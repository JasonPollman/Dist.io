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
const path = require('path');
const fs = require('fs');

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
  levels: { error: 0, warn: 1, disconnect: 2, close: 3, start: 3, spawn: 3, connect: 3, info: 4, verbose: 5 },
  colors: {
    error: 'red',
    warn: 'yellow',
    start: 'cyan',
    spawn: 'cyan',
    connect: 'green',
    close: 'green',
    disconnect: 'yellow',
    info: 'blue',
    verbose: 'magenta',
  },
};

winston.addColors(logOptions.colors);

/**
 * The MasterProxyServer.
 * Starts a remote slave server, used to fork slave processes remotely.
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
          timestamp: () => new Date().toLocaleString(),
          formatter: (options) => (
            `${winston.config.colorize(options.level, `${options.timestamp()} - `)}` +
            `${winston.config.colorize(options.level, `${options.level} `)}` +
            `${options.message !== undefined ? options.message : ''} ` +
            `${options.meta && Object.keys(options.meta).length ? `${os.EOL}  ${JSON.stringify(options.meta)}` : ''}`
          ),
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

      /**
       * True if the slave is started, false otherwise.
       * @type {Boolean}
       */
      started: false,

      /**
       * The root path to the available server scripts.
       * @type {String}
       */
      root: typeof config.root === 'string' // eslint-disable-line no-nested-ternary
        ? path.isAbsolute(config.root)
          ? config.root
          : path.join(__dirname, '..', config.root)
        : process.cwd(),

      sigintHandler: null,
      sigintSignalsReceived: 0,
    };

    if (config.authorizedIps instanceof Array) {
      this[server].io.use((socket, next) => {
        const ip = socket.request.connection.remoteAddress;
        let isAllowed = false;

        isAllowed = !config.authorizedIps.every(allowed => {
          if (typeof allowed === 'string' && new RegExp(allowed).test(ip)) return false;
          return true;
        });

        if (isAllowed) return next();
        return next(new Error('Unauthorized'));
      });
    }

    this[server].io.on('connection', socket => {
      // Add socket to connection list on connection...
      this[server].connections.push(socket);
      // Remote socket from connetion list on disconnect...
      socket.on('disconnect', () => {
        log.disconnect(`Master process ${socket.handshake.address}${socket.id} disconnected.`);
        const idx = this[server].connections.indexOf(socket);
        if (idx > -1) this[server].connections.splice(idx, 1);
      });

      log.connect(`Remote master process @${socket.handshake.address}${socket.id} has connected.`);
      // All socket events have been "tucked" into the below function to keep this file smaller.
      addSocketEvents(this, socket, log);
    });
  }

  /**
   * The root path to the available server scripts.
   * @type {String}
   */
  get root() {
    return this[server].root;
  }

  /**
   * @return {Boolean} True if the slave is started, false otherwise.
   */
  get started() {
    return this[server].started;
  }

  /**
   * Starts the Master Proxy Server.
   * @param {...*} args The entire arguments list.
   * @return {Promise} Resolve when the socket server is started, rejects on error.
   */
  start(...args) {
    const done = args._.getCallback();
    return new Promise((resolve, reject) => {
      if (this[server].started === false) {
        fs.stat(this.root, (e, stat) => {
          if (e) {
            reject(new Error(`Scripts root directory ${this.root} is invalid: ${e.message}`));
          } else if (stat.isFile()) {
            reject(new Error(`Scripts root directory ${this.root} isn't a directory!`));
          } else {
            dns.lookup(os.hostname(), (err, address) => {
              if (err) {
                reject(err);
                done(err);
              } else {
                this[server].io.listen(this[server].port);

                const info = this[server].io.httpServer.address();
                if (info && typeof info === 'object') this[server].port = info.port;

                this[server].log.start(`Master proxy server started on port ${this[server].port}`);
                this[server].log.info(
                  `Remote masters can now fork slaves using host string: "http://${address}:${this[server].port}"`
                );
                this[server].log.info(`Hosting scripts from "${this.root}"`);
                this[server].started = true;
                resolve(this[server].port);
                done(null, this[server].port);
              }
            });
          }
        });
      } else {
        resolve(this[server].port);
        done(null, this[server].port);
      }
    });
  }

  /**
   * Binds the server's SIGINT listener, which gracefully stops the server on a single sigint, and kills it on two.
   * @return {MasterProxyServer} A self reference to the current MasterProxyServer.
   */
  bindSIGINT() {
    this[server].sigintHandler = () => {
      if (this[server].sigintSignalsReceived > 0) process.exit(0);
      this[server].log.close('Server gracefully shutting down (^C again to exit immediately)...');
      this[server].sigintSignalsReceived++;
      setTimeout(() => this.stop(), 500);
    };

    process.on('SIGINT', this[server].sigintHandler);
    return this;
  }

  /**
   * Removes the server SIGINT listener...
   * @return {MasterProxyServer} A self reference to the current MasterProxyServer.
   */
  unbindSIGINT() {
    if (typeof this[server].sigintHandler === 'function') {
      process.removeListener('SIGINT', this[server].sigintHandler);
    }
    return this;
  }

  /**
   * Stops the master proxy server...
   * @return {MasterProxyServer} The current MasterProxyServer instance.
   */
  stop() {
    if (this[server].started === true) {
      this[server].started = false;
      this.unbindSIGINT();
      // Terminate existing connections...
      this[server].connections.forEach(s => s.disconnect());
      this[server].connections = [];

      // Stop listening for new connections...
      this[server].io.close();
    }
    return this;
  }
}

/**
 * The MasterProxyServer class.
 * @type {Function}
 */
module.exports = MasterProxyServer;
