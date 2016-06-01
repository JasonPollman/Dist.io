/**
 * @file
 * Represents a collection of slaves, and their actions as a collective object.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';
require('proto-lib').get('_');

/**
 * @module DistIO/Response
 */

/**
 * Validates that all arguments are Slave objects.
 * @param {...*} slaves The slave list to validate.
 * @throws {TypeError} If any of the arguments are non-Slave objects.
 * @return {undefined}
 */
function validateArgumentsAreAllSlaves(...slaves) {
  [...slaves].forEach(s => {
    if (!(s instanceof require('./Slave'))) { // eslint-disable-line global-require
      throw new TypeError('Cannot insert non-Slave object into SlaveArray!');
    }
  });
}

/**
 * An array of response objects.
 * @extends Array
 */
class SlaveArray extends Array {
  /**
   * ResponseArray constructor.
   * @param {...Response} A list of response object to add to the ResponseArray.
   * @return {ResponseArray} The newly created response array.
   */
  constructor(...args) {
    validateArgumentsAreAllSlaves(...args);
    super(...args);
  }

  /**
   * Loops through each item in the response array.
   * @param {...*} args Arguments to pass to proto-lib#each function.
   * @return {*} The return value of this._.each()
   */
  each(...args) {
    return this._.each.apply(this, [...args]);
  }

  /**
   * Broadcasts a message to all slaves.
   * @param {...*} args Arguments to pass to Master#broadcast function.
   * @return {Promise} A promise for completion.
   */
  exec(...args) {
    return require('./Master').broadcast(...args).to(...this); // eslint-disable-line global-require
  }

  /**
   * An alias for SlaveArray#exec
   * @return {Promise} A promise for completion.
   */
  do(...args) {
    return this.exec(...args);
  }

  /**
   * Closes all of the slaves in the array.
   * @param {...*} args Arguments to pass to slave#close.
   * @return {Promise} A promise for completion
   */
  close(...args) {
    const done = [...args]._.getCallback();
    const total = this.length;
    const statuses = [];
    let completed = 0;

    return new Promise(resolve => {
      this.forEach(s => {
        s.close()
          .then(status => {
            statuses.push(status);
            if (++completed === total) {
              resolve(statuses);
              done.call(this, statuses);
            }
          })
          .catch(e => {
            statuses.push(e);
            if (++completed === total) {
              resolve(statuses);
              done.call(this, statuses);
            }
          });
      });
    });
  }

  /**
   * Kills all of the slaves in the array.
   * @return {Promise} A promise for completion
   */
  kill() {
    this.forEach(s => {
      s.kill();
    });
  }

  /**
   * Allows us to chain promises against the instantation of a Slave objects.
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
   * Alias for SlaveArray#close.
   * @param {...*} args Arguments to pass to slave#close.
   * @return {Promise} A promise for completion
   */
  exit(...args) {
    return this.close(...args);
  }

  /**
   * Overrides Array.prototype.push.
   * Checks that all elements provided are Slave objects.
   * @param {...*} args The arguments to pass to Array.prototype.push.
   * @return {Number} The new length of the SlaveArray.
   */
  push(...args) {
    validateArgumentsAreAllSlaves(...args);
    return super.push(...args);
  }

  /**
   * Overrides Array.prototype.unshift.
   * Checks that all elements provided are Slave objects.
   * @param {...*} args The arguments to pass to Array.prototype.unshift
   * @return {Number} The new length of the SlaveArray.
   */
  unshift(...args) {
    validateArgumentsAreAllSlaves(...args);
    return super.push(...args);
  }
}

/**
 * The SlaveArray class.
 * @type {ResponseArray}
 */
module.exports = SlaveArray;
