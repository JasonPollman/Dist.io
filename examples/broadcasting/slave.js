/**
 * @file
 * A simple example of message broadcasting.
 * @see ./master.js for more information.
 */

'use strict';
const slave = require('../../').Slave;

/**
 * The "foo" task. Simply sends back "bar" to the master.
 */
slave.task('foo', (data, done) => {
  done('bar');
});
