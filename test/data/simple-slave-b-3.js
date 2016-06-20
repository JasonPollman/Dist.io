'use strict';

const slave = require('../../').Slave;
slave.task('echoR', (data, done) => { done(data); });
module.exports = slave;
