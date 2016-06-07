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
const Workpool = require('./Workpool');
const lib = require('proto-lib').get('_');
const options = Symbol();

// Extend proto-lib to strip out callbacks....
lib.extend(Array, 'getAndStripCallback', (a) => {
  const done = a._.getCallback();
  const idx = a.indexOf(done);
  if (idx > -1) a.splice(idx, 1);
  return done;
});

/**
 * @module DistIO/Master
 */

/**
 * Flattens a slave list down to an array of slaves.
 * So if an array is encountered, it's elements will simply be added to the slave list.
 * @param {Boolean} strict If true, this will throw when it encounters a non-Slave argument.
 * @param {...Slave|Array} slaveList The list of slaves to flatten.
 * @return {Array<Slaves>} The flattened list of slaves.
 */
function flattenSlaveList(strict, ...slaveList) {
  let slaves = [];
  slaveList._.every(function buildSlaveList(slaveOrGroup) {
    if (slaveOrGroup instanceof Array) return slaveOrGroup._.every(buildSlaveList);
    const slaveGroup = Slave.getSlavesInGroup(slaveOrGroup);
    const s = slaveGroup.length > 0 ? slaveGroup : Slave.getSlave(slaveOrGroup);

    if (s instanceof Array) {
      slaves = slaves.concat(s);
    } else if (s) {
      slaves.push(s);
    } else if (strict) {
      throw new TypeError(
        `Expected an instanceof Slave, slave id, group id, or slave alias, but got "${slaveOrGroup}".`
      );
    }
    return true;
  });
  return slaves;
}

/**
 * Validate the given command. If validation fails, a type error is thrown.
 * @param {String|Number|Symbol} command The command to validate.
 * @return {String|Symbol} The validated command.
 */
function validateCommand(command) {
  if (!(typeof command === 'string' || typeof command === 'symbol' || typeof command === 'number')) {
    throw new TypeError(
      `Task command must be a string, number, or symbol, but got ${typeof command}.`
    );
  }

  if (typeof command === 'number') command = command.toString();
  return command;
}

/**
 * The master "controller" class.
 * Controls IO flow and sends messages to slave processes.
 * @extends EventEmitter
 */
class Master extends EventEmitter {
  /**
   * Master constructor.
   * Sets the process title, if it hasn't been modified already...
   * @param {Obejct} opts User options.
   */
  constructor(opts) {
    super();
    this[options] = typeof opts === 'object' ? opts : {};
    if (/node$/.test(process.title)) process.title = 'DistIOMaster';

    // Closes all slaves
    this.close.all = () => this.close(this.slaves.all);
    // Closes all slaves in the given group
    this.close.group = (g, cb) => this.close(this.slaves.inGroup(g), cb);
    // Shutsdown all slaves
    this.shutdown.all = () => this.shutdown(this.slaves.all);
    // Shutsdown all slaves in the given group
    this.shutdown.group = (g, cb) => this.shutdown(this.slaves.inGroup(g), cb);
    // Kills all slaves
    this.kill.all = () => this.kill(this.slaves.all);
    // Kills all slaves in the given group
    this.kill.group = (g) => this.kill(this.slaves.inGroup(g));
  }

  /**
   * If set, every request sent will have this timeout period set on it.
   * @param {Number} timeout The default timeout period to set in ms.
   */
  set defaultTimeout(timeout) {
    Slave.defaultTimeout = timeout;
  }

  /**
   * @return {Number|null} The default timeout period for all slaves.
   */
  get defaultTimeout() {
    return Slave.defaultTimeout;
  }

  /**
   * Sets the default "catchAll" value on the Slave class, for all slaves.
   * @param {Boolean|null} value The value to set.
   */
  set shouldCatchAll(value) {
    Slave.shouldCatchAll = value;
  }

  /**
   * @return {Boolean|null} The default "catchAll" setting for all slaves.
   */
  get shouldCatchAll() {
    return Slave.shouldCatchAll;
  }

  /**
   * Gets the list of common commands
   */
  get commands() {
    return COMMANDS;
  }

