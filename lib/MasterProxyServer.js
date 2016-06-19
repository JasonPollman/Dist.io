/**
 * @file
 * Serves as a remote slave server.
 * @copyright © 2016 Jason James Pollman
 */
'use strict';

/**
 * @module DistIO/MasterProxyServer
 */

require('proto-lib').get('_');
const io = require('socket.io');
const winston = require('winston');
const dns = require('dns');
const os = require('os');
const addSocketEvents = require('./ServerEvents');

/**
 * Used to privatize members of the MasterProxyServer class.
 * @type {Symbol}
 */
const server = Symbol();

/**
 * Logging options for the MasterProxyServer class to utilize.
 * @type {Object}
 */
const logOptions = {
  levels: { error: 0, warn: 1, disconnect: 2, start: 3, spawn: 3, connect: 3, info: 4, verbose: 5 },
  colors: {
    error: 'red',
    warn: 'yellow',
    start: 'cyan',
    spawn: 'cyan',
    connect: 'green',
    disconnect: 'yellow',
    info: 'blue',
    verbose: 'magenta',
  },
};

winston.addColors(logOptions.colors);

/**
 * The MasterProxyServer.
 * Starts a remote slave server, to fork slave processes remotely.
 */
class MasterProxyServer {
  /**
   * Sets up default options for the MasterProxyServer instance, and
   * handlers for this server's socket io instance.
   * @param {Object} conf Configuration options for this server.
   */
  constructor(conf) {
    const config = typeof conf === 'object' ? conf : {};

    /**
     * A winston logger...
     * @type {winston.Logger}
     */
    const log = new winston.Logger({
      levels: logOptions.levels,
      transports: [
        new winston.transports.Console({
          level: typeof config.logLevel === 'number' // eslint-disable-line no-nested-ternary
            ? logOptions.levels._.invert()[config.logLevel] || 'info'
            : typeof logOptions.levels[config.logLevel] === 'number' ? config.logLevel : 'info',
          colorize: true,
        }),
      ],
    });

    this[server] = {
      /**
       * The port for the socket.io server to listen on.
       * @type {Number}
       */
      port: typeof config.port === 'number' ? config.port : 1337,

      /**
       * The socket io instance.
       * @return {Object}
       */
      io: io(),

      /**
       * Stores active socket connections
       * @type {Array<Object>}
       */
      connections: [],

      /**
       * A logger instance
       * @type {winston.Logger}
       */
      log,

      /**
       * The server configuration object (settings for this server).
       * @type {Object}
       */
      config,
    };

    this[server].io.on('connection', socket => {
      // Add socket to connection list on connection...
      this[server].connections.push(socket);
      // Remote socket from connetion list on disconnect...
      socket.on('disconnect', () => {
        const idx = this[server].connections.indexOf(socket);
        if (idx > -1) this[server].connections.splice(idx, 1);
      });

      log.connect(`Remote master process @${socket.handshake.address}${socket.id} has connected.`);
      // All socket events have been "tucked" into the below function to keep this file smaller.
      addSocketEvents(this, socket, log);
    });
  }

  /**
   * Starts the Master Proxy Server.
   * @param {...*} args The entire arguments list.
   * @return {Promise} Resolve when the socket server is started, rejects on error.
   */
  start(...args) {
    const done = args._.getCallback();
    return new Promise((resolve, reject) => {
      dns.lookup(os.hostname(), (err, address) => {
        if (err) {
          reject(err);
          done(err);
        } else {
          this[server].io.listen(this[server].port);
          this[server].log.start(
            `Master Proxy Server Started: ${address}:${this[server].port}, ${new Date().toLocaleString()}`
          );
          resolve(null);
          done(null);
        }
      });
    });
  }

  /**
   * Stops the master proxy server...
   * @return {Promise} Resolved when the server is stopped.
   */
  stop() {
    // Stop listening for new connections...
    this[server].io.close();
    // Terminate existing connections...
    this[server].connections.forEach(s => s.disconnect());
    this[server].connections = [];
  }
}

/**
 * The MasterProxyServer class.
 * @type {Function}
 */
module.exports = MasterProxyServer;
