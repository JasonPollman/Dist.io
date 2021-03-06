/**
 * @file
 * The Slave class. A representation of the slave on the "front end".
 * Spawns child processes using ChildProcess.fork.
 * @copyright © 2016 Jason James Pollman
 */
'use strict';
require('proto-lib').get('_');
const minimist = require('minimist');

/**
 * @module DistIO/Slave
 */

const EventEmitter = require('events').EventEmitter;
const fork = require('child_process').fork;
const lib = require('proto-lib').get('_');
const fs = require('fs');
const path = require('path');

const Request = require('./Request');
const Response = require('./Response');
const TimeoutResponse = require('./TimeoutResponse');
const Commands = require('./Commands');
const SlaveArray = require('./SlaveArray');

/**
 * A default timeout. If set using Master#defaultTimeout, every request will have this timeout
 * period set on it, unless the meta or slave overrides it.
 * @type {Number|null}
 */
let defaultTimeout = null;

/**
 * A default 'catchAll' value. If set using Master#shouldCatchAll, every request will treat response errors
 * like errors, unless the meta or slave overrides it.
 * @type {Boolean|null}
 */
let shouldCatchAll = null;

/**
 * Store valid slave file paths to prevent fs.stat I/O on the same path multiple times.
 * Keyed by filename.
 * @type {Object<Boolean>}
 */
const validPaths = {};

/**
 * Used by the Slave class to protect properties.
 */
const settings = Symbol();

/**
 * The time, now.
 * @return {Array<Number>} A process.hrtime tuple.
 */
const INIT = process.hrtime();

/**
 * A "secret time" that is used to verify that a message is indeed a slave message.
 * This will be added to each outgoing request, and a property of each incoming response.
 * @type {Number}
 */
const SECRET_NUMBER = INIT[0] * 1e9 + INIT[1];

/**
 * A "secret id" used to verify that a message is indeed a slave message.
 * This will be added to each outgoing request, and a property of each incoming response.
 * @type {String}
 */
const SECRET_ID = lib.string.randomString(50);

/**
 * An object of pending requests, keyed by Slave id.
 * @type {Object<Object<Request>>}
 */
const pendingRequests = {};

/**
 * Stores active slaves.
 * @type {Object}
 */
const slaves = {};

/**
 * An accumulator. Each time a new slave is created, it is assigned this number, then it increments.
 * @type {Number}
 */
let slaveIds = 0;

/**
 * Sends the reqponse for the message "m".
 * @param {Object} m The message recieved from the slave process.
 * @return {undefined}
 */
function respondToRequest(m) {
  if (pendingRequests[m.request.for] && pendingRequests[m.request.for][m.request.rid]) {
    const request = pendingRequests[m.request.for][m.request.rid];
    request.clearTimeout();
    // Create a new response object from the message.
    const response = new Response(m);
    // Remove the message from the pending queue.
    delete pendingRequests[m.request.for][m.request.rid];

    if (request.hasTimedout(response)) {
      // Ignore the message, no op...
    } else if (request.callback instanceof Function) {
      // Invoke the callback for the message.
      request.callback.call(response, response, request);
    }
  }
}

/**
 * Removes all in-file reference to this slave, and close it.
 * @param {Slave} slave The slave to "cleanup".
 * @return {undefined}
 */
function cleanupSlaveReferences(slave) {
  slave[settings].process.unref();
  slave[settings].exited = true;
  slave[settings].closed = true;
  delete slaves[slave.id];

  // Handle any outstanding requests that might be lingering...
  if (pendingRequests[slave.id]) {
    pendingRequests[slave.id]._.every(req => {
      respondToRequest({
        title: 'SlaveIOResponse',
        sent: Date.now(),
        request: req.raw,
        error: {
          name: 'RequestAborted',
          message: `${slave.toString()} was killed or closed during request.`,
        },
        data: undefined,
        [SECRET_ID]: SECRET_NUMBER,
      });
      return true;
    });
    delete pendingRequests[slave.id];
  }
}

