/**
 * @file
 * The Remote Slave class. A representation of a remote slave on the "front end".
 * Spawns child processes on a remote MasterProxyServer using socket.io-client to communicate
 * to the MasterProxyServer.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';
require('proto-lib').get('_');

/**
 * @module DistIO/RemoteSlave
 */

const io = require('socket.io-client');
const Commands = require('./Commands');
const Slave = require('./Slave');
const Response = require('./Response');
const crypto = require('crypto');

/**
 * Used by the RemoteSlave class to privatize properties.
 */
const remoteslave = Symbol();

/**
 * Used by the PseduoChildProcess class to privatize properties.
 */
const pseudo = Symbol();

/**
 * Used to match against connection strings.
 * @type {RegExp}
 */
const REMOTE_CONNECTION_REGEXP =
  /^(?:(http(?:s)?):\/\/)?(?:([a-z0-9$\-_.+!*'(),]+)(?::([a-z0-9$\-_.+!*'(),]+))@)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[a-z0-9$\-_.+!*'(),]+?)(?::(\d{1,5}))?$/i; // eslint-disable-line max-len

// Associated with the socket.io client options...
let RECONNECTION_ATTEMPTS = 3;
let RECONNECTION_DELAY = 500;

/**
 * A "fake" ChildProcess class that remote slaves use in place of ChildProcess.
 */
class PseduoChildProcess {
  /**
   * @param {RemoteSlave} slave The remote slave object associated with this PseduoChildProcess.
   */
  constructor(slave) {
    this[pseudo] = { slave };
  }

  /**
   * Returns a phony process id for the remote slave.
   * @return {Number} Always -1 for remote slaves.
   */
  get pid() {
    return this[pseudo].slave[remoteslave].remotePID;
  }

  /**
   * Returns the slave's connection status.
   * @return {Boolean} True if the slave is connected, false otherwise.
   */
  get connected() {
    return this[pseudo].slave[remoteslave].isConnected;
  }

  /**
   * Kills the slave process by sending a singal to the master proxy server.
   * @param {String} signal The signal to pass along to the master proxy to use to kill the slave.
   * @return {RemoteSlave} The current RemoteSlave instance.
   */
  kill(signal) {
    this[pseudo].slave.exec(Commands.REMOTE_KILL(signal), null, null) // eslint-disable-line new-cap
      .then(res => {
        this[pseudo].slave[remoteslave].isConnected = false;
        Slave.cleanupSlaveReferences(this[pseudo].slave);
        this[pseudo].slave[remoteslave].socket.destroy();
        if (res.error) {
          this[pseudo].slave.emit('remote kill error', res.error);
        } else {
          /**
           * Emitted when the remote slave has been killed.
           * @event remote killed
           * @argument {String} signal The signal sent to the slave.
           */
          this[pseudo].slave.emit('remote killed', signal);
        }
      })
      .catch(e => {
        this[pseudo].slave[remoteslave].isConnected = false;
        Slave.cleanupSlaveReferences(this[pseudo].slave);
        this[pseudo].slave[remoteslave].socket.destroy();
        /**
         * Emitted when the master proxy server encountered an error killing the slave.
         * @event remote kill error
         * @argument {Error} e The error that occured when killing the slave.
         */
        this[pseudo].slave.emit('remote kill error', e);
      });
    return this;
  }

  /**
   * Does nothing.
   * @return {PseduoChildProcess} A self reference.
   */
  unref() {
    return this;
  }

  /**
   * Emits a socket message to the slave.
   * @param {Request} m The Request message to send.
   * @return {PseduoChildProcess} A self reference.
   */
  send(m) {
    this[pseudo].slave[remoteslave].socket.emit('message', m);
    return this;
  }
}

/**
 * Initializes a new remote slave, by setting up events.
 * @param {RemoteSlave} slave The new RemoteSlave.
 * @param {Array<String>} args The arguments that will be passed to the master proxy server to init the remote process.
 * @param {Object} socket The socket.io connection associated with this slave.
 * @param {Object} options Options that will be passed to the proxy server to init the remote process with.
 * @return {undefined}
 */
function initializeSlaveEventsWithSlaveAndPseudoChildProcess(slave, args, socket, options) {
  let handledSpawnError = false;

  const setSlaveExitedToTrue = () => {
    slave[remoteslave].isConnected = false;
    Slave.cleanupSlaveReferences(slave);
  };

  socket.on('reconnect_failed', () => {
    setSlaveExitedToTrue();
    const e = new Error(`Unable to connect to host ${slave.location}`);

    if (!slave[remoteslave].handshake && !handledSpawnError) {
      handledSpawnError = true;
      if (slave.listenerCount('spawn error') === 0) {
        throw e;
      } else {
        slave.emit('spawn error', e);
      }
    } else {
      slave.emit('uncaughtException', e);
    }

    /**
     * Emitted when the slave fails to establish a socket connection with the host
     * @event remote connection failed
     */
    slave.emit('remote connection failed');
  });

  const onSpawnError = m => {
    if (!handledSpawnError) {
      handledSpawnError = true;
      if (slave.listenerCount('spawn error') === 0) {
        throw new Error(m);
      } else {
        slave.emit('spawn error', new Error(m));
      }
      setSlaveExitedToTrue();
    }
  };

  // Should the slave spawn fail, cleanup references and call the onSpawnError handler.
  socket.on('spawn failed', onSpawnError);

  // If the remote closes or exist, ensure we do the same local.
  socket.on('remote slave exited', setSlaveExitedToTrue);
  socket.on('remote slave closed', setSlaveExitedToTrue);

  // Handle responses from the remote slave...
  socket.on('message', (m) => slave.slaveResponseListener(m));

  // Handle stdout passed from the slave to the master proxy server to here...
  socket.on('stdout', m => {
    if (typeof options.forkOptions === 'object' && options.forkOptions.silent) {
      slave.emit('stdout', m);
    } else {
      process.stdout.write(m);
    }
  });

  // Handle stderr passed from the slave to the master proxy server to here...
  socket.on('stderr', m => {
    if (typeof options.forkOptions === 'object' && options.forkOptions.silent) {
      slave.emit('stderr', m);
    } else {
      process.stderr.write(m);
    }
  });

  // Set the slave's PID
  socket.on('remote pid', id => {
    slave.emit('remote initialized', id);
    slave[remoteslave].handshake = true;
    slave[slave[remoteslave].protected].received++;
    slave[remoteslave].remotePID = id;
  });

  socket.on('error', e => {
    if (slave.pid !== 0) {
      setSlaveExitedToTrue();
      if (slave.listenerCount('uncaughtException') === 0) {
        throw e;
      } else {
        slave.emit('uncaughtException', e);
      }
    } else {
      onSpawnError(e);
    }
  });

  // Set connected to false when the child closes, exits, or is disconnected.
  const remoteOptions = options._.copy();
  remoteOptions.args = args;

  // Don't want/need aliases on remote master, could cause conflict...
  remoteOptions.alias = undefined;
  socket.on('disconnect', setSlaveExitedToTrue);

  // Send the message to the socket to initialize the slave.
  socket.emit('message', {
    command: 'init',
    options: remoteOptions,
    count: 1,
    path: remoteOptions.remoteFilepath,
  });
}

/**
 * A representation of a remote slave process from the master process' perspective.
 */
class RemoteSlave extends Slave {
  /**
   * Set the number of socket.io reconnection attempts.
   * @see http://socket.io/docs/client-api/#manager#reconnectionattempts(v:boolean):manager
   * @param {Number} r The new number of attempts.
   */
  static set reconnectionAttempts(r) {
    if (typeof r === 'number') RECONNECTION_ATTEMPTS = r;
  }

  /**
   * Set the socket.io reconnection timeout.
   * @see http://socket.io/docs/client-api/#manager#reconnectionattempts(v:boolean):manager
   * @param {Number} r The new number of attempts.
   */
  static set reconnectionDelay(r) {
    if (typeof r === 'number') RECONNECTION_DELAY = r;
  }

  /**
   * @param {Object<String>} connectOptions Connection options to start the slave with.
   * @param {Object} opts Options to initialize the slave with.
   */
  constructor(connectOptions, opts) {
    if (typeof connectOptions !== 'object') {
      throw new TypeError(
        'RemoteSlave#constructor expected argument #0 (connectOptions) to be an object, ' +
        `but got ${typeof connectOptions}`
      );
    }

    connectOptions = connectOptions ? connectOptions._.copy() : {};

    // Alias for connectOptions.location...
    if (connectOptions.host && !connectOptions.location) connectOptions.location = connectOptions.host;

    // Alias for connectOptions.path...
    if (connectOptions.script && !connectOptions.path) connectOptions.path = connectOptions.script;

    // Check for remote server location...
    if (typeof connectOptions.location !== 'string') {
      throw new TypeError(
        'RemoteSlave#constructor expected argument #0 (connectOptions) property "location" to be a string, ' +
        `but got ${typeof connectOptions.location}`
      );
    }

    // Check for remote path...
    if (typeof connectOptions.path !== 'string') {
      throw new TypeError(
        'RemoteSlave#constructor expected argument #0 (connectOptions) property "path" to be a string, ' +
        `but got ${typeof connectOptions.path}`
      );
    }

    const options = typeof opts === 'object' ? opts._.copy() : {};

    options.remoteFilepath = connectOptions.path;
    options.passphrase = connectOptions.passphrase;
    super(connectOptions.location, options);
  }

  /**
   * @override
   * @return {Boolean} True if the slave is remote, false othewise.
   */
  get isRemote() {
    return true;
  }

  /**
   * @return {Object} The socket.io connection associated with this slave.
   */
  get socket() {
    return this[remoteslave].socket;
  }

  /**
   * @return {String} The path to the slave file on the remote server.
   */
  get path() {
    return this[remoteslave].path;
  }

  /**
   * True if the message recieved is a "slave message", or one sent by a slave process.
   * @param {Object} m The message data.
   * @return {Boolean} True if the message is a slave message, false otherwise.
   */
  isSlaveMessage(m) {
    if (
      typeof m === 'object'
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
   * Handles responses, and is called when the socket connection associated with this slave emits a "message" message.
   * @param {Object<String|Number|Object>} m The message from the master proxy server.
   * @return {undefined}
   */
  slaveResponseListener(m) {
    const pendingRequests = Slave.pendingRequests;
    if (this.isSlaveMessage(m)) {
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
    } else if (Slave.isSlaveExceptionMessage(m)) {
      const e = new Error(m.error.message || 'Unknown error');
      e.stack = m.error.stack;
      e.name = m.error.name;
      if (this.id === m.from) {
        /**
         * Emitted when a slave exception occurs.
         * @event uncaughtException
         * @argument {Error} The error emitted from the slave.
         */
        if (this.listenerCount('uncaughtException') === 0) {
          throw e;
        } else {
          this.emit('uncaughtException', e);
        }
      }
    }
  }

  /**
   * Initializes the protected values of this class.
   * @param {Object} options Options to fork the slave with.
   * @return {RemoteSlave} A self reference to the current remote slave instance.
   */
  initProtected(options) {
    this[remoteslave] = {
      protected: Slave.protected(this),
      isConnected: true,
      handshake: false,
      socket: null,
      username: null,
      pass: null,
      host: null,
      port: null,
      remotePID: 0,
      passphrase: typeof options.passphrase === 'string' ? options.passphrase : null,
      path: options.remoteFilepath,
    };
    return this;
  }

  /**
   * Spawns an initializes the remote slave process.
   * @override
   * @param {String} loc The location of the remote master proxy server.
   * @param {Object} options Options to fork the slave with.
   * @param {Array<String>} args Arguments to fork the slave with.
   * @return {RemoteSlave} A self reference to the current slave instance.
   */
  initProcess(loc, options, args) {
    this.initProtected(options);
    const location = loc.match(REMOTE_CONNECTION_REGEXP);
    this[remoteslave].protocol = location[1];
    this[remoteslave].username = location[2];
    this[remoteslave].pass = location[3];
    this[remoteslave].host = location[4];
    this[remoteslave].port = location[5] || 80;
    this[remoteslave].connectionString = `${location[1]}://${location[4]}:${location[5] || 80}`;

    this[this[remoteslave].protected].process = new PseduoChildProcess(this);

    const socketOptions = {
      reconnectionAttempts: RECONNECTION_ATTEMPTS,
      reconnectionDelay: RECONNECTION_DELAY,
    };

    if (this[remoteslave].username && this[remoteslave].pass) {
      const authString = `${this[remoteslave].username}:${this[remoteslave].pass}`;
      if (this[remoteslave].passphrase) {
        const cipher = crypto.createCipher('aes256', this[remoteslave].passphrase);
        let encrypted = cipher.update(authString, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        socketOptions.query = `authorization=${encrypted}`;
      } else {
        socketOptions.query = `authorization=${authString.toString('base64')}`;
      }
    }

    this[remoteslave].socket = io(this[remoteslave].connectionString, socketOptions);

    initializeSlaveEventsWithSlaveAndPseudoChildProcess(this, args, this[remoteslave].socket, options);
    return this;
  }

  /**
   * Validates the connection string passed to the slave constructor within the argument "connectOptions".
   * @override
   * @param {String} loc The location to validate.
   * @return {String} The location.
   * @throws {TypeError} If the location is invalid.
   */
  checkLocation(loc) {
    if (!REMOTE_CONNECTION_REGEXP.test(loc)) {
      throw new TypeError(`Bad remote connection string: ${loc}`);
    }

    if (!/^http(s)?:\/\//.test(loc)) loc = `http://${loc}`;
    return loc;
  }

  /**
   * Gracefully shuts down the child process.
   * @override
   * @param {Function=} done A callback for completion.
   * @return {Promise} A promise for completion.
   */
  close(...args) {
    const done = args._.getCallback();
    return new Promise((resolve, reject) => {
      super.close()
        .then(res => {
          this[remoteslave].socket.destroy();
          done(null, res);
          resolve(res);
        }).catch(e => {
          done(e, null);
          reject(e);
        });
    });
  }
}

/**
 * The RemoteSlave class.
 * @type {Slave}
 */
module.exports = RemoteSlave;
