/**
 * @file
 * A simple example of creating remote and local slaves and executing tasks on them
 * together, simultaneously.
 */

/* eslint-disable no-console */

/**
 * Note: In order to execute this example, you must run bin/distio-serve to host "remote" slaves.
 * Or, alter the configuration below and run bin/distio-serve from a remote machine.
 *
 * This example assumes you've run bin/distio-serve from the local machine on the default port (1337).
 * You can change the port number by starting bin/distio-serve with the --port flag.
 */

'use strict';
const master = require('../../').Master;
const path = require('path');

// Create two remote slaves, and one local.
let s = master.create.remote.slaves(2, { host: 'localhost:1337', path: './examples/local-remote/slave.js' });
const local = master.create.slaves(2, path.join(__dirname, '/slave.js'));

// Push the local into the slave array created using master.create.remote.slaves...
s = s.concat(local);

let wp;

master.tell(s)
  .to('say hello')
  .then(() => master.tell(s).to('say goodbye'))
  .then(() => {
    wp = master.create.workpool(s);
  })
  .then(() => wp.do('say hello wp'))
  .then(() => wp.do('say hello wp'))
  .then(() => wp.do('say hello wp'))
  .then(() => wp.do('say hello wp'))
  .then(() => wp.do('say hello wp'))
  .then(() => wp.do('say hello wp'))
  .then(() => s.close())
  .catch(e => console.error(e));
