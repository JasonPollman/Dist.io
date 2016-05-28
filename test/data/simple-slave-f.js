'use strict';

const slave = require('../../lib/SlaveChildProcess');

slave.task('echo', () => { throw new Error('Test Error 2'); });
module.exports = slave;
