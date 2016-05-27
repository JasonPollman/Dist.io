'use strict';

const slave = require('../../lib/SlaveChildProcess');

slave.task('echo', (data, done) => { done(slave.id); });
module.exports = slave;
