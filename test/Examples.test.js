/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const path = require('path');
const fork = require('child_process').fork;

describe('Validate Examples', function () {
  let mpserver;

  before((done) => {
    mpserver = fork(path.join(__dirname, '..', 'bin', 'distio-serve'), ['--port=1337'], { silent: true });
    setTimeout(() => {
      done();
    }, 1000);
  });

  after(() => {
    mpserver.kill('SIGINT');
  });

  const examples = [
    path.join(__dirname, '..', 'examples', 'broadcasting', 'master.js'),
    path.join(__dirname, '..', 'examples', 'hello-world', 'master.js'),
    path.join(__dirname, '..', 'examples', 'piping', 'master.js'),
    path.join(__dirname, '..', 'examples', 'scatter', 'master.js'),
    path.join(__dirname, '..', 'examples', 'parallel', 'master.js'),
    path.join(__dirname, '..', 'examples', 'workpool', 'master.js'),
    path.join(__dirname, '..', 'examples', 'remote', 'master.js'),
    path.join(__dirname, '..', 'examples', 'local-remote', 'master.js'),
  ];

  it('Should execute the examples from the "./examples" directory without any errors', function (done) {
    this.timeout(30000);
    this.slow(5000);

    const total = examples.length;
    let completed = 0;

    examples.forEach(example => {
      const cp = fork(example, { silent: true });
      cp.on('exit', (code) => {
        if (code !== 0) {
          done(new Error(`Example ${example} exited with code 1.`));
        } else if (++completed === total) {
          done();
        }
      });
    });
  });
});
