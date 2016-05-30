/**
 * @file
 * The Slave class. A representation of the slave on the "front end".
 * Spawns child processes using ChildProcess.fork.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';

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

/**
 * Store valid slave file paths to prevent fs.stat I/O on the same path multiple times.
 * Keyed by filename.
 * @type {Object<Boolean>}
 */
const validPaths = {};

/**
 * Used by the Slave class to privatize properties.
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
 * Removes all in-file reference to this slave, and close it.
 * @param {Slave} slave The slave to "cleanup".
 * @return {undefined}
 */
function cleanupSlaveReferences(slave) {
  slave[settings].process.unref();
  slave[settings].exited = true;
  slave[settings].closed = true;
  delete slaves[slave.id];
  delete pendingRequests[slave.id];
}

/**
 * True if the message recieved is a "slave message", or one sent by a slave process.
 * @param {Object} m The message data.
 * @return {Boolean} True if the message is a slave message, false otherwise.
 */
function isSlaveMessage(m) {
  if (m[SECRET_ID] === SECRET_NUMBER && m.sent && m.title === 'SlaveIOResponse' && typeof m.request === 'object') {
    if (typeof m.request.for === 'number'
      && typeof m.request.rid === 'number'
      && typeof m.request.command === 'string') {
      return true;
    }
  }
  return false;
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
 * Listens for messages received from the slave.
 * @param {*} m The message data.
 * @return {undefined}
 */
function slaveMessageListener(m) {
  if (typeof m === 'object') {
    if (isSlaveMessage(m)) {
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
    } else if (isSlaveExceptionMessage(m)) {
      const e = new Error(m.error.message || 'Unknown error');
      e.stack = m.error.stack;
      e.name = m.error.name;
      if (slaves[m.from]) slaves[m.from][settings].onUncaughtException(e);
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
    cleanupSlaveReferences(slave);
  };

  child.on('message', slaveMessageListener);

  // If the child fails to spawn...
  child.on('error', function onSpawnError(e) { // eslint-disable-line prefer-arrow-callback
    child.removeListener('error', onSpawnError);
    slave[settings].spawnError = e;
    cleanupSlaveReferences(slave);

    // Call user onSpawnError function...
    if (options.onSpawnError instanceof Function) options.onSpawnError.call(slave, e);

    // Add a new generic error listener
    child.on('error', () => {
      cleanupSlaveReferences(slave);
      if (options.onError instanceof Function) options.onError.call(slave, e);
    });
  });

  // Set connected to false when the child closes, exits, or is disconnected.
  child.on('close', setSlaveExitedToTrue);
  child.on('exit', setSlaveExitedToTrue);
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
  let request;
  switch (command) {
    case Commands.EXIT:
      request = new Request(slave, Commands.EXIT, meta, data, SECRET_ID, SECRET_NUMBER, settings, done);
      break;

    case Commands.ACK:
      request = new Request(slave, Commands.ACK, meta, data, SECRET_ID, SECRET_NUMBER, settings, done);
      break;

    case Commands.NULL:
      request = new Request(slave, Commands.NULL, meta, data, SECRET_ID, SECRET_NUMBER, settings, done);
      break;

    default:
      request = new Request(slave, command, meta, data, SECRET_ID, SECRET_NUMBER, settings, done);
  }

  // If a timeout is set on the metadata, set a timeout handler...
  request.onTimeout(() => {
    // Remove the request from the pending heap...
    delete pendingRequests[slave.id][request.id];
    // Create a new Timeout response...
    const response = new TimeoutResponse(slave, request);
    request.callback.call(response, response, request);
  });

  // Add the request to the pending heap...
  if (!pendingRequests[slave.id]) pendingRequests[slave.id] = {};
  pendingRequests[slave.id][request.rid] = request;

  /**
   * Allows the user to intercept messages prior to sending.
   * @event Slave#pre-send
   * @property {Request} request The request object that to be sent.
   */
  slave.emit('pre-send', request);

  // Send the message to the child...
  request.send();
  slave[settings].sent++;

  /**
   * Emitter just after sending the request to the slave object.
   * @event Slave#post-sent
   * @property {Request} request The request object that to be sent.
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
   * Returns all the slaves in the given group.
   * @param {String} g The name of the group to get the slaves from.
   * @return {ResponseArray<Slave>} An array of slaves belonging to the given group
   */
  static getSlavesInGroup(g) {
    const group = [];
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
    idOrAliasOrSlave = idOrAliasOrSlave instanceof Slave ? idOrAliasOrSlave : Slave.getSlaveWithId(idOrAliasOrSlave);
    idOrAliasOrSlave = idOrAliasOrSlave instanceof Slave ? idOrAliasOrSlave : Slave.getSlaveWithAlias(idOrAliasOrSlave);
    return idOrAliasOrSlave || null;
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
   * @return {Array<Slaves>} [description]
   */
  static getAllSlaves() {
    return slaves._.toArray();
  }

  /**
   * Slave constructor.
   * @param {String} file The filepath to the slave js file.
   * @param {Object} opts Options to init the slave with.
   * @return {Slave} The current slave instance.
   */
  constructor(file, opts) {
    super();
    const options = typeof opts === 'object' ? opts : {};

    if (!file || typeof file !== 'string') {
      throw new ReferenceError(
        `Slave constructor argument #0 requires a non-empty string, but got: "${file ? file.toString() : file}"`
      );
    }

    file = path.resolve(file);

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
      id: slaveIds++,

      /**
       * An optional alias assigned to the
       * @type {String|null}
       */
      alias: typeof options.alias === 'string' ? options.alias : this._.uniqueId(),

      /**
       * The filepath to the slave process.
       * @type {String}
       */
      location: file,

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
       * Handles slave exceptions
       * @param {Error} e The slave's error.
       * @return {undefined}
       */
      onUncaughtException: options.onUncaughtException instanceof Function
        ? options.onUncaughtException
        : (e) => { throw e; },

      /**
       * The group this slave belongs to.
       * @type {String}
       */
      group: options.group || 'global',
    };

    slaves._.every((s) => {
      if (s.alias === this[settings].alias) throw new Error(`Slave with alias "${options.alias}" already exists.`);
      return true;
    });

    // Add this slave to the slave store...
    slaves[this.id] = this;

    // Check for a slave options array...
    if (!(options.args instanceof Array)) options.args = [];
    const args = options.args._.clone();

    // Add in some custom cli args...
    args.push(
      `--dist-io-slave-id=${this[settings].id}`,
      `--dist-io-slave-alias=${this[settings].alias}`
    );

    if (typeof options.title === 'string') {
      args.push(`--dist-io-slave-title=${options.title}`);
    }

    // Fork the child process...
    this[settings].process = fork(file, args, options.forkOptions || { stdio: 'pipe' });
    initializeSlaveEventsWithSlaveAndChildProcess(this, this[settings].process, options);
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
    return this[settings].sent;
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
   * The function to invoke if the child throws an exception.
   * @param {Function} f A callback function.
   * @return {undefined}
   */
  set onUncaughtException(f) {
    if (typeof f === 'function') this[settings].onUncaughtException = f;
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
      this[settings].process.kill(signal || 'SIGKILL');
      cleanupSlaveReferences(this);
      /**
       * @event Slave#killed
       * @property {String} signal The signal sent to kill the slave.
       * Triggered when the slave is killed (or a singal is sent to it).
       */
      this.emit('killed', signal || 'SIGKILL');

      /**
       * Emitted when slave interaction is no longer possible.
       * @event Slave#exited
       */
      this.emit('exited');
    }
    return this;
  }

  /**
   * Gracefully shuts down the child process.
   * @param {Function=} done A callback for completion.
   * @return {Promise} A promise for completion.
   */
  close(...args) {
    const done = [...args]._.getCallback();
    return new Promise((resolve, reject) => {
      if (!this[settings].spawnError && !this[settings].exited && !this[settings].closed) {
        this[settings].closed = true;
        sendCommandMessageToChildWithMetadata(Commands.EXIT, this, null, null, response => {
          this[settings].gotExitResponse = true;
          cleanupSlaveReferences(this);

          /**
           * @event Slave#closed
           * @property {Error|null} err An error, if one occured during shutdown.
           * @property {String} status The shutdown status sent by the slave.
           * Triggered when the slave is shutdown.
           */
          this.emit('closed', response.error, response.value);
          this.emit('exited');

          done.call(this, response.error, response.value);
          return response.error ? reject(response.error) : resolve(response.value);
        });
      } else {
        resolve(true);
      }
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
    const meta = typeof metadata === 'object' ? metadata : {};

    if (data instanceof Function) data = null;

    return new Promise((resolve, reject) => {
      // Check to make sure the slave hasn't exited, or that it didn't spawn.
      if (!this[settings].spawnError && !this[settings].exited && !this[settings].closed) {
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

        // Send the message to the slave process...
        sendCommandMessageToChildWithMetadata(command, this, meta, data,
          // Invoked when the message is received, or times out if the meta.timeout property is set.
          (response, request) => {
            this[settings].received++;

            /**
             * Emitted everytime the slave receives a response to a request.
             * @event Slave#response
             * @property {Request} request The request object that to be sent.
             */
            this.emit('response', response, request);

            resolve(response);
            done.call(response, response.error, response.data, response, request);
          });
      } else { // The slave has been shutdown, reject with error...
        const err = new Error(`${this.toString()} has been closed.`);
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
