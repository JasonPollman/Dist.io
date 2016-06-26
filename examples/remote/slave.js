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
    console.log(`Hello world from slave with id local id ${slave.id} and server id ${slave.serverId}!`);
    done(); // You must explicitly call done here, or the task will never resolve in the master process.
  })
  .task('say goodbye', (data, done) => {
    console.log(`Goodbye world from slave with id local id ${slave.id} and server id ${slave.serverId}!`);
    done(); // Again, you must explicitly call done here, or the task will never resolve in the master process.
  });
