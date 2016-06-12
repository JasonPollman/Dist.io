/**
 * @file
 * A simple example of "scattering" data between slaves.
 * This example scatters an array of two items between two slaves.
 * The messages will be sent in parallel among slaves, and when all responses
 * have been received, the promise will be resolved.
 */

/* eslint-disable no-console */

'use strict';
const master = require('../../').Master;
const path = require('path');
const slaveJS = path.join(__dirname, 'slave.js');

/**
 * A simple error handler.
 * @param {Error} e The error passed to the error handler.
 * @return {undefined}
 */
function onError(e) {
  console.log(e);
  process.exit(1);
}

// Create a single slave...
const slaves = master.createSlaves(2, slaveJS);
const scatter = master.create.scatter('echo');

scatter
  .data('hello', 'world')
  .gather(slaves[0], slaves[1])
  .then(res => {
    // You can use Response#sortBy to sort a response by any of its properties.
    // And Response#joinValues will join all the response's values like Array#join.
    console.log(res.sortBy('sent').joinValues(', '));
    console.log(res.sortBy('value', 'desc').joinValues(', '));
    slaves.exit();
  })
  .catch(onError);
