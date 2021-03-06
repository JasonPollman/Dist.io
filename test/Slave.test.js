/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const Slave = require('../lib/Slave');
const path = require('path');
const expect = require('chai').expect;
const exec = require('child_process').exec;
const pgrep = 'pgrep';
const os = require('os');
const Response = require('../lib/Response');
const TimeoutResponse = require('../lib/TimeoutResponse');
const ResponseError = require('../lib/ResponseError');
const master = require('../lib/Master');
const ChildProcess = require('child_process').ChildProcess;

describe('Slave Class', function () {
  describe('Slave#getAllSlaves', function () {
    it('Should return an array of all slaves', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-a.js');
      new Slave(location, { group: 'slave-test-get-all' }); // eslint-disable-line
      new Slave(location, { group: 'slave-test-get-all' }); // eslint-disable-line
      new Slave(location, { group: 'slave-test-get-all' }); // eslint-disable-line

      const slaves = Slave.getAllSlaves();
      expect(slaves).to.be.an('array');
      expect(slaves.length).to.be.gte(3);
      slaves.forEach(s => {
        expect(s.pid).to.be.a('number');
        expect(s.pid).to.be.gte(0);
      });
      master.kill('slave-test-get-all');
      done();
    });
  });

  describe('Slave#childProcess', function () {
    it('Should return the slave\'s child process instance', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-a.js');
      const a = new Slave(location); // eslint-disable-line

      expect(a.childProcess).to.be.an.instanceof(ChildProcess);
      a.on('spawn error', e => {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('test');
        done();
      });

      a.childProcess.emit('error', new Error('test'));
    });

    it('Should throw on spawn error if no "spawn error" event is registered', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-a.js');
      const a = new Slave(location);
      expect(a.childProcess).to.be.an.instanceof(ChildProcess);
      try {
        a.childProcess.emit('error', new Error('test'));
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e.message).to.equal('test');
        done();
      }
    });
  });

  describe('Slave#getSlaveWithAlias', function () {
    it('Should return an array of all slaves', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-a.js');
      const a = new Slave(location, { alias: 'bar2' }); // eslint-disable-line
      const b = new Slave(location); // eslint-disable-line
      const c = new Slave(location); // eslint-disable-line

      const slaves = Slave.getAllSlaves();
      expect(slaves).to.be.an('array');
      expect(slaves.length).to.be.gte(3);
      expect(Slave.getSlaveWithAlias('foo')).to.equal(null);

      let ss = null;
      try {
        ss = new Slave(location, { alias: 'bar2' }); // eslint-disable-line
      } catch (e) {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('Slave with alias "bar2" already exists.');
      }
      slaves.forEach(s => {
        s.group = 'new group';
        s.group = {};
        expect(s.rank).to.be.a('number');
        expect(s.group).to.equal('new group');
      });
      master.kill(ss, a, b, c);
      done();
    });
  });

  describe('Slave#lastId', function () {
    it('Should return an array of all slaves', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-a.js');
      const x = new Slave(location); // eslint-disable-line
      const y = new Slave(location); // eslint-disable-line
      const z = new Slave(location); // eslint-disable-line

      Slave.getAllSlaves();
      master.kill(x, y, z);
      expect(Slave.lastId).to.be.gte(3);
      done();
    });
  });

  describe('Slave#constructor', function () {
    it('Should spawn a new slave, then kill it', function (done) {
      this.timeout(5500);
      this.slow(5000);

      const location = path.join(__dirname, 'data', 'simple-slave-a-3.js');
      const slave = new Slave(location);
      expect(slave).to.be.an.instanceof(Slave);
      expect(slave.id).to.match(/^\d+$/);
      expect(slave.alias).to.match(/^0x[a-z0-9]+$/);
      expect(slave.location).to.equal(location);
      expect(slave.path).to.equal(location);
      expect(Slave.isSlaveMessage).to.be.a('function');

      expect(slave.toString())
        .to.equal(`Slave id=${slave.id}, alias=${slave.alias}, sent=${slave.sent}, received=${slave.received}`);

      expect(slave.hasExited).to.equal(false);
      expect(slave.isConnected).to.equal(true);
      expect(slave.spawnError).to.equal(null);

      if (os.platform() !== 'win32') {
        setTimeout(() => {
          exec(`${pgrep} TestingSimpleSlaveA3`, function (err, stdout) {
            expect(err).to.equal(null);
            expect(stdout.trim()).to.match(/^\d+\s*$/m);
            expect(slave.kill()).to.equal(slave);
            exec(`${pgrep} TestingSimpleSlaveA3`, function (e, sout) {
              expect(err).to.equal(null);
              expect(sout.trim()).to.match(/^$/);
              expect(slave.id).to.match(/^\d+$/);
              expect(slave.alias).to.match(/^0x[a-z0-9]+$/);
              expect(slave.location).to.equal(location);

              expect(slave.toString())
                .to.equal(`Slave id=${slave.id}, alias=${slave.alias}, sent=${slave.sent}, received=${slave.received}`);

              expect(slave.hasExited).to.equal(true);
              expect(slave.isConnected).to.equal(false);
              expect(slave.spawnError).to.equal(null);

              expect(Slave.protected.bind(Slave, null)).to.throw(Error);
              expect(Slave.protected.bind(Slave, slave)).to.not.throw(Error);

              expect(Slave.cleanupSlaveReferences.bind(Slave, null)).to.throw(Error);
              expect(Slave.cleanupSlaveReferences.bind(Slave, slave)).to.not.throw(Error);
              done();
            });
          });
        }, 2000);
      } else {
        done();
      }
    });

    it('Should handle spawn errors', function (done) {
      this.timeout(3000);
      this.slow(2500);

      let location = path.join(__dirname, 'data', 'doesnt-exist.js');
      try {
        const slave = new Slave(location); // eslint-disable-line
      } catch (e) {
        expect(e.message).to.equal('Slave constructor argument #0 requires a regular file, ' +
          'but received error: ENOENT: no such file or directory, ' +
          'stat \'/Users/Jason/Source/Dist.io/test/data/doesnt-exist.js\''
        );
      }

      try {
        const slave = new Slave(); // eslint-disable-line
      } catch (e) {
        expect(e.message).to.equal('Slave constructor argument #0 requires a non-empty string, but got: "undefined"');
      }

      try {
        const slave = new Slave(''); // eslint-disable-line
      } catch (e) {
        expect(e.message).to.equal('Slave constructor argument #0 requires a non-empty string, but got: ""');
      }

      try {
        const slave = new Slave([]); // eslint-disable-line
      } catch (e) {
        expect(e.message).to.equal('Slave constructor argument #0 requires a non-empty string, but got: "object"');
      }

      try {
        const slave = new Slave(() => {}); // eslint-disable-line
      } catch (e) {
        expect(e.message).to.equal('Slave constructor argument #0 requires a non-empty string, but got: "function"');
      }

      try {
        const slave = new Slave(null); // eslint-disable-line
      } catch (e) {
        expect(e.message).to.equal('Slave constructor argument #0 requires a non-empty string, but got: "object"');
      }

      location = path.join(__dirname, 'data');
      try {
        const slave = new Slave(location); // eslint-disable-line
      } catch (e) {
        expect(e.message).to.equal(
          'Slave constructor argument #0 requires a regular file, ' +
          'but /Users/Jason/Source/Dist.io/test/data isn\'t a file.'
        );
      }
      done();
    });

    it('Should set the slave title option', function (done) {
      this.timeout(3000);
      this.slow(2500);

      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location, { title: 'slave-title-test' });
      slave.kill();
      done();
    });

    it('Should set slave process arguments', function (done) {
      this.timeout(3000);
      this.slow(2500);

      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location, { title: 'slave-title-test', args: ['a', '--foo=bar', '-x'] });
      slave.kill();
      done();
    });
  });

  describe('Slave#exec, Slave#do', function () {
    it('Should pass options.forkOptions to ChildProcess.fork', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const location = path.join(__dirname, 'data', 'simple-slave-j.js');
      const slave = new Slave(location, { forkOptions: { silent: true } });
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
          slave.kill();
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

      let location = path.join(__dirname, 'data', 'simple-slave-d.js');
      let slave = new Slave(location);
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

      location = path.join(__dirname, 'data', 'simple-slave-c.js');
      slave = new Slave(location);
      slave.exec(1234, null)
        .then((res) => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.error.message).to.match(/Slave #\d+ does not listen to task "1234"/);
          expect(res.error.name).to.equal('ResponseError: ReferenceError');
          if (++completed === 2) {
            slave.kill();
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

      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location);

      Slave.defaultTimeout = 100;
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
      Slave.defaultTimeout = 0;
      Slave.defaultTimeout = null;
    });

    it('Should handle request timeouts (with Slave.defaultTimeout set), part II', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location);

      Slave.defaultTimeout = 10;
      slave.do('echo', null, { catchAll: true })
        .then(() => done(new Error('Expected to throw')))
        .catch(e => {
          expect(e).to.be.an.instanceof(ResponseError);
          expect(e.message).to.match(/Request #\d+ with command "\w+" timed out after 10ms./);
          expect(e.name).to.equal('ResponseError: Error');
          slave.kill();
          done();
        });
      Slave.defaultTimeout = undefined;
      expect(Slave.defaultTimeout).to.equal(null);
    });

    it('Should handle request timeouts (with Master#defaultTimeout set), part I', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location);

      master.defaultTimeout = 100;
      expect(master.defaultTimeout).to.equal(Slave.defaultTimeout);
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

    it('Should handle request timeouts (with Slave#defaultTimeout set), part I', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location);

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

    it('Should handle request timeouts (with Slave#defaultTimeout set), part II', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location);
      const slave2 = new Slave(location);

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
      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location);
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
      const slave = new Slave(); // eslint-disable-line
    } catch (e) {
      expect(e.message).to.equal('Slave constructor argument #0 requires a non-empty string, but got: "undefined"');
    }

    try {
      const slave = new Slave(''); // eslint-disable-line
    } catch (e) {
      expect(e.message).to.equal('Slave constructor argument #0 requires a non-empty string, but got: ""');
    }
    done();
  });

  it('Should have a #then property', function (done) {
    const location = path.join(__dirname, 'data', 'simple-slave-d.js');
    const slave = new Slave(location);
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
    const location = path.join(__dirname, 'data', 'simple-slave-d.js');
    const slave = new Slave(location);
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

  describe('Slave#ack', function () {
    this.slow(2000);
    it('Should send an acknowledgement message', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location);

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

  describe('Slave#noop', function () {
    this.slow(2000);
    it('Should send a noop message', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location);

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
    Slave.getSlavesWithPath(path.join(__dirname, 'data', 'simple-slave-a.js')).kill();
    done();
  });
});
