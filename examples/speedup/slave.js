/**
 * @file
 * Task "add" simply increments zero "times" times.
 * Task "read file" reads a file n times.
 */

'use strict';
const slave = require('../../').Slave;
const fs = require('fs');

slave
  .task('add', (times, done) => {
    let total = 0;
    for (let i = 0; i < times; i++) total++;
    done(total);
  })
  .task('read file', (data, done) => {
    let chars = 0;
    for (let i = 0; i < data.times; i++) {
      const contents = fs.readFileSync(data.file, 'utf-8');
      chars += contents.length;
    }
    done(chars);
  });
