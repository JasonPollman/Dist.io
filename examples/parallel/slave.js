/**
 * @file
 * A simple slave hello world example.
 * @see ./master.js for more information.
 */

/* eslint-disable no-console */

'use strict';
const slave = require('../../').Slave;

slave
  .task('hello', (data, done) => {
    done('hello');
  })
  .task('world', (data, done) => {
    done('world');
  })
  .task('!', (data, done) => {
    done('!');
  })
  .task('?', (data, done) => {
    done('?');
  });
