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
    const a = [...args];
    a.forEach(e => {
      if (!(e instanceof require('./Slave'))) { // eslint-disable-line global-require
        throw new TypeError('Slave arrays only allow Slave objects.');
      }
    });
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

    return new Promise((resolve, reject) => {
      this.forEach(s => {
        s.close(...args)
          .then(status => {
            statuses.push(status);
            if (++completed === total) {
              resolve(statuses);
              done.call(this);
            }
          })
          .catch(e => {
            statuses.push(e);
            if (++completed === total) {
              reject(e);
              done.call(this);
            }
          });
      });
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
}

/**
 * The SlaveArray class.
 * @type {ResponseArray}
 */
module.exports = SlaveArray;
