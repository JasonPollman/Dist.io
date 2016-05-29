/**
 * @file
 * A simple example of piping a response to another slave.
 * slave-foo returns a list of boys and girls.
 * slave-bar creates "love" pairs from the list provided from slave-foo.
 *
 * This file creates two slaves (foo and bar).
 * Task "get names" is performed by foo, then the response from "get names"
 * is piped to bar's "make pairs" command.
 */

/* eslint-disable no-console */

'use strict';
const master = require('../../').Master;
const path = require('path');
const fooLocation = path.join(__dirname, 'slave-foo.js');
const barLocation = path.join(__dirname, 'slave-bar.js');
const tell = master.tell;

let foo;

// Create slave bar.
// Slave creation is syncronous. So this is possible.
const bar = master.createSlave(barLocation);

// Create the foo slave.
master.create.slave(fooLocation)
  .then(slave => {
    foo = slave;
  })
  // Tell slave foo to get the list of names.
  .then(() => tell.slave(foo).to('get names'))
  // Pipe the response value to bar's "make pairs" task.
  // Pipe always returns an array, since we can pipe to multiple slaves.
  .then(res => res.pipe('make pairs').to(bar))
  // Log results...
  .then(res => res[0].value.forEach(pair => {
    console.log(`${pair.girl} loves ${pair.boy}`);
  }))
  // Tell foo to add a new girl to the girl's list.
  .then(() => tell.slave(foo).to('add name', { type: 'girl', name: 'Ashley' }))
  // Pipe the response to bar's "make pairs" task.
  .then(res => res.pipe('make pairs').to(bar))
  // Log results...
  .then(res => {
    console.log('\n');
    res[0].value.forEach(pair => {
      console.log(`${pair.girl} loves ${pair.boy}`);
    });
  })
  // Close the slaves.
  .then(() => master.close(foo, bar))
  .catch(e => console.log(e));
