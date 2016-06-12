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
const args = require('minimist')(process.argv.slice(2), {
  number: ['dist-io-slave-id'],
  string: ['dist-io-slave-alias', 'dist-io-slave-title'],
});

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
      paused: false,
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
        data,
        meta,
      });
    });

    this.task('__dist.io__null__', (data, done) => done(null));
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
   * If called, the slave will stop accepting messages until Slave#resume is called.
   * @return {SlaveChildProcess} A self reference to the current SlaveChildProcess
   */
  pause() {
    this[slave].paused = true;
    return this;
  }

  /**
   * If called, the slave will once again continue accepting messages.
   * @return {SlaveChildProcess} A self reference to the current SlaveChildProcess
   */
  resume() {
    this[slave].paused = false;
    return this;
  }

  /**
   * @return {Boolean} True if the slave is paused, false otherwise.
   */
  get isPaused() {
    return this[slave].paused;
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
    /**
     * Emitted right before a slave is called upon to do a task (just before the .task() invocation).
     * @event task started
     * @argument {String} task The name of the task that was completed.
     * @argument {*} data The data to send back to the master.
     * @argument {Object} The metadata, which will also be sent back to the master.
     */
    this.emit('task started', task, data, meta);

    return new Promise((resolve, reject) => {
      if (this[slave].tasks[task] instanceof Function) {
        try {
          this[slave].tasks[task].call(this, data, res => {
            if (res instanceof Error) {
              this.emit('task completed', task, res, null, data, meta);
              reject(res);
            } else {
              this.emit('task completed', task, null, res, data, meta);
              resolve(res);
            }
          }, meta, m);
        } catch (e) {
          /**
           * Emitted when a slave process finishes a task, right before the data is sent back to the master.
           * @event task completed
           * @argument {String} task The name of the task that was completed.
           * @argument {Error|null} e An error, if one occured during the task
           * @argument {*} res The response value that's being sent back to the master.
           * @argument {*} data The data sent from the master.
           * @argument {Object} The metadata sent from the master.
           */
          this.emit('task completed', task, e, null, data, meta);
          reject(e);
        }
      } else {
        const err = new ReferenceError(`Slave #${this.id} does not listen to task "${task}"`);
        this.emit('task completed', task, err, null, data, meta);
        reject(err);
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

  // Send the message to the parent process...

  /**
   * Emitted when a slave process is sending a message to it's master
   * @event sending message
   * @argument {Obkect} response The response message the slave is sending.
   */
  slaveInstance.emit('sending message', response);

  if (process.send instanceof Function) {
    process.send(response);
  } else {
    throw new Error('Fatal: Disconnected from master process.');
  }
}

/**
 * Sends an exception response message to the master process.
 * @param {Object} res The data to send.
 * @return {undefined}
 */
function sendExceptionMessageToMaster(res) {
  /**
   * Emitted when a slave process is sending an exception to it's master
   * @event sending exception
   * @argument {Obkect} exception The exception response object the slave is sending.
   */
  slaveInstance.emit('sending exception', res);

  if (process.send instanceof Function) {
    process.send(res);
  } else {
    throw new Error('Fatal: Disconnected from master process.');
  }
}

/**
 * A listener attached to process.on('message', ...).
 * @param {*} m The message contents.
 * @return {undefined}
 */
function slaveMessageListener(m) {
  if (SlaveChildProcess.isMasterMessage(m)) {
    if (!slaveInstance.isPaused) {
      slaveInstance.invokeTaskListener(m.command, m.meta, m.data, m)
        .then(res => {
          sendMessageToMaster(m, res);
        })
        .catch(e => {
          sendMessageToMaster(m, e);
        });
    } else {
      sendMessageToMaster(m, new Error(`Slave #${slaveInstance.id} is not currently accepting messages.`));
    }
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
