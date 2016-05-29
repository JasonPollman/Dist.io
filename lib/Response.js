/**
 * @file
 * A reprentation of a response. All request actions are defined in the Response class.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';

/**
 * @module DistIO/Response
 */

const ResponseError = require('./ResponseError');
const response = Symbol();

/**
 * An accumulator for transmit ids (a response's id).
 * @type {Number}
 */
let txids = 0;

/**
 * A simple response abstraction object.
 * @constructor
 */
class Response {
  /**
   * Respons constructor.
   * @param {Object} message The message from the slave object.
   * @return {Response} The newly created response object.
   */
  constructor(message) {
    if (typeof message !== 'object') {
      throw new TypeError(
        `Response constructor argument #0 (message) expected an object, but got ${typeof message}.`
      );
    }

    if (!message) {
      throw new TypeError(
        'Response constructor argument #0 (message) cannot be null.'
      );
    }

    this[response] = message;

    // Set the response id.
    this[response].txid = txids++;

    // Set the response reciept time.
    this[response].received = Date.now();

    // Set the response error, if it exists on the message.
    this[response].error = message.error !== null && typeof message.error === 'object'
      ? new ResponseError(message.error)
      : null;
  }

  /**
   * A string representation of this object.
   * @return {String} This object's string representation.
   */
  toString() {
    return `Response: from=${this[response].request.for}, ` +
           `txid=${this[response].txid}, ` +
           `rid=${this[response].request.rid}, ` +
           `received=${this[response].received}, ` +
           `error=${!!this[response].error}`;
  }

  /**
   * Returns this id of the slave this response was from.
   * @return {Number} The slave's id.
   */
  get from() {
    return this[response].request.for;
  }

  /**
   * Returns the request id this response was for.
   * @return {Number} The request id for this response.
   */
  get rid() {
    return this[response].request.rid;
  }

  /**
   * Returns a "Request" like object send back from the slave.
   * @return {Object} A copy of the request this response answers.
   */
  get request() {
    return this[response].request;
  }

  /**
   * Returns the response id for this response.
   * @return {Number} The "transmit" id.
   */
  get txid() {
    return this[response].txid;
  }

  /**
   * Alias for Response#txid.
   * @return {Number} The "transmit" id.
   */
  get id() {
    return this[response].txid;
  }

  /**
   * Returns the amount of time taken to send this response in ms.
   * @return {Number} How long it took to resolve this request.
   */
  get duration() {
    return this[response].received - this[response].request.sent;
  }

  /**
   * Returns the creation time of this response in milliseconds.
   * @return {Number} The time this response was created.
   */
  get received() {
    return this[response].received;
  }

  /**
   * Returns this time the response was sent in milliseconds.
   * @return {Number} The time this response was sent by the slave.
   */
  get sent() {
    return this[response].request.sent;
  }

 /**
 * The name of the command used to get this response.
 * @return {String} The request command.
 */
  get command() {
    return this[response].request.command;
  }

  /**
   * The error associated with this response, if any.
   * @return {ResponseError|null} An error, if one occured.
   */
  get error() {
    return this[response].error;
  }

  /**
   * The data associated with this response object, if any.
   * @return {*} The response's data.
   */
  get data() {
    return this[response].data;
  }

  /**
   * Alias for Response#data.
   * @return {*} The response's data.
   */
  get value() {
    return this[response].data;
  }

  /**
   * Alias for Response#data.
   * @return {*} The response's data.
   */
  get val() {
    return this[response].data;
  }

  /**
   * Sets the responses value.
   * @param {*} v The value to set.
   */
  set data(v) {
    this[response].data = v;
  }

  /**
   * Sets the responses value.
   * @param {*} v The value to set.
   */
  set value(v) {
    this[response].data = v;
  }

  /**
   * Sets the responses value.
   * @param {*} v The value to set.
   */
  set val(v) {
    this[response].data = v;
  }

  /**
   * Pipes a response as a command to another slave.
   * @param {String|Number|Symbol} task The task name to pipe
   * @param {Object} meta The metadata to use to pip with.
   * @return {Promise} The promise from Master#broadcast.to
   */
  pipe(task, meta) {
    return {
      to: (...slaves) => require('./Master') // eslint-disable-line global-require
        .broadcast(task, this.value, meta)
        .to(...slaves),
    };
  }
}

/**
 * The Response class.
 * @type {Response}
 */
module.exports = Response;
