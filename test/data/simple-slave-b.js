'use strict';

const slave = require('../../lib/SlaveChildProcess');
slave.task('echo', (data, done) => { done(data); });
module.exports = slave;
