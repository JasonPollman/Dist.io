'use strict';

const slave = require('../../lib/SlaveChildProcess');
slave.task('echo', (data, done) => { /* No Op */ });
module.exports = slave;
