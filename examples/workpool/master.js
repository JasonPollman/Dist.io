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

// Create a single slave...
const slaves = master.createSlaves(5, slaveJS);
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

workpool
  .while((i) => i < 20)
  .do('echo', 'hello world #!')
  .then(res => console.log(res.sortBy('sent').values))
  .then(() => master.close(master.slaves.all))
  .catch(onError);
