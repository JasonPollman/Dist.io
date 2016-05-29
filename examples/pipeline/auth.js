/**
 * @file
 * Slave bar.
 * Creates pairs from the data provided (a list of boys and girls).
 */

'use strict';
const slave = require('../../').Slave;

slave.task('authenticate token', (token, done) => {
  switch (token) {
    case 'token-1': return done(123);
    case 'token-2': return done(456);
    default: return done(false);
  }
});
