/**
 * @file
 * All errors send from the child processes will be an instance of the ResponseError class.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';

/**
 * @module DistIO/ResponseError
 */

/**
 * A simple error class for Response object errors.
 * @constructor
 * @extends Error
 */
class ResponseError extends Error {
  /**
   * ResponseError constructor.
   * @param {Object} e The error object from the response.
   * @return {ResponseError} The newly created ResponseError.
   */
  constructor(e) {
    if (!e || typeof e !== 'object') {
      throw new TypeError(`ResponseError constructor argument #0 (e) expected an object, but got ${typeof e}.`);
    }

    super(typeof e.message === 'string' ? e.message : 'Unknown Response Error');

    // Set the error's stack...
    if (typeof e.stack === 'string') this.stack = e.stack;
    // Set the error's name...
    if (typeof e.name === 'string') this.name = `ResponseError: ${e.name}`;
  }

  /**
   * @return {Object<String>} This error, in a tranmittable form.
   */
  get raw() {
    return {
      message: this.message,
      stack: this.stack,
      name: this.name.replace(/^ResponseError: /, ''),
    };
  }
}

/**
 * The ResponseError class.
 * @type {ResponseError}
 */
module.exports = ResponseError;
