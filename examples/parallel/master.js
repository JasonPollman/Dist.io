/**
 * @file
 * A simple master hello world example.
 * It creates 7 slaves asyncrnously, and each will perform the "say hello"
 * task, wait for a response, then perform the "say goodbye"task.
 */

/* eslint-disable no-console, newline-per-chained-call */

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
  .addTask('hello').for(slaves[0])  // Add a task for slave one.
  .addTask('world').for(slaves[1])  // Add a task for slave two.
  .addTask('!').for(slaves[2])      // Add a task for slave three.
  .execute()                        // When done adding tasks, execute them in parallel.
  .then(res => {
    // The ResponseArray object returned here, has two really nice convenience methods:
    // ResponseArray#sortBy and ResponseArray#joinValues.
    console.log(res.sortBy('rid').joinValues(' '));
    // Don't forget to close the slave processes...
    slaves.exit();
  })
  .catch(onError);


// We don't have to chain...
const newSlaves = master.createSlaves(5, slaveJS);
const myParallel = master.create.parallel();
myParallel.addTask('hello').for(newSlaves.random);
myParallel.addTask('world').for(newSlaves.random);
const exclamationTask = myParallel.addTask('!').for(newSlaves.random);

myParallel.execute()
  .then(res => {
    console.log(res.sortBy('rid').joinValues(' '));
    newSlaves.exit();
  })
  .catch(onError);

// Add another task, post first execution, then execute again...
myParallel
  .removeTask(exclamationTask)
  .addTask('?').for(newSlaves.random)
  .execute()
  .then(res => {
    console.log(res.sortBy('rid').joinValues(' '));
    newSlaves.exit();
  })
  .catch(onError);
