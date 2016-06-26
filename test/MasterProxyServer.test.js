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
const commands = require('../lib/Commands');
const fork = require('child_process').fork;

describe('Master Proxy Server', function masterProxyServerTest() {
  this.timeout(10000);
  this.slow(5000);

  let MPS;
  before(() => {
    MPS = distio.MasterProxyServer;
  });

  describe('MasterProxyServer#maxConcurrentSlaves', function () {
    let mpserver;

    before(() => {
      mpserver = fork(
        path.join(__dirname, '..', 'bin', 'distio-serve'), ['--port=5731', '--maxConcurrentSlaves=2'], { silent: true }
      );
    });

    after(done => {
      setTimeout(() => {
        mpserver.kill('SIGINT');
        done();
      }, 1000);
    });

    it('Should queue slaves according to "config.maxConcurrentSlaves" < max', function (done) {
      const slaves = master.create.remote
        .slaves(2, { host: 'localhost:5731', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

      master.tell(slaves).to(commands.ACK)
        .then(res => {
          expect(res.length).to.equal(2);
          res.forEach(r => {
            expect(r.error).to.equal(null);
            expect(r.value).to.be.an('object');
          });
          slaves.kill();
          done();
        })
        .catch(done);
    });

    it('Should queue slaves according to "config.maxConcurrentSlaves" > max (client side)', function (done) {
      const slaves = master.create.remote
        .slaves(5, { host: 'localhost:5731', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

      let completed = 0;
      for (let i = 0; i < slaves.length; i++) {
        master.tell(slaves[i]).to('random')
          .then(r => { // eslint-disable-line
            expect(r.error).to.equal(null);
            expect(r.value).to.be.a('number');
            slaves[i].kill();
            if (++completed === 5) done();
          })
          .catch(done);
      }
    });

    it('Should queue slaves according to "config.maxConcurrentSlaves" > max (server side)', function (done) {
      this.timeout(45000);
      this.slow(5000);

      const server = new MPS({ authorizedIps: ['.*'], port: 9176, logLevel: 0, maxConcurrentSlaves: 80 });

      const readySlave = master.create.remote
        .slave({ host: 'localhost:9176', path: path.join(__dirname, 'data', 'simple-slave-m.js') });

      server.start()
        .then(() => {
          readySlave.exec('init')
            .then(res => {
              expect(res.error).to.equal(null);
              expect(res.value).to.equal('okay');
              done();
            })
            .catch(done);
        })
        .catch(done);
    });
  });

  describe('MasterProxyServer#bindSIGINT', function () {
    this.timeout(5000);
    this.slow(2500);

    it('Should bind to the SIGINT process event and shutdown the server', (done) => {
      const server = new MPS({ authorizedIps: ['.*'], port: 3112, logLevel: 0 });

      server.start()
        .then(() => {
          expect(server.started).to.equal(true);

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
    it('Should throw if the config.authorizedIps value isn\'t an array', (done) => {
      /* eslint-disable no-new */
      try {
        new MPS({ authorizedIps: 'string', port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
      }

      try {
        new MPS({ authorizedIps: 123, port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
      }

      try {
        new MPS({ authorizedIps: 0, port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
      }
      /* eslint-enable no-new */
      done();
    });

    it('Should throw if the config.basicAuth value isn\'t an object', (done) => {
      /* eslint-disable no-new */
      try {
        new MPS({ basicAuth: 'string', port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
      }

      try {
        new MPS({ basicAuth: 123, port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
      }

      try {
        new MPS({ basicAuth: 0, port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
      }
      /* eslint-enable no-new */
      done();
    });

    it('Should throw if the config.basicAuth.username value isn\'t a string', (done) => {
      /* eslint-disable no-new */
      try {
        new MPS({ basicAuth: {}, port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
        expect(e.message).to.match(/Config parameter "basicAuth.username" is invalid/);
      }

      try {
        new MPS({ basicAuth: { password: '123' }, port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
        expect(e.message).to.match(/Config parameter "basicAuth.username" is invalid/);
      }

      try {
        new MPS({ basicAuth: { username: 123, password: 'qwe' }, port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
        expect(e.message).to.match(/Config parameter "basicAuth.username" is invalid/);
      }
      /* eslint-enable no-new */
      done();
    });

    it('Should throw if the config.basicAuth.password value isn\'t a string', (done) => {
      /* eslint-disable no-new */
      try {
        new MPS({ basicAuth: { username: 'foo' }, port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
        expect(e.message).to.match(/Config parameter "basicAuth.password" is invalid/);
      }

      try {
        new MPS({ basicAuth: { username: '123', password: 123 }, port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
        expect(e.message).to.match(/Config parameter "basicAuth.password" is invalid/);
      }

      try {
        new MPS({ basicAuth: { username: 'foo', password: [] }, port: 3245, logLevel: 0 });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
        expect(e.message).to.match(/Config parameter "basicAuth.password" is invalid/);
      }
      /* eslint-enable no-new */
      done();
    });

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

    it('Should allow a connection if basicAuth string is correct (no passphrase)', (done) => {
      const server = new MPS({ basicAuth: { username: 'foo', password: 'bar' }, port: 3111, logLevel: 0 });
      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({ host: 'foo:bar@localhost:3111', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

          slave.on('spawn error', e => done(e));
          slave.noop().then(() => done()).then(() => server.stop());
        })
        .catch(done);
    });

    it('Should allow a connection if basicAuth string is correct (with passphrase)', (done) => {
      const server = new MPS(
        { basicAuth: { username: 'foo', password: 'bar', passphrase: 'baz' },
        port: 3112,
        logLevel: 0,
      });

      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({
              host: 'foo:bar@localhost:3112',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
              passphrase: 'baz',
            });

          slave.on('spawn error', e => done(e));
          slave.noop().then(() => done()).then(() => server.stop());
        })
        .catch(done);
    });

    it('Should reject a connection if basicAuth string is incorrect (no auth provided)', (done) => {
      const server = new MPS(
        { basicAuth: { username: 'foo', password: 'bar', passphrase: 'baz' },
        port: 3123,
        logLevel: 0,
      });

      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({
              host: 'localhost:3123',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
            });

          slave.on('spawn error', e => {
            expect(e.message).to.equal('Unauthorized');
            done();
          });
        })
        .catch(done);
    });

    it('Should reject a connection if basicAuth string is incorrect (with bad passphrase)', (done) => {
      const server = new MPS(
        { basicAuth: { username: 'foo', password: 'bar', passphrase: 'baz' },
        port: 3113,
        logLevel: 0,
      });

      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({
              host: 'foo:bar@localhost:3113',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
              passphrase: 'baz1',
            });

          slave.on('spawn error', e => {
            expect(e.message).to.equal('Unauthorized');
            done();
          });
        })
        .catch(done);
    });

    it('Should reject a connection if basicAuth string is incorrect (with bad password)', (done) => {
      const server = new MPS(
        { basicAuth: { username: 'foo', password: 'bar', passphrase: 'baz' },
        port: 3114,
        logLevel: 0,
      });

      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({
              host: 'foo:basr@localhost:3114',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
              passphrase: 'baz',
            });

          slave.on('spawn error', e => {
            expect(e.message).to.equal('Unauthorized');
            done();
          });
        })
        .catch(done);
    });

    it('Should reject a connection if basicAuth string is incorrect (with bad username)', (done) => {
      const server = new MPS(
        { basicAuth: { username: 'foo', password: 'bar' },
        port: 3115,
        logLevel: 0,
      });

      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({
              host: 'faoo:bar@localhost:3115',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
            });

          slave.on('spawn error', e => {
            expect(e.message).to.equal('Unauthorized');
            done();
          });
        })
        .catch(done);
    });

    it('Should reject a connection if basicAuth string is incorrect (with unnecessary passphrase)', (done) => {
      const server = new MPS(
        { basicAuth: { username: 'foo', password: 'bar' },
        port: 3116,
        logLevel: 0,
      });

      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({
              host: 'foo:bar@localhost:3116',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
              passphrase: 'abcdefghi',
            });

          slave.on('spawn error', e => {
            expect(e.message).to.equal('Unauthorized');
            done();
          });
        })
        .catch(done);
    });

    it('Should reject a connection if basicAuth string is incorrect (missing passphrase)', (done) => {
      const server = new MPS(
        { basicAuth: { username: 'foo', password: 'bar', passphrase: 'qwerty' },
        port: 3117,
        logLevel: 0,
      });

      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({
              host: 'foo:bar@localhost:3117',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
            });

          slave.on('spawn error', () => done());
        })
        .catch(done);
    });

    it('Should block unauthorized IP addresses if config.authorizedIps is an array', (done) => {
      const server = new MPS({ authorizedIps: [], port: 3245, logLevel: 0 });
      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({
              host: 'localhost:3245',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
            },
            {
              onSpawnError: function spawnError(e) {
                expect(e).to.be.an.instanceof(Error);
                expect(e.message).to.equal('Unauthorized');
                slave.kill();
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
          const slave = master.create.remote
            .slave({
              host: 'localhost:3246',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
            },
            {
              onSpawnError: function spawnError(e) {
                expect(e).to.be.an.instanceof(Error);
                expect(e.message).to.equal('Unauthorized');
                slave.kill();
                server.stop();
                done();
              },
            }
          );
        })
        .catch(done);
    });

    it('Should reject a connection if basicAuth string is incorrect (with authorized ip)', (done) => {
      const server = new MPS(
        { basicAuth: { authorizedIps: ['.*'], username: 'foo', password: 'bar', passphrase: 'qwerty' },
        port: 3118,
        logLevel: 0,
      });

      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({
              host: 'faoo:bar@localhost:3118',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
              passphrase: 'qwerty',
            });

          slave.on('spawn error', e => {
            expect(e.message).to.equal('Unauthorized');
            done();
          });
        })
        .catch(done);
    });

    it('Should block unauthorized IP addresses if the user\'s ip isn\'t in config.authorizedIps (but with successful auth string)', (done) => { // eslint-disable-line max-len
      const server = new MPS(
        { authorizedIps: ['no matches'], basicAuth: { username: 'foo22', password: 'bar', passphrase: 'qwerty' },
        port: 3119,
        logLevel: 0,
      });

      server.start()
        .then(() => {
          const slave = master.create.remote
            .slave({
              host: 'foo22:bar@localhost:3119',
              path: path.join(__dirname, 'data', 'simple-slave-i.js'),
              passphrase: 'qwerty',
            });

          slave.on('spawn error', e => {
            expect(e.message).to.equal('Unauthorized');
            done();
          });
        })
        .catch(done);
    });
  });

  it('Should reject bad messages', function (done) {
    const server = new MPS({ logLevel: 0, port: 12356 });
    server.start()
      .then(() => {
        const slave = master.create.remote
          .slave({ host: 'localhost:12356', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

        slave.on('uncaughtException', () => {
          /* Noop */
        });

        const thirdListener = m => {
          slave.socket.removeListener('message', thirdListener);
          expect(m.error.message).to.equal('Invalid request');
          expect(m.error.name).to.equal('RemoteSlaveError: ReferenceError');
          done();
        };

        const secondListener = m => {
          slave.socket.removeListener('message', secondListener);
          expect(m.error.message).to.equal('No slave with id 19191919191 exists!');
          expect(m.error.name).to.equal('RemoteSlaveError: ReferenceError');
          slave.socket.on('message', thirdListener);
          slave.socket.emit('message', {
            sent: Date.now(),
            rid: 1245,
            for: slave.id,
            meta: {},
            data: null,
            command: 'echo',
            created: Date.now() - 100,
          });
        };

        const firstListener = m => {
          slave.socket.removeListener('message', firstListener);
          expect(m.error.message).to.equal('Invalid request');
          expect(m.error.name).to.equal('RemoteSlaveError: ReferenceError');
          slave.socket.on('message', secondListener);
          slave.socket.emit('message', {
            sent: Date.now(),
            rid: 1245,
            for: 19191919191,
            meta: {},
            data: null,
            command: 'echo',
            created: Date.now() - 100,
            secretId: 'abc',
            secretNumber: 123,
            title: 'MasterIOMessage',
          });
        };

        slave.on('remote handshake', () => {
          server.connections.forEach(c => {
            if (c.id.replace(/^\/#/, '') === slave.socket.id) {
              slave.socket.on('message', firstListener);
              slave.socket.emit('message', 'foo');
            }
          });
        });
      })
      .catch(done);
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
    const server = new MPS({ logLevel: 0, root: 'a/b/c' });
    server.start()
      .then(() => done(new Error('Expected to throw')))
      .catch(e => {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.match(/Scripts root directory .*\/a\/b\/c is invalid/);
        done();
      });
  });

  it('Should resolve if start is called and the server is running', (done) => {
    const server = new MPS({ logLevel: 0 });
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
    const server = new MPS({ logLevel: 0, port: 5556, killSlavesAfter: 9999 });
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

  it('Should kills slaves after "config.killSlavesAfter" ms', (done) => {
    const server = new MPS({ logLevel: 0, port: 5586, killSlavesAfter: 1 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5586', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

      setTimeout(() => {
        expect(slave.isConnected).to.equal(false);
        expect(slave.hasExited).to.equal(true);
        done();
      }, 100);
    });
  });

  it('Should kills slaves after "config.killSlavesAfter" ms (verify "exited" event)', (done) => {
    const server = new MPS({ logLevel: 0, port: 5587, killSlavesAfter: 200 });
    expect(server.start).to.be.a('function');
    expect(server.stop).to.be.a('function');
    expect(server).to.be.an.instanceof(MPS);

    server.start((err) => {
      expect(err).to.equal(null);
      const slave = master.create.remote
        .slave({ host: 'localhost:5587', path: path.join(__dirname, 'data', 'simple-slave-i.js') });

      slave.on('exited', () => {
        expect(slave.isConnected).to.equal(false);
        expect(slave.hasExited).to.equal(true);
        done();
      });
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
