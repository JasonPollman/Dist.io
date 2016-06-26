'use strict';
const slave = require('../../lib/SlaveChildProcess');

slave.task('random', (data, done) => {
  setTimeout(() => {
    done(Math.random() * 1000);
  }, 1000);
});
