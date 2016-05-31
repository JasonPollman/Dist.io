/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const Master = require('../lib/Master');
const Slave = require('../lib/Slave');
const path = require('path');
const expect = require('chai').expect;
const Response = require('../lib/Response');
const ResponseError = require('../lib/ResponseError');
const SlaveArray = require('../lib/SlaveArray');

describe('Master Class', function () {
  describe('Master#close', function () {
    it('Should gracefully close the given slave arguments', function (done) {
      this.timeout(3000);
      this.slow(2000);

      let slaves = Master.createSlaves(
        10, path.join(__dirname, 'data', 'simple-slave-b.js'), { group: 'testing close' }
      );

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(10);

      Master.close(slaves[0])
        .then(status => {
          expect(status).to.equal(true);
          slaves = Master.slaves.inGroup('testing close');
          expect(slaves).to.be.an.instanceof(SlaveArray);
          expect(slaves.length).to.equal(9);
        })
        .then(() => Master.close(slaves[0]))
        .then(status => {
          expect(status).to.equal(true);
          slaves = Master.slaves.inGroup('testing close');
          expect(slaves).to.be.an.instanceof(SlaveArray);
          expect(slaves.length).to.equal(8);
        })
        .then(() => Master.close(slaves[0], slaves[1]))
        .then(statuses => {
          expect(statuses).to.be.an.instanceof(Array);
          expect(statuses[0]).to.equal(true);
          expect(statuses[1]).to.equal(true);
          slaves = Master.slaves.inGroup('testing close');
          expect(slaves).to.be.an.instanceof(SlaveArray);
          expect(slaves.length).to.equal(6);
        })
        .then(() => Master.close(slaves))
        .then(statuses => {
          expect(statuses).to.be.an.instanceof(Array);
          slaves = Master.slaves.inGroup('testing close');
          expect(slaves).to.be.an.instanceof(SlaveArray);
          expect(slaves.length).to.equal(0);
          done();
        })
        .catch(e => done(e));
    });
  });

  describe('Master#getSlaveWithId', function () {
    it('Should get the correct slave when passed a slave id', function () {
      expect(Master.getSlaveWithId(Number.MAX_VALUE)).to.equal(null);
      expect(Master.getSlaveWithId(11111)).to.equal(null);
      expect(Master.getSlaveWithId(-1)).to.equal(null);
      expect(Master.getSlaveWithId(800)).to.equal(null);
      expect(Master.getSlaveWithId('')).to.equal(null);
      expect(Master.getSlaveWithId(function () {})).to.equal(null);
      expect(Master.getSlaveWithId([])).to.equal(null);
      expect(Master.getSlaveWithId({})).to.equal(null);

      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      const s = Master.getSlaveWithId(slave.id);

      expect(s).to.be.an.instanceof(Slave);
      expect(slave).to.equal(s);

      expect(s.kill('SIGINT')).to.equal(s);
    });
  });

  describe('Master#getSlaveWithAlias', function () {
    it('Should get the correct slave when passed a slave alias', function () {
      expect(Master.getSlaveWithAlias(0)).to.equal(null);
      expect(Master.getSlaveWithAlias(1)).to.equal(null);
      expect(Master.getSlaveWithAlias(-1)).to.equal(null);
      expect(Master.getSlaveWithAlias(800)).to.equal(null);
      expect(Master.getSlaveWithAlias('')).to.equal(null);
      expect(Master.getSlaveWithAlias(function () {})).to.equal(null);
      expect(Master.getSlaveWithAlias([])).to.equal(null);
      expect(Master.getSlaveWithAlias({})).to.equal(null);
      expect(Master.getSlaveWithAlias('my slave')).to.equal(null);

      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'), { alias: 'slavey' });
      const s = Master.getSlaveWithAlias('slavey');

      expect(s).to.be.an.instanceof(Slave);
      expect(slave).to.equal(s);

      expect(s.kill('SIGINT')).to.equal(s);
    });
  });

  describe('Master#tellSlave', function (done) {
    it('Should send task commands to a slave', function () {
      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'), { alias: 'slavey' });
      let completed = 0;

      Master.tellSlave(slave.id).to('echo', 'okay')
        .then(res => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal('okay');
          if (++completed === 3) done();
        })
        .catch(e => {
          done(e);
        });

      Master.tellSlave('slavey').to('echo', 'okay 2')
        .then(res => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal('okay 2');
          if (++completed === 3) done();
        })
        .catch(e => {
          done(e);
        });

      Master.tellSlave(slave).to('echo', 'okay')
        .then(res => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal('okay 3');
          if (++completed === 3) done();
        })
        .catch(e => {
          done(e);
        });
    });
  });

  describe('Master#createSlave', function () {
    it('Should catch uncaught slave exceptions', function (done) {
      this.timeout(6000);
      this.slow(5000);

      Master.createSlave(path.join(__dirname, 'data', 'simple-slave-g.js'), {
        onUncaughtException: (e) => {
          expect(e).to.be.an.instanceof(Error);
          expect(e.message).to.equal('uncaught exception');
        },
      });

      Master.createSlave(path.join(__dirname, 'data', 'simple-slave-h.js'), {
        onUncaughtException: (er) => {
          expect(er).to.be.an.instanceof(Error);
          expect(er.message).to.equal('Unknown error');
          done();
        },
      });
    });

    it('Should create new slave objects', function (done) {
      this.timeout(3000);
      this.slow(1000);

      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      let completed = 0;

      slave.exec('echo', 'test data')
        .then(res => { expect(res.value).to.equal('test data'); })
        .then(() => slave.exec('echo', { foo: 'bar' }))
        .then(res => { expect(res.value).to.eql({ foo: 'bar' }); })
        .then(() => slave.exec('echo', [1, 2, 3, 4, 5]))
        .then(res => { expect(res.value).to.eql([1, 2, 3, 4, 5]); })
        .then(() => slave.exec('echo', function () {}))
        .then(res => { expect(res.value).to.eql(null); })
        .then(() => slave.exec('echo', new Error('foo')))
        .then(res => { expect(res.value).to.eql({}); })
        .then(() => slave.close())
        .then(() => {
          expect(slave.sent).to.be.gte(10);
          expect(slave.received).to.be.gte(10);
        })
        .then(() => {
          if (++completed === 2) {
            expect(slave.kill('SIGINT')).to.equal(slave);
            done();
          }
        })
        .catch(e => {
          done(e);
        });

      slave.exec('echo', 'test data')
        .then(res => { expect(res.value).to.equal('test data'); })
        .then(() => slave.exec('echo', { foo: 'bar' }))
        .then(res => { expect(res.value).to.eql({ foo: 'bar' }); })
        .then(() => slave.exec('echo', [1, 2, 3, 4, 5]))
        .then(res => { expect(res.value).to.eql([1, 2, 3, 4, 5]); })
        .then(() => slave.exec('echo', function () {}))
        .then(res => { expect(res.value).to.eql(null); })
        .then(() => slave.exec('echo', new Error('foo')))
        .then(res => { expect(res.value).to.eql({}); })
        .then(() => { slave.close(); })
        .then(() => {
          expect(slave.sent).to.be.gte(10);
          expect(slave.received).to.be.gte(10);
        })
        .then(() => {
          if (++completed === 2) {
            expect(slave.kill('SIGINT')).to.equal(slave);
            done();
          }
        })
        .catch(e => {
          done(e);
        });
    });
  });


  describe('Master#createSlaves', function () {
    it('Should throw when "count" is non-numeric', function (done) {
      expect(Master.createSlaves.bind(Master, '')).to.throw(TypeError);
      expect(Master.createSlaves.bind(Master, [])).to.throw(TypeError);
      expect(Master.createSlaves.bind(Master, {})).to.throw(TypeError);
      expect(Master.createSlaves.bind(Master, () => {})).to.throw(TypeError);
      expect(Master.createSlaves.bind(Master, 0)).to.not.throw(TypeError);
      expect(Master.createSlaves.bind(Master, -1)).to.not.throw(TypeError);
      expect(Master.createSlaves.bind(Master, '0')).to.not.throw(TypeError);
      expect(Master.createSlaves.bind(Master, '-1')).to.not.throw(TypeError);

      expect(Master.createSlaves(0, path.join(__dirname, 'data', 'simple-slave-c.js'))).to.eql([]);
      expect(Master.createSlaves(-100, path.join(__dirname, 'data', 'simple-slave-c.js'))).to.eql([]);

      const slaves = Master.createSlaves(3, path.join(__dirname, 'data', 'simple-slave-c.js'), { group: 'my group' });
      expect(slaves).to.be.an('array');
      expect(slaves.length).to.equal(3);
      slaves.forEach(s => expect(s.group).to.equal('my group'));
      slaves.forEach(q => expect(q.close()).to.be.an.instanceof(Promise));
      done();
    });
  });

  describe('Master#broadcast.to', function () {
    this.slow(1000);
    it('Should reject when the command is not a string', function (done) {
      const slaves = Master.createSlaves(5, path.join(__dirname, 'data', 'simple-slave-c.js'), { group: 'test' });

      Master
        .broadcast([])
        .to(slaves[0], slaves[1])
        .then(() => {
          done(new Error('Should have rejected, not resolved.'));
        })
        .catch(e => {
          expect(e).to.be.an.instanceof(TypeError);
          expect(e.message).to.equal(
            'Master#broadcast expected argument #0 (command) to be a string or number, but got object.'
          );
          done();
        });
    });

    it('Broadcast messages to the given slave group', function (done) {
      this.timeout(3000);
      this.slow(2000);
      let totalDone = 0;

      const slaves = Master.createSlaves(5, path.join(__dirname, 'data', 'simple-slave-c.js'), { group: 'c-type' });
      expect(slaves).to.be.an('array');
      expect(slaves.length).to.equal(5);
      slaves.forEach(s => expect(s.group).to.equal('c-type'));

      const startSlaveId = slaves[0].id;
      const TOTAL = 7;
      let totalValue = 0;

      for (let i = startSlaveId; i < startSlaveId + 5; i++) {
        totalValue += i;
      }

      Master.broadcast('echo').to('c-type')
        .then(responses => {
          expect(responses.length).to.equal(5);
          expect(responses.errors).to.be.an.instanceof(Array);
          expect(responses.errors.length).to.equal(5);
          expect(responses.values.length).to.equal(5);
          responses.each((res, i, k) => {
            expect(res).to.be.an.instanceof(Response);
            expect(res.val).to.equal(k + startSlaveId);
            expect(res.rid).to.match(/^\d+$/);
            expect(res.id).to.match(/^\d+$/);
            expect(res.error).to.equal(null);
            expect(res.request).to.be.an('object');
            expect(res.sent).to.be.a('number');
            expect(res.command).to.be.an('string');
            expect(res.toString()).to.match(
              /^Response: from=\d+, txid=\d+, rid=\d+, received=\d+, error=false$/
            );
          });
          if (++totalDone === TOTAL) done();
        })
        .catch(e => {
          done(e);
        });

      Master.broadcast('echo').to('c-type')
        .then(responses => {
          expect(responses.length).to.equal(5);
          responses.each((res, i, k) => {
            expect(res).to.be.an.instanceof(Response);
            expect(res.data).to.equal(k + startSlaveId);
            expect(res.error).to.equal(null);
            expect(res.rid).to.match(/^\d+$/);
            expect(res.id).to.match(/^\d+$/);
            expect(res.request).to.be.an('object');
            expect(res.sent).to.be.a('number');
            expect(res.command).to.be.a('string');
            expect(res.toString()).to.match(
              /^Response: from=\d+, txid=\d+, rid=\d+, received=\d+, error=false$/
            );
          });
          const sum = responses.reduce(
            function (prev, curr) {
              return { value: prev.value + curr.value };
            },
            { value: 0 }
          ).value;

          expect(sum).to.equal(totalValue);
          if (++totalDone === TOTAL) done();
        })
        .catch(e => {
          done(e);
        });

      const eslaves = Master.createSlaves(3, path.join(__dirname, 'data', 'simple-slave-e.js'), { group: 'e-type' });
      expect(eslaves).to.be.an('array');
      expect(eslaves.length).to.equal(3);
      eslaves.forEach(s => expect(s.group).to.equal('e-type'));

      Master.broadcast('echo').to('e-type')
        .then(responses => {
          expect(responses.length).to.equal(3);
          responses.each(res => {
            expect(res).to.be.an.instanceof(Response);
            expect(res.data).to.equal(undefined);
            expect(res.error).to.be.an.instanceof(ResponseError);
            expect(res.error.message).to.equal('Test Error');
            expect(res.rid).to.match(/^\d+$/);
            expect(res.id).to.match(/^\d+$/);
            expect(res.request).to.be.an('object');
            expect(res.sent).to.be.a('number');
            expect(res.command).to.be.a('string');
            expect(res.toString()).to.match(
              /^Response: from=\d+, txid=\d+, rid=\d+, received=\d+, error=true$/
            );
          });
          if (++totalDone === TOTAL) done();
        })
        .catch(e => {
          done(e);
        });


      const fslaves = Master.createSlaves(3, path.join(__dirname, 'data', 'simple-slave-f.js'), { group: 'f-type' });
      expect(fslaves).to.be.an('array');
      expect(fslaves.length).to.equal(3);
      fslaves.forEach(s => expect(s.group).to.equal('f-type'));

      Master.broadcast('echo').to('f-type')
        .then(responses => {
          expect(responses.length).to.equal(3);
          responses.each(res => {
            expect(res).to.be.an.instanceof(Response);
            expect(res.data).to.equal(undefined);
            expect(res.error).to.be.an.instanceof(ResponseError);
            expect(res.error.message).to.equal('Test Error 2');
            expect(res.rid).to.match(/^\d+$/);
            expect(res.id).to.match(/^\d+$/);
            expect(res.request).to.be.an('object');
            expect(res.sent).to.be.a('number');
            expect(res.command).to.be.a('string');
            expect(res.toString()).to.match(
              /^Response: from=\d+, txid=\d+, rid=\d+, received=\d+, error=true$/
            );
          });
          if (++totalDone === TOTAL) done();
        })
        .catch(e => {
          done(e);
        });

      Master.broadcast('echo').to('c-type')
        .then(responses => {
          expect(responses.length).to.equal(5);
          responses.each((res, i, k) => {
            expect(res).to.be.an.instanceof(Response);
            expect(res.value).to.equal(k + startSlaveId);
            expect(res.error).to.equal(null);
            expect(res.rid).to.match(/^\d+$/);
            expect(res.id).to.match(/^\d+$/);
            expect(res.request).to.be.an('object');
            expect(res.sent).to.be.a('number');
            expect(res.command).to.be.a('string');
            expect(res.toString()).to.match(
              /^Response: from=\d+, txid=\d+, rid=\d+, received=\d+, error=false$/
            );
          });
          const sum = responses.reduce(
            function (prev, curr) {
              return { value: prev.value + curr.value };
            },
            { value: 0 }
          ).value;

          expect(sum).to.equal(totalValue);
          if (++totalDone === TOTAL) done();
        })
        .catch(e => {
          done(e);
        });

      const cTypes = Slave.getSlavesInGroup('c-type');
      Master.broadcast('echo').to(cTypes[0], cTypes[1], cTypes[2], cTypes[3], cTypes[4])
        .then(responses => {
          expect(responses.length).to.equal(5);
          responses.each((res, i, k) => {
            expect(res).to.be.an.instanceof(Response);
            expect(res.value).to.equal(k + startSlaveId);
            expect(res.error).to.equal(null);
            expect(res.rid).to.match(/^\d+$/);
            expect(res.id).to.match(/^\d+$/);
            expect(res.request).to.be.an('object');
            expect(res.sent).to.be.a('number');
            expect(res.command).to.be.a('string');
            expect(res.toString()).to.match(
              /^Response: from=\d+, txid=\d+, rid=\d+, received=\d+, error=false$/
            );
          });
          const sum = responses.reduce(
            function (prev, curr) {
              return { value: prev.value + curr.value };
            },
            { value: 0 }
          ).value;

          expect(sum).to.equal(totalValue);
          if (++totalDone === TOTAL) done();
        })
        .catch(e => {
          done(e);
        });

      Master.broadcast('echo').to('non-existent')
        .then(() => {
          done(new Error('Expected to throw'));
        })
        .catch(e => {
          expect(e).to.be.an.instanceof(TypeError);
          expect(e.message).to.equal(
            'Expected an instanceof Slave, slave id, group id, or slave alias, but got "non-existent".'
          );
          if (++totalDone === TOTAL) done();
        });
    });
  });
});
