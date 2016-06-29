'use strict';

const slave = require('../../lib/SlaveChildProcess');
slave.task('echo', (data, done) => {
  setTimeout(() => {
    done();
  }, 999999);
});
module.exports = slave;
