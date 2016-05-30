/**
 * @file
 * A simple slave hello world example.
 * @see ./master.js for more information.
 */

/* eslint-disable no-console */

'use strict';
const slave = require('../../').Slave;

slave
  .task('compute', (data, done) => {
    const a = data.a;
    const b = data.b;

    const r = a.length;
    const c = b.length;

    const result = [];
    let sum = 0;

    for (let n = 0; n < c; n++) {
      for (let k = 0; k < r; k++) {
        sum += a[k] * b[n];
      }

      result[n] = sum;
      sum = 0;
    }

    done({ result, i: data.i });
  });
