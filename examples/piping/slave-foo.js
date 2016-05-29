/**
 * @file
 * Slave foo.
 * Task "get names" sends back an object containing two arrays: a list of boys, and a list of girls.
 */

'use strict';
const slave = require('../../').Slave;
require('proto-lib').get('_');

const boys = ['John', 'Dick', 'Harry', 'Will', 'Bill'];
const girls = ['Sue', 'Sally', 'Mary', 'Ann'];
const names = { boys, girls };

/**
 * Task "get names".
 * Sends back the names constant.
 */
slave.task('get names', (data, done) => {
  done(names);
});

/**
 * Task "add name".
 * Adds a name to either the boys or girls array.
 */
slave.task('add name', (data, done) => {
  if (data.type === 'boy') boys.push(data.name); else girls.push(data.name);
  done(names);
});
