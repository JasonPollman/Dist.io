'use strict';

const slave = require('../../').Slave;
slave.task('echo', (data, done) => { done(data); });
module.exports = slave;
