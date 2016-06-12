/**
 * @file
 * A silly DB slave example.
 * Returns the user data for the given token.
 */

'use strict';
const slave = require('../../').Slave;

slave.task('get user info for token with id', (tokenId, done) => {
  switch (tokenId) {
    case 123: return done({ username: 'williamriker', password: 'mypassword' });
    case 456: return done({ username: 'jeanlucpicard', password: 'mypassword' });
    default : return done(new Error(`No token with ${tokenId} exists!`));
  }
});
