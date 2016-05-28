'use strict';

const slave = require('../../lib/SlaveChildProcess');

slave.task('echo', (data, done) => { done(new Error('Test Error')); });
module.exports = slave;
