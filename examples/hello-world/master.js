/**
 * @file
 * A simple master hello world example.
 */

'use strict';
const master = require('../../').Master;
const path = require('path');
const slaveLocation = path.join(__dirname, 'slave.js');

// Create a single slave...
const slave = master.createSlave(slaveLocation);

// Tell the slave to execute the taks...
slave.exec('say hello')
  .then(() => slave.exec('say goodbye'))
  .then(() => slave.exit()) // Very important, or the child process will never exit.
  .catch(e => { throw e; });

const slave2 = master.createSlave(slaveLocation);

// Alternative syntax...
master.tellSlave(slave2).to('say hello')
  .then(() => slave2.exit())
  .catch(e => { throw e; });

// This works since messages were sent asyncronously.
// So the slave2.close() invocation from above hasn't been hit yet.
slave2.exec('say goodbye')
  .then(() => slave2.exit())
  // However, this will fail since now the slave has been closed.
  .then(() => slave2.exec('say goodbye'))
  .catch(e => {
    console.log(e); // Error: Slave id=1, alias=0xd, sent=3, received=2 has been closed.
  });

// Create multiple slaves...
const slaves = master.createSlaves(5, slaveLocation, { alias: 'foo' });

slaves.exec('say hello')
  .then(() => slaves.exec('say goodbye'))
  .then(() => slaves.exit())
  .catch(e => { throw e; });
