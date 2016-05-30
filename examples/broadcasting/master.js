/**
 * @file
 * A simple example of message broadcasting.
 * Broadcasting sends a command to multiple slaves and wait for all responses
 * to be recieved before resolving.
 *
 * This master sends an ACK message (acknowledgement) message to all the slaves.
 * The master.COMMANDS object contains various "common" commands that can be used.
 *
 * The acknowledgement just sends back an object with some info about the slave,
 * like its id and uptime.
 */

/* eslint-disable no-console */

'use strict';
const master = require('../../').Master;
const path = require('path');
const slaveLocation = path.join(__dirname, 'slave.js');
const tell = master.tell;

// Create 10 slaves...
// Send an acknowledgement message to all the slaves...
const broadcast = master.broadcast;
master.create.slaves(10, slaveLocation)
  .then(slaves => broadcast(master.commands.ACK).to(slaves))
  .then(res => res.each(r => console.log(r.value.message)))
  // Shortcut to clase all slaves.
  .then(() => master.close(master.slaves.ALL))
  .catch(e => console.log(e));

// Alternative syntax...
// Create 10 more slaves...
master.create.slaves(10, slaveLocation)
  .then(slaves => tell(slaves).to(master.commands.ACK))
  .then(res => res.each(r => console.log(r.value.message)))
  .then(() => master.close(master.SLAVES.ALL))
  .catch(e => console.log(e));