/**
 * True if the message recieved is a "slave message", or one sent by a slave process.
 * @param {Object} m The message data.
 * @return {Boolean} True if the message is a slave message, false otherwise.
 */
function isSlaveMessage(m) {
  if (
    typeof m === 'object'
    && m[SECRET_ID] === SECRET_NUMBER
    && m.sent
    && m.title === 'SlaveIOResponse'
    && typeof m.request === 'object'
  ) {
    if (typeof m.request.for === 'number'
      && typeof m.request.rid === 'number'
      && typeof m.request.command === 'string'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if the message is from the master process.
 * @param {Object} m The message to inspect.
 * @return {Boolean} True if the message if from the master, false otherwise.
 */
function isMasterMessage(m) {
  return typeof m === 'object'
    && typeof m.rid === 'number'
    && m.title === 'MasterIOMessage'
    && typeof m.for === 'number'
    && typeof m.command === 'string'
    && typeof m.secretNumber === 'number'
    && typeof m.secretId === 'string';
}

/**
 * True if the message recieved is a "slave exception message", or one sent by a slave process.
 * @param {Object} m The message data.
 * @return {Boolean} True if the message is a slave exception message, false otherwise.
 */
function isSlaveExceptionMessage(m) {
  if (typeof m.sent === 'number'
    && m.title === 'SlaveIOException'
    && typeof m.error === 'object'
    && typeof m.from === 'number'
  ) {
    return true;
  }
  return false;
}

/**
 * Determines if the slave can execute tasks. And used to check for shutdown conditions.
 * @param {Slave} slave The slave to deterine interactivity status.
 * @return {Boolean} True if the slave can interact, false otherwise.
 */
function canInteract(slave) {
  return !slave[settings].spawnError
    && !slave[settings].exited
    && !slave[settings].closed
    && !slave[settings].rejectingRequests;
}

/**
 * Listens for messages received from the slave.
 * @param {*} m The message data.
 * @return {undefined}
 */
function slaveMessageListener(m) {
  if (isSlaveMessage(m)) {
    respondToRequest(m);
  } else if (isSlaveExceptionMessage(m)) {
    const e = new Error(m.error.message || 'Unknown error');
    e.stack = m.error.stack;
    e.name = m.error.name;
    if (slaves[m.from]) {
      /**
       * Emitted when a slave exception occurs.
       * @event uncaughtException
       * @argument {Error} The error emitted from the slave.
       */
      if (slaves[m.from].listenerCount('uncaughtException') === 0) {
        throw e;
      } else {
        slaves[m.from].emit('uncaughtException', e);
      }
    }
  }
}

/**
 * Sets up various event handlers for a newly created slave process.
 * @param {Slave} slave The Slave object to setup the event handler for.
 * @param {ChildProcess} child The actual child process associated with this slave.
 * @param {Object} options Options to initialize the slave with.
 * @return {undefined}
 */
function initializeSlaveEventsWithSlaveAndChildProcess(slave, child, options) {
  const setSlaveExitedToTrue = () => {
    /**
     * Emitted when the actual slave ChildProcess exits.
     * @event slave child process exited
     */
    slave.emit('slave child process exited');
    cleanupSlaveReferences(slave);
  };

  child.on('message', slaveMessageListener);

  // If the child fails to spawn...
  child.on('error', function onSpawnError(e) { // eslint-disable-line prefer-arrow-callback
    slave[settings].spawnError = e;
    cleanupSlaveReferences(slave);

    if (slave.listenerCount('spawn error') === 0) {
      throw e;
    } else {
      /**
       * Emited when the slave process fails to properly spawn.
       * @argument {Error} e The error tht occured during spawn.
       * @event spawn error
       */
      slave.emit('spawn error', e);
    }
  });

  // Set connected to false when the child closes, exits, or is disconnected.
  child.on('close', () => {
    setSlaveExitedToTrue();
    /**
     * Emited when the slave process closes.
     * @event closed
     */
    slave.emit('closed');
  });

  child.on('exit', () => {
    setSlaveExitedToTrue();
    /**
     * Emited when the slave process exits (is either killed or closed).
     * @event exited
     */
    slave.emit('exited');
  });

  if (typeof options.forkOptions === 'object' && options.forkOptions.silent === true) {
    /**
     * Emited when the slave process writes to the stdout. This event is only triggered
     * if forkOptions.slient: true was passed to the slave initialization options.
     * @event stdout
     * @argument {Buffer} data The data from the slave's stdout
     */
    child.stdout.on('data', d => slave.emit('stdout', d));
    /**
     * Emited when the slave process writes to the stderr. This event is only triggered
     * if forkOptions.slient: true was passed to the slave initialization options.
     * @event stderr
     * @argument {Buffer} data The data from the slave's stdout
     */
    child.stderr.on('data', d => slave.emit('stderr', d));
  }
}

/**
 * Sends a message to the child process.
 * @param {String} command The "name" or "command" of the message.
 * @param {Slave} slave The slave object to send the message to.
 * @param {*} meta The message's metadata.
 * @param {*} data The message's data.
 * @param {Function} done The callback to invoke when the message response is received.
 * @return {undefined}
 */
function sendCommandMessageToChildWithMetadata(command, slave, meta, data, done) {
  const request = new Request(slave, command, meta, data, SECRET_ID, SECRET_NUMBER, settings, done);

  // If a timeout is set on the metadata, set a timeout handler...
  request.onTimeout(() => {
    // Remove the request from the pending heap...
    if (pendingRequests[slave.id]) delete pendingRequests[slave.id][request.id];
    // Create a new Timeout response...
    const response = new TimeoutResponse(slave, request);
    request.callback.call(response, response, request);
  });

  // Add the request to the pending heap...
  if (!pendingRequests[slave.id]) pendingRequests[slave.id] = {};
  pendingRequests[slave.id][request.rid] = request;

  /**
   * Allows the user to intercept messages prior to sending.
   * @event pre-send
   * @argument {Request} request The request object to be sent
   */
  slave.emit('pre-send', request);

  // Send the message to the child...
  request.send();
  slave[settings].sent++;

  /**
   * Emitted just after sending the request to the slave object.
   * @event post-sent
   * @argument {Request} request The request object that was sent.
   */
  slave.emit('post-send', request);
}

/**
 * A slave abstraction object.
 * Represents the slave in the master process.
 * @extends EventEmitter
 * @constructor
 * @throws {ReferenceError} If the argument passed to the "file" parameter isn't a string.
 * @throws {TypeError} If the argument passed to the "file" parameter isn't a valid regular file,
 * or if fs.statSync threw an error trying to open it.
 */
class Slave extends EventEmitter {
  /**
   * Returns the slave with the given id.
   * @param {Number} id The id of the slave to retrieve.
   * @return {Slave} The slave with the provided it, if it exists.
   */
  static getSlaveWithId(id) {
    return slaves[id] || null;
  }

  /**
   * @return {Function} An outlet for the private "isSlaveMessage" method.
   */
  static get isSlaveMessage() {
    return isSlaveMessage;
  }

  /**
   * @return {Function} An outlet for the private "isSlaveMessage" method.
   */
  static get isMasterMessage() {
    return isMasterMessage;
  }

  /**
   * @return {Function} An outlet for the private "isSlaveExceptionMessage" method.
   */
  static get isSlaveExceptionMessage() {
    return isSlaveExceptionMessage;
  }

  /**
   * Get's the protected symbol. Must be calling passing in a Slave instance.
   * @param {Slave} o An instanceof Slave to get the symbol using.
   * @return {Symbol} The "protected" symbol.
   */
  static protected(o) {
    if (!(o instanceof Slave)) throw new Error('Cannot access protected members from non-Slave instance!');
    return settings;
  }

  /**
   * Cleans up all interal references to the slave (freeing it from this file for GC).
   * @param {Slave} o The slave instance to clean up.
   * @return {undefined}
   */
  static cleanupSlaveReferences(o) {
    if (!(o instanceof Slave)) throw new Error('Cannot access protected members from non-Slave instance!');
    return cleanupSlaveReferences(o);
  }

  /**
   * Returns the "pendingRequests" object. Which holds all available pending requests.
   * @return {Object<Array>} An object which contains pending requests keyed by Slave id.
   */
  static get pendingRequests() {
    return pendingRequests;
  }

  /**
   * Returns the slaves with the given file path.
   * @param {String} fp The id of the slave to retrieve.
   * @return {SlaveArray<Slave>} The slave with the provided path, if any exist.
   */
  static getSlavesWithPath(fp) {
    const slavesAtPath = new SlaveArray();
    if (typeof fp !== 'string') return slavesAtPath;

    fp = path.resolve(path.normalize(fp));

    slaves._.every(s => {
      if (s.location === fp) slavesAtPath.push(s);
      return true;
    });
    return slavesAtPath;
  }

  /**
   * Returns all the slaves in the given group.
   * @param {String} g The name of the group to get the slaves from.
   * @return {SlaveArray<Slave>} An array of slaves belonging to the given group
   */
  static getSlavesInGroup(g) {
    const group = new SlaveArray();
    if (typeof g !== 'string') return group;

    slaves._.every((s) => {
      if (s.group === g) group.push(s);
      return true;
    });
    return group;
  }

  /**
   * Gets the slave with the given alias.
   * @param {String} alias The alias to lookup the slave with.
   * @return {Slave} The slave with the provided alias, if it exists.
   */
  static getSlaveWithAlias(alias) {
    if (typeof alias !== 'string') return null;

    return slaves._.any(slave => {
      if (alias === slave.alias) return slave;
      return undefined;
    }) || null;
  }

  /**
   * Attempts to get a slave first by checking to see if the given argument for parameter "idOrAliasOrSlave" is a
   * slave, then by attempting to get the slave by id, then alias.
   * @param {Slave|Number|String} idOrAliasOrSlave A slave, slave id, or slave alias.
   * @return {Slave|null} The slave, if it was resolved, null otherwise.
   */
  static getSlave(idOrAliasOrSlave) {
    if (!idOrAliasOrSlave && idOrAliasOrSlave !== 0) return null;

    let s = idOrAliasOrSlave instanceof Slave
      ? idOrAliasOrSlave
      : Slave.getSlaveWithId(idOrAliasOrSlave);

    s = s instanceof Slave ? s : Slave.getSlaveWithAlias(idOrAliasOrSlave);

    return s || null;
  }

  /**
   * The last id assigned to a slave.
   * @return {Number} The last used slave id.
   */
  static get lastId() {
    return slaveIds;
  }

  /**
   * Returns a shallow copy of the slaves object as an array.
   * @return {Array<Slaves>} All slaves.
   */
  static getAllSlaves() {
    return new SlaveArray(...slaves._.toArray());
  }

  /**
   * Returns all idle slaves.
   * @return {Array<Slaves>} All idle slaves.
   */
  static getAllIdleSlaves() {
    return new SlaveArray(...slaves._.toArray().filter(s => s.isIdle));
  }

  /**
   * Returns all busy slaves.
   * @return {Array<Slaves>} All busy slaves.
   */
  static getAllBusySlaves() {
    return new SlaveArray(...slaves._.toArray().filter(s => s.isBusy));
  }

  /**
   * Returns the least busy slave in the given list of slaves.
   * @return {Slave} The least busy slave.
   */
  static getLeastBusy(...slaveList) {
    if (slaveList.length === 0) return null;
    return slaveList._.min(s => (s instanceof Slave ? s.pendingRequests : Number.MAX_VALUE));
  }

  /**
   * Sets the default timeout period for messages.
   * @param {Number|null} timeout The timeout period to set.
   */
  static set defaultTimeout(timeout) {
    if (typeof timeout === 'number' && timeout > 0) {
      defaultTimeout = timeout;
    } else if (!timeout) {
      defaultTimeout = null;
    }
  }

  /**
   * @return {Number|null} The default timeout period for all slaves.
   */
  static get defaultTimeout() {
    return defaultTimeout;
  }

  /**
   * Sets the default "catchAll" value.
   * @param {Boolean|null} value The value to set.
   */
  static set shouldCatchAll(value) {
    if (typeof value === 'boolean') {
      shouldCatchAll = value;
    } else if (!value) {
      shouldCatchAll = null;
    }
  }

  /**
   * @return {Boolean|null} The default "catchAll" setting for all slaves.
   */
  static get shouldCatchAll() {
    return shouldCatchAll;
  }

  /**
   * Slave constructor.
   * @param {String} loc The file location to the slave js file.
   * @param {Object} opts Options to init the slave with.
   * @return {Slave} The current slave instance.
   */
  constructor(loc, opts) {
    super();
    const options = typeof opts === 'object' ? opts : {};

    if (!loc || typeof loc !== 'string') {
      throw new TypeError(
        'Slave constructor argument #0 requires a non-empty string, but got: ' +
        `"${typeof loc === 'string' ? '' : typeof loc}"`
      );
    }

    loc = this.checkLocation(loc);

    // Check for a slave options array...
    if (!(options.args instanceof Array)) options.args = [];
    const args = options.args._.clone();
    const parsedArgs = minimist(args);
    const slaveId = typeof parsedArgs['dist-io-slave-id'] === 'number'
      ? parsedArgs['dist-io-slave-id']
      : slaveIds++;

    // Add in some custom cli args...
    if (!parsedArgs['dist-io-slave-id'] && parsedArgs['dist-io-slave-id'] !== 0) {
      args.push(`--dist-io-slave-id=${slaveId}`);
    }

    /**
     * Options for this slave instance.
     * @namespace SlaveOptions
     * @type {Object}
     */
    this[settings] = {
      /**
       * The numeric slave id assigned to this slave.
       * @type {Number}
       */
      id: slaveId,

      /**
       * An optional alias assigned to the
       * @type {String|null}
       */
      alias: typeof options.alias === 'string' ? options.alias : this._.uniqueId(),

      /**
       * The filepath to the slave process.
       * @type {String}
       */
      location: loc,

      /**
       * True if the child has exited (or closed), false otherwise.
       * @type {Boolean}
       */
      exited: false,

      /**
       * The actual ChildProcess instance this Slave object will create.
       * @type {ChildProcess}
       */
      process: null,

      /**
       * Once set to true, no more messages will be sent to this slave process.
       * This will allow it to exit gracefully.
       * @type {Boolean}
       */
      closed: false,

      /**
       * True if the child failed to spawn, false otherwise.
       * @type {Boolean}
       */
      spawnError: false,

      /**
       * Used by shutdown to signify that the slave can no longer recieve incoming messages.
       * @type {Boolean}
       */
      rejectingRequests: false,

      /**
       * The total number of messages sent by the master process to the slave process.
       * @type {Number}
       */
      sent: 0,

      /**
       * The total number of messages received by the slave process.
       * @type {Number}
       */
      received: 0,

      /**
       * The group this slave belongs to.
       * @type {String}
       */
      group: options.group || 'global',

      /**
       * The default timeout period for just this slave.
       * @type {Number|null}
       */
      defaultTimeout: null,

      /**
       * The default "catchAll" value for this slave.
       * @type {Boolean|null}
       */
      shouldCatchAll: null,
    };

    slaves._.every((s) => {
      if (s.alias === this[settings].alias) throw new Error(`Slave with alias "${options.alias}" already exists.`);
      return true;
    });

    if (!parsedArgs['dist-io-slave-alias']) args.push(`--dist-io-slave-alias=${this[settings].alias}`);

    if (typeof options.title === 'string' && !args['dist-io-slave-title']) {
      args.push(`--dist-io-slave-title=${options.title}`);
    }

    // Add this slave to the slave store...
    slaves[this.id] = this;

    if (typeof options.onSpawnError === 'function') this.on('spawn error', options.onSpawnError);
    if (typeof options.onUncaughtException === 'function') this.on('uncaughtException', options.onUncaughtException);

    // Fork the child process...
    this.initProcess(loc, options, args);
  }

  /**
   * Spawns an initializes the slave process.
   * @param {String} file The file path to the file to start the slave using.
   * @param {Object} options Options to fork the slave with.
   * @param {Array<String>} args Arguments to fork the slave with.
   * @return {Slave} A self reference to the current slave instance.
   */
  initProcess(file, options, args) {
    this[settings].process = fork(file, args, options.forkOptions);
    initializeSlaveEventsWithSlaveAndChildProcess(this, this[settings].process, options);
    return this;
  }

  /**
   * Checks that the file location used to initialize the slave exists.
   * We use sync here, as this is used in the constructor.
   * @param {String} file The file path to inspect.
   * @return {String} The "adjusted" filepath.
   * @throws {TypeError} If the file isn't a file.
   */
  checkLocation(file) {
    file = path.resolve(path.normalize(file));
    // Do some checking on the spawn file.
    // This might save some problems later.
    // The results are cached per file, to prevent subsequent disk I/O.
    if (!validPaths[file]) {
      let stat;
      try {
        stat = fs.statSync(file);
      } catch (e) {
        throw new TypeError(`Slave constructor argument #0 requires a regular file, but received error: ${e.message}`);
      }

      if (!stat.isFile()) {
        throw new TypeError(`Slave constructor argument #0 requires a regular file, but ${file} isn't a file.`);
      } else {
        validPaths[file] = true;
      }
    }
    return file;
  }

  /**
   * Sets the default timeout period for messages for this slave instance.
   * @param {Number|null} timeout The timeout period to set.
   */
  set defaultTimeout(timeout) {
    if (typeof timeout === 'number' && timeout > 0) {
      this[settings].defaultTimeout = timeout;
    } else if (!timeout) {
      this[settings].defaultTimeout = null;
    }
  }

  /**
   * @return {Number|null} The default timeout period for this slave.
   */
  get defaultTimeout() {
    return this[settings].defaultTimeout;
  }

  /**
   * Sets the default "catchAll" value for this slave.
   * @param {Boolean|null} value The value to set.
   */
  set shouldCatchAll(value) {
    if (typeof value === 'boolean') {
      this[settings].shouldCatchAll = value;
    } else if (!value) {
      this[settings].shouldCatchAll = null;
    }
  }

  /**
   * @return {ChildProcess|PseudoChildProcess} The ChildProcess associated with this slave.
   */
  get childProcess() {
    return this[settings].process;
  }

  /**
   * @return {Boolean|null} The default "catchAll" setting for this slave.
   */
  get shouldCatchAll() {
    return this[settings].shouldCatchAll;
  }

  /**
   * Get's the name of the group the slave belongs to.
   * @return {String} The slave's group name.
   */
  get group() {
    return this[settings].group;
  }

  /**
   * The number of messages the master has sent to the slave process.
   * @return {Number} The total sent messages.
   */
  get sent() {
    return this[settings].sent;
  }

  /**
   * The number of messages the master has received from the slave process.
   * @return {Number} The total received messages.
   */
  get received() {
    return this[settings].received;
  }

  /**
   * @return {Boolean} True if the slave is remote, false othewise.
   */
  get isRemote() {
    return false;
  }

  /**
   * Sets the group this slave belongs to.
   * @param {String} g The name of the new group for this slave.
   */
  set group(g) {
    if (typeof g === 'string') this[settings].group = g;
  }

  /**
   * Returns the slave's id.
   * @return {Number} The slave's id.
   */
  get id() {
    return this[settings].id;
  }

  /**
   * The slave's process id.
   * @return {Number} The slave's PID.
   */
  get pid() {
    return this[settings].process.pid;
  }

  /**
   * Alias for the slave's id.
   * @return {Number} The slave's id.
   */
  get rank() {
    return this[settings].id;
  }

  /**
   * Returns the slave's alias
   * @return {Number} The slave's alias.
   */
  get alias() {
    return this[settings].alias;
  }

  /**
   * Returns the slave's filepath.
   * @return {String} The slave's code path.
   */
  get location() {
    return this[settings].location;
  }

  /**
   * Returns the slave's filepath.
   * @return {String} The slave's code path.
   */
  get path() {
    return this[settings].location;
  }

  /**
   * Determines if the slave is not busy (idle)
   * @return {Boolean} True if the slave is idle, false otherwise.
   */
  get isIdle() {
    return this.pendingRequests === 0;
  }

  /**
   * Determines if the slave is busy
   * @return {Boolean} True if the slave is budy, false otherwise.
   */
  get isBusy() {
    return !this.isIdle;
  }

  /**
   * Gets the number of pending request for this slave.
   * @return {Number} The number of pending requests for this slave.
   */
  get pendingRequests() {
    if (pendingRequests[this.id]) {
      return pendingRequests[this.id]._.size();
    }
    return 0;
  }

  /**
   * Returns the connection state of the slave process.
   * @return {Boolean} True if messages can still be sent/received from the child, false otherwise.
   */
  get isConnected() {
    return this[settings].process.connected;
  }

  /**
   * Returns the process run state of the child process.
   * @return {Boolean} True if the process is running, false otherwise.
   */
  get hasExited() {
    return this[settings].exited;
  }

  /**
   * Returns the spawn error, if one occured.
   * @return {Error|null} The error that was recieved during spawn, if any.
   */
  get spawnError() {
    return this[settings].spawnError || null;
  }

  /**
   * Allows us to chain promises against instantation of a Slave object.
   * @param {Function} cb The callback to invoke.
   * @return {Promise} A promise for completion.
   */
  then(cb) {
    if (cb instanceof Function) {
      const res = cb.call(this, this);
      if (res instanceof Promise) return res;
      return new Promise(resolve => {
        resolve(res);
      });
    }
    return new Promise(resolve => {
      resolve();
    });
  }

  /**
   * A string representation of this object.
   * @return {String} The string representation of this Slave object.
   */
  toString() {
    return `Slave id=${this[settings].id}, ` +
           `alias=${this[settings].alias}, ` +
           `sent=${this[settings].sent}, ` +
           `received=${this[settings].received}`;
  }

  /**
   * Sends an acknowledgment to the slave.
   * @param {Object=} meta Meta data to send to the slave along with this acknowledgment.
   * @return {Promise} A promise for completion.
   */
  ack(meta) {
    return this.exec(Commands.ACK, null, typeof meta === 'object' && meta ? meta : { timeout: 10000 });
  }

  /**
   * Sends an noop command to the slave.
   * @param {Object=} meta Meta data to send to the slave along with this acknowledgment.
   * @return {Promise} A promise for completion.
   */
  noop(meta) {
    return this.exec(Commands.NULL, null, typeof meta === 'object' && meta ? meta : { timeout: 10000 });
  }

  /**
   * Forcefully kills the slave process.
   * @param {String=} signal The signal to kill the slave with.
   * @return {Slave} The current Slave instance.
   */
  kill(signal) {
    if (!this[settings].spawnError && !this[settings].exited) {
      signal = typeof signal === 'string' ? signal : 'SIGKILL';
      this[settings].process.kill(signal);
      /**
       * @event killed
       * @argument {String} signal The signal sent to kill the slave.
       * Triggered when the slave is killed (or a singal is sent to it).
       */
      this.emit('killed', signal);
      if (signal === 'SIGKILL' || signal === 'SIGSTOP') cleanupSlaveReferences(this);
    }
    return this;
  }

  /**
   * Gracefully shuts down the child process.
   * @param {Function=} done A callback for completion.
   * @return {Promise} A promise for completion.
   */
  close(...args) {
    const done = args._.getCallback();
    return new Promise((resolve, reject) => {
      if (!this[settings].spawnError && !this[settings].exited && !this[settings].closed) {
        this[settings].closed = true;
        sendCommandMessageToChildWithMetadata(Commands.EXIT, this, null, null, response => {
          this[settings].gotExitResponse = true;
          cleanupSlaveReferences(this);

          done.call(this, response.error, response.value);
          return response.error ? reject(response.error) : resolve(response.value);
        });
      } else {
        resolve(true);
      }
    });
  }

  /**
   * Gracefully shuts down the slave, after all remaning messages are received.
   * @param {Function=} done A callback for completion.
   * @return {Promise} A promise for completion.
   */
  shutdown(...args) {
    const done = args._.getCallback();
    this[settings].rejectingRequests = true;
    delete slaves[this.id];

    if (this.pendingRequests === 0) return this.close(done);

    /**
     * Emitted when the slave is scheduled for shutdown.
     * @event shutting-down
     * @argument {Slave} slave The slave.
     * @argument {...*} args The arguments passed to shutdown
     */
    this.emit('shutdown', this, ...args);
    return new Promise((resolve, reject) => {
      this.on('response', () => {
        if (this.pendingRequests === 0) {
          this.close()
            .then(status => {
              done.call(this, null, status);
              resolve(status);
            })
            .catch(e => {
              done.call(this, e, null);
              reject(e);
            });
        }
      });
    });
  }

  /**
   * Alias for Slave#close.
   * @param {...*} args Arguments to send to Slave#close
   * @return {Promise} A promise for completion.
   */
  exit(...args) {
    return this.close(...args);
  }

  /**
   * Sends a command to the slave to execute...
   * @param {String} command The command for the slave to execute
   * @param {Object|String|Number|Boolean|Array|null} data The data to send to the slave.
   * @param {Object=} metadata "Options" to send to the slave.
   * @return {Promise} A promise for completion.
   */
  exec(command, data, metadata) {
    const done = arguments._.getCallback(); // eslint-disable-line prefer-rest-params
    const meta = metadata && typeof metadata === 'object' ? metadata : {};

    if (data instanceof Function) data = null;

    return new Promise((resolve, reject) => {
      // Check to make sure the slave hasn't exited, or that it didn't spawn.
      if (canInteract(this)) {
        if (typeof command !== 'string' && typeof command !== 'symbol') {
          if (typeof command === 'number') {
            // Convert the command to a string...
            command = command.toString();
          } else {
            // Bad command, resolve with error...
            const err = new TypeError(
              `Slave#exec expected argument #0 to be a command string, but got: ${typeof command}`
            );

            reject(err);
            done.call(this, err, null);
            return;
          }
        }

        // Set defaults for timeout based on meta, then slave, then master...
        if ((!meta.timeout || !meta.timeout._.isNumeric())) {
          meta.timeout = this.defaultTimeout || defaultTimeout || undefined;
        }

        // Set defaults for catchAll based on meta, then slave, then master...
        if (meta.catchAll === undefined) {
          meta.catchAll = typeof this.shouldCatchAll === 'boolean' // eslint-disable-line no-nested-ternary
            ? this.shouldCatchAll
            : typeof shouldCatchAll === 'boolean'
              ? shouldCatchAll
              : undefined;
        }

        // Send the message to the slave process...
        sendCommandMessageToChildWithMetadata(command, this, meta, data,
          // Invoked when the message is received, or times out if the meta.timeout property is set.
          (response, request) => {
            this[settings].received++;

            /**
             * Emitted everytime the slave receives a response to a request.
             * @event response
             * @argument {Response} request The resposne from the request.
             * @argument {Request} request The request object originally sent to the slave.
             */
            this.emit('response', response, request);
            if (response.error && typeof response.error === 'object' && meta && meta.catchAll) {
              // Response errors rejected...
              reject(response.error);
              done.call(response, response.error, null, request);
            } else {
              // Response errors resolved...
              resolve(response);
              done.call(response, null, response, request);
            }
          });
      } else { // The slave has been shutdown, reject with error...
        const err = new Error(`${this.toString()} has been shutdown, closed, or killed.`);
        reject(err);
        done.call(this, err, null, this);
      }
    });
  }

  /**
   * An alias for Slave#exec
   * @param {...*} Arguments to pass to Slave#exec
   * @return {Promise} A promise for completion.
   */
  do(...args) {
    return this.exec(...args);
  }
}

/**
 * The Slave class.
 * @type {Slave}
 */
module.exports = Slave;
