/**
 * @file
 * A simple slave hello world example.
 */

'use strict';
const slave = require('../../').Slave;
require('proto-lib').get('_');

const boys = ['John', 'Dick', 'Harry', 'Will', 'Bill'];
const girls = ['Sue', 'Sally', 'Mary', 'Ann'];
const names = { boys, girls };

slave.task('get names', (data, done) => {
  done(names);
});

slave.task('add name', (data, done) => {
  if (data.type === 'boy') boys.push(data.name); else girls.push(data.name);
  done(names);
});
