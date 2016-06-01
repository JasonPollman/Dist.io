/**
 * @file
 * A simple slave hello world example.
 * @see ./master.js for more information.
 */

/* eslint-disable no-console */

'use strict';
const slave = require('../../').Slave;

slave
  .task('echo', (data, done) => {
    done(data);
  });
