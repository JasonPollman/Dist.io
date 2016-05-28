/**
 * @file
 * A simple example of piping a response to another slave.
 * slave-foo returns a list of boys and girls.
 * slave-bar creates "love" pairs from the list provided from slave-foo.
 */

'use strict';
const master = require('../../').Master;
const path = require('path');
const slaveLocation = path.join(__dirname, 'slave.js');

// Create slave foo
master.createSlaves(10, slaveLocation);

master.broadcast(master.COMMANDS.ACK).to.all()
  .then(res => {
    res.each(r => console.log(r.value));
  })
  .then(master.close(...master.SLAVES.ALL))
  .catch(e => { throw e; });
