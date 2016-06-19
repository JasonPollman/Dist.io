/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const Master = require('../lib/Master');
const Slave = require('../lib/Slave');
const path = require('path');
const expect = require('chai').expect;
const Response = require('../lib/Response');
const ResponseError = require('../lib/ResponseError');
const ResponseArray = require('../lib/ResponseArray');
const SlaveArray = require('../lib/SlaveArray');

describe('Master Class', function () {
  describe('Master#close', function () {
    it('Should gracefully close the given slave arguments (Promises)', function (done) {
      this.timeout(3000);
      this.slow(2000);

      let slaves = Master.createSlaves(
        10, path.join(__dirname, 'data', 'simple-slave-b.js'), { group: 'testing close' }
      );

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(10);

      slaves.each(s => {
        expect(s.isRemote).to.equal(false);
      });

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

    it('Should gracefully close the given slave arguments (callbacks)', function (done) {
      this.timeout(3000);
      this.slow(2000);

      let slaves = Master.createSlaves(
        11, path.join(__dirname, 'data', 'simple-slave-b.js'), { group: 'testing close' }
      );

      expect(Master.slaves.leastBusyInGroup('testing close')).to.be.an.instanceof(Slave);
      expect(Master.slaves.leastBusyInList(slaves[0])).to.equal(slaves[0]);
      expect(Master.slaves.leastBusyInList(slaves[0], slaves[1])).to.be.oneOf(slaves);
      expect(Master.slaves.leastBusyInList([slaves[0]], slaves, slaves[1])).to.be.oneOf(slaves);

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(11);

      slaves[0].close(function (err, status) {
        expect(err).to.equal(null);
        expect(status).to.equal(true);
        slaves = Master.slaves.inGroup('testing close');
        expect(slaves).to.be.an.instanceof(SlaveArray);
        expect(slaves.length).to.equal(10);

        Master.close(slaves[0], function (status) { // eslint-disable-line no-shadow
          expect(status).to.equal(true);
          slaves = Master.slaves.inGroup('testing close');
          expect(slaves).to.be.an.instanceof(SlaveArray);
          expect(slaves.length).to.equal(9);

          Master.close(slaves[0], function (status) { // eslint-disable-line no-shadow
            expect(status).to.equal(true);
            slaves = Master.slaves.inGroup('testing close');
            expect(slaves).to.be.an.instanceof(SlaveArray);
            expect(slaves.length).to.equal(8);

            Master.close(slaves[0], slaves[1], function (statuses) {
              expect(statuses).to.be.an.instanceof(Array);
              expect(statuses[0]).to.equal(true);
              expect(statuses[1]).to.equal(true);
              slaves = Master.slaves.inGroup('testing close');
              expect(slaves).to.be.an.instanceof(SlaveArray);
              expect(slaves.length).to.equal(6);

              Master.close.group('testing close', function (statuses) { // eslint-disable-line no-shadow
                expect(statuses).to.be.an.instanceof(Array);
                slaves = Master.slaves.inGroup('testing close');
                expect(slaves).to.be.an.instanceof(SlaveArray);
                expect(slaves.length).to.equal(0);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('Master#shutdown', function () {
    it('Should shutdown the given slave arguments after all messages have been sent (Promises)', function (done) {
      this.timeout(3000);
      this.slow(2000);

      let slaves = Master.createSlaves(
        3, path.join(__dirname, 'data', 'simple-slave-b.js'), { group: 'testing shutdown' }
      );

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(3);

      Master.broadcast(Master.commands.ACK).to(slaves)
        .catch(e => done(e));

      Master.broadcast(Master.commands.ACK).to.all()
        .catch(e => done(e));

      Master.broadcast(Master.commands.ACK).to.group('testing shutdown')
        .catch(e => done(e));

      Master.broadcast(Master.commands.ACK).to(slaves)
        .catch(e => done(e));

      Master.broadcast(Master.commands.ACK).to(slaves)
        .catch(e => done(e));

      Master.shutdown(slaves)
        .then(statuses => {
          expect(statuses).to.eql([true, true, true]);
          slaves = Master.slaves.inGroup('testing shutdown');
          expect(slaves).to.be.an.instanceof(SlaveArray);
          expect(slaves.length).to.equal(0);
          done();
        })
        .catch(e => done(e));

      Master.broadcast(Master.commands.ACK).to(slaves)
        .catch(e => {
          expect(e).to.be.an.instanceof(Error);
        });
    });

    it('Should shutdown the given slave arguments after all messages have been sent (Callbacks)', function (done) {
      this.timeout(3000);
      this.slow(2000);

      let slaves = Master.createSlaves(
        3, path.join(__dirname, 'data', 'simple-slave-b.js'), { group: 'testing shutdown' }
      );

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(3);

      Master.broadcast(Master.commands.ACK).to(slaves, err => {
        expect(err).to.equal(null);
      });

      Master.broadcast(Master.commands.ACK).to(slaves, err => {
        expect(err).to.equal(null);
      });

      Master.broadcast(Master.commands.ACK).to(slaves, err => {
        expect(err).to.equal(null);
      });

      Master.shutdown(slaves, function (err, statuses) {
        expect(err).to.equal(null);
        expect(statuses).to.eql([true, true, true]);
        slaves = Master.slaves.inGroup('testing shutdown');
        expect(slaves).to.be.an.instanceof(SlaveArray);
        expect(slaves.length).to.equal(0);
        done();
      });

      Master.broadcast(Master.commands.ACK).to(slaves, err => {
        expect(err).to.be.an.instanceof(Error);
      });
    });

    it('Should shutdown the given slave arguments after all messages have been sent (Using SlaveArray)', function (done) { // eslint-disable-line max-len
      this.timeout(3000);
      this.slow(2000);

      let slaves = Master.createSlaves(
        3, path.join(__dirname, 'data', 'simple-slave-b.js'), { group: 'testing shutdown' }
      );

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(3);

      slaves.shutdown()
        .then(statuses => {
          expect(statuses).to.eql([true, true, true]);
          slaves = Master.slaves.inGroup('testing shutdown');
          expect(slaves).to.be.an.instanceof(SlaveArray);
          expect(slaves.length).to.equal(0);
          done();
        })
        .catch(e => done(e));

      Master.broadcast(Master.commands.ACK).to(slaves)
        .catch(e => {
          expect(e).to.be.an.instanceof(Error);
        });
    });

    it('Should shutdown the slave immediately if there are no pending requests', function (done) {
      this.timeout(3000);
      this.slow(2000);

      const slaves = Master.createSlaves(
        1, path.join(__dirname, 'data', 'simple-slave-e.js'), { group: 'testing-qwerty' }
      );

      slaves[0].shutdown((err, status) => {
        expect(status).to.equal(true);
        expect(err).to.equal(null);
        expect(slaves[0].isConnected).to.equal(true);
        expect(slaves[0].hasExited).to.equal(true);
        done();
      });
    });
  });

  describe('Master#getSlaveWithPath', function () {
    it('Should get all the active slaves with the given path', function (done) {
      this.timeout(3000);
      this.slow(2000);

      const slaves = Master.createSlaves(
        11, path.join(__dirname, 'data', 'simple-slave-b-2.js'), { group: 'testing getSlaveWithPath' }
      );

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(11);

      let slavesWithPath = Master.getSlavesWithPath(path.join(__dirname, 'data', 'simple-slave-b-2.js'));
      expect(slavesWithPath).to.be.an.instanceof(SlaveArray);
      expect(slavesWithPath.length).to.equal(11);
      slaves.kill();

      slavesWithPath = Master.getSlavesWithPath([]);
      expect(slavesWithPath).to.be.an.instanceof(SlaveArray);
      expect(slavesWithPath.length).to.equal(0);
      slaves.kill();

      slavesWithPath = Master.getSlavesWithPath(() => {});
      expect(slavesWithPath).to.be.an.instanceof(SlaveArray);
      expect(slavesWithPath.length).to.equal(0);
      slaves.kill();

      slavesWithPath = Master.getSlavesWithPath(123);
      expect(slavesWithPath).to.be.an.instanceof(SlaveArray);
      expect(slavesWithPath.length).to.equal(0);
      slaves.kill();
      done();
    });
  });

  describe('Master#slaveBelongsToGroup', function () {
    it('Should determine if a slave belongs to a group correctly', function (done) {
      this.timeout(2000);
      this.slow(1000);

      const slaves = Master.createSlaves(
        3, path.join(__dirname, 'data', 'simple-slave-b.js'), { group: 'testing slaveBelongsToGroup' }
      );

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(3);

      expect(Master.slaveBelongsToGroup(slaves[0], 'testing slaveBelongsToGroup')).to.equal(true);
      expect(Master.slaveBelongsToGroup(slaves[1], 'testing slaveBelongsToGroup')).to.equal(true);
      expect(Master.slaveBelongsToGroup(slaves[2], 'testing slaveBelongsToGroup')).to.equal(true);
      expect(Master.slaveBelongsToGroup(99999, 'testing slaveBelongsToGroup')).to.equal(false);
      expect(Master.slaveBelongsToGroup('non-existent', 'testing slaveBelongsToGroup')).to.equal(false);
      expect(Master.slaveBelongsToGroup(slaves, 'testing slaveBelongsToGroup')).to.equal(false);
      expect(Master.slaveBelongsToGroup({}, 'testing slaveBelongsToGroup')).to.equal(false);
      expect(Master.slaveBelongsToGroup([], 'testing slaveBelongsToGroup')).to.equal(false);
      expect(Master.slaveBelongsToGroup(() => {}, 'testing slaveBelongsToGroup')).to.equal(false);

      expect(Master.slaveBelongsToGroup(slaves[0], 'foo')).to.equal(false);
      expect(Master.slaveBelongsToGroup(slaves[1], '')).to.equal(false);
      expect(Master.slaveBelongsToGroup(slaves[2], 123)).to.equal(false);
      expect(Master.slaveBelongsToGroup(slaves[2], {})).to.equal(false);
      expect(Master.slaveBelongsToGroup(slaves[2], [])).to.equal(false);

      expect(Master.slaveBelongsToGroup(slaves[0], slaves[0].group)).to.equal(true);
      expect(Master.slaveBelongsToGroup(slaves[1], slaves[0].group)).to.equal(true);
      expect(Master.slaveBelongsToGroup(slaves[2], slaves[0].group)).to.equal(true);
      slaves.kill();
      done();
    });
  });

  describe('Master#slaves.notInGroup', function () {
    it('Should get all the slaves not in the given group', function (done) {
      this.timeout(2000);
      this.slow(1000);

      const outGroup = Master.createSlaves(
        3, path.join(__dirname, 'data', 'simple-slave-b.js'), { group: 'testing notInGroup' }
      );

      const inGroup = Master.createSlaves(
        3, path.join(__dirname, 'data', 'simple-slave-b.js'), { group: 'testing inGroup ' }
      );

      const outGroupRes = Master.slaves.notInGroup('testing notInGroup');
      expect(outGroupRes).to.be.an.instanceof(SlaveArray);
      expect(outGroupRes.indexOf(inGroup[0])).to.be.gte(0);
      expect(outGroupRes.indexOf(inGroup[1])).to.be.gte(0);
      expect(outGroupRes.indexOf(inGroup[2])).to.be.gte(0);
      expect(outGroupRes.indexOf(outGroup[0])).to.equal(-1);
      expect(outGroupRes.indexOf(outGroup[1])).to.equal(-1);
      expect(outGroupRes.indexOf(outGroup[2])).to.equal(-1);
      done();
    });
  });

  describe('Master#slave', function () {
    it('Should work as an alias for Slave#getSlave', function (done) {
      this.timeout(2000);
      this.slow(1000);

      const slaves = Master.createSlaves(
        3, path.join(__dirname, 'data', 'simple-slave-b.js'), { group: 'master#slave' }
      );

      expect(Master.slave(slaves[0].id)).to.equal(slaves[0]);
      expect(Master.slave(slaves[1].id)).to.equal(slaves[1]);
      expect(Master.slave(slaves[2].id)).to.equal(slaves[2]);
      expect(Master.slave(slaves[0].alias)).to.equal(slaves[0]);
      expect(Master.slave(slaves[1].alias)).to.equal(slaves[1]);
      expect(Master.slave(slaves[2].alias)).to.equal(slaves[2]);
      done();
    });

    it('Should throw ResponseErrors if meta.catchAll is true (Promises)', function (done) {
      this.timeout(2000);
      this.slow(1000);

      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));

      slave.exec('foobar', null, { catchAll: true })
        .then(() => done(new Error('Expected to throw')))
        .catch(e => {
          expect(e).to.be.an.instanceof(ResponseError);
          expect(e.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

          Master.tell(slave).to('foobar', null, { catchAll: true })
            .then(() => done(new Error('Expected to throw')))
            .catch(er => {
              expect(er).to.be.an.instanceof(ResponseError);
              expect(er.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

              Master.broadcast('foobar', null, { catchAll: true }).to(slave)
                .then(() => done(new Error('Expected to throw')))
                .catch(err => {
                  expect(err).to.be.an.instanceof(ResponseError);
                  expect(err.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);
                  slave.exit();
                  done();
                });
            });
        });
    });

    it('Should throw ResponseErrors if meta.catchAll is true (Callbacks)', function (done) {
      this.timeout(2000);
      this.slow(1000);

      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));

      slave.exec('foobar', null, { catchAll: true }, (e, res) => {
        expect(res).to.equal(null);
        expect(e).to.be.an.instanceof(ResponseError);
        expect(e.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

        Master.tell(slave).to('foobar', null, { catchAll: true }, (er, res2) => {
          expect(res2).to.equal(null);
          expect(er).to.be.an.instanceof(ResponseError);
          expect(er.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

          Master.broadcast('foobar', null, { catchAll: true }).to(slave, (err, res3) => {
            expect(res3).to.equal(null);
            expect(err).to.be.an.instanceof(ResponseError);
            expect(err.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);
            slave.exit();
            done();
          });
        });
      });
    });

    it('Should throw ResponseErrors if meta.catchAll is true (Multiple slaves, Promises)', function (done) {
      this.timeout(2000);
      this.slow(1000);

      const slaves = Master.createSlaves(2, path.join(__dirname, 'data', 'simple-slave-b.js'));

      slaves.exec('foobar', null, { catchAll: true })
        .then(() => done(new Error('Expected to throw')))
        .catch(e => {
          expect(e).to.be.an.instanceof(ResponseError);
          expect(e.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

          Master.tell(slaves).to('foobar', null, { catchAll: true })
            .then(() => done(new Error('Expected to throw')))
            .catch(er => {
              expect(er).to.be.an.instanceof(ResponseError);
              expect(er.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

              Master.broadcast('foobar', null, { catchAll: true }).to(...slaves)
                .then(() => done(new Error('Expected to throw')))
                .catch(err => {
                  expect(err).to.be.an.instanceof(ResponseError);
                  expect(err.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);
                  slaves.exit();
                  done();
                });
            });
        });
    });

    it('Should throw ResponseErrors if meta.catchAll is true (Multiple slaves, Callbacks)', function (done) {
      this.timeout(2000);
      this.slow(1000);

      const slaves = Master.createSlaves(4, path.join(__dirname, 'data', 'simple-slave-b.js'));

      slaves.exec('foobar', null, { catchAll: true }, (e, res) => {
        expect(res).to.equal(null);
        expect(e).to.be.an.instanceof(ResponseError);
        expect(e.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

        Master.tell(slaves).to('foobar', null, { catchAll: true }, (er, res2) => {
          expect(res2).to.equal(null);
          expect(er).to.be.an.instanceof(ResponseError);
          expect(er.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

          Master.broadcast('foobar', null, { catchAll: true }).to(slaves, (err, res3) => {
            expect(res3).to.equal(null);
            expect(err).to.be.an.instanceof(ResponseError);
            expect(err.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);
            slaves.exit();
            done();
          });
        });
      });
    });

    it('Should throw ResponseErrors if meta.catchAll is true (on the slave instance)', function (done) {
      this.timeout(2000);
      this.slow(1000);

      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      slave.shouldCatchAll = true;
      slave.exec('foobar', null)
        .then(() => done(new Error('Expected to throw')))
        .catch(e => {
          expect(e).to.be.an.instanceof(ResponseError);
          expect(e.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

          Master.tell(slave).to('foobar', null, { catchAll: true })
            .then(() => done(new Error('Expected to throw')))
            .catch(er => {
              expect(er).to.be.an.instanceof(ResponseError);
              expect(er.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

              Master.broadcast('foobar', null, { catchAll: true }).to(slave)
                .then(() => done(new Error('Expected to throw')))
                .catch(err => {
                  expect(err).to.be.an.instanceof(ResponseError);
                  expect(err.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);
                  slave.exit();
                  done();
                });
            });
        });
    });

    it('Should throw ResponseErrors if meta.catchAll is true (statically, on the Slave class)', function (done) {
      this.timeout(2000);
      this.slow(1000);

      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      Slave.shouldCatchAll = true;
      Slave.shouldCatchAll = 'string';
      Slave.shouldCatchAll = [];
      Slave.shouldCatchAll = () => {};
      expect(Slave.shouldCatchAll).to.equal(true);
      slave.exec('foobar', null)
        .then(() => done(new Error('Expected to throw')))
        .catch(e => {
          expect(e).to.be.an.instanceof(ResponseError);
          expect(e.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

          Master.tell(slave).to('foobar', null, { catchAll: true })
            .then(() => done(new Error('Expected to throw')))
            .catch(er => {
              expect(er).to.be.an.instanceof(ResponseError);
              expect(er.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

              Master.broadcast('foobar', null, { catchAll: true }).to(slave)
                .then(() => done(new Error('Expected to throw')))
                .catch(err => {
                  expect(err).to.be.an.instanceof(ResponseError);
                  expect(err.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);
                  slave.exit();
                  done();
                });
            });
        });

      slave.shouldCatchAll = undefined;
      expect(slave.shouldCatchAll).to.equal(null);
      Slave.shouldCatchAll = null;
      expect(Slave.shouldCatchAll).to.equal(null);
    });

    it('Should throw ResponseErrors if meta.catchAll is true (using the Master class)', function (done) {
      this.timeout(2000);
      this.slow(1000);

      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      Master.shouldCatchAll = true;
      Master.shouldCatchAll = 'string';
      Master.shouldCatchAll = [];
      Master.shouldCatchAll = () => {};
      expect(Master.shouldCatchAll).to.equal(true);
      slave.exec('foobar', null)
        .then(() => done(new Error('Expected to throw')))
        .catch(e => {
          expect(e).to.be.an.instanceof(ResponseError);
          expect(e.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

          Master.tell(slave).to('foobar', null, { catchAll: true })
            .then(() => done(new Error('Expected to throw')))
            .catch(er => {
              expect(er).to.be.an.instanceof(ResponseError);
              expect(er.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);

              Master.broadcast('foobar', null, { catchAll: true }).to(slave)
                .then(() => done(new Error('Expected to throw')))
                .catch(err => {
                  expect(err).to.be.an.instanceof(ResponseError);
                  expect(err.message).to.match(/^Slave #\d+ does not listen to task "foobar"$/);
                  slave.exit();
                  done();
                });
            });
        });

      slave.shouldCatchAll = undefined;
      expect(slave.shouldCatchAll).to.equal(null);
      Master.shouldCatchAll = null;
      expect(Slave.shouldCatchAll).to.equal(null);
    });

    it('Should not throw ResponseErrors if meta.catchAll is false (Instance overriding static, class)', function (done) { // eslint-disable-line max-len
      this.timeout(2000);
      this.slow(1000);

      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      Slave.shouldCatchAll = true;
      slave.shouldCatchAll = false;
      slave.shouldCatchAll = 'string';
      slave.shouldCatchAll = [];
      slave.shouldCatchAll = () => {};
      expect(slave.shouldCatchAll).to.equal(false);
      slave.exec('foobar', null)
        .then(() => {
          done();
          slave.kill();
        })
        .catch(e => done(e));
      Slave.shouldCatchAll = null;
    });

    it('Should not throw ResponseErrors if meta.catchAll is false (Meta overriding instance)', function (done) {
      this.timeout(2000);
      this.slow(1000);

      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      slave.shouldCatchAll = true;
      slave.exec('foobar', null, { catchAll: false })
        .then(() => {
          done();
          slave.kill();
        })
        .catch(e => done(e));
    });
  });

  describe('Master#kill', function () {
    it('Should handle non-slave arguments', function () {
      expect(Master.kill.bind(Master, {}, [], () => {}, 'string', 123)).to.not.throw(Error);
    });

    it('Should kill the given slave arguments', function (done) {
      this.slow(1000);

      let slaves = Master.createSlaves(
        10, path.join(__dirname, 'data', 'simple-slave-b.js'), { group: 'testing kill' }
      );

      expect(slaves.length).to.equal(10);
      expect(slaves).to.be.an.instanceof(SlaveArray);

      slaves[0].kill();
      slaves = Master.slaves.inGroup('testing kill');

      expect(slaves.length).to.equal(9);
      expect(slaves).to.be.an.instanceof(SlaveArray);

      Master.kill(slaves[0], slaves[1]);
      slaves = Master.slaves.inGroup('testing kill');

      expect(slaves.length).to.equal(7);
      expect(slaves).to.be.an.instanceof(SlaveArray);

      Master.kill.group('testing kill');
      slaves = Master.slaves.inGroup('testing kill');

      expect(slaves.length).to.equal(0);
      expect(slaves).to.be.an.instanceof(SlaveArray);

      // Null check...
      Master.kill.group('testing kill');
      slaves = Master.slaves.inGroup('testing kill');

      expect(slaves.length).to.equal(0);
      expect(slaves).to.be.an.instanceof(SlaveArray);
      done();
    });
  });

  describe('Master#create.slave', function () {
    it('Should create (and return) a single slave', function (done) {
      this.slow(1000);

      const s = Master.create.slave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      expect(s).to.be.an.instanceof(Slave);
      expect(s.then).to.be.an.instanceof(Function);
      expect(s.then(slave => {
        expect(slave).to.equal(s);
        s.close((err, status) => {
          expect(status).to.equal(true);
          done();
        });
      })).to.be.an.instanceof(Promise);
    });
  });

  describe('Master#create.slaves', function () {
    it('Should create (and return) multiple slaves', function (done) {
      this.slow(1000);

      const s = Master.create.slaves(10, path.join(__dirname, 'data', 'simple-slave-b.js'));
      expect(s).to.be.an.instanceof(SlaveArray);
      s.each(slave => {
        expect(slave).to.be.an.instanceof(Slave);
      });
      expect(s.then).to.be.an.instanceof(Function);
      expect(s.then(slaves => {
        expect(slaves).to.equal(s);
        slaves.close(statuses => {
          expect(statuses).to.eql([true, true, true, true, true, true, true, true, true, true]);
          done();
        });
      })).to.be.an.instanceof(Promise);
    });
  });

  describe('Master#tell', function () {
    it('Should work exactly like Master#broadcast', function (done) {
      this.slow(1000);
      const s = Master.create.slave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      expect(s).to.be.an.instanceof(Slave);

      expect(Master.tell).to.be.a('function');
      const to = Master.tell(s);
      expect(to).to.be.an('object');

      const p = to.to('echo', 'data');
      p.then(res => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.value).to.equal('data');
        expect(res.error).to.equal(null);
        s.close((err, status) => {
          expect(status).to.equal(true);
          done();
        });
      })
      .catch(e => done(e));

      expect(p).to.be.an.instanceof(Promise);
    });

    it('Should return a response error if the slave isn\'t subscribed to the provided task', function (done) {
      this.slow(1000);
      const s = Master.create.slave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      expect(s).to.be.an.instanceof(Slave);

      Master.tell(s).to(1123)
        .then(res => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal(undefined);
          expect(res.error).to.be.an.instanceof(ResponseError);
          expect(res.error.message).to.match(/^Slave #\d+ does not listen to task "1123"$/);
          s.close((err, status) => {
            expect(status).to.equal(true);
            done();
          });
        })
        .catch(e => done(e));
    });

    it('Should broadcast to multiple slaves (passing SlaveArray)', function (done) {
      this.slow(500);
      const s = Master.create.slaves(5, path.join(__dirname, 'data', 'simple-slave-b.js'));
      expect(s).to.be.an.instanceof(SlaveArray);

      expect(Master.tell).to.be.a('function');
      const to = Master.tell(s);
      expect(to).to.be.an('object');

      const p = to.to('echo', 'data');
      p.then(res => {
        expect(res).to.be.an.instanceof(ResponseArray);
        expect(res.length).to.equal(5);
        expect(res.values).to.eql(['data', 'data', 'data', 'data', 'data']);
        expect(res.errors).to.eql([null, null, null, null, null]);
        s.close(statuses => {
          expect(statuses).to.eql([true, true, true, true, true]);
          done();
        });
      })
      .catch(e => done(e));
      expect(p).to.be.an.instanceof(Promise);
    });

    it('Should broadcast to multiple slaves (spreading Slave Array)', function (done) {
      this.slow(500);
      const s = Master.create.slaves(5, path.join(__dirname, 'data', 'simple-slave-b.js'));
      expect(s).to.be.an.instanceof(SlaveArray);

      expect(Master.tell).to.be.a('function');
      const to = Master.tell(...s);
      expect(to).to.be.an('object');

      const p = to.to('echo', 'data');
      p.then(res => {
        expect(res).to.be.an.instanceof(ResponseArray);
        expect(res.length).to.equal(5);
        expect(res.values).to.eql(['data', 'data', 'data', 'data', 'data']);
        expect(res.errors).to.eql([null, null, null, null, null]);
        s.close(statuses => {
          expect(statuses).to.eql([true, true, true, true, true]);
          done();
        });
      })
      .catch(e => done(e));
      expect(p).to.be.an.instanceof(Promise);
    });

    it('Should resolve an empty ResponseArray when no slaves are passed', function (done) {
      this.slow(500);

      expect(Master.tell).to.be.a('function');
      const to = Master.tell();
      expect(to).to.be.an('object');

      const p = to.to('echo', 'data');
      p.then(res => {
        expect(res).to.be.an.instanceof(ResponseArray);
        expect(res.length).to.equal(0);
        expect(res.values).to.eql([]);
        expect(res.errors).to.eql([]);
        done();
      })
      .catch(e => done(e));
      expect(p).to.be.an.instanceof(Promise);
    });

    it('Should broadcast to all slaves', function (done) {
      this.slow(500);
      const s = Master.createSlaves(2, path.join(__dirname, 'data', 'simple-slave-b.js'));

      expect(Master.tell).to.be.a('function');
      const to = Master.tell(Master.slaves.all);
      expect(to).to.be.an('object');

      const p = to.to(Master.commands.ACK);
      p.then(res => {
        expect(res).to.be.an.instanceof(ResponseArray);
        expect(res.length).to.be.gte(2);
        res.each(r => {
          expect(r.value.message).to.match(
            /Slave acknowledgement from=\d+, received=\d+, responded=\d+, started=\d+, uptime=\d+/
          );
        });
        s.close().then(() => { done(); });
      })
      .catch(e => done(e));
      expect(p).to.be.an.instanceof(Promise);
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
      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'), { alias: 'slavey-2' });
      let completed = 0;

      Master.tellSlave(slave.id).to('echo', 'okay')
        .then(res => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal('okay');
          if (++completed === 3) {
            Master.close('slavey-2', status => {
              expect(status).to.equal(true);
              done();
            });
          }
        })
        .catch(e => {
          done(e);
        });

      Master.tellSlave('slavey').to('echo', 'okay 2')
        .then(res => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal('okay 2');
          if (++completed === 3) {
            Master.close('slavey', status => {
              expect(status).to.equal(true);
              done();
            });
          }
        })
        .catch(e => {
          done(e);
        });

      Master.tellSlave(slave).to('echo', 'okay')
        .then(res => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal('okay 3');
          if (++completed === 3) {
            Master.close('slavey', status => {
              expect(status).to.equal(true);
              done();
            });
          }
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

      const c = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-g.js'));
      c.onUncaughtException = (e) => {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('uncaught exception');
      };

      // Does nothing, but shouldn't cause any side effects.
      const d = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-g.js'));
      d.onUncaughtException = {};

      const b = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-h.js'), {
        onUncaughtException: (er) => {
          expect(er).to.be.an.instanceof(Error);
          expect(er.message).to.equal('Unknown error');
          Master.kill(b);
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
    it('Should increment alias names', function (done) {
      const slaves =
        Master.createSlaves(3, path.join(__dirname, 'data', 'simple-slave-c.js'), { alias: 'alias-test' });

      expect(slaves[0].alias).to.equal('alias-test');
      expect(slaves[1].alias).to.equal('alias-test-1');
      expect(slaves[2].alias).to.equal('alias-test-2');
      slaves.kill();
      done();
    });

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

    it('Should broadcast messages to all idle slaves using Master#broadcast.to.idle', function (done) {
      const s = Master.createSlaves(2, path.join(__dirname, 'data', 'simple-slave-b.js'));

      Master.broadcast(Master.commands.ACK, null, { foo: 'bar' }).to.idle()
        .then(res => {
          expect(res).to.be.an.instanceof(ResponseArray);
          expect(res.length).to.be.gte(2);
          res.each(r => {
            expect(r.value.meta).to.eql({ foo: 'bar' });
            expect(r.value.data).to.eql(null);
            expect(r.value.message).to.match(
              /Slave acknowledgement from=\d+, received=\d+, responded=\d+, started=\d+, uptime=\d+/
            );
          });
          s.close().then(() => { done(); });
        })
        .catch(e => done(e));
    });

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

    it('Should broadcast messages to the given slave group', function (done) {
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
