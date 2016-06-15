/**
 * @file
 * Exports the dist.io module.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';
/* eslint-disable global-require */

/**
 * @module DistIO
 */

/**
 * A simple exportable for the Dist.io module.
 * @constructor
 */
class DistIO {
  /**
   * Returns the Master singleton.
   * Require is deferred using a getter.
   * @type {Master}
   */
  get Master() {
    return require('./lib/Master.js');
  }

  /**
   * Returns the SlaveChildProcess singleton.
   * Require is deferred using a getter.
   * @type {Function}
   */
  get Slave() {
    return require('./lib/SlaveChildProcess');
  }

  /**
   * Returns the MasterProxyServer class.
   * @type {Function}
   */
  get MasterProxyServer() {
    return require('./lib/MasterProxyServer');
  }
}

/**
 * A singleton instance of the DistIO class.
 * @type {DistIO}
 */
module.exports = new DistIO();
