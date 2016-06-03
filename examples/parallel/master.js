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
const slaves = master.createSlaves(5, slaveJS);
const parallel = master.create.parallel();

parallel
  .addTask('hello')
  .for(slaves[0])
  .addTask('world')
  .for(slaves[1])
  .addTask('!')
  .for(slaves[2])
  .times(1)
  .execute()
  .then(res => {
    console.log(res.sortBy('from').joinValues(' '));
    slaves.exit();
  })
  .catch(onError);
