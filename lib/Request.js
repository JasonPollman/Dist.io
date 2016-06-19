/**
 * @file
 * A reprentation of a request. All request actions are defined in the Request class.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';
require('proto-lib').get('_');

/**
 * @module DistIO/Request
 */

const Commands = require('./Commands');
const Response = require('./Response');

/**
 * Used by the request class to privatize variables.
 */
const request = Symbol();

/**
 * An accumulator for request ids.
 * @type {Number}
 */
let rids = 0;

/**
 * A simple class that represents a request.
 * @constructor
 */
class Request {
  /**
   * Slave constructor.
   * @param {Slave} slave The slave associated with this request.
   * @param {String} command The command for this request.
   * @param {Object} meta Meta data for this request.
   * @param {Object} data The data to send with this request.
   * @param {String} secretId A string to prevent accidentally sending a slave request.
   * @param {Number} secretNumber A number to help prevent accidentally sending a slave request by mistake.
   * @param {Symbol} slaveSymbol The private slave symbol.
   * @param {Function=} callback The callback to invoke when this request is responded to.
   * @return {Slave} The newly created slave instance.
   */
  constructor(slave, command, meta, data, secretId, secretNumber, slaveSymbol, callback) {
    // Check arguments...
    if (!(slave instanceof require('./Slave'))) { // eslint-disable-line global-require
      throw new TypeError('Request argument #0 (slave) expected a an instanceof Slave.');
    } else if (typeof secretId !== 'string') {
      throw new TypeError(`Request argument #4 (secretId) expected a string, but got ${typeof secretId}.`);
    } else if (typeof secretNumber !== 'number') {
      throw new TypeError(`Request argument #5 (secretNumber) expected a number, but got ${typeof secretNumber}.`);
    } else if (typeof meta !== 'object') {
      throw new TypeError(`Request argument #2 (meta) expected an object, but got ${typeof object}.`);
    }

    meta = meta || {};

    // Validate command argument...
    switch (command) {
      // The command to gracefully exit the slave process.
      case Commands.EXIT:
        command = '__dist.io__exit__';
        break;

      // The command to send an acknowledgement to the slave.
      case Commands.ACK:
        command = '__dist.io__ack__';
        break;

      // Sends a no-op command.
      case Commands.NULL:
        command = '__dist.io__null__';
        break;

      // Sends a SIGINT command
      case Commands.REMOTE_KILL_SIGINT:
        command = '__dist.io__remote__kill__SIGINT__';
        break;

      // Sends a SIGTERM command
      case Commands.REMOTE_KILL_SIGTERM:
        command = '__dist.io__remote__kill__SIGTERM__';
        break;

      // Sends a SIGHUP command
      case Commands.REMOTE_KILL_SIGHUP:
        command = '__dist.io__remote__kill__SIGHUP__';
        break;

      // Sends a SIGKILL command
      case Commands.REMOTE_KILL_SIGKILL:
        command = '__dist.io__remote__kill__SIGKILL__';
        break;

      // Sends a SIGBREAK command
      case Commands.REMOTE_KILL_SIGBREAK:
        command = '__dist.io__remote__kill__SIGBREAK__';
        break;

      // Sends a SIGSTOP command
      case Commands.REMOTE_KILL_SIGSTOP:
        command = '__dist.io__remote__kill__SIGSTOP__';
        break;

      // Sends a user command.
      default:
        if (typeof command !== 'string') {
          throw new TypeError(`Request constructor argument #0 (command) expect a string, but got ${typeof command}.`);
        }
    }

    const created = Date.now();
    const timeout = meta.timeout ? meta.timeout._.getNumeric() : null;

    /**
     * Protected properties for this Request instance.
     * @namespace RequestProtected
     */
    this[request] = {
      /**
       * The request id.
       * @type {Number}
       */
      rid: rids++,

      /**
       * The time the request was created in nanoseconds.
       * @type {Number}
       */
      created,

      /**
       * The slave process associated with this request.
       * @type {Slave}
       */
      slave,

      /**
       * The command for this request.
       * @type {String}
       */
      command,

      /**
       * Metadata for this request.
       * @type {Object}
       */
      meta,

      /**
       * The data to send with this request.
       * @type {Object}
       */
      data,

      /**
       * The callback to be invoked when this request is complete.
       * @type {Function}
       * @return {undefined}
       */
      callback: callback instanceof Function ? callback : () => {},

      /**
       * The duration before this request times out. <= Zero means never.
       * @type {Object}
       */
      ttl: 0,

      /**
       * The Timeout object associated with this request (the actual timeout).
       * @type {Timeout}
       */
      timeout: null,

      /**
       * A function to invoke when the request times out.
       * @type {Function}
       * @return {undefined}
       */
      onTimeout: () => {},

      /**
       * The secret id from the Slave module.
       * @type {String}
       */
      secretId,

      /**
       * The secret tiem from the Slave module.
       * @type {Number}
       */
      secretNumber,

      /**
       * The symbol object passed in by the slave process.
       * @type {Symbol}
       */
      slaveSymbol,
    };

    if (timeout && timeout._.isNumeric()) {
      this[request].ttl = timeout;
      this[request].timeout = setTimeout(() => {
        this[request].onTimeout();
      }, timeout);
    }
  }

  /**
   * The request id.
   * @return {Number} The request id.
   */
  get id() {
    return this[request].rid;
  }

  /**
   * The request id (an alias for Request#id).
   * @return {Number} The request id.
   */
  get rid() {
    return this[request].rid;
  }

  /**
   * The request time to live.
   * @return {Number} The request TTL.
   */
  get ttl() {
    return this[request].ttl;
  }

  /**
   * The request's command
   * @return {String} The request's command.
   */
  get command() {
    return this[request].command;
  }

  /**
   * Returns the time the Request was created.
   * @return {Number} The time in nanoseconds.
   */
  get created() {
    return this[request].created;
  }

  /**
   * Returns the request's callback.
   * @return {Function} The callback to invoked when the response is received for this request.
   */
  get callback() {
    return this[request].callback;
  }

  /**
   * Sends the request.
   * @return {Request} The current request instance.
   */
  send() {
    const sendTime = Date.now();
    this[request].slave[this[request].slaveSymbol].process.send({
      sent: sendTime,
      rid: this[request].rid,
      for: this[request].slave.id,
      meta: this[request].meta,
      data: this[request].data,
      command: this[request].command,
      created: this[request].created,
      secretId: this[request].secretId,
      secretNumber: this[request].secretNumber,
      title: 'MasterIOMessage',
    });
    return this;
  }

  /**
   * Checks whether or not the Request has timedout.
   * @param {Response} response The received message.
   * @return {Boolean} True if the message has timedout, false otherwise.
   */
  hasTimedout(response) {
    if (!(response instanceof Response)) {
      throw new TypeError('Request#hasTimedout expected argument #0 (response) to be an instanceof Response.');
    }
    if (this.ttl !== 0 && this[request].timeout && this.ttl < (response.received - this.created)) return true;
    return false;
  }

  /**
   * A callback that is invoked when the request times out.
   * @param {Function} callback The callback to invoked when the request times out.
   * @return {Request} The current request instance.
   */
  onTimeout(callback) {
    if (callback instanceof Function) this[request].onTimeout = callback;
    return this;
  }

  /**
   * Clears the Request timeout.
   * @return {Request} The current request instance.
   */
  clearTimeout() {
    clearTimeout(this[request].timeout);
    return this;
  }
}

/**
 * The Request class.
 * @type {Request}
 */
module.exports = Request;
