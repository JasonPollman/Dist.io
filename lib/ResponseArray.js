/**
 * @file
 * Represents a collection of responses, and their actions as a collective object.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';
require('proto-lib').get('_');
const Response = require('./Response');

/**
 * @module DistIO/Response
 */

 /**
  * Validates that all arguments are Response objects.
  * @param {...*} responses The responses to validate.
  * @throws {TypeError} If any of the arguments are non-Response objects.
  * @return {undefined}
  */
function validateArgumentsAreAllResponses(...responses) {
  [...responses].forEach(r => {
    if (!(r instanceof Response)) throw new TypeError('Cannot insert non-Response object into ResponseArray!');
  });
}

/**
 * An array of response objects.
 * @extends Array
 */
class ResponseArray extends Array {
  /**
   * ResponseArray constructor.
   * @param {...Response} A list of response object to add to the ResponseArray.
   * @return {ResponseArray} The newly created response array.
   */
  constructor(...args) {
    validateArgumentsAreAllResponses(...args);
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
   * Joins all the data from the responses.
   * @param {...*} args Arguments to pass to Array#join.
   * @return {String} The joined values.
   */
  joinValues(...args) {
    return this.values.join(...args);
  }

  /**
   * Sorts the array by the given property.
   * @param {String} prop The property to sory by.
   * @return {ResponseArray} The sorted response array.
   */
  sortBy(prop) {
    if (this.length > 0) {
      if (this[0][prop]) {
        this.sort((a, b) => (a[prop] < b[prop] ? -1 : a[prop] > b[prop] ? 1 : 0)); // eslint-disable-line no-nested-ternary, max-len
      } else {
        throw new Error(`ResponseArray#sortBy expected argument #0 (prop) to be a string, but got ${typeof prop}`);
      }
    }
    return this;
  }

  /**
   * Overrides Array.prototype.push.
   * Checks that all elements provided are Slave objects.
   * @param {...*} args The arguments to pass to Array.prototype.push.
   * @return {Number} The new length of the ResponseArray.
   */
  push(...args) {
    validateArgumentsAreAllResponses(...args);
    return super.push(...args);
  }

  /**
   * Overrides Array.prototype.unshift.
   * Checks that all elements provided are Slave objects.
   * @param {...*} args The arguments to pass to Array.prototype.unshift
   * @return {Number} The new length of the ResponseArray.
   */
  unshift(...args) {
    validateArgumentsAreAllResponses(...args);
    return super.push(...args);
  }

  /**
   * Returns the errors from all of the responses.
   * @return {Array<ResponseError>} An array of ResponseErrors.
   */
  get errors() {
    return this.map(elem => elem.error);
  }

  /**
   * Sums the values of each response in the array.
   * @return {Number|NaN} The sum of all the values in the array.
   */
  get sum() {
    return this.values.reduce((p, c) => p + c, 0);
  }

  /**
   * Multiplies the values of each response in the array.
   * @return {Number|NaN} The sum of all the values in the array.
   */
  get product() {
    return this.values.reduce((p, c) => p * c, 0);
  }

  /**
   * Returns the values (data) from all of the responses.
   * @return {Array<*>} An array of response values.
   */
  get values() {
    return this.map(elem => elem.value);
  }

  /**
   * Returns the average response time.
   * @return {Number} The average response time in ms.
   */
  get averageResponseTime() {
    if (this.length === 0) return 0;

    let sum = 0;
    this.forEach(e => { sum += e.duration; });
    return sum / this.length;
  }
}

/**
 * The ResponseArray class.
 * @type {ResponseArray}
 */
module.exports = ResponseArray;
