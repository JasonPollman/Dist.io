/**
 * @file
 * Includes the Workpool class, an implementation of the workpool distributed computing pattern.
 * @copyright © 2016 Jason James Pollman
 */

'use strict';

/**
 * @module Workpool
 */

/**
 * Used to privatize members of the Workpool class.
 */
const workpool = Symbol();

const ResponseArray = require('./ResponseArray');

/**
 * An abstraction around the parallel, distrubuted computing workpool pattern.
 */
class Workpool {
  /**
   * @param {...Slaves} The list of slaves to start this workpool with.
   */
  constructor(...slaves) {
    const queue = [];
    this[workpool] = { lastIndex: -1, slaves, queue };

    if (slaves.length === 0) throw new Error('No slaves given to start workpool with!');

    slaves.forEach(s => {
      // Setup a listener for when a slave receives a response to pop the next task of the queue
      // and execute it while there are idle slaves.
      s.on('response', () => this.tickTaskQueue());
    });
  }

  /**
   * "Ticks" the task queue (invokes the next task to be done)
   * @return {undefined}
   */
  tickTaskQueue() {
    if (this[workpool].queue.length > 0) this[workpool].queue.shift()();
  }

  /**
   * Adds a "while" workpool task to the task queue.
   * @param {Function} predicate The predicate from the .while() call.
   * @param {String} command The command to execute.
   * @param {*} data Data for the command.
   * @param {Object} meta Metadata for the command.
   * @param {Function=} done An optional callback for completion.
   * @return {Promise} A promise for completion.
   */
  addWhileTask(predicate, command, data, meta, done) {
    if (data instanceof Function) data = undefined;
    if (meta instanceof Function) meta = undefined;

    let i = 0;
    let predicateFailed = false;
    let received = 0;
    let sent = 0;
    let executeWithIdle = null;

    const responses = new ResponseArray();

    return new Promise((resolve, reject) => {
      const ifPredicatePassesExecWithSlave = (s) => {
        if (!predicateFailed && predicate(i++, responses)) {
          sent++;
          s.exec(command, data, meta)
            .then(res => {
              ++received;
              responses.push(res);
              if (received === sent && predicateFailed) {
                resolve(responses);
                done.call(this, null, responses);
              } else {
                this[workpool].queue.push(executeWithIdle);
                this.tickTaskQueue();
              }
            })
            .catch(e => {
              done.call(this, e, null);
              reject(e);
            });
        } else {
          predicateFailed = true;
          if (received === sent) {
            resolve(responses);
            done.call(this, null, responses);
          }
        }
      };

      executeWithIdle = () => {
        const idleSlaves = require('./Master').slaves // eslint-disable-line global-require
          .idleInList(...this[workpool].slaves);

        idleSlaves.forEach(s => ifPredicatePassesExecWithSlave(s));
      };

      this[workpool].queue.push(executeWithIdle);
      this.tickTaskQueue();
    });
  }

  /**
   * Retrieves the next slave that should do work in the workpool.
   * If no slaves are available to do work, then null will be returned.
   * @return {Slave|Null} A slave that's ready for work, or null.
   */
  nextSlave() {
    if (this[workpool].lastIndex === this[workpool].slaves.length - 1) this[workpool].lastIndex = -1;

    const slaves = require('./Master').slaves // eslint-disable-line global-require
      .idleInList(...this[workpool].slaves);

    let slave;

    if (slaves.length > 1) {
      slave = slaves
      ._.where(s => this[workpool].slaves.indexOf(s) > this[workpool].lastIndex)
      ._.first();
    } else if (slaves.length === 1) {
      slave = slaves[0];
    }


    if (slave) this[workpool].lastIndex = this[workpool].slaves.indexOf(slave);
    return slave || null;
  }

  /**
   * Adds a task to the workpool queue.
   * @param {String} command The command to execute.
   * @param {*} data Data for the command.
   * @param {Object} meta Metadata for the command.
   * @param {Function=} done An optional callback for completion.
   * @return {Promise} A promise for completion.
   */
  addTask(command, data, meta, done) {
    if (data instanceof Function) data = undefined;
    if (meta instanceof Function) meta = undefined;

    return new Promise((resolve, reject) => {
      const doTask = () => {
        const s = this.nextSlave();
        if (s) {
          s.exec(command, data, meta)
            .then(res => {
              resolve(res);
              done.call(this, null, res);
            })
            .catch(e => {
              reject(e);
              done.call(this, e, null);
            });
        } else {
          this[workpool].queue.push(doTask);
        }
      };

      this[workpool].queue.push(doTask);
      this.tickTaskQueue();
    });
  }

  /**
   * Executes a while-loop style workpool task.
   * @param {[type]} predicate A function, that when invoked will keep adding tasks to the workpool until
   * a falsy value is returned.
   * @return {Promise} The same promise returned from Workpool#addWhileTask
   */
  while(predicate) {
    if (!(predicate instanceof Function)) {
      throw new TypeError(
        `Workpool#while expected argument #0 (predicate) to be a function, but got ${typeof predicate}.`
      );
    } else {
      return {
        do: (command, ...rest) => {
          const done = rest._.getCallback();
          const idx = rest.indexOf(done);

          if (idx > -1) rest.splice(idx, 1);
          return this.addWhileTask(predicate, command, rest[0], rest[1], done);
        },
      };
    }
  }

  /**
   * Adds a task to the workpool queue.
   * @param {String} command The command to execute
   * @param {...*} rest The rest of the arguments to pass to Workpool#addTask
   * @return {Promise} The same promise returned from Workpool#addTask
   */
  do(command, ...rest) {
    const done = rest._.getCallback();
    const idx = rest.indexOf(done);

    if (idx > -1) rest.splice(idx, 1);
    return this.addTask(command, rest[0], rest[1], done);
  }
}

/**
 * The Workpool class.
 * @type {Function}
 */
module.exports = Workpool;
