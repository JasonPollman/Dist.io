/**
 * @file
 * The Slave class. A representation of the slave on the "front end".
 * Spawns child processes using ChildProcess.fork.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';
require('proto-lib').get('_');

/**
 * @module DistIO/RemoteSlave
 */

const Commands = require('./Commands');
const Slave = require('./Slave');
const io = require('socket.io-client');
const Response = require('./Response');

const remoteslave = Symbol();
const pseduo = Symbol();

/**
 * Used to match against connection strings.
 * @type {RegExp}
 */
const REMOTE_CONNECTION_REGEXP =
  /^(?:http(?:s)?:\/\/)?(?:(\S+)(?::(\S+))@)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\S+?)(?::(\d{1,5}))?$/i;

let RECONNECTION_ATTEMPTS = 3;

/**
 * A "fake" ChildProcess class for remote slaves to use.
 */
class PseduoChildProcess {
  constructor(slave) {
    this[pseduo] = { slave };
  }

  /**
   * Returns a phony process id for the remote slave.
   * @return {Number} Always -1 for remote slaves.
   */
  get pid() {
    return -1;
  }

  /**
   * Returns the slave's connection status.
   * @return {Boolean} True if the slave is connected, false otherwise.
   */
  get connected() {
    return this[pseduo].slave[remoteslave].isConnected;
  }

  /**
   * Kills the slave process by sending a singal to the master proxy server.
   * @param {String} signal The signal to pass along to the master proxy to use to kill the slave.
   * @return {[type]} [description]
   */
  kill(signal) {
    this[pseduo].slave.exec(Commands.REMOTE_KILL(signal || 'SIGKILL'), null, null) // eslint-disable-line new-cap
      .then(res => {
        if (res.error) this[pseduo].slave.emit('remote kill error', res.error);
      })
      .catch(e => {
        this[pseduo].slave.emit('remote kill error', e);
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

  send(m) {
    return this[pseduo].slave[remoteslave].socket.emit('message', m);
  }
}

function initializeSlaveEventsWithSlaveAndPseudoChildProcess(slave, args, socket, options) {
  const setSlaveExitedToTrue = () => {
    Slave.cleanupSlaveReferences(slave);
  };

  socket.on('reconnect_failed', () => {
    Slave.cleanupSlaveReferences(slave);
    // Call user onSpawnError function...
    if (options.onSpawnError instanceof Function) {
      options.onSpawnError.call(slave, new Error(`Failed to connect to remote slave @${slave.location}`));
    }
  });

  socket.on('message', slave.slaveResponseListener.bind(slave));
  socket.on('stdout', m => {
    if (typeof options.forkOptions === 'object' && options.forkOptions.silent) {
      slave.emit('stdout', m);
    } else {
      process.stdout.write(m);
    }
  });

  socket.on('stderr', m => {
    if (typeof options.forkOptions === 'object' && options.forkOptions.silent) {
      slave.emit('stderr', m);
    } else {
      process.stderr.write(m);
    }
  });

  // If the child fails to spawn...
  socket.on('error', function onError(e) { // eslint-disable-line prefer-arrow-callback
    Slave.cleanupSlaveReferences(slave);

    // Add a new generic error listener
    socket.on('error', () => {
      Slave.cleanupSlaveReferences(slave);
      if (options.onError instanceof Function) options.onError.call(slave, e);
    });
  });

  // Set connected to false when the child closes, exits, or is disconnected.
  const remoteOptions = options._.copy();
  remoteOptions.args = args;
  socket.on('disconnect', setSlaveExitedToTrue);
  socket.emit('message', {
    command: 'init',
    options: remoteOptions,
    count: 1,
    path: remoteOptions.remoteFilepath,
  });
}

/**
 * A representation of a Remote slave process from the master process.
 */
class RemoteSlave extends Slave {

  static set reconnectionAttempts(r) {
    if (r._.isNumeric()) RECONNECTION_ATTEMPTS = r._.getNumeric();
  }

  constructor(connectOptions, opts) {
    if (typeof connectOptions !== 'object') {
      throw new TypeError(
        'RemoteSlave#constructor expected argument #0 (connectOptions) to be an object, ' +
        `but got typeof ${connectOptions}`
      );
    }

    // Check for remote server location...
    if (typeof connectOptions.location !== 'string') {
      throw new TypeError(
        'RemoteSlave#constructor expected argument #0 (connectOptions) property "location" to be a string, ' +
        `but got typeof ${connectOptions.location}`
      );
    }

    // Check for remote path...
    if (typeof connectOptions.path !== 'string') {
      throw new TypeError(
        'RemoteSlave#constructor expected argument #0 (connectOptions) property "path" to be a string, ' +
        `but got typeof ${connectOptions.path}`
      );
    }

    const options = typeof opts === 'object' ? opts._.copy() : {};

    if (!(options.onSpawnError instanceof Function)) {
      options.onSpawnError = (e) => { throw e; };
    }
    options.remoteFilepath = connectOptions.path;
    super(connectOptions.location, options);
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

  slaveResponseListener(m) {
    const pendingRequests = Slave.pendingRequests;
    console.log(m, '<<<<<<<<<');
    if (this.isSlaveMessage(m)) {
      console.log('here ??????????');
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
        this.emit('uncaughtException', e);
        if (!this.hasSpawned) {
          this[remoteslave].onSpawnError(e);
        } else {
          this.onUncaughtException(e);
        }
      }
    }
  }

  initProtected() {
    this[remoteslave] = {
      protected: Slave.protected(this),
      isConnected: false,
      socket: null,
      username: null,
      pass: null,
      host: null,
      port: null,
    };
  }

  initProcess(loc, options, args) {
    this.initProtected();
    const location = loc.match(REMOTE_CONNECTION_REGEXP);
    this[remoteslave].onSpawnError = options.onSpawnError;
    this[remoteslave].username = location[1];
    this[remoteslave].pass = location[2];
    this[remoteslave].host = location[3];
    this[remoteslave].port = location[4];
    this[remoteslave].connectionString = location[0];

    this[this[remoteslave].protected].process = new PseduoChildProcess(this);
    this[remoteslave].socket = io(this[remoteslave].connectionString, { reconnectionAttempts: RECONNECTION_ATTEMPTS });
    initializeSlaveEventsWithSlaveAndPseudoChildProcess(this, args, this[remoteslave].socket, options);
  }

  checkLocation(loc) {
    if (!REMOTE_CONNECTION_REGEXP.test(loc)) {
      throw new TypeError(`Bad remote connection string: ${loc}`);
    }
    return loc;
  }

  close(...args) {
    return new Promise((resolve, reject) => {
      super.close(...args).then(res => {
        console.log('>>>>>>>>>>>>>>>');
        resolve(res);
        this[remoteslave].socket.disconnect();
      }).catch(e => reject(e));
      //this[remoteslave].socket.disconnect();
    });
  }
}

/**
 * The RemoteSlave class.
 * @type {Slave}
 */
module.exports = RemoteSlave;
