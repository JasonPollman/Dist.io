/**
 * @file
 * A simple example of using a workpool to utilize idle slaves.
 * The workpool pattern will find an idle slave to send the task to. If there is no idle
 * slave, it waits until a slave in the pool is idle to send the request.
 */

/* eslint-disable no-console */

'use strict';
const master = require('../../').Master;
const path = require('path');
const slaveJS = path.join(__dirname, 'slave.js');

// Create some slaves...
const slaves = master.createSlaves(4, slaveJS);
// Create a workpool from the slaves...
const workpool = master.create.workpool(slaves);

/**
 * A simple error handler.
 * @param {Error} e The error passed to the error handler.
 * @return {undefined}
 */
function onError(e) {
  console.log(e);
  process.exit(1);
}

// Note how the slaves are chosen in a "round robin" fashion.
// Since all the following requests are sent asyncronously,
// determining the order of which slave will be used is nearly impossible.
// Note, also that some slaves may take more time to spawn than others.
workpool.do('echo', 'I\'m idle')
  .then(res => console.log(res.value));

workpool.do('echo', 'I\'m idle')
  .then(res => console.log(res.value));

workpool.do('echo', 'I\'m idle')
  .then(res => console.log(res.value));

workpool.do('echo', 'I\'m idle')
  .then(res => console.log(res.value));

workpool.do('echo', 'I\'m idle')
  .then(res => console.log(res.value));

// You can use the Workpool#while function to perform a task multiple times...
workpool
  .while(i => i < 10)
  .do('echo', 'hello world')
  .then(res => console.log(res.joinValues('\n'))) // A ResponseArray is returned...
  .then(() => slaves.shutdown())
  .catch(onError);