  /**
   * Used to retrieve slaves.
   * @returns {Array<Slaves>} An array of slaves
   */
  get slaves() {
    return {
      /**
       * Gets all slaves
       * @type {Array<Slave>}
       */
      all: Slave.getAllSlaves(),

      /**
       * Gets all busy slaves
       * @type {Array<Slave>}
       */
      busy: Slave.getAllBusySlaves(),

      /**
       * Gets all idle slaves
       * @type {Array<Slave>}
       */
      idle: Slave.getAllIdleSlaves(),

      /**
       * Gets the idle slaves in the list of slaves.
       * @param {...String|Number|Slave} slaveList The list of slave to find idle slaves.
       * @return {Array<Slave>} An array of slaves.
       */
      idleInList: (...slaveList) => {
        const slaves = flattenSlaveList(true, ...slaveList);
        return new SlaveArray(...slaves._.where(s => s.isIdle));
      },

      /**
       * Gets the least busy slave
       * @type {Slave}
       */
      leastBusy: Slave.getLeastBusy(...Slave.getAllSlaves()),

      /**
       * Gets all slaves in the given group.
       * @param {String} g The group to get the slaves from.
       * @return {Array<Slave>} An array of slaves.
       */
      inGroup: (g) => Slave.getSlavesInGroup(g),

      /**
       * Gets all slaves not in the given group.
       * @param {String} g The group to omit slaves.
       * @return {Array<Slave>} An array of slaves.
       */
      notInGroup: (g) => {
        const slavesInGroupG = Slave.getSlavesInGroup(g);
        const all = Slave.getAllSlaves();
        return new SlaveArray(...all.filter(s => slavesInGroupG.indexOf(s) === -1));
      },

      /**
       * Gets the least busy slave in the given group.
       * @param {String} g The group to find the least busy slave.
       * @return {Array<Slave>} An array of slaves.
       */
      leastBusyInGroup: (g) => Slave.getLeastBusy(...Slave.getSlavesInGroup(g)),

      /**
       * Gets the least busy slave in the list of slaves.
       * @param {...String|Number|Slave} slaveList The list of slave to find the least busy from.
       * @return {Array<Slave>} An array of slaves.
       */
      leastBusyInList: (...slaveList) => Slave.getLeastBusy(...flattenSlaveList(true, ...slaveList)),
    };
  }

  /**
   * Determines if the given slave belongs to the provided group.
   * @param {String|Number|Slave} s The slave, slave id, or slave alias to determine group membership.
   * @param {String} g The group to determine if the slave belongs to.
   * @return {Boolean} True if the slave belongs to the group, false otherwise.
   */
  slaveBelongsToGroup(s, g) {
    s = Slave.getSlave(s);
    if (!s || !g || typeof g !== 'string') return false;
    return s.group === g;
  }

  /**
   * Creates a new slave.
   * @param {String} path The file path to the slave's code.
   * @param {Object} slaveOptions Options to pass to the slave constructor.
   * @param {...*} rest The rest of the argument to pass to the Slave constructor.
   * @return {Slave} The newly created slave.
   */
  createSlave(path, slaveOptions, ...rest) {
    const done = rest._.getAndStripCallback();
    const slave = new Slave(path, slaveOptions, ...rest);
    done.call(slave, slave);

    /**
     * Emitted when a new slave is created by the master process.
     * @event slave created
     * @argument {Slave} slave The newly created slave instance.
     */
    this.emit('slave created', slave);
    return slave;
  }

