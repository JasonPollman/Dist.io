'use strict';
/**
 * @module TimeoutResponse
 */

const Response = require('./Response');
const Request = require('./Request');

/**
 * A "pseduo" response object that is passed back to a request if the request timesout.
 */
class TimeoutResponse extends Response {
  /**
   * TimeoutResponse constructor.
   * @param {Slave} slave The slave associated with this timeout response.
   * @param {Request} request The request associated with this response.
   * @return {TimeoutResponse} The newly created TimeoutResponse object.
   */
  constructor(slave, request) {
    const Slave = require('./Slave'); // eslint-disable-line global-require

    if (!(slave instanceof Slave)) {
      throw new TypeError('TimeoutResponse constructor expected argument #0 (slave) to be a Slave instance.');
    }

    if (!(request instanceof Request)) {
      throw new TypeError('TimeoutResponse constructor expected argument #1 (request) to be a Request instance.');
    }

    super({
      title: 'SlaveIOTimeoutResponse',
      sent: Date.now(),
      request,
      error: new Error(`Request #${request.rid} with command ${request.command} timed out after ${request.ttl}.`),
      data: null,
    });
  }
}

/**
 * The TimeoutResponse class.
 * @type {TimeoutResponse}
 */
module.exports = TimeoutResponse;
