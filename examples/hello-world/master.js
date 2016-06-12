/**
 * @file
 * A simple master hello world example.
 * It creates 7 slaves asyncrnously, and each will perform the "say hello"
 * task, wait for a response, then perform the "say goodbye"task.
 */

/* eslint-disable no-console */

'use strict';
const master = require('../../').Master;
const path = require('path');
const slaveJS = path.join(__dirname, 'slave.js');
const tell = master.tell;

let slaveA;
let slaveB;
let slaves;

/**
 * A simple error handler.
 * @param {Error} e The error passed to the error handler.
 * @return {undefined}
 */
function onError(e) {
  console.log(e);
  process.exit(1);
}


// Create a single slave...
master.create.slave(slaveJS)
  .then(slave => { slaveA = slave; })
  .then(() => slaveA.exec('say hello'))     // Tell the slave to do a task
  .then(() => slaveA.exec('say goodbye'))   // Tell the slave to do another task
  .then(() => slaveA.exit())                // **Very Important** Close the slave, otherwise the child will next exit.
  .catch(onError);

master.create.slave(slaveJS)
  .then(slave => { slaveB = slave; })
  .then(() => tell(slaveB).to('say hello'))
  .then(() => tell(slaveB).to('say goodbye'))
  .then(() => slaveB.exit())
  .catch(onError);

// Create multiple slaves...
// Using the alternate syntax here: slave.do() vs. master.tell.slave().to()
master.create.slaves(5, slaveJS)
  .then(instances => { slaves = instances; })
  .then(() => slaves.do('say hello'))
  .then(() => slaves.do('say goodbye'))
  .then(() => slaves.exit())
  .catch(onError);
