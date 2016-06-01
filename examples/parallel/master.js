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

// Create a single slave...
const slaves = master.createSlaves(5, slaveJS);
const parallel = master.create.parallel();

parallel
  .do('hello')
  .with(slaves[0])
  .do('world')
  .with(slaves[1])
  .do('!')
  .with(slaves[2])
  .times(1)
  .execute()
  .then(res => {
    console.log(res);
    console.log(res.sortBy('from').joinValues(' '));
    slaves.exit();
  })
  .catch(e => {
    console.log(e);
  });
