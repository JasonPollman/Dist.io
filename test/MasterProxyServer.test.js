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

  describe('MasterProxyServer#bindSIGINT', function () {
    this.timeout(5000);
    this.slow(2500);

    it('Should bind to the SIGINT process event and shutdown the server', (done) => {
      const server = new MPS({ authorizedIps: ['.*'], port: 3112, logLevel: 0 });

      server.start()
        .then(() => {
          expect(server.started).to.equal(true);
          master.create.remote
            .slave({ host: 'localhost:3112', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

          const listeners = process.listeners('SIGINT');
          process.removeAllListeners('SIGINT');
          server.bindSIGINT();

          process.emit('SIGINT');
          server.unbindSIGINT();

          setTimeout(() => {
            expect(server.started).to.equal(false);
            listeners.forEach(e => process.on('SIGINT', e));
            done();
          }, 1000);
        })
        .catch(done);
    });
  });

  describe('Security', () => {
    it('Should allow authorized IP addresses if the user\'s ip is in config.authorizedIps', (done) => {
      const server = new MPS({ authorizedIps: ['196\\.168\\.0\\..*', '.*'], port: 3247, logLevel: 0 });
      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({ host: 'localhost:3247', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

          slave.on('spawn error', function spawnError(e) {
            done(e);
          });

          slave.noop().then(() => done()).then(() => server.stop());
        })
        .catch(done);
    });

    it('Should block unauthorized IP addresses if config.authorizedIps is an array', (done) => {
      const server = new MPS({ authorizedIps: [], port: 3245, logLevel: 0 });
      server.start()
        .then(() => {
          master.create.remote
            .slave({
              host: 'localhost:3245',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
            },
            {
              onSpawnError: function spawnError(e) {
                expect(e).to.be.an.instanceof(Error);
                expect(e.message).to.equal('Unauthorized');
                server.stop();
                done();
              },
            }
          );
        })
        .catch(done);
    });

    it('Should block unauthorized IP addresses if the user\'s ip isn\'t in config.authorizedIps', (done) => {
      const server = new MPS({ authorizedIps: ['196\\.168\\.0\\..*'], port: 3246, logLevel: 0 });
      server.start()
        .then(() => {
          master.create.remote
            .slave({
              host: 'localhost:3246',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
            },
            {
              onSpawnError: function spawnError(e) {
                expect(e).to.be.an.instanceof(Error);
                expect(e.message).to.equal('Unauthorized');
                server.stop();
                done();
              },
            }
          );
        })
        .catch(done);
    });
  });

  it('Should be returned by the Dist.io Index file', () => {
    expect(MPS).to.equal(mpserver);
  });

  it('Should be returned by the Dist.io Index file', () => {
    const server = new MPS();
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);
  });

  it('Should handle invalid script root paths', (done) => {
    const server = new MPS({ root: 'a/b/c' });
    server.start()
      .then(() => done(new Error('Expected to throw')))
      .catch(e => {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.match(/Scripts root directory .*\/a\/b\/c is invalid/);
        done();
      });
  });

  it('Should resolve if start is called and the server is running', (done) => {
    const server = new MPS();
    server.start()
      .then(() => {
        expect(server.started).to.equal(true);
        server.start()
          .then(() => {
            expect(server.started).to.equal(true);
            server.stop();
            done();
          })
          .catch(e => done(e));
      })
      .catch(e => done(e));
  });

  it('Shouldn\'t do anything if stop is called and the server isn\'t running', (done) => {
    const server = new MPS();
    expect(server.started).to.equal(false);
    server.stop();
    expect(server.started).to.equal(false);
    done();
  });

  it('Should handle files passed as script root paths', (done) => {
    const server = new MPS({ root: __filename });
    server.start()
      .then(() => done(new Error('Expected to throw')))
      .catch(e => {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.match(/Scripts root directory .*MasterProxyServer.test.js isn't a directory!/);
        done();
      });
  });

  it('Should allow for absolute root paths', (done) => {
    const server = new MPS({ root: path.join(__dirname, '..'), logLevel: 0, port: 4567 });
    server.start()
      .then(() => {
        expect(server.root).to.equal(path.join(__dirname, '..'));
        server.stop();
        done();
      })
      .catch(done);
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
    const server = new MPS({ logLevel: 0, port: 5556 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5556', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

      let nextSlave;
      slave.ack()
        .then(res => {
          nextSlave = master.create.remote
            .slave({ host: 'localhost:5556', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

          expect(res.value).to.be.an('object');
        })
        .then(() => slave.noop())
        .then(res => {
          expect(res.value).to.equal(null);
          slave.exit()
            .then(() => nextSlave.exit())
            .then(() => server.stop())
            .then(() => done());
        })
        .catch(done);
    });
  });

  it('Should handle closing slaves', (done) => {
    const server = new MPS({ logLevel: 0, port: 5589 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5589', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

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

      slave.on('spawn error', e => {
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

    const oldStdout = process.stdout.write;
    const oldStderr = process.stderr.write;

    process.stdout.write = () => {};
    process.stderr.write = () => {};

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5554', path: path.join(__dirname, 'data', 'simple-slave-k.js') });

      slave.exec('random')
        .then(res => {
          expect(res.value).to.be.a('number');
          server.stop();

          process.stdout.write = oldStdout;
          process.stderr.write = oldStderr;
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
