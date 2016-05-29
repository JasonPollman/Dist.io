/**
 * @file
 * The Master class, which controls Slave classes, which send messages to SlaveChildProcess programs.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';
const EventEmitter = require('events').EventEmitter;
const Slave = require('./Slave.js');
const ResponseArray = require('./ResponseArray');
const SlaveArray = require('./SlaveArray');
const COMMANDS = require('./Commands');

/**
 * @module DistIO/Master
 */

/**
 * The master "controller" class.
 * Controls IO flow and sends messages to slave processes.
 * @extends EventEmitter
 */
class Master extends EventEmitter {
  /**
   * Master constructor.
   * Sets the process title, if it hasn't been modified already...
   */
  constructor() {
    super();
    if (/node$/.test(process.title)) process.title = 'DistIOMaster';
  }

  /**
   * Gets the list of common commands
   */
  get COMMANDS() {
    return COMMANDS;
  }

  /**
   * Used to retrieve slaves.
   * @returns {Array<Slaves>} An array of slaves
   */
  get SLAVES() {
    return {
      ALL: Slave.getAllSlaves(),
    };
  }

  /**
   * Creates a new slave.
   * @param {String} path The file path to the slave's code.
   * @param {Object} options Options to pass to the slave constructor.
   * @param {...*} rest The rest of the argument to pass to the Slave constructor.
   * @return {Slave} The newly created slave.
   */
  createSlave(path, options, ...rest) {
    return new Slave(path, options, ...rest);
  }

  /**
   * Creates multiple slaves from a single file path.
   * @param {Number} count The number of slaves to create.
   * @param {String} path The file path to the slave's code.
   * @param {Object} options Options to pass to the slave constructor.
   * @param {...*} rest The rest of the argument to pass to the Slave constructor.
   * @throws {TypeError} When the value passed to the count param is non-numeric.
   * @return {Array<Slave>} The newly created slave(s).
   */
  createSlaves(count, path, options, ...rest) {
    const toCreate = count._.getNumeric();
    if (!toCreate._.isNumeric()) {
      throw new TypeError(`Master#createSlaves expected argument #0 (count) to be numeric, but got ${typeof count}`);
    }

    options = typeof options === 'object' ? options : {};

    const optionsArray = [];
    for (let i = 0; i < count; i++) {
      optionsArray.push(options._.clone());
      if (typeof options.alias === 'string') {
        if (i !== 0) {
          optionsArray[i].alias = `${options.alias}-${i}`;
        } else {
          optionsArray[i].alias = options.alias;
        }
      }
    }

    const slaves = new SlaveArray();
    for (let i = 0; i < count; i++) slaves.push(this.createSlave(path, optionsArray[i], ...rest));
    return slaves;
  }

  /**
   * Returns the slave with the given id, if it exists.
   * @param {...*} args The arguments to pass to Slave.getSlaveWithId.
   * @return {Slave|null} The slave with the given id, if it existed.
   */
  getSlaveWithId(...args) {
    return Slave.getSlaveWithId(...args);
  }

  /**
   * Returns the slave with the given alias, if it exists.
   * @param {...*} args The arguments to pass to Slave.getSlaveWithAlias.
   * @return {Slave|null} The slave with the given alias, if it existed.
   */
  getSlaveWithAlias(...args) {
    return Slave.getSlaveWithAlias(...args);
  }


  /**
   * Executes a slave task.
   * @param {Slave} slave The slave object to execute the task, or the slave id (or alias).
   * @param {...*} rest The remainder of the argument list.
   * @return {Promise} A promise for completion.
   */
  tellSlave(slave, ...rest) {
    const done = [...rest]._.getCallback();
    slave = Slave.getSlave(slave);

    return {
      to: (...args) => new Promise((resolve, reject) => {
        if (!(slave instanceof Slave)) {
          const e = new TypeError('Master#execute expected argument #0 (slave) to be an instanceof Slave');
          reject(e);
          done.call(this, e, null);
        }

        slave.exec(...args)
          .then(resolve)
          .catch(reject);
      }),
    };
  }

