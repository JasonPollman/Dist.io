'use strict';
const slave = require('../../lib/SlaveChildProcess');
const master = require('../../').Master;
const path = require('path');

slave.task('init', (data, done) => {
  const slaves = master.create.remote
    .slaves(100, { host: 'localhost:9176', path: path.join(__dirname, 'simple-slave-i.js') });

  let completed = 0;
  for (let i = 0; i < slaves.length; i++) {
    master.tell(slaves[i]).to('random')
      .then(r => { // eslint-disable-line
        slaves[i].kill();
        if (++completed === 100) done('okay');
      })
      .catch(e => {
        done(e);
      });
  }
});
