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
  .addTask('authenticate token')
  .for(authSlave)
  // Intercept the response, and end the pipeline chain if the token is invalid.
  .intercept((res, end) => {
    if (res.value === false) end('bad token');
  })
  .addTask('get user info for token with id')
  .for(dbSlave)
  .intercept((res, end) => {
    if (!res.value.username || !res.value.password) end('bad user');
  });

/**
 * Invoked when the pipeline is completed.
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
}

// Execute the pipeline against token-1...
authenticateAndGetUserInfo
  .execute('token-1')
  .then(onPipelineComplete)
  // Execute the pipeline against token-2...
  .then(() => authenticateAndGetUserInfo.execute('token-2'))
  .then(onPipelineComplete)
  .then(() => master.close.all())
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