  /**
   * Syntatic sugar for Master#createSlaves and Master#createSlave.
   * @return {Object<Function>} An object containing the Master#createSlave and Master#tellSlave createSlaves.
   */
  get create() {
    return {
      slave: (...args) => new Promise(resolve => {
        resolve(this.createSlave(...args));
      }),

      slaves: (...args) => new Promise(resolve => {
        resolve(this.createSlaves(...args));
      }),

      pipeline: this.createPipeline,
    };
  }

  /**
   * Syntatic sugar for Master#broadcast and Master#tellSlave
   * @return {Object<Function>} An object containing the Master#broadcast and Master#tellSlave methods.
   */
  get tell() {
    return {
      slave: this.tellSlave,
      slaves: (...slaves) => { // eslint-disable-line arrow-body-style
        return {
          to: (...args) => this.broadcast(...args).to(...slaves),
        };
      },
    };
  }

  /**
   * Attempts to resolve the slave with the given arugment.
   * @param {Slave|String|Number} s The value to resolve the slave with.
   * @return {Slave|null} The slave, if it was resolved.
   */
  slave(s) {
    return Slave.getSlave(s);
  }

  /**
   * Broadcasts a message to all slaves, or a group. Returns an object for syntatic sugar.
   * @param {String} command The command to send to the slave.
   * @param {...*} args Arguments to pass to Slave#exec
   * @return {Promise} A promise for completion.
   */
  broadcast(command, ...args) {
    const done = [...args]._.getCallback();
    const bcast = {
      to: (...slaveList) => new Promise((resolve, reject) => {
        if (typeof command === 'string' || typeof command === 'symbol' || (command && command._.isNumeric())) {
          if (typeof command === 'number') command = command.toString();
          let slaves = [];

          // Build out the slave list...
          [...slaveList]._.every((slaveOrGroup) => {
            const slaveGroup = Slave.getSlavesInGroup(slaveOrGroup);
            const s = slaveGroup.length > 0 ? slaveGroup : Slave.getSlave(slaveOrGroup);

            if (s instanceof Array) {
              slaves = slaves.concat(s);
            } else if (s) {
              slaves.push(s);
            }
            return true;
          });

          const totalTasks = slaves.length;
          const responses = new ResponseArray();
          let completedTasks = 0;

          /**
           * When a response is received from one of the slaves.
           * @param {Response} res The response object from the slave.
           * @returns {undefined}
           * @function
           */
          const onResponse = res => {
            responses.push(res);
            if (++completedTasks === totalTasks) {
              responses.sort(
                (a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0) // eslint-disable-line no-nested-ternary
              );

              done(this, null, responses);
              resolve(responses);
            }
          };

          if (slaves.length === 0) {
            // No slaves to send the message to, resolve with empty response array.
            done(this, null, responses);
            resolve(responses);
          } else {
            // Execute the command with each slave.
            slaves._.every(s => {
              s.exec(command, ...args).then(onResponse).catch(onResponse);
              return true;
            });
          }
        } else {
          // Got invalid command.
          const e =
            new TypeError(
              `Master#broadcast expected argument #0 (command) to be a string or number, but got ${typeof command}.`
            );

          reject(e);
          done.call(this, e, null);
        }
      }),
    };

    // Attach broadcast to all function
    bcast.to.all = () => this.broadcast(command, ...args).to(...Slave.getAllSlaves());
    return bcast;
  }

