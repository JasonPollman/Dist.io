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
const slaves = master.createSlaves(4, slaveJS);
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
  .while(i => i < 10)
  .do('echo', 'hello world #!')
  .then(res => console.log(res.value))
  .then(() => workpool.do('echo', 'hello world #!'))
  .then(res => console.log(res.value))
  .then(() => workpool.do('echo', 'hello world #!'))
  .then(res => console.log(res.value))
  .then(() => workpool.do('echo', 'hello world #!'))
  .then(res => console.log(res.value))
  .then(() => workpool.do('echo', 'hello world #!'))
  .then(res => console.log(res.value))
  .then(() => workpool.do('echo', 'hello world #!'))
  .then(res => console.log(res.value))
  .then(() => workpool.do('echo', 'hello world #!'))
  .then(res => console.log(res.value))
  .then(() => workpool.do('echo', 'hello world #!'))
  .then(res => console.log(res.value))
  .then(() => workpool.do('echo', 'hello world #!'))
  .then(res => console.log(res.value))
  .then(() => workpool.do('echo', 'hello world #!'))
  .then(res => console.log(res.value))
  .then(() => workpool.do('echo', 'hello world #!'))
  .then(res => console.log(res.value))
  .then(() => slaves.shutdown())
  .catch(onError);
