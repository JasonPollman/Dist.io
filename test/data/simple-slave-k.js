'use strict';
const slave = require('../../lib/SlaveChildProcess');

slave.task('random', (data, done) => {
  console.log('testing stdout');
  console.error('testing stderr');
  done(Math.random() * 1000);
});
