/**
 * @file
 * A simple slave hello world example.
 * This slave just returns the value of the data with the slave's id concatenated.
 * @see ./master.js for more information.
 */

/* eslint-disable no-console */

'use strict';
const slave = require('../../').Slave;

slave
  .task('echo', (data, done) => {
    done(`${data} from slave ${slave.id}`);
  });
