/**
 * @file
 * A simple example of message broadcasting.
 * Broadcasting sends a command to multiple slaves and wait for all responses
 * to be recieved before resolving.
 *
 * This master sends an ACK message (acknowledgement) message to all the slaves.
 * The master.commands object contains various "common" commands that can be used.
 *
 * The second broadcast, broadcasts the "foo" task to the slaves and prints the data
 * recieved back from the slave to the stdout.
 *
 * The acknowledgement just sends back an object with some info about the slave,
 * like its id and uptime.
 */

/* eslint-disable no-console */

'use strict';

const path = require('path');
const slaveLocation = path.join(__dirname, 'slave.js');

const master = require('../../').Master;
const tell = master.tell;
const broadcast = master.broadcast;

/**
 * A simple error handler.
 * @param {Error} e The error passed to the error handler.
 * @return {undefined}
 */
function onError(e) {
  console.log(e);
  process.exit(1);
}

// Create 10 slaves...
const slaves = master.create.slaves(10, slaveLocation);

// Send an acknowledgement message to all the slaves...
broadcast(master.commands.ACK).to(slaves)
  .then(res => {
    res.each(r => console.log(r.value.message));
  })
  .catch(onError);

// Send command to do task "foo" to slaves...
broadcast('foo').to(slaves)
    .then(res => res.each(r => console.log(r.value)))
    .catch(onError);

// Alternative syntax...
// Create 10 different slaves...
master.create.slaves(10, slaveLocation)
  .then(newSlaves => tell(newSlaves).to(master.commands.ACK))
  .then(res => res.each(r => console.log(r.value.message)))
  .catch(onError);

// Waits for all messages to be sent before shutting down the slaves...
// Note, that this will prevent any more messages from being sent.
master.shutdown.all();

// If any messages are sent after here... an error will be rejected/passed to the promise/callback.
