/**
 * @file
 * A simple example of creating remote slaves and executing tasks on them.
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
const s = master.create.remote.slaves(2, { host: 'localhost:1337', script: './examples/remote/slave.js' });

master.tell(s[0])
  .to('say hello')
  .then(() => master.tell(s[0]).to('say goodbye'))
  .then(() => s[0].close())
  .catch(e => console.error(e));

master.tell(s[1])
  .to('say hello')
  .then(() => master.tell(s[1]).to('say goodbye'))
  .then(() => s[1].close())
  .catch(e => console.error(e));
