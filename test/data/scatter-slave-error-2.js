/**
 * @file
 * A simple slave hello world example.
 * @see ./master.js for more information.
 */

/* eslint-disable no-console */

'use strict';
const slave = require('../../').Slave;
let i = 0;

slave
  .task('echo', (data, done) => {
    if (++i > 1) {
      done(new Error('oops'));
    } else {
      done('whatever');
    }
  });
