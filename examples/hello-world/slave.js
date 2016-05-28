/**
 * @file
 * A simple slave hello world example.
 */

'use strict';
const slave = require('../../').Slave;

slave
  .task('say hello', (data, done) => {
    console.log(`Hello world from slave with id ${slave.id}!`);
    done();
  })
  .task('say goodbye', (data, done) => {
    console.log(`Goobye from slave with id ${slave.id}!`);
    done();
  });
