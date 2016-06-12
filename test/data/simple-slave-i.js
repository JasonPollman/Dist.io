'use strict';
const slave = require('../../lib/SlaveChildProcess');

slave.task('random', (data, done) => {
  done(Math.random() * 1000);
});
