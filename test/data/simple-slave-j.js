'use strict';

const slave = require('../../lib/SlaveChildProcess');
slave.task('echo', (data, done) => {
  console.log('testing silent slave');
  console.error('testing silent slave');
  done(slave.id);
});
module.exports = slave;
