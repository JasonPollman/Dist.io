/**
 * @file
 * A simple slave hello world example.
 * @see ./master.js for more information.
 */

/* eslint-disable no-console */

'use strict';
const slave = require('../../').Slave;

slave
  .task('say hello', (data, done) => {
    console.log(`Hello world from slave with id ${slave.id}!`);
    done(); // You must explicitly call done here, or the task will never resolve in the master process.
  })
  .task('say goodbye', (data, done) => {
    console.log(`Goodbye from slave with id ${slave.id}!`);
    done(); // Again, you must explicitly call done here, or the task will never resolve in the master process.
  });
