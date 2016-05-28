/**
 * @file
 * A simple example of piping a response to another slave.
 * slave-foo returns a list of boys and girls.
 * slave-bar creates "love" pairs from the list provided from slave-foo.
 */

'use strict';
const master = require('../../').Master;
const path = require('path');
const fooLocation = path.join(__dirname, 'slave-foo.js');
const barLocation = path.join(__dirname, 'slave-bar.js');

// Create slave foo
const foo = master.createSlave(fooLocation);

// Create slave bar
const bar = master.createSlave(barLocation);

// Simply gets a list of boy and girl names from slave-foo
master.tellSlave(foo).to('get names')
  // Pipe the names to the bar slave and execute command 'make pairs'
  .then(res => res.pipe('make pairs').to(bar))
  // Pipe always returns an array of responses, since we can pipe to multiple slaves.
  // Print the love pairs
  .then(res => {
    res[0].value.forEach((pair) => {
      console.log(`${pair.girl} loves ${pair.boy}`);
    });
  })
  // Let's add a new girl to the list...
  .then(() => foo.exec('add name', { type: 'girl', name: 'Ashley' }))
  .then(res => res.pipe('make pairs').to(bar))
  // Print the new love pairs
  .then(res => {
    console.log('\n');
    res[0].value.forEach((pair) => {
      console.log(`${pair.girl} loves ${pair.boy}`);
    });
  })
  // Close both the slaves...
  .then(() => master.close(foo, bar))
  .catch(() => {
    /* Handle Errors */
  });
