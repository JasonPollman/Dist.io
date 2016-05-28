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

describe('Slave Class', function () {
  describe('Slave#getAllSlaves', function () {
    it('Should return an array of all slaves', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-a.js');
      new Slave(location); // eslint-disable-line
      new Slave(location); // eslint-disable-line
      new Slave(location); // eslint-disable-line

      const slaves = Slave.getAllSlaves();
      expect(slaves).to.be.an('array');
      expect(slaves.length).to.be.gte(3);
      slaves.forEach(s => {
        s.kill();
      });
      done();
    });
  });

  describe('Slave#getSlaveWithAlias', function () {
    it('Should return an array of all slaves', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-a.js');
      new Slave(location, { alias: 'bar' }); // eslint-disable-line
      new Slave(location); // eslint-disable-line
      new Slave(location); // eslint-disable-line

      const slaves = Slave.getAllSlaves();
      expect(slaves).to.be.an('array');
      expect(slaves.length).to.be.gte(3);
      expect(Slave.getSlaveWithAlias('foo')).to.equal(null);

      try {
        new Slave(location, { alias: 'bar' }); // eslint-disable-line
      } catch (e) {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('Slave with alias "bar" already exists.');
      }
      slaves.forEach(s => {
        s.kill();
        s.group = 'new group';
        s.group = {};
        expect(s.rank).to.be.a('number');
        expect(s.group).to.equal('new group');
      });
      done();
    });
  });

  describe('Slave#lastId', function () {
    it('Should return an array of all slaves', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-a.js');
      new Slave(location); // eslint-disable-line
      new Slave(location); // eslint-disable-line
      new Slave(location); // eslint-disable-line

      const slaves = Slave.getAllSlaves();
      slaves.forEach(s => {
        s.kill();
      });

      expect(Slave.lastId).to.be.gte(3);
      done();
    });
  });

  it('Should spawn a new slave, then kill it', function (done) {
    this.timeout(5500);
    this.slow(5000);

    const location = path.join(__dirname, 'data', 'simple-slave-a.js');
    const slave = new Slave(location);
    expect(slave).to.be.an.instanceof(Slave);
    expect(slave.id).to.match(/^\d+$/);
    expect(slave.alias).to.match(/^0x[a-z0-9]+$/);
    expect(slave.location).to.equal(location);

    expect(slave.toString())
      .to.equal(`Slave id=${slave.id}, alias=${slave.alias}, sent=${slave.sent}, received=${slave.received}`);

    expect(slave.hasExited).to.equal(false);
    expect(slave.isConnected).to.equal(true);
    expect(slave.spawnError).to.equal(null);

    if (os.platform() !== 'win32') {
      setTimeout(() => {
        exec(`${pgrep} SimpleSlaveA`, function (err, stdout) {
          expect(err).to.equal(null);
          expect(stdout.trim()).to.match(/^\d+\s*$/m);
          expect(slave.kill()).to.equal(slave);
          exec(`${pgrep} SimpleSlaveA`, function (e, sout) {
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
            done();
          });
        });
      }, 2000);
    } else {
      done();
    }
  });

  it('Should handle request timeouts', function (done) {
    this.timeout(3000);
    this.slow(2500);

    let location = path.join(__dirname, 'data', 'simple-slave-d.js');
    let slave = new Slave(location);
    slave.exec('echo', null, { timeout: 1000 })
      .then((res) => {
        expect(res).to.be.an.instanceof(TimeoutResponse);
        expect(res.error.message).to.match(/Request #\d+ with command "\w+" timed out after 1000ms./);
        expect(res.error.name).to.equal('ResponseError: Error');
        done();
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
        done();
      })
      .catch(e => {
        done(e);
      });
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
    it('Should send an acknowledgement message', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location);

      slave.ack()
        .then(res => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.match(/^\d+$/);
          done();
        })
        .catch(e => {
          done(e);
        });
    });
  });

  describe('Slave#noop', function () {
    it('Should send a noop message', function (done) {
      const location = path.join(__dirname, 'data', 'simple-slave-d.js');
      const slave = new Slave(location);

      slave.noop()
        .then(res => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal(undefined);
          done();
        })
        .catch(e => {
          done(e);
        });
    });
  });
});