  /**
   * Creates multiple slaves from a single file path.
   * @param {Number} count The number of slaves to create.
   * @param {String} path The file path to the slave's code.
   * @param {Object} slaveOptions Options to pass to the slave constructor.
   * @param {...*} rest The rest of the argument to pass to the Slave constructor.
   * @throws {TypeError} When the value passed to the count param is non-numeric.
   * @return {Array<Slave>} The newly created slave(s).
   */
  createSlaves(count, path, slaveOptions, ...rest) {
    const done = rest._.getAndStripCallback();
    const toCreate = count._.getNumeric();
    if (!toCreate._.isNumeric()) {
      throw new TypeError(`Master#createSlaves expected argument #0 (count) to be numeric, but got ${typeof count}`);
    }

    slaveOptions = typeof slaveOptions === 'object' ? slaveOptions : {};

    const optionsArray = [];
    for (let i = 0; i < count; i++) {
      optionsArray.push(slaveOptions._.clone());
      if (typeof slaveOptions.alias === 'string') {
        if (i !== 0) {
          optionsArray[i].alias = `${slaveOptions.alias}-${i}`;
        } else {
          optionsArray[i].alias = slaveOptions.alias;
        }
      }
    }

    const slaves = new SlaveArray();
    for (let i = 0; i < count; i++) slaves.push(this.createSlave(path, optionsArray[i]));
    done.call(slaves, slaves);
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
   * Returns the slave with the given path.
   * @param {...*} args The arguments to pass to Slave.getSlaveWithPath.
   * @return {SlaveArray<Slave>} The slaves with the given path, if any exist.
   */
  getSlavesWithPath(...args) {
    return Slave.getSlavesWithPath(...args);
  }

  /**
   * Executes a slave task.
   * @param {Slave} slave The slave object to execute the task, or the slave id (or alias).
   * @return {Promise} A promise for completion.
   */
  tellSlave(slave) {
    slave = Slave.getSlave(slave);

    return {
      to: (...args) => new Promise((resolve, reject) => {
        const done = args._.getAndStripCallback();
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
   * Syntatic sugar for Master#createSlaves, Master#createSlave and various patterns.
   * @return {Object<Function>} An object containing the Master#createSlave and Master#tellSlave createSlaves.
   */
  get create() {
    return {
      slave: (...args) => this.createSlave(...args),
      slaves: (...args) => this.createSlaves(...args),

      pipeline: (...args) => this.createPipeline(...args),
      scatter: (...args) => this.createScatter(...args),
      workpool: (...args) => this.createWorkpool(...args),
      parallel: (...args) => this.createParallel(...args),
    };
  }

  /**
   * Syntatic sugar for Master#broadcast and Master#tellSlave
   * @return {Object<Function>} An object containing the Master#broadcast and Master#tellSlave methods.
   */
  get tell() {
    return (...slaves) => ({
      to: (...args) => {
        const done = args._.getAndStripCallback();
        return this.broadcast(...args).to(...slaves, done);
      },
    });
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
   * Creates a new parallel directive.
   * @return {Object} A parallel object, for building out parallel tasks.
   */
  createParallel() {
    const tasks = [];
    let doTask = null;
    let forSlave = null;
    let setTimes = null;
    let times = 1;

    const executeTasks = (...args) => {
      const done = args._.getAndStripCallback();

      return new Promise((resolve, reject) => {
        const total = tasks.length * times;
        const responses = [];

        let completed = 0;
        let broken = false;

        if (tasks.length === 0 || times <= 0) {
          const res = new ResponseArray();
          done.call(this, null, res);
          resolve(res);
          return;
        }

        const singleResponse = times === 1;

        const doIteration = (n) => {
          tasks.forEach((t, i) => {
            if (!responses[n]) responses[n] = new ResponseArray();

            if (!(t.slave instanceof Slave)) {
              const e = new TypeError(`Task #${i} is missing a slave. Did you forget to call ".for"?`);
              done.call(this, e, null);
              reject(e);
              return;
            }

            t.slave.exec(t.command, t.data, t.meta)
              .then(res => {
                responses[n].push(res);
                if (!broken && ++completed === total) {
                  const result = singleResponse ? responses[0] : responses;
                  done.call(this, null, result);
                  resolve(result);
                }
              })
              .catch(e => {
                if (!broken) {
                  broken = true;
                  done.call(this, e, null);
                  reject(e);
                }
              });
          });
        };

        for (let n = 0; n < times; n++) doIteration(n);
      });
    };

    setTimes = (n) => {
      if (typeof n === 'number') times = n;
      return { execute: executeTasks };
    };

    forSlave = (slave) => {
      slave = Slave.getSlave(slave);
      if (!slave) throw new TypeError('Master#paralle.addTask.for expected argument #0 to be an instanceof Slave.');

      tasks[tasks.length - 1].slave = slave;
      return { addTask: doTask, execute: executeTasks, times: setTimes };
    };

    doTask = (command, data, meta) => {
      validateCommand(command);
      tasks.push({ command, data, meta, slave: null });
      return { for: forSlave };
    };

    return { addTask: doTask, execute: executeTasks };
  }

  /**
   * Creates a wookpool from the given slave list.
   * @param {...Slave|Number|String} A list of slaves to create the workpool from.
   * @return {Object} A workpool object.
   */
  createWorkpool(...slaves) {
    return new Workpool(...flattenSlaveList(true, slaves));
  }

  /**
   * Broadcasts a message to all slaves, or a group. Returns an object for syntatic sugar.
   * @param {String} command The command to send to the slave.
   * @param {*} data The data to send with this command.
   * @param {Object} meta The metadata to send with this broadcast.
   * @return {Promise} A promise for completion.
   */
  broadcast(command, data, meta) {
    const bcast = {
      to: (...slaveList) => new Promise((resolve, reject) => {
        const done = slaveList._.getAndStripCallback();

        if (typeof command === 'string' || typeof command === 'symbol' || (command && command._.isNumeric())) {
          if (typeof command === 'number') command = command.toString();

          const slaves = flattenSlaveList(true, ...slaveList);

          const totalTasks = slaves.length;
          const singleResponse = slaves.length === 1;
          const responses = new ResponseArray();
          let broken = false;
          let completedTasks = 0;

          /**
           * When a response is received from one of the slaves.
           * @param {Response} res The response object from the slave.
           * @returns {undefined}
           * @function
           */
          const onResponse = res => {
            if (!broken) {
              if (res instanceof Error) {
                broken = true;
                done.call(this, res, null);
                reject(res);
                return;
              }

              responses.push(res);
              if (++completedTasks === totalTasks) {
                responses.sort(
                  (a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0) // eslint-disable-line no-nested-ternary
                );

                if (singleResponse) {
                  done.call(this, null, responses[0]);
                  resolve(responses[0]);
                } else {
                  done.call(this, null, responses);
                  resolve(responses);
                }
              }
            }
          };

          if (slaves.length === 0) {
            // No slaves to send the message to, resolve with empty response array.
            done.call(this, null, responses);
            resolve(responses);
          } else {
            slaves._.every(s => {
              s.exec(command, data, meta).then(onResponse).catch(onResponse);
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
    bcast.to.all = () => this.broadcast(command, data, meta).to(...Slave.getAllSlaves());
    // Attach broadcast to idle function
    bcast.to.idle = () => this.broadcast(command, data, meta).to(...Slave.getAllIdleSlaves());
    // Attach broadcast to group function
    bcast.to.group = (g) => this.broadcast(command, data, meta).to(...Slave.getSlavesInGroup(g));
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
     * Executes the pipeline with the given data.
     * @param {*} data The initial data to start the pipeline with.
     * @param {Object} meta The metadata to pass to the pipeline.
     * @return {Promise} A promise for completion.
     */
    const execute = (data, ...rest) => new Promise((resolve, reject) => {
      // Copy the task queue to allow for multi-execution
      const thisRunsTasks = tasks._.copy();
      const done = rest._.getAndStripCallback();

      let meta;
      if (typeof rest[0] === 'object') meta = rest[0];

      /**
       * Performs the tasks in the task queue recursively until no tasks remain.
       * @param {String|Number|Symbol} taskToPerform A task object to perform.
       * @param {*} dataForTask The data to perform the task with.
       * @param {Object} metadataForTask The metadata to pass to this task.
       * @return {undefined}
       */
      const doTask = (taskToPerform, dataForTask, metadataForTask) => {
        if (!(taskToPerform.slave instanceof Slave)) {
          const e = new Error(`Task "${taskToPerform.command}" is missing a slave. Did you forget to chain ".for"?`);
          done.call(this, e, null);
          reject(e);
          return;
        }

        taskToPerform.slave.exec(taskToPerform.command, dataForTask, metadataForTask)
          .then(res => {
            if (res.error) {
              // Reject pipeline on error.
              done.call(this, res.error, null);
              return reject(res.error);
            }

            const nextTask = thisRunsTasks.shift();
            let finished = false;

            /**
             * Cuts off pipeline execution.
             * @param {*} value The value to end execution with.
             * @return {undefined}
             */
            const end = (value) => {
              finished = true;
              if (value instanceof Error) {
                res.error = value;
              } else if (value !== undefined) {
                res.value = value;
              }
              done.call(this, null, res);
              resolve(res);
            };

            // Execute all the intercepts...
            taskToPerform.intercepts._.every(intercept => {
              try {
                return intercept.call(taskToPerform.slave, res, end);
              } catch (e) {
                done.call(this, e, null);
                reject(e);
                finished = true;
                return false; // Break every loop
              }
            });

            // Perform the next task in the queue...
            if (nextTask && !finished) {
              doTask(nextTask, res.value, meta);
            } else {
              done.call(this, null, res);
              resolve(res);
            }
            return null;
          })
          .catch(e => {
            done.call(this, e, null);
            reject(e);
          });
      };

      // Execute the first task...
      doTask(thisRunsTasks.shift(), data, meta);
    });

    /**
     * Allows the user to intercept responses between pipeline sections and modify it.
     * @param {Function} callback The function to execute on task response.
     * @return {Object} Various chaining objects to continue defining the pipeline.
     */
    const intercept = (callback) => {
      if (callback instanceof Function) tasks[tasks.length - 1].intercepts.push(callback);
      return { addTask: task, execute };
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
      return { intercept, addTask: task, execute };
    };

    /**
     * Adds a new task to the pipeline.
     * @param {String|Number|Symbol} command The task command to execute.
     * @return {Object} Various chaining objects to continue defining the pipeline.
     */
    task = (command) => {
      command = validateCommand(command);
      tasks.push({ command, slave: null, intercepts: [] });
      return { for: slave };
    };

    task.execute = execute;
    return { addTask: task, execute };
  }

  /**
   * Splits data up among slaves for the given command.
   * @param {Object} command The command to bind to this scatter.
   * @param {Object} meta Meta data for this scatter.
   * @return {Object<Function>} Various functions to finish creating this scatter.
   */
  createScatter(command, meta) {
    command = validateCommand(command);
    let dataList = [];
    const tasks = [];

    /**
     * Executes the scatter, and gathers the responses into a response array.
     * @param {...Slaves} slaves The slaves to execute this scatter with.
     * @return {ResponseArray} An array of responses.
     */
    const gather = (...slaves) => {
      let completed = 0;
      let done = function EMPTY_CALLBACK() {};

      const responses = new ResponseArray();

      if (slaves[slaves.length - 1] instanceof Function) done = slaves.pop();
      slaves = flattenSlaveList(true, ...slaves);

      return new Promise((resolve, reject) => {
        if (!slaves || slaves.length === 0) {
          const e = Error('Cannot gather without at least one slave!');
          done.call(this, e, responses);
          reject(e);
        }

        // Build out task list...
        for (let i = 0; i < dataList.length; i++) {
          tasks.push({
            data: dataList[i],
            slave: slaves[i % slaves.length],
          });
        }

        // We have no tasks to scatter, simply resolve...
        if (tasks.length === 0) {
          done.call(this, null, responses);
          resolve(responses);
          return;
        }

        // Execute task list...
        tasks.forEach(t => {
          this.tellSlave(t.slave).to(command, t.data, meta)
            .then(res => {
              responses.push(res);
              if (++completed === tasks.length) {
                done.call(this, null, responses);
                resolve(responses);
              }
            })
            .catch(e => {
              responses.push(e);
              if (++completed === tasks.length) {
                done.call(this, null, responses);
                resolve(responses);
              }
            });
        });
      });
    };

    /**
     * Adds data to the scatter.
     * @param {...*} d The data to add.
     * @return {Object<Function>} An object containing a self reference for chaining, and the gather method.
     */
    const data = (...d) => {
      dataList = dataList.concat(...d);
      return { data, gather };
    };

    return { data };
  }

  /**
   * Gracefully Closes all the given slaves.
   * @param {...Slave} slaves A list of the slaves to close.
   * @return {Promise} A promise for completion.
   */
  close(...slaves) {
    const done = slaves._.getAndStripCallback();
    slaves = flattenSlaveList(false, ...slaves);
    const statuses = [];
    const total = slaves.length;
    let complete = 0;

    return new Promise(resolve => {
      const singleResponse = slaves.length === 1;
      const onClose = (status) => {
        statuses.push(status);
        if (++complete === total) {
          const res = singleResponse ? statuses[0] : statuses;
          done.call(this, res);
          resolve(res);
        }
      };

      slaves.forEach(s => s.close().then(onClose).catch(onClose));
    });
  }

  /**
   * Gracefully Closes all the given slaves, after all messages are received.
   * @param {...Slave} slaves A list of the slaves to close.
   * @return {Promise} A promise for completion.
   */
  shutdown(...slaves) {
    const done = slaves._.getAndStripCallback();
    slaves = flattenSlaveList(false, ...slaves);

    const statuses = [];
    const total = slaves.length;
    let complete = 0;

    return new Promise(resolve => {
      const singleResponse = slaves.length === 1;
      const onShutdown = (status) => {
        statuses.push(status);
        if (++complete === total) {
          const res = singleResponse ? statuses[0] : statuses;
          done.call(this, null, res);
          resolve(res);
        }
      };

      slaves.forEach(s => s.shutdown().then(onShutdown).catch(onShutdown));
    });
  }

  /**
   * Kills all the given slaves with SIGKILL
   * @param {...Slave} slaves A list of the slaves to close.
   * @return {Master} A self reference for chaining.
   */
  kill(...slaves) {
    slaves = flattenSlaveList(false, ...slaves);
    slaves.forEach(s => s.kill('SIGKILL'));
    return this;
  }
}

/**
 * A singleton instance of the Master class.
 * @type {Master}
 */
module.exports = new Master();
