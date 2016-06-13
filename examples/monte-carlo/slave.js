/**
 * @file
 * A simple slave monte-carlo implementation.
 * @see ./master.js for more information.
 */

'use strict';
const slave = require('../../').Slave;

slave
  .task('count circumscribed', (iterations, done) => {
    let x;
    let y;
    let count = 0;

    for (let i = 0; i < iterations; i++) {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      if (x * x + y * y <= 1) count++;
    }
    done(count);
  });
