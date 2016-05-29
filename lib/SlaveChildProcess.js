/**
 * @file
 * The actual slave processes requre this file.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';
require('proto-lib').get('_');

/**
 * @module DistIO/SlaveChildProcess
 */

const EventEmitter = require('events').EventEmitter;
const args = require('minimist')(process.argv.slice(2), { number: ['dist-io-slave-id'] });

/**
 * Used by the SlaveChildProcess class to privatize properties.
 */
const slave = Symbol();

/**
 * The time this process was started.
 * @type {Number}
 */
const INIT = Date.now();

/**
 * A slave worker process controller.
 * @constructor
 * @extends EventEmitter
 */
class SlaveChildProcess extends EventEmitter {
  /**
   * SlaveChildProcess constructor.
   * @return {SlaveChildProcess} The newly created SlaveChildProcess object.
   */
  constructor() {
    super();
    this[slave] = {
      id: args['dist-io-slave-id'],
      alias: args['dist-io-slave-alias'],
      tasks: {},
    };

    // Set the process title, if desired.
    if (typeof args['dist-io-slave-title'] === 'string') {
      process.title = args['dist-io-slave-title'];
    }

    // Change default process title...
    if (/node$/.test(process.title)) {
      process.title = `DistIOSlave-${this.id}-${this.alias}`;
    }

    this.task('__dist.io__ack__', (data, done, meta, m) => {
      const now = Date.now();
      const uptime = Date.now() - INIT;
      return done({
        from: this.id,
        sent: m.sent,
        responsed: now,
        started: INIT,
        uptime,
        message:
          `Slave acknowledgement from=${this.id}, received=${m.sent}, ` +
          `responded=${now}, started=${INIT}, uptime=${uptime}`,
      });
    });

    this.task('__dist.io__null__', (data, done) => done());
    this.task('__dist.io__exit__', (data, done) => {
      process.removeListener('message', this[slave].messageListener);
      done(true);
    });
  }

  /**
   * Returns true if the message is from the master process.
   * @param {Object} m The message to inspect.
   * @return {Boolean} True if the message if from the master, false otherwise.
   */
  static isMasterMessage(m) {
    return typeof m === 'object'
      && typeof m.rid === 'number'
      && m.title === 'MasterIOMessage'
      && typeof m.for === 'number'
      && typeof m.command === 'string'
      && typeof m.secretNumber === 'number'
      && typeof m.secretId === 'string';
  }

  /**
   * Returns the slave's id.
   * @return {Number} The slave's id.
   */
  get id() {
    return this[slave].id;
  }

  /**
   * Returns the slave's alias.
   * @return {Number} The slave's alias.
   */
  get alias() {
    return this[slave].alias;
  }

  /**
   * Invoked when the slave receives an task command from the master.
   * @param {String} task The name of the task to execute.
   * @param {Object} meta Metadata from the master.
   * @param {*} data The data from the master.
   * @param {Object} m The original message sent by the master.
   * @return {Promise} A promise for completion.
   */
  invokeTaskListener(task, meta, data, m) {
    this.emit('task started', task, data, meta);
    return new Promise((resolve, reject) => {
      if (this[slave].tasks[task] instanceof Function) {
        try {
          this[slave].tasks[task].call(this, data, res => {
            this.emit('task completed', task, res, data, meta);
            if (res instanceof Error) reject(res); else resolve(res);
          }, meta, m);
        } catch (e) {
          reject(e);
          this.emit('task completed', task, e, data, meta);
        }
      } else {
        const err = new ReferenceError(`Slave #${this.id} does not listen to task "${task}"`);
        reject(err);
        this.emit('task completed', task, err, data, meta);
      }
    });
  }

  /**
   * Adds a task listener for this slave.
   * @param {String} name The name of the task.
   * @param {Function} listener The listener to attach.
   * @return {SlaveChildProcess} The current slave child process.
   */
  task(name, listener) {
    if (typeof name === 'string' && listener instanceof Function) {
      if (!this[slave].tasks[name]) {
        this[slave].tasks[name] = listener;
      } else {
        throw new TypeError(`Slave already has a listener for task ${name}`);
      }
    } else {
      throw new TypeError('Slave#task: Invalid arguments. Name should be a string, and listener a function.');
    }
    return this;
  }
}

/**
 * A singleton instanceof SlaveChildProcess
 * @type {SlaveChildProcess}
 */
const slaveInstance = new SlaveChildProcess();

/**
 * Sends the response message to the master process.
 * @param {Object} req The original request from the master.
 * @param {Object} res The results from the request execution.
 * @return {undefined}
 */
function sendMessageToMaster(req, res) {
  // The actual message to send to the master process...
  const response = {
    title: 'SlaveIOResponse',
    sent: Date.now(),
    request: req,
    error: null,
    data: undefined,
    [req.secretId]: req.secretNumber,
  };

  // Remove these as the above will be exposed.
  delete req.secretId;
  delete req.secretNumber;

  // Add each result, either as an error, or data.
  if (res instanceof Error) {
    response.error = { message: res.message, stack: res.stack, name: res.name };
  } else {
    response.data = res;
  }

  // Send the message to the parent process..
  slaveInstance.emit('sending message', response);
  process.send(response);
}

/**
 * Sends an exception response message to the master process.
 * @param {Object} res The data to send.
 * @return {undefined}
 */
function sendExceptionMessageToMaster(res) {
  slaveInstance.emit('sending exception', res);
  process.send(res);
}

/**
 * A listener attached to process.on('message', ...).
 * @param {*} m The message contents.
 * @return {undefined}
 */
function slaveMessageListener(m) {
  if (SlaveChildProcess.isMasterMessage(m)) {
    slaveInstance.invokeTaskListener(m.command, m.meta, m.data, m)
      .then(res => {
        sendMessageToMaster(m, res);
      })
      .catch(e => {
        sendMessageToMaster(m, e);
      });
  }
}

// Send an error on uncaught exception
process.on('uncaughtException', (e) => {
  sendExceptionMessageToMaster({
    from: slaveInstance.id,
    title: 'SlaveIOException',
    sent: Date.now(),
    error: { message: e.message, stack: e.stack, name: e.name },
  });
});

// Listens for master messages.
process.on('message', slaveMessageListener);
// Attach this to the slave child process instance, so we can remove it later.
slaveInstance[slave].messageListener = slaveMessageListener;

/**
 * A singleton instance of the SlaveChildProcess class.
 * @type {SlaveChildProcess}
 */
module.exports = slaveInstance;
