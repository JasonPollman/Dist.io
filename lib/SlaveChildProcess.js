/**
 * @file
 * The actual slave processes require this file for use in setting up the slave process
 * and defining slave tasks.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';
require('proto-lib').get('_');
const Slave = require('./Slave');

const os = require('os');
const v8 = require('v8'); // eslint-disable-line import/no-unresolved

/**
 * @module DistIO/SlaveChildProcess
 */

const EventEmitter = require('events').EventEmitter;
const args = require('minimist')(process.argv.slice(2), {
  number: ['dist-io-slave-id', 'dist-io-slave-remote-id'],
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
 * Used to match against function strings and retrieve the parameter list.
 * @type {RegExp}
 */
const paramListRegExp = /\s*function(?:\s+[$_a-z][$_a-z0-9]*)?\s*\((.*?)\)|\s*\((.*?)\)\s*=>/i;

/**
 * Finds the invocation of the "paramName" function, given the name of the parameter.
 * @param {String} functionString The string version of the function.
 * @param {String} paramName The name of the parameter to seek out invocation.
 * @returns {Boolean} True if the given parameter name is invoked false otherwise.
 */
function matchDoneCall(functionString, paramName) {
  const invocationRegExp = new RegExp(
    `(${paramName._.regexpSafe()}(?:\.(?:call|apply))?\\s*\\([\\S\\s]*?\\s*\\))`, 'im'
  );

  const match = functionString.match(invocationRegExp);
  if (match && match.length === 2) return true;
  return false;
}

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
      rid: typeof args['dist-io-slave-remote-id'] === 'number' ? args['dist-io-slave-remote-id'] : null,
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
      process.title = `dist.io-slave-${this.id}`;
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
    this.task('__dist.io__info__', (data, done) => done(
      {
        os: {
          platform: os.platform(),
          type: os.type(),
          cpus: os.cpus(),
        },
        process: {
          arch: process.arch,
          usage: process.cpuUsage(),
          heap: v8.getHeapStatistics(),
        },
      }
    ));
    this.task('__dist.io__exit__', (data, done) => {
      process.removeListener('message', this[slave].messageListener);
      /**
       * Emitted when the master sends the shutdown signal.
       * @event close requested
       */
      this.emit('close requested');
      done(true);
    });
  }

  /**
   * Determines if the given function task listener invokes the "done" callback.
   * @static
   * @param {Function} f The listener to inspect.
   * @return {Boolean} True if the listener calls done, false otherwise.
   */
  listenerCallsDone(f) {
    const functionString = f.toString();
    const match = functionString.match(paramListRegExp);
    if (match && (match[1] || match[2]) && !(match[1] && match[2])) {
      const paramList = match[1] || match[2];
      const params = paramList.trim().split(/,\s*/g);
      if (params.length >= 2) return matchDoneCall(functionString, params[1]);
    }
    return false;
  }

  /**
   * Returns the slave's id.
   * @return {Number} The slave's id.
   */
  get id() {
    return this[slave].rid || this[slave].rid === 0 ? this[slave].rid : this[slave].id;
  }

  /**
   * Returns the slave's local id.
   * @return {Number} The slave's local id.
   */
  get serverId() {
    return this[slave].id;
  }

  /**
   * Returns the slave's remote id (if one exists).
   * @return {Number} The slave's remote id.
   */
  get remoteId() {
    return this[slave].rid;
  }

  /**
   * @return {Boolean} True if the slave is remote, false otherwise.
   */
  get wasProxied() {
    return typeof this[slave].rid === 'number';
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
    if (this[slave].paused === false) {
      /**
       * Emitted when the slave is paused.
       * @event paused
       */
      this.emit('paused');
      this[slave].paused = true;
    }
    return this;
  }

  /**
   * If called, the slave will once again continue accepting messages.
   * @return {SlaveChildProcess} A self reference to the current SlaveChildProcess
   */
  resume() {
    if (this[slave].paused === true) {
      /**
       * Emitted when the slave is resumed.
       * @event resumed
       */
      this.emit('resumed');
      this[slave].paused = false;
    }
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
        const done = res => {
          if (res instanceof Error) {
            this.emit('task completed', task, res, null, data, meta);
            reject(res);
          } else {
            this.emit('task completed', task, null, res, data, meta);
            resolve(res);
          }
        };

        try {
          if (this[slave].tasks[task].invokesDone) {
            this[slave].tasks[task].call(this, data, done, meta, m._.copy());
          } else {
            const res = this[slave].tasks[task].call(this, data, done, meta, m._.copy());
            done(res);
          }
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
   * Invokes a slave task, as if it were called from the master process.
   * @param {String} task The name of the slave task to invoke.
   * @param {*} data The data to pass to the task.
   * @param {Function=} done An optional callback for completion.
   * @return {Promise} Resolves when the task is done.
   */
  invoke(task, ...rest) {
    const done = rest._.getCallback();
    const data = rest[1] === done ? undefined : rest[1];

    return new Promise((resolve, reject) => {
      this.invokeTaskListener(task, {}, data, {})
        .then(res => {
          resolve(res);
          done.call(this, null, res);
        })
        .catch(e => {
          reject(e);
          done.call(this, e, null);
        });
    });
  }

  /**
   * Adds a task listener for this slave.
   * @param {String} name The name of the task.
   * @param {Function} listener The listener to attach.
   * @return {SlaveChildProcess} The current slave child process.
   */
  task(name, listener) {
    if (typeof name === 'number') name = name.toString();
    if (typeof name === 'string' && listener instanceof Function) {
      if (!this[slave].tasks[name]) {
        listener.invokesDone = this.listenerCallsDone(listener);
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
  if (Slave.isMasterMessage(m)) {
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
process.on('uncaughtException', e => {
  sendExceptionMessageToMaster({
    from: slaveInstance.id,
    title: 'SlaveIOException',
    sent: Date.now(),
    error: { message: e.message, stack: e.stack, name: e.name },
  });

  // Throw if exception to simulate default behavior,
  // if no other uncaughtException listeners are present...
  if (process.listenerCount('uncaughtException') === 1) throw e;
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
