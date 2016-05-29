/**
 * @file
 * Slave bar.
 * Creates pairs from the data provided (a list of boys and girls).
 */

'use strict';
const slave = require('../../').Slave;

/**
 * Task "make pairs"
 */
slave.task('make pairs', (data, done) => {
  const pairs = [];
  data.girls.forEach(girl => {
    // Get's a random boy.
    const boy = data.boys._.random();
    // Removes the boy from the array, to prevent
    // multiple girls from pairing with the same boy.
    data.boys.splice(data.boys.indexOf(boy), 1);
    pairs.push({ girl, boy });
  });

  // Return the list of pairs.
  done(pairs);
});
