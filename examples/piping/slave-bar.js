/**
 * @file
 * A simple slave hello world example.
 */

'use strict';
const slave = require('../../').Slave;

slave.task('make pairs', (data, done) => {
  const pairs = [];
  data.girls.forEach(girl => {
    const boy = data.boys._.random();
    data.boys.splice(data.boys.indexOf(boy), 1);
    pairs.push({ girl, boy });
  });
  done(pairs);
});
