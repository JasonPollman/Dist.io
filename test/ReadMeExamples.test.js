/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const path = require('path');
const fork = require('child_process').fork;
const expect = require('chai').expect;
const master = require('../').Master;

/**
 * A simple error handler.
 * @param {Error} e The error passed to the error handler.
 * @return {undefined}
 */
function onError(e) {
  throw e;
}

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

  describe('ReadMe "Hello World"', function () {
    this.timeout(3000);
    this.slow(1000);

    it('"Hello World" local', function (done) {
      const slave = master.createSlave(path.join(__dirname, 'data', 'read-me.js'));

      master.tell(slave).to('say hello')
        .then(response => {
          expect(response.value).to.equal('Hello World!');
          expect(response.error).to.equal(null);
          return master.tell(slave).to('say goodbye');
        })
        .then(response => {
          expect(response.value).to.equal('Goodbye World!');
          expect(response.error).to.equal(null);
          return slave.close();        // All done, gracefully exit the slave process.
        })
        .then(() => {
          done();
        })
        .catch(onError);
    });

    it('"Hello World" local, multiple', function (done) {
      const tell = master.tell;
      const slaves = master.createSlaves(5, path.join(__dirname, 'data', 'read-me-2.js'));

      // Broadcast a message to all the slaves...
      tell(slaves).to('say hello')
        .then(responses => {
          expect(responses.joinValues(', ')).to.match(
            /Hello from \d+, Hello from \d+, Hello from \d+, Hello from \d+, Hello from \d+/
          );
        })
        .then(() => tell(slaves[0]).to('say hello'))
        .then(response => {
          expect(response.value).to.match(/Hello from \d+/);
        })
        .then(() => slaves.close())
        .then(() => done())
        .catch(onError);
    });
  });
});
