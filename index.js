'use strict';
/* eslint-disable global-require */

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
   * Returns the Slave Class.
   * Require is deferred using a getter.
   * @type {Function}
   */
  get Slave() {
    return require('./lib/SlaveChildProcess');
  }
}

module.exports = new DistIO();
