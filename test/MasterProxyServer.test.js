/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names, no-shadow, require-jsdoc */
'use strict';
const distio = require('../');
const mpserver = require('../lib/MasterProxyServer');
const master = require('../').Master;
const expect = require('chai').expect;
const path = require('path');
const os = require('os');
const ResponseError = require('../lib/ResponseError');

describe('Master Proxy Server', function masterProxyServerTest() {
  this.timeout(3000);
  this.slow(1500);

  let MPS;
  before(() => {
    MPS = distio.MasterProxyServer;
  });

  it('Should be returned by the Dist.io Index file', () => {
    expect(MPS).to.equal(mpserver);
  });

  it('Should start a new server on the given port', () => {
    const server = new MPS();
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);
  });

  it('Should start a new server on the given port', () => {
    const server = new MPS();
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);
  });

  it('Should start a new server on the given port (Promises)', (done) => {
    const server = new MPS({ logLevel: 0, port: 'invalid' });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);
    server.start()
      .then(() => {
        server.stop();
        done();
      })
      .catch(done);
  });

  it('Should start a new server on the given port (Callbacks)', (done) => {
    const server = new MPS({ logLevel: 'error', port: 1340 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      server.stop();
      done();
    });
  });

  it('Should start a new server on the given port (Callbacks II)', (done) => {
    const server = new MPS({ logLevel: 999, port: 1399 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      server.stop();
      done();
    });
  });

  it('Should start a new server and allow a master client to connect', (done) => {
    const server = new MPS({ logLevel: 0, port: 5123 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5123', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

      slave.ack()
        .then(res => {
          master.create.remote
            .slave({ host: 'localhost:5554', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

          expect(res.value).to.be.an('object');
        })
        .then(() => slave.noop())
        .then(res => {
          expect(res.value).to.equal(null);
          server.stop();
          done();
        })
        .catch(done);
    });
  });

  it('Should handle closing slaves', (done) => {
    const server = new MPS({ logLevel: 0, port: 5550 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5550', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

      slave.exec('random')
        .then(res => {
          expect(res.value).to.be.a('number');
        })
        .then(() => slave.exec('random'))
        .then(res => {
          expect(res.value).to.be.a('number');
          slave.exit()
            .then(res => {
              expect(res).to.equal(true);
              server.stop();
              done();
            })
            .catch(done);
        })
        .catch(done);
    });
  });

  it('Should handle response errors', (done) => {
    const server = new MPS({ logLevel: 0, port: 5015 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5015', path: path.join(__dirname, 'data', 'simple-slave-e.js') });

      slave.exec('echo', null, { catchAll: false })
        .then(res => {
          expect(res.value).to.equal(undefined);
          expect(res.error).to.be.an.instanceof(ResponseError);
          expect(res.error.message).to.equal('Test Error');
          slave.kill('SIGKILL');
          server.stop();
          done();
        })
        .catch(done);
    });
  });

  it('Should strip catchAlls and let the local instance handle them', (done) => {
    const server = new MPS({ logLevel: 0, port: 5016 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5016', path: path.join(__dirname, 'data', 'simple-slave-e.js') });

      slave.exec('echo', null, { catchAll: true })
        .then(() => {
          done(new Error('Expected to catch...'));
        })
        .catch(err => {
          expect(err).to.be.an.instanceof(ResponseError);
          expect(err.message).to.equal('Test Error');
          slave.kill('SIGKILL');
          server.stop();
          done();
        });
    });
  });

  it('Should handle invalid paths', (done) => {
    const server = new MPS({ logLevel: 0, port: 5017 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5017', path: '/foo/bar' });

      slave.onSpawnError(e => {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.match(/Slave constructor argument #0 requires a regular file, but received error:/);
        done();
      });
    });
  });

  it('Should handle killing slaves', (done) => {
    const server = new MPS({ logLevel: 0, port: 5546 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5546', path: path.join(__dirname, 'data', 'simple-slave-c.js') });

      slave.exec('echo')
        .then(res => {
          slave.on('remote killed', signal => {
            expect(signal).to.equal('SIGINT');
            server.stop();
            done();
          });
          expect(res.value).to.be.a('number');
          slave.kill('SIGINT');
        })
        .catch(done);
    });
  });

  it('Should handle client stdout and stderr', (done) => {
    const server = new MPS({ logLevel: 0, port: 5554 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5554', path: path.join(__dirname, 'data', 'simple-slave-k.js') });

      slave.exec('random')
        .then(res => {
          expect(res.value).to.be.a('number');
          server.stop();
          done();
        })
        .catch(done);
    });
  });

  it('Should handle client stdout and stderr (silent)', (done) => {
    const server = new MPS({ logLevel: 0, port: 5555 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    let gotStdout = false;
    let gotStderr = false;

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave(
          { host: 'localhost:5555', path: path.join(__dirname, 'data', 'simple-slave-k.js') },
          { forkOptions: { silent: true } }
        );

      slave.on('stdout', m => {
        expect(m.toString()).to.equal(`testing stdout${os.EOL}`);
        gotStdout = true;
      });

      slave.on('stderr', m => {
        expect(m.toString()).to.equal(`testing stderr${os.EOL}`);
        gotStderr = true;
      });

      slave.exec('random')
        .then(res => {
          expect(res.value).to.be.a('number');
          server.stop();
          if (!gotStderr || !gotStdout) {
            done(new Error('Didn\'t get stdout/stderr'));
          } else {
            done();
          }
        })
        .catch(done);
    });
  });
});
