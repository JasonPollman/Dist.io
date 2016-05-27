'use strict';
const EventEmitter = require('events').EventEmitter;
const Slave = require('./Slave.js');
const ResponseArray = require('./ResponseArray');

/**
 * @module Master
 */

/**
 * The master "controller" class.
 * Controls IO flow and sends messages to slave processes.
 * @extends EventEmitter
 */
class Master extends EventEmitter {
  /**
   * Creates a new slave.
   * @param {String} path The file path to the slave's code.
   * @param {Object} options Options to pass to the slave constructor.
   * @param {...*} rest The rest of the argument to pass to the Slave constructor.
   * @return {Slave} The newly created slave.
   */
  createSlave(path, options, ...rest) {
    return new Slave(path, options, rest);
  }

  /**
   * Creates multiple slaves from a single file path.
   * @param {[type]} count [description]
   * @param {String} path The file path to the slave's code.
   * @param {Object} options Options to pass to the slave constructor.
   * @param {...*} rest The rest of the argument to pass to the Slave constructor.
   * @return {Array<Slave>} The newly created slave(s).
   */
  createSlaves(count, path, options, ...rest) {
    const toCreate = count._.getNumeric();
    if (!toCreate._.isNumeric()) {
      throw new Error(`Master#createSlaves expected argument #0 (count) to be numeric, but got ${typeof count}`);
    }

    const slaves = [];
    for (let i = 0; i < count; i++) slaves.push(this.createSlave(path, options, ...rest));
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
   * @param {*} args Arguments to pass to Slave#exec
   * @return {Promise} A promise for completion.
   */
  tellSlave(slave, ...args) {
    const done = [...args]._.getCallback();
    slave = slave instanceof Slave ? slave : Slave.getSlaveWithId(slave);
    slave = slave instanceof Slave ? slave : Slave.getSlaveWithAlias(slave);

    return new Promise((resolve, reject) => {
      if (!(slave instanceof Slave)) {
        const e = new TypeError('Master#execute expected argument #0 (slave) to be an instanceof Slave');
        reject(e);
        done.call(this, e, null);
      }

      slave.exec.apply(slave, [...args])
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Broadcasts a message to all slaves in the given group.
   * @param {String} group The name of the group to broadcast to.
   * @param {String} command The task for the slave to complete.
   * @param {...*} args Arguments to pass to Slave#exec
   * @return {Promise} A promise for completion.
   */
  broadcastTo(group, command, ...args) {
    const done = [...args]._.getCallback();

    return new Promise((resolve, reject) => {
      if (typeof group === 'string' && typeof command === 'string') {
        const slaves = Slave.getSlavesInGroup(group);
        const totalTasks = slaves.length;
        const responses = new ResponseArray();
        let completedTasks = 0;

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
          done(this, null, responses);
          resolve(responses);
        } else {
          slaves._.every(s => {
            s.exec.apply(s, [command, ...args])
              .then(onResponse)
              .catch(onResponse);

            return true;
          });
        }
      } else {
        let e;
        if (typeof group !== 'string') {
          e = new Error(`Master#broadcastTo expected argument #0 (group) to be a string, but got ${typeof group}`);
        } else {
          e = new Error(`Master#broadcastTo expected argument #1 (command) to be a string, but got ${typeof group}`);
        }
        reject(e);
        done.call(this, e, null);
      }
    });
  }

  /**
   * Broadcasts a message to all slaves.
   * @param {String} command The command to send to the slave.
   * @param {...*} args Arguments to pass to Slave#exec
   * @return {Promise} A promise for completion.
   */
  broadcast(command, ...args) {
    const done = [...args]._.getCallback();

    return new Promise((resolve, reject) => {
      if (typeof command === 'string') {
        const slaves = Slave.getAllSlaves();
        const totalTasks = slaves.length;
        const responses = new ResponseArray();
        let completedTasks = 0;

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
          done(this, null, responses);
          resolve(responses);
        } else {
          slaves._.every(s => {
            s.exec.apply(s, [command, ...args])
              .then(onResponse)
              .catch(onResponse);

            return true;
          });
        }
      } else {
        const e =
          new Error(`Master#broadcastTo expected argument #1 (command) to be a string, but got ${typeof group}`);

        reject(e);
        done.call(this, e, null);
      }
    });
  }
}

/**
 * A singleton instance of the Master class.
 * @type {Master}
 */
module.exports = new Master();
