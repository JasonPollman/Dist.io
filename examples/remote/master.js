/**
 * @file
 * A simple example of creating remote slaves.
 */

/* eslint-disable no-console */

'use strict';
const master = require('../../').Master;

const s = master.create.remote.slave({ location: 'http://asdf:asdf@localhost:1337', path: './examples/hello-world/master.js' });
s.close()
  .then(res => {
    console.log('exited', res);
  })
  .catch(e => console.error(e));
