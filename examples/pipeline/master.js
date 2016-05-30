/**
 * @file
 * A simple example of using a task pipeline.
 */

/* eslint-disable no-console */

'use strict';
const master = require('../../').Master;
const path = require('path');
const authSlaveJS = path.join(__dirname, 'auth.js');
const dbSlaveJS = path.join(__dirname, 'db.js');

const authSlave = master.createSlave(authSlaveJS);
const dbSlave = master.createSlave(dbSlaveJS);

// Create a new pipeline...
const authenticateAndGetUserInfo = master.create.pipeline()
  // Authenticate the user token
  .do('authenticate token').with(authSlave)
  // Intercept the response, and end the pipeline chain
  // if the token is invalid.
  .intercept((res, end) => {
    if (res.value === false) end('bad token');
  });
  // Get the user's info for the token.

authenticateAndGetUserInfo.do('get user info for token with id').with(dbSlave)
  // Intercept the value and end the pipeline chain
  // if the user information dont exist.
  .intercept((res, end) => {
    if (!res.value.username || !res.value.password) end('bad user');
    // Add a custom field to the response.
    res.value.lastAccess = Date.now();
  });

let done = 0;

/**
 * Executed when the pipeline is completed.
 * @param {Response} res The result from the pipeline.
 * @return {undefined}
 */
function onPipelineComplete(res) {
  if (res.value === 'bad token') {
    console.log('Token authenticated: failed!');
  } else if (res.value === 'bad user') {
    console.log('User does not exist!');
  } else {
    const user = res.value;
    console.log('Token authenticated: success!');
    console.log(`User=${user.username}, Password=${user.password}\n`);
  }
  if (++done === 2000) master.close(...master.slaves.ALL);
}

// Execute the pipeline 2000 times.
for (let i = 0; i < 1000; i++) {
  // Execute the pipeline against token-1...
  authenticateAndGetUserInfo.execute('token-1')
    .then(onPipelineComplete)
    .then(() => authenticateAndGetUserInfo.execute('token-2'))
    // Execute the pipeline against token-2...
    .then(onPipelineComplete)
    .catch(e => console.log(e));
}
