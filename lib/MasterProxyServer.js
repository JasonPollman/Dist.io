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
const args = require('minimist')(process.argv.slice(2), { number: 'port' });
const winston = require('winston');
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
  levels: { error: 0, warn: 1, disconnect: 2, connect: 3, info: 4, verbose: 5 },
  colors: { error: 'red', warn: 'yellow', connect: 'green', disconnect: 'yellow', info: 'blue', verbose: 'blue' },
};

winston.addColors(logOptions.colors);

/**
 * A winston logger...
 * @type {winston.Logger}
 */
const log = new winston.Logger({
  levels: logOptions.levels,
  transports: [
    new winston.transports.Console({
      level: typeof args.logLevel === 'number' // eslint-disable-line no-nested-ternary
        ? logOptions.levels._.invert()[args.logLevel] || 'info'
        : logOptions[args.logLevel] ? args.logLevel : 'info',
      colorize: true,
    }),
  ],
});

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

    this[server] = {
      port: typeof args.port === 'number' ? args.port : 1337,
      io: io(),
      config,
    };

    this[server].io.on('connection', socket => {
      log.connect(`Master process @ ${socket.handshake.address} connected.`);
      addSocketEvents(this, socket, log);
    });
  }

  start() {
    this[server].io.listen(this[server].port);
    log.connect(`Slave Server started on port ${this[server].port}`);
  }
}

/**
 * [exports description]
 * @type {[type]}
 */
module.exports = MasterProxyServer;
