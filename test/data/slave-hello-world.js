'use strict';
const slave = require('../../').Slave;

slave
  .task('say hello', (data, done) => {
    done('hello');
  })
  .task('say goodbye', (data, done) => {
    done('goodbye');
  });