  /**
   * Creates a new executable task pipeline.
   * @return {Object} A pipeline object.
   */
  createPipeline() {
    const tasks = [];
    let task = null;

    /**
     * An object that holds the key (with) to start pipeline execution.
     * @type {Object<Function>}
     */
    const execute = {
      /**
       * Executes the pipeline with the given data.
       * @param {*} data The initial data to start the pipeline with.
       * @param {Object} meta The metadata to pass to the pipeline.
       * @return {Promise} A promise for completion.
       */
      with: (data, meta, ...rest) => new Promise((resolve, reject) => {
        // Copy the task queue to allow for multi-execution
        const thisRunsTasks = tasks._.copy();
        const done = [...rest]._.getCallback();

        /**
         * Performs the tasks in the task queue recursively until no tasks remain.
         * @param {String|Number|Symbol} taskToPerform A task object to perform.
         * @param {*} dataForTask The data to perform the task with.
         * @param {Object} metadataForTask The metadata to pass to this task.
         * @return {undefined}
         */
        const doTask = (taskToPerform, dataForTask, metadataForTask) => {
          taskToPerform.slave.exec(taskToPerform.command, dataForTask, metadataForTask)
            .then(res => {
              if (res.error) return reject(res.error); // Reject pipeline on error.

              const nextTask = thisRunsTasks.shift();
              let finished = false;

              /**
               * Cuts off pipeline execution.
               * @param {*} value The value to end execution with.
               * @return {undefined}
               */
              const end = (value) => {
                finished = true;
                if (value !== undefined) res.value = value;
                done(null, res);
                resolve(res);
              };

              // Execute all the intercepts...
              taskToPerform.intercepts._.every(intercept => {
                try {
                  return intercept.call(taskToPerform.slave, res, end);
                } catch (e) {
                  done(e, null);
                  reject(e);
                  finished = true;
                  return false; // Break every loop
                }
              });

              // Perform the next task in the queue...
              if (nextTask && !finished) {
                doTask(nextTask, res.value, meta);
              } else {
                done(null, res);
                resolve(res);
              }
              return null;
            })
            .catch(e => {
              done(e, null);
              reject(e);
            });
        };

        // Execute the first task...
        doTask(thisRunsTasks.shift(), data, meta);
      }),
    };

    /**
     * Allows the user to intercept responses between pipeline sections and modify it.
     * @param {Function} callback The function to execute on task response.
     * @return {Object} Various chaining objects to continue defining the pipeline.
     */
    const intercept = (callback) => {
      if (callback instanceof Function) tasks[tasks.length - 1].intercepts.push(callback);
      return { do: task, execute };
    };

    /**
     * Adds a slave to the task queue.
     * @param {Slave|Number|String} s The slave (or slave id, or slave alias) to add.
     * @return {Object} Various chaining objects to continue defining the pipeline.
     */
    const slave = (s) => {
      const taskSlave = Slave.getSlave(s);
      if (!taskSlave) throw new TypeError('Master#pipeline.task.for.slave requires an instanceof Slave.');
      tasks[tasks.length - 1].slave = s;
      return { intercept, do: task, execute };
    };

    /**
     * Adds a new task to the pipeline.
     * @param {String|Number|Symbol} command The task command to execute.
     * @return {Object} Various chaining objects to continue defining the pipeline.
     */
    task = (command) => {
      if (!(typeof command === 'string' || typeof command === 'symbol' || typeof command === 'number')) {
        throw new TypeError(
          `Master#pipeline.task expected a string, number, or symbol, but got ${typeof command}.`
        );
      }
      tasks.push({ command, slave: null, intercepts: [] });
      return { with: { slave } };
    };

    task.execute = execute;
    return { do: task };
  }

  /**
   * Closes all the given slaves.
   * @param {...Slave} slaves A list of the slaves to close.
   * @return {Promise} A promise for completion.
   */
  close(...slaves) {
    slaves = [...slaves];
    const done = [...slaves]._.getCallback();
    const statuses = [];
    const total = slaves.length;
    let complete = 0;

    return new Promise(resolve => {
      slaves.forEach(s => {
        if (s instanceof Slave) {
          s.close()
            .then(status => {
              statuses.push(status);
              if (++complete === total) {
                done.call(this, statuses);
                resolve(statuses);
              }
            })
            .catch(status => {
              statuses.push(status);
              if (++complete === total) {
                done.call(this, statuses);
                resolve(statuses);
              }
            });
        }
      });
    });
  }
}

/**
 * A singleton instance of the Master class.
 * @type {Master}
 */
module.exports = new Master();
