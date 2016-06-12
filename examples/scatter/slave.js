/**
 * @file
 * A simple slave example that just sends back any data it receives.
 * @see ./master.js for more information.
 */

/* eslint-disable no-console */

'use strict';
const slave = require('../../').Slave;
slave.task('echo', (data, done) => done(data));
