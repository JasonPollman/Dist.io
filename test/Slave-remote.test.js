/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const RemoteSlave = require('../lib/RemoteSlave');
const path = require('path');
const expect = require('chai').expect;
const exec = require('child_process').exec;
const pgrep = 'pgrep';
const os = require('os');
const Response = require('../lib/Response');
const TimeoutResponse = require('../lib/TimeoutResponse');
const ResponseError = require('../lib/ResponseError');
const master = require('../lib/Master');
const fork = require('child_process').fork;
const SlaveArray = require('../lib/SlaveArray');

describe('Slave Class (Remote)', function () {
  let mpserver = null;

  before(() => {
    mpserver = fork(path.join(__dirname, '..', 'bin', 'distio-serve'), ['--port=1339'], { silent: true });
  });

  after(done => {
    setTimeout(() => {
      mpserver.kill('SIGINT');
      done();
    }, 1000);
  });

  describe('RemoteSlave#getAllSlaves', function () {
    it('Should return an array of all slaves', function (done) {
      const location = path.join('test', 'data', 'simple-slave-a.js');
      const connectOptions = {
        location: '127.0.0.1:1339',
        path: location,
      };

      master.create.remote.slave(connectOptions, { group: 'sremote' }); // eslint-disable-line
      master.create.remote.slave(connectOptions, { group: 'sremote' }); // eslint-disable-line
      master.create.remote.slave(connectOptions, { group: 'sremote' }); // eslint-disable-line

      const sls = master.slaves.remote;
      expect(sls).to.be.an.instanceof(SlaveArray);
      expect(sls.length).to.be.gte(3);

      const slaves = RemoteSlave.getAllSlaves();
      expect(slaves).to.be.an('array');
      expect(slaves.length).to.be.gte(3);
      slaves.forEach(s => {
        expect(s.pid).to.be.a('number');
        expect(s.pid).to.be.gte(0);
      });
      master.kill('sremote');
      done();
    });
  });

  describe('RemoteSlave#getSlaveWithAlias', function () {
    it('Should return an array of all slaves', function (done) {
      const location = path.join('test', 'data', 'simple-slave-a.js');
      const connectOptions = {
        location: '127.0.0.1:1339',
        path: location,
      };

      new RemoteSlave(connectOptions, { alias: 'bar', group: 'sr-t' }); // eslint-disable-line
      new RemoteSlave(connectOptions, { group: 'sr-t' }); // eslint-disable-line
      new RemoteSlave(connectOptions, { group: 'sr-t' }); // eslint-disable-line

      const slaves = RemoteSlave.getAllSlaves();
      expect(slaves).to.be.an('array');
      expect(slaves.length).to.be.gte(3);
      expect(RemoteSlave.getSlaveWithAlias('foo')).to.equal(null);

      try {
        new RemoteSlave(connectOptions, { alias: 'bar' }); // eslint-disable-line
      } catch (e) {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('Slave with alias "bar" already exists.');
      }
      slaves.forEach(s => {
        s.group = 'new group';
        s.group = {};
        expect(s.rank).to.be.a('number');
        expect(s.group).to.equal('new group');
      });
      master.kill('sr-t');
      done();
    });
  });

  describe('RemoteSlave#lastId', function () {
    it('Should return an array of all slaves', function (done) {
      const location = path.join('test', 'data', 'simple-slave-a.js');
      const connectOptions = {
        host: '127.0.0.1:1339',
        path: location,
      };

      new RemoteSlave(connectOptions, { group: 'sremote2' }); // eslint-disable-line
      new RemoteSlave(connectOptions, { group: 'sremote2' }); // eslint-disable-line
      new RemoteSlave(connectOptions, { group: 'sremote2' }); // eslint-disable-line

      const slaves = RemoteSlave.getAllSlaves();
      expect(slaves).to.be.an.instanceof(SlaveArray);
      master.kill('sremote2');

      expect(RemoteSlave.lastId).to.be.gte(3);
      done();
    });
  });

  describe('RemoteSlave#constructor', function () {
    it('Should spawn a new slave, then kill it', function (done) {
      this.timeout(7500);
      this.slow(6000);

      const location = path.join('test', 'data', 'simple-slave-a-4.js');
      const connectOptions = {
        location: '127.0.0.1:1339',
        path: location,
      };

      const slave = new RemoteSlave(connectOptions);
      expect(slave).to.be.an.instanceof(RemoteSlave);
      expect(slave.id).to.match(/^\d+$/);
      expect(slave.alias).to.match(/^0x[a-z0-9]+$/);
      expect(slave.location).to.equal(`http://${connectOptions.location}`);
      expect(slave.path).to.equal(connectOptions.path);

      expect(slave.toString())
        .to.equal(`Slave id=${slave.id}, alias=${slave.alias}, sent=${slave.sent}, received=${slave.received}`);

      expect(slave.hasExited).to.equal(false);
      expect(slave.isConnected).to.equal(true);
      expect(slave.spawnError).to.equal(null);

      if (os.platform() !== 'win32') {
        setTimeout(() => {
          exec(`${pgrep} QWERTYSimpleSlaveA4`, function (err, stdout) {
            expect(err).to.equal(null);
            expect(stdout.trim()).to.match(/^\d+\s*$/m);
            expect(slave.kill()).to.equal(slave);
            setTimeout(() => {
              exec(`${pgrep} QWERTYSimpleSlaveA4`, function (e, sout) {
                expect(err).to.equal(null);
                expect(sout.trim()).to.match(/^$/);
                expect(slave.id).to.match(/^\d+$/);
                expect(slave.alias).to.match(/^0x[a-z0-9]+$/);
                expect(slave.location).to.equal(`http://${connectOptions.location}`);
                expect(slave.path).to.equal(connectOptions.path);

                expect(slave.toString()).to
                  .equal(`Slave id=${slave.id}, alias=${slave.alias}, sent=${slave.sent}, received=${slave.received}`);

                expect(slave.hasExited).to.equal(true);
                expect(slave.isConnected).to.equal(false);
                expect(slave.spawnError).to.equal(null);
                done();
              });
            }, 2000);
          });
        }, 2000);
      } else {
        done();
      }
    });

    it('Should handle spawn errors', function (done) {
      this.timeout(3000);
      this.slow(2500);

      RemoteSlave.reconnectionAttempts = 4;
      RemoteSlave.reconnectionDelay = 4000;
      RemoteSlave.reconnectionAttempts = 'a';
      RemoteSlave.reconnectionDelay = 'b';

      let location = path.join('test', 'data', 'doesnt-exist.js');
      const connectOptions = {
        location: '127.0.0.1:1339',
        path: location,
      };

      const slave = new RemoteSlave(connectOptions); // eslint-disable-line
      slave.on('spawn error', er => {
        expect(er).to.be.an.instanceof(Error);
        expect(er.message).to.match(
          /Slave constructor argument #0 requires a regular file,.*/ // eslint-disable-line max-len
        );


        try {
          const slave = new RemoteSlave(); // eslint-disable-line
        } catch (e) {
          expect(e.message).to.equal(
            'RemoteSlave#constructor expected argument #0 (connectOptions) to be an object, but got undefined'
          );
        }

        try {
          const slave = new RemoteSlave(''); // eslint-disable-line
        } catch (e) {
          expect(e.message).to.equal(
            'RemoteSlave#constructor expected argument #0 (connectOptions) to be an object, but got string'
          );
        }

        try {
          const slave = new RemoteSlave([]); // eslint-disable-line
        } catch (e) {
          expect(e.message).to.equal(
            'RemoteSlave#constructor expected argument #0 ' +
            '(connectOptions) property "location" to be a string, but got undefined'
          );
        }

        try {
          const slave = new RemoteSlave(() => {}); // eslint-disable-line
        } catch (e) {
          expect(e.message).to.equal(
            'RemoteSlave#constructor expected argument #0 (connectOptions) to be an object, but got function'
          );
        }

        try {
          const slave = new RemoteSlave(null); // eslint-disable-line
        } catch (e) {
          expect(e.message).to.equal(
            'RemoteSlave#constructor expected argument #0 (connectOptions) property ' +
            '"location" to be a string, but got undefined'
          );
        }

        location = path.join('test', 'data');
        connectOptions.path = location;
        try {
          const slave = new RemoteSlave(location); // eslint-disable-line
        } catch (e) {
          expect(e.message).to.equal(
            'RemoteSlave#constructor expected argument #0 (connectOptions) to be an object, but got string'
          );
        }
        done();
      });
    });

    it('Should set the slave title option', function (done) {
      this.timeout(3000);
      this.slow(2500);

      const connectOptions = {
        host: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-d.js'),
      };

      const slave = new RemoteSlave(connectOptions, { title: 'slave-title-test' });
      slave.kill('SIGINT');
      done();
    });

    it('Should set slave process arguments', function (done) {
      this.timeout(3000);
      this.slow(2500);

      const connectOptions = {
        location: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-d.js'),
      };

      const slave = new RemoteSlave(connectOptions, { title: 'slave-title-test', args: ['a', '--foo=bar', '-x'] });
      slave.kill('SIGBREAK');
      done();
    });
  });

  describe('RemoteSlave#exec, RemoteSlave#do', function () {
    it('Should pass options.forkOptions to ChildProcess.fork', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const connectOptions = {
        location: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-j.js'),
      };

      const slave = new RemoteSlave(connectOptions, { forkOptions: { silent: true } });
      let gotStdout = false;
      let gotStderr = false;

      slave.on('stdout', (m) => {
        expect(m.toString('utf8')).to.equal('testing silent slave\n');
        gotStdout = true;
      });

      slave.on('stdout', (m) => {
        expect(m.toString('utf8')).to.equal('testing silent slave\n');
        gotStderr = true;
      });

      slave.do('echo', null)
        .then((res) => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.error).to.equal(null);
          expect(res.value).to.equal(slave.id);
          slave.kill('SIGSTOP');
          if (gotStdout === false) {
            return done(new Error('Expected stdout, but got none...'));
          }
          if (gotStderr === false) {
            return done(new Error('Expected stderr, but got none...'));
          }
          return done();
        })
        .catch(e => {
          done(e);
        });
    });

    it('Should handle request timeouts', function (done) {
      this.timeout(3000);
      this.slow(2500);
      let completed = 0;

      const connectOptions = {
        location: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-d.js'),
      };

      let slave = new RemoteSlave(connectOptions);
      slave.do('echo', null, { timeout: 1000 })
        .then((res) => {
          expect(res).to.be.an.instanceof(TimeoutResponse);
          expect(res.error.message).to.match(/Request #\d+ with command "\w+" timed out after 1000ms./);
          expect(res.error.name).to.equal('ResponseError: Error');
          if (++completed === 2) {
            slave.kill();
            done();
          }
        })
        .catch(e => {
          done(e);
        });

      connectOptions.path = path.join('test', 'data', 'simple-slave-c.js');
      slave = new RemoteSlave(connectOptions);
      slave.exec(1234, null)
        .then((res) => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.error.message).to.match(/Slave #\d+ does not listen to task "1234"/);
          expect(res.error.name).to.equal('ResponseError: ReferenceError');
          if (++completed === 2) {
            slave.kill('SIGHUP');
            done();
          }
        })
        .catch(e => {
          done(e);
        });
    });

    it('Should handle request timeouts (with Slave.defaultTimeout set), part I', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const connectOptions = {
        location: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-d.js'),
      };
      const slave = new RemoteSlave(connectOptions);

      RemoteSlave.defaultTimeout = 100;
      slave.do('echo', null)
        .then((res) => {
          expect(res).to.be.an.instanceof(TimeoutResponse);
          expect(res.error.message).to.match(/Request #\d+ with command "\w+" timed out after 100ms./);
          expect(res.error.name).to.equal('ResponseError: Error');
          slave.kill('SIGTERM');
          done();
        })
        .catch(e => {
          done(e);
        });
      RemoteSlave.defaultTimeout = 0;
      RemoteSlave.defaultTimeout = null;
    });

    it('Should handle request timeouts (with Slave.defaultTimeout set), part II', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const connectOptions = {
        location: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-d.js'),
      };
      const slave = new RemoteSlave(connectOptions);

      RemoteSlave.defaultTimeout = 10;
      slave.do('echo', null, { catchAll: true })
        .then(() => done(new Error('Expected to throw')))
        .catch(e => {
          expect(e).to.be.an.instanceof(ResponseError);
          expect(e.message).to.match(/Request #\d+ with command "\w+" timed out after 10ms./);
          expect(e.name).to.equal('ResponseError: Error');
          slave.kill('SIGHUP');
          done();
        });
      RemoteSlave.defaultTimeout = undefined;
      expect(RemoteSlave.defaultTimeout).to.equal(null);
    });

    it('Should handle request timeouts (with Master#defaultTimeout set), part I', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const connectOptions = {
        location: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-d.js'),
      };
      const slave = new RemoteSlave(connectOptions);

      master.defaultTimeout = 100;
      expect(master.defaultTimeout).to.equal(RemoteSlave.defaultTimeout);
      slave.do('echo', null)
        .then((res) => {
          expect(res).to.be.an.instanceof(TimeoutResponse);
          expect(res.error.message).to.match(/Request #\d+ with command "\w+" timed out after 100ms./);
          expect(res.error.name).to.equal('ResponseError: Error');
          slave.kill();
          done();
        })
        .catch(e => {
          done(e);
        });
      master.defaultTimeout = null;
    });

    it('Should handle request timeouts (with RemoteSlave#defaultTimeout set), part I', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const connectOptions = {
        location: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-d.js'),
      };
      const slave = new RemoteSlave(connectOptions);

      slave.defaultTimeout = 50;
      slave.defaultTimeout = undefined;
      expect(slave.defaultTimeout).to.equal(null);
      slave.defaultTimeout = null;
      expect(slave.defaultTimeout).to.equal(null);
      slave.defaultTimeout = false;
      expect(slave.defaultTimeout).to.equal(null);
      slave.defaultTimeout = 50;
      slave.defaultTimeout = 'foo';
      slave.defaultTimeout = [];
      slave.defaultTimeout = () => {};
      expect(slave.defaultTimeout).to.equal(50);
      slave.do('echo', null)
        .then((res) => {
          expect(res).to.be.an.instanceof(TimeoutResponse);
          expect(res.error.message).to.match(/Request #\d+ with command "\w+" timed out after 50ms./);
          expect(res.error.name).to.equal('ResponseError: Error');
          slave.kill();
          done();
        })
        .catch(e => {
          done(e);
        });

      slave.defaultTimeout = undefined;
      expect(slave.defaultTimeout).to.equal(null);
    });

    it('Should handle request timeouts (with RemoteSlave#defaultTimeout set), part II', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const connectOptions = {
        location: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-d.js'),
      };
      const slave = new RemoteSlave(connectOptions);
      const slave2 = new RemoteSlave(connectOptions);

      slave2.defaultTimeout = 2;
      slave2.defaultTimeout = 'foo';
      slave.defaultTimeout = [];
      slave.defaultTimeout = () => {};
      expect(slave.defaultTimeout).to.equal(null);
      expect(slave2.defaultTimeout).to.equal(2);
      master.tell(slave, slave2).to('echo', null, { catchAll: true })
        .then(() => done(new Error('Expected to throw')))
        .catch(e => {
          expect(e).to.be.an.instanceof(ResponseError);
          expect(e.message).to.match(/Request #\d+ with command "\w+" timed out after 2ms./);
          expect(e.name).to.equal('ResponseError: Error');
          slave.kill();
          slave2.kill();
          done();
        });
    });

    it('Should reject on invalid command types', function (done) {
      const connectOptions = {
        location: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-d.js'),
      };
      const slave = new RemoteSlave(connectOptions);
      let completed = 0;

      slave.exec({}, null, { timeout: 1000 })
        .then(() => {
          done(new Error('Expected to throw'));
        })
        .catch(e => {
          expect(e).to.be.an.instanceof(TypeError);
          expect(e.message).to.equal('Slave#exec expected argument #0 to be a command string, but got: object');
          if (++completed === 3) {
            slave.kill();
            done();
          }
        });

      slave.exec(() => {}, null, { timeout: 1000 })
        .then(() => {
          done(new Error('Expected to throw'));
        })
        .catch(e => {
          expect(e).to.be.an.instanceof(TypeError);
          expect(e.message).to.equal('Slave#exec expected argument #0 to be a command string, but got: function');
          if (++completed === 3) {
            slave.kill();
            done();
          }
        });

      slave.do([], null, { timeout: 1000 }, function (err, res) {
        expect(res).to.equal(null);
        expect(err).to.be.an.instanceof(TypeError);
        expect(err.message).to.equal('Slave#exec expected argument #0 to be a command string, but got: object');
        if (++completed === 3) {
          slave.kill();
          done();
        }
      });
    });
  });

  it('Should expect a non-empty string filepath for the "file" argument', function (done) {
    try {
      const slave = new RemoteSlave(); // eslint-disable-line
    } catch (e) {
      expect(e.message).to.equal(
        'RemoteSlave#constructor expected argument #0 (connectOptions) to be an object, but got undefined'
      );
    }

    try {
      const slave = new RemoteSlave(''); // eslint-disable-line
    } catch (e) {
      expect(e.message).to.equal(
        'RemoteSlave#constructor expected argument #0 (connectOptions) to be an object, but got string'
      );
    }
    done();
  });

  it('Should have a #then property', function (done) {
    const connectOptions = {
      location: '127.0.0.1:1339',
      path: path.join('test', 'data', 'simple-slave-d.js'),
    };
    const slave = new RemoteSlave(connectOptions);
    slave.then();
    slave.then('string');
    slave.then(123);
    slave.then({});

    const p = new Promise(() => {});
    expect(slave.then(() => p)).to.equal(p);
    slave.then(() => {
      slave.kill();
      done();
    });
  });

  it('Should handle very short request timeouts', function (done) {
    const connectOptions = {
      location: '127.0.0.1:1339',
      path: path.join('test', 'data', 'simple-slave-d.js'),
    };
    const slave = new RemoteSlave(connectOptions);
    slave.exec('echo', null, { timeout: 1 })
      .then((res) => {
        expect(res).to.be.an.instanceof(TimeoutResponse);
        expect(res.error.message).to.match(/Request #\d+ with command "\w+" timed out after \d+ms./);
        expect(res.error.name).to.equal('ResponseError: Error');
        done();
      })
      .catch(e => {
        done(e);
      });
  });

  describe('RemoteSlave#ack', function () {
    this.slow(2000);
    it('Should send an acknowledgement message', function (done) {
      const connectOptions = {
        location: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-d.js'),
      };
      const slave = new RemoteSlave(connectOptions);

      slave.ack({ foo: 'bar' })
        .then(res => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.be.an('object');
          expect(res.value.data).to.equal(null);
          expect(res.value.meta).to.eql({ foo: 'bar' });
          expect(res.value.from).to.be.an('number');
          expect(res.value.sent).to.be.an('number');
          expect(res.value.responsed).to.be.an('number');
          expect(res.value.started).to.be.an('number');
          expect(res.value.uptime).to.be.an('number');
          expect(res.value.message).to.be.an('string');
          done();
        })
        .catch(e => {
          done(e);
        });
    });
  });

  describe('RemoteSlave#noop', function () {
    this.slow(2000);
    it('Should send a noop message', function (done) {
      const connectOptions = {
        location: '127.0.0.1:1339',
        path: path.join('test', 'data', 'simple-slave-d.js'),
      };
      const slave = new RemoteSlave(connectOptions);

      slave.noop()
        .then(res => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal(null);
          done();
        })
        .catch(e => {
          done(e);
        });
    });
  });

  after((done) => {
    RemoteSlave.getSlavesWithPath(path.join('test', 'data', 'simple-slave-a.js')).kill();
    done();
  });
});
