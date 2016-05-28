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
    const a = [...args];
    a.forEach(e => {
      if (!(e instanceof Response)) throw new TypeError('Response arrays only allow Response objects.');
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
   * Returns the errors from all of the responses.
   * @return {Array<ResponseError>} An array of ResponseErrors.
   */
  get errors() {
    return this.map(elem => elem.error);
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
