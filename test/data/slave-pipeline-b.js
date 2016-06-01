/**
 * @file
 * Slave bar.
 * Creates pairs from the data provided (a list of boys and girls).
 */

'use strict';
const slave = require('../../').Slave;

slave.task('get', (tokenId, done) => {
  switch (tokenId) {
    case 123: return done({ username: 'williamriker', password: 'mypassword' });
    case 456: return done({ username: 'jeanlucpicard', password: 'mypassword' });
    default : return done(new Error(`No token with ${tokenId} exists!`));
  }
});
