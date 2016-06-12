/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names, no-shadow, require-jsdoc */
'use strict';

const master = require('../').Master;
const Slave = require('../lib/Slave');
const path = require('path');
const expect = require('chai').expect;
const tell = master.tell;

const ResponseArray = require('../lib/ResponseArray');
const Response = require('../lib/Response');

function checkSimpleResponseHello(res) {
  expect(res).to.be.an.instanceof(ResponseArray);
  expect(res.length).to.equal(3);
  expect(res.values).to.eql(['hello', 'hello', 'hello']);
  expect(res.errors).to.eql([null, null, null]);
}

function checkSimpleResponseGoodbye(res) {
  expect(res).to.be.an.instanceof(ResponseArray);
  expect(res.length).to.equal(3);
  expect(res.values).to.eql(['goodbye', 'goodbye', 'goodbye']);
  expect(res.errors).to.eql([null, null, null]);
}

function checkSimpleResponseHelloSingle(res) {
  expect(res).to.be.an.instanceof(Response);
  expect(res.value).to.eql('hello');
  expect(res.error).to.eql(null);
}

function checkSimpleResponseGoodbyeSingle(res) {
  expect(res).to.be.an.instanceof(Response);
  expect(res.value).to.eql('goodbye');
  expect(res.error).to.eql(null);
}

describe('Hello World', function () {
  this.timeout(2000);
  this.slow(500);

  describe('Basic Usage', function () {
    it('Should send messages to the slave and return the data (Promises)', (done) => {
      const slaves = master.createSlaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-a' });

      tell(slaves).to('say hello')
        .then(res => checkSimpleResponseHello(res))
        .then(() => tell(slaves[0], slaves[1], slaves[2]).to('say hello'))
        .then(res => checkSimpleResponseHello(res))
        .then(() => tell(...slaves).to('say hello'))
        .then(res => checkSimpleResponseHello(res))
        .then(() => tell(slaves[0].id, slaves[1].id, slaves[2].id).to('say hello'))
        .then(res => checkSimpleResponseHello(res))
        .then(() => tell('hw-a').to('say hello'))
        .then(res => checkSimpleResponseHello(res))
        .then(() => tell(slaves).to('say goodbye'))
        .then(res => checkSimpleResponseGoodbye(res))
        .then(() => tell(slaves[0], slaves[1], slaves[2]).to('say goodbye'))
        .then(res => checkSimpleResponseGoodbye(res))
        .then(() => tell(...slaves).to('say goodbye'))
        .then(res => checkSimpleResponseGoodbye(res))
        .then(() => tell(slaves[0].id, slaves[1].id, slaves[2].id).to('say goodbye'))
        .then(res => checkSimpleResponseGoodbye(res))
        .then(() => tell('hw-a').to('say goodbye'))
        .then(res => checkSimpleResponseGoodbye(res))
        .then(() => slaves.exec('say hello'))
        .then(res => checkSimpleResponseHello(res))
        .then(() => slaves.exec('say goodbye'))
        .then(res => checkSimpleResponseGoodbye(res))
        .then(() => slaves.close())
        .then(statuses => {
          expect(statuses).to.eql([true, true, true]);
        })
        .then(() => done())
        .catch(e => done(e));
    });

    it('Should send messages to the slave and return the data (Callbacks)', function (done) {
      this.timeout(8000);
      const slaves = master.createSlaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-b' });

      tell(slaves).to('say hello', function (err, res) {
        expect(err).to.equal(null);
        checkSimpleResponseHello(res);
        tell(slaves[0], slaves[1], slaves[2]).to('say hello', function (err, res) {
          expect(err).to.equal(null);
          checkSimpleResponseHello(res);
          tell(slaves[0].id, slaves[1].id, slaves[2].id).to('say hello', function (err, res) {
            expect(err).to.equal(null);
            checkSimpleResponseHello(res);
            tell('hw-b').to('say hello', function (err, res) {
              expect(err).to.equal(null);
              checkSimpleResponseHello(res);
              tell(slaves).to('say goodbye', function (err, res) {
                expect(err).to.equal(null);
                checkSimpleResponseGoodbye(res);
                tell(slaves[0], slaves[1], slaves[2]).to('say goodbye', function (err, res) {
                  expect(err).to.equal(null);
                  checkSimpleResponseGoodbye(res);
                  tell(...slaves).to('say goodbye', function (err, res) {
                    expect(err).to.equal(null);
                    checkSimpleResponseGoodbye(res);
                    tell(slaves[0].id, slaves[1].id, slaves[2].id).to('say goodbye', function (err, res) {
                      expect(err).to.equal(null);
                      checkSimpleResponseGoodbye(res);
                      tell('hw-b').to('say goodbye', function (err, res) {
                        expect(err).to.equal(null);
                        checkSimpleResponseGoodbye(res);
                        slaves.exec('say hello', function (err, res) {
                          expect(err).to.equal(null);
                          checkSimpleResponseHello(res);
                          slaves.exec('say goodbye', function (err, res) {
                            expect(err).to.equal(null);
                            checkSimpleResponseGoodbye(res);
                            slaves.close(function (statuses) {
                              expect(err).to.equal(null);
                              expect(statuses).to.eql([true, true, true]);
                              done();
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('Workpool', function () {
    it('Should only send messages to one slave at a time and round-robin requests (Promises)', (done) => {
      let slaves;
      let workpool;
      let slave1;
      let slave2;
      let slave3;

      master.create.slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-c' })
        .then(instances => { slaves = instances; })
        .then(() => master.create.workpool(slaves))
        .then(wp => { workpool = wp; })
        .then(() => workpool.do('say hello'))
        .then(res => {
          expect(res.slave).to.be.an.instanceof(Slave);
          checkSimpleResponseHelloSingle(res);
          slave1 = res.slave;
        })
        .then(() => workpool.do('say hello'))
        .then(res => {
          expect(res.slave).to.be.an.instanceof(Slave);
          checkSimpleResponseHelloSingle(res);
          slave2 = res.slave;
          expect(slave1).to.not.equal(slave2);
        })
        .then(() => workpool.do('say hello'))
        .then(res => {
          expect(res.slave).to.be.an.instanceof(Slave);
          checkSimpleResponseHelloSingle(res);
          slave3 = res.slave;
          expect(slave3).to.not.equal(slave2);
          expect(slave3).to.not.equal(slave1);
        })
        .then(() => workpool.do('say hello'))
        .then(res => {
          expect(res.slave).to.be.an.instanceof(Slave);
          checkSimpleResponseHelloSingle(res);
          expect(res.slave).to.equal(slave1);
        })
        .then(() => workpool.do('say goodbye'))
        .then(res => {
          expect(res.slave).to.be.an.instanceof(Slave);
          checkSimpleResponseGoodbyeSingle(res);
          expect(res.slave).to.equal(slave2);
        })
        .then(() => workpool.do('say goodbye'))
        .then(res => {
          expect(res.slave).to.be.an.instanceof(Slave);
          checkSimpleResponseGoodbyeSingle(res);
          expect(res.slave).to.equal(slave3);
        })
        .then(() => slaves.exit())
        .then(() => done())
        .catch(e => done(e));
    });

    it('Should only send messages to one slave at a time and round-robin requests (Callbacks)', (done) => {
      master.create.slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-d' }, function (slaves) { // eslint-disable-line max-len
        const workpool = master.create.workpool(slaves);

        let slave1;
        let slave2;
        let slave3;

        workpool.do('say hello', function (err, res) {
          expect(err).to.equal(null);
          checkSimpleResponseHelloSingle(res);
          slave1 = res.slave;

          workpool.do('say hello', function (err, res) {
            expect(err).to.equal(null);
            checkSimpleResponseHelloSingle(res);
            slave2 = res.slave;

            workpool.do('say hello', function (err, res) {
              expect(err).to.equal(null);
              checkSimpleResponseHelloSingle(res);
              slave3 = res.slave;

              expect(slave1).not.to.equal(slave2);
              expect(slave1).not.to.equal(slave3);
              expect(slave2).not.to.equal(slave3);
              slaves.exit();
              done();
            });
          });
        });
      });
    });

    it('Master#workpool should throw if given no slaves', (done) => {
      try {
        master.create.workpool().do('say hello');
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('No slaves given to start workpool with!');
        done();
      }
    });

    it('Master#workpool should throw if the while predicate is not a function', (done) => {
      let slave;
      try {
        slave = master.create.slave(path.join(__dirname, 'data', 'slave-hello-world.js'));
        master.create.workpool(slave).while('string');
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal(
          'Workpool#while expected argument #0 (predicate) to be a function, but got string.'
        );
        slave.exit();
        done();
      }
    });

    it('Master#workpool.while (Callbacks)', (done) => {
      master.create.slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-e' }, function (slaves) { // eslint-disable-line max-len
        const workpool = master.create.workpool(slaves);

        workpool
          .while((i) => i < 3)
          .do('say hello', function (err, res) {
            expect(err).to.equal(null);
            checkSimpleResponseHello(res);
            slaves.kill();
            done();
          });
      });
    });

    it('Master#workpool.while #2 (Callbacks)', (done) => {
      master.create.slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-e' }, function (slaves) { // eslint-disable-line max-len
        const workpool = master.create.workpool(slaves);

        workpool
          .while((i) => i < 3)
          .do('say hello', () => {}, () => {}, function (err, res) {
            expect(err).to.equal(null);
            checkSimpleResponseHello(res);
            slaves.kill();
            done();
          });
      });
    });

    it('Master#workpool.while #3 (Callbacks)', (done) => {
      master.create.slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-e' }, function (slaves) { // eslint-disable-line max-len
        const workpool = master.create.workpool(slaves);

        workpool
          .do('say hello', () => {}, () => {}, function (err, res) {
            expect(err).to.equal(null);
            checkSimpleResponseHelloSingle(res);
            slaves.kill();
            done();
          });
      });
    });

    it('Master#workpool.while #4 (Callbacks, Single Slave)', (done) => {
      master.create.slaves(1, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-e' }, function (slaves) { // eslint-disable-line max-len
        const workpool = master.create.workpool(slaves);

        workpool
          .while((i) => i < 3)
          .do('say hello', () => {}, () => {}, function (err, res) {
            expect(err).to.equal(null);
            checkSimpleResponseHello(res);
            slaves.kill();
            done();
          });
      });
    });

    it('Master#workpool.while (Promises)', (done) => {
      master.create.slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-y' }, function (slaves) { // eslint-disable-line max-len
        const workpool = master.create.workpool(slaves);

        workpool
          .while((i) => i < 3)
          .do('say hello')
          .then(res => {
            checkSimpleResponseHello(res);
            slaves.kill();
            done();
          })
          .catch(e => done(e));
      });
    });

    it('Master#workpool.while (Promises, Single Slave, Async)', (done) => {
      this.timeout(5000);

      master.create.slaves(1, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-z' }, function (slaves) { // eslint-disable-line max-len
        const workpool = master.create.workpool(slaves);
        let completed = 0;

        workpool
          .while((i) => i < 3)
          .do('say hello')
          .then(res => {
            checkSimpleResponseHello(res);
            if (++completed === 2) {
              done();
              slaves.kill();
            }
          })
          .catch(e => done(e));

        workpool
          .while((i) => i < 3)
          .do('say hello')
          .then(res => {
            checkSimpleResponseHello(res);
            if (++completed === 2) {
              done();
              slaves.kill();
            }
          })
          .catch(e => done(e));
      });
    });

    it('Master#workpool.do (Promises, Single Slave, Async)', (done) => {
      this.timeout(5000);

      master.create.slaves(1, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-z' }, function (slaves) { // eslint-disable-line max-len
        const workpool = master.create.workpool(slaves);
        let completed = 0;

        workpool
          .do('say hello')
          .then(res => {
            checkSimpleResponseHelloSingle(res);
            if (++completed === 2) {
              done();
              slaves.kill();
            }
          })
          .catch(e => done(e));

        workpool
          .do('say hello')
          .then(res => {
            checkSimpleResponseHelloSingle(res);
            if (++completed === 2) {
              done();
              slaves.kill();
            }
          })
          .catch(e => done(e));
      });
    });
  });

  describe('Parallel', function () {
    it('Master#createParallel.removeTask should remove a task', function (done) {
      const a = path.join(__dirname, 'data', 'slave-pipeline-a.js');
      const b = path.join(__dirname, 'data', 'slave-pipeline-b.js');
      const slaveA = master.createSlave(a);
      const slaveB = master.createSlave(b);
      const parallel = master.create.parallel();

      const addedTask = parallel.addTask('auth').for(slaveA);
      expect(parallel.taskCount()).to.equal(1);
      const addedTask2 = parallel.addTask('auth').for(slaveA);
      expect(parallel.taskCount()).to.equal(2);
      const addedTask3 = parallel.addTask('auth').for(slaveB);
      expect(parallel.taskCount()).to.equal(3);
      expect(parallel.removeTask(Symbol()).removed).to.equal(false);
      expect(parallel.taskCount()).to.equal(3);
      expect(parallel.removeTask('string').removed).to.equal(false);
      expect(parallel.taskCount()).to.equal(3);
      expect(parallel.removeTask([]).removed).to.equal(false);
      expect(parallel.taskCount()).to.equal(3);
      expect(parallel.removeTask(123).removed).to.equal(false);
      expect(parallel.taskCount()).to.equal(3);
      expect(parallel.removeTask(addedTask).removed).to.equal(true);
      expect(parallel.taskCount()).to.equal(2);
      expect(parallel.removeTask(addedTask2.id).removed).to.equal(true);
      expect(parallel.taskCount()).to.equal(1);
      expect(parallel.removeTask(addedTask3).removed).to.equal(true);
      expect(parallel.taskCount()).to.equal(0);
      done();
    });

    it('Should execute a bunch of tasks "simultaneously" (Promises)', (done) => {
      let slaves;
      master.create.slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-h' })
        .then(instances => { slaves = instances; })
        .then(() => master.create.parallel())
        .then(parallel => parallel
            .addTask('say hello')
            .for(slaves[0])
            .addTask('say hello')
            .for(slaves[1])
            .addTask('say hello')
            .for(slaves[2])
            .execute()
        )
        .then(res => checkSimpleResponseHello(res))
        .then(() => slaves.kill())
        .then(() => done())
        .catch(e => done(e));
    });

    it('Should execute a bunch of tasks "simultaneously" (Callbacks)', (done) => {
      master.create
        .slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-i' }, function (slaves) {
          const parallel = master.create.parallel();

          parallel.addTask('say hello').for(slaves[0]);
          parallel.addTask('say hello').for(slaves[1]);
          parallel.addTask('say hello').for(slaves[2]);
          parallel.execute(function (err, res) {
            expect(err).to.equal(null);
            checkSimpleResponseHello(res);
            slaves.kill();
            done();
          });
        });
    });

    it('Should execute a bunch of tasks "simultaneously" (With numeric task)', (done) => {
      master.create
        .slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-i' }, function (slaves) {
          const parallel = master.create.parallel();

          parallel.addTask(1).for(slaves[0]);
          parallel.addTask(1).for(slaves[1]);
          parallel.addTask(1).for(slaves[2]);
          parallel.execute(null, { catchAll: true }, function (err, res) {
            expect(err).to.equal(null);
            expect(res).to.be.an.instanceof(ResponseArray);
            expect(res[0].value).to.equal(1);
            expect(res[1].value).to.equal(1);
            expect(res[2].value).to.equal(1);
            expect(res.length).to.equal(3);
            slaves.kill();
            done();
          });
        });
    });

    it('Should should throw if ".for" wasn\'t called on a task', (done) => {
      master.create
        .slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-j' }, function (slaves) {
          const parallel = master.create.parallel();

          parallel.addTask('say hello').for(slaves[0]);
          parallel.addTask('say hello');
          parallel.addTask('say hello').for(slaves[2]);
          parallel.execute(function (err, res) {
            expect(err).to.be.an.instanceof(Error);
            expect(err.message).to.equal('Task #1 is missing a slave. Did you forget to call ".for"?');
            expect(res).to.equal(null);
            slaves.kill();
            done();
          });
        });
    });

    it('Should should resolve an empty ReponseArray if no tasks have been added (Promises)', (done) => {
      let slaves;
      master.create.slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-k' })
        .then(instances => { slaves = instances; })
        .then(() => master.create.parallel())
        .then(parallel => parallel.execute())
        .then(res => {
          expect(res).to.be.an.instanceof(ResponseArray);
          expect(res.length).to.equal(0);
        })
        .then(() => slaves.kill())
        .then(() => done())
        .catch(e => done(e));
    });

    it('Should should resolve an empty ReponseArray if no tasks have been added (Callbacks)', (done) => {
      master.create
        .slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-l' }, function (slaves) {
          const parallel = master.create.parallel();

          parallel.execute(function (err, res) {
            expect(err).to.equal(null);
            expect(res).to.be.an.instanceof(ResponseArray);
            expect(res.length).to.equal(0);
            slaves.kill();
            done();
          });
        });
    });

    it('Should iterate multiple times when using ".times" (Promises)', (done) => {
      let slaves;
      master.create.slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-h' })
        .then(instances => { slaves = instances; })
        .then(() => master.create.parallel())
        .then(parallel => parallel
            .addTask('say hello')
            .for(slaves[0])
            .addTask('say hello')
            .for(slaves[1])
            .addTask('say hello')
            .for(slaves[2])
            .times(7)
            .execute()
        )
        .then(res => {
          expect(res).to.be.an.instanceof(Array);
          expect(res.length).to.equal(7);
          res.forEach(r => {
            checkSimpleResponseHello(r);
          });
        })
        .then(() => slaves.kill())
        .then(() => done())
        .catch(e => done(e));
    });

    it('Should iterate multiple times when using ".times" (Callbacks)', (done) => {
      master.create
        .slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-i' }, function (slaves) {
          const parallel = master.create.parallel();

          parallel.addTask('say hello').for(slaves[0]).times(7);
          parallel.addTask('say hello').for(slaves[1]);
          parallel.addTask('say hello').for(slaves[2]);
          parallel.execute(function (err, res) {
            expect(err).to.equal(null);
            expect(res).to.be.an.instanceof(Array);
            expect(res.length).to.equal(7);
            res.forEach(r => {
              checkSimpleResponseHello(r);
            });
            slaves.kill();
            done();
          });
        });
    });

    it('Should do nothing if a non-number is passed to ".times"', (done) => {
      master.create
        .slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-i' }, function (slaves) {
          const parallel = master.create.parallel();

          parallel.addTask('say hello').for(slaves[0]).times('string');
          parallel.addTask('say hello').for(slaves[1]).times({});
          parallel.addTask('say hello').for(slaves[2]).times(() => {});
          parallel.execute(function (err, res) {
            expect(err).to.equal(null);
            checkSimpleResponseHello(res);
            slaves.kill();
            done();
          });
        });
    });

    it('Should throw if a non-Slave argument is passed to ".for"', (done) => {
      let slaves;
      master.create.slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-h' })
        .then(instances => { slaves = instances; })
        .then(() => master.create.parallel())
        .then(parallel => {
          try {
            parallel
              .addTask('say hello')
              .for(-123);

            done(new Error('Expected to throw'));
          } catch (e) {
            expect(e).to.be.an.instanceof(TypeError);
            expect(e.message).to.equal('Master#paralle.addTask.for expected argument #0 to be an instanceof Slave.');
          }

          try {
            parallel
              .addTask('say hello')
              .for('non-existent slave');

            done(new Error('Expected to throw'));
          } catch (e) {
            expect(e).to.be.an.instanceof(TypeError);
            expect(e.message).to.equal('Master#paralle.addTask.for expected argument #0 to be an instanceof Slave.');
          }

          try {
            parallel
              .addTask('say hello')
              .for([]);

            done(new Error('Expected to throw'));
          } catch (e) {
            expect(e).to.be.an.instanceof(TypeError);
            expect(e.message).to.equal('Master#paralle.addTask.for expected argument #0 to be an instanceof Slave.');
          }

          try {
            parallel
              .addTask('say hello')
              .for({});

            done(new Error('Expected to throw'));
          } catch (e) {
            expect(e).to.be.an.instanceof(TypeError);
            expect(e.message).to.equal('Master#paralle.addTask.for expected argument #0 to be an instanceof Slave.');
          }
        })
        .then(() => slaves.kill())
        .then(() => done())
        .catch(e => done(e));
    });

    it('Should throw if the given task is invalid', (done) => {
      let slaves;
      master.create.slaves(3, path.join(__dirname, 'data', 'slave-hello-world.js'), { group: 'hw-h' })
        .then(instances => { slaves = instances; })
        .then(() => master.create.parallel())
        .then(parallel => {
          try {
            parallel
              .addTask([])
              .for(-123);

            done(new Error('Expected to throw'));
          } catch (e) {
            expect(e).to.be.an.instanceof(TypeError);
            expect(e.message).to.equal('Task command must be a string, number, or symbol, but got object.');
          }

          try {
            parallel
              .addTask({})
              .for(-123);

            done(new Error('Expected to throw'));
          } catch (e) {
            expect(e).to.be.an.instanceof(TypeError);
            expect(e.message).to.equal('Task command must be a string, number, or symbol, but got object.');
          }

          try {
            parallel
              .addTask(() => {})
              .for(-123);

            done(new Error('Expected to throw'));
          } catch (e) {
            expect(e).to.be.an.instanceof(TypeError);
            expect(e.message).to.equal('Task command must be a string, number, or symbol, but got function.');
          }

          try {
            parallel
              .addTask()
              .for(-123);

            done(new Error('Expected to throw'));
          } catch (e) {
            expect(e).to.be.an.instanceof(TypeError);
            expect(e.message).to.equal('Task command must be a string, number, or symbol, but got undefined.');
          }

          try {
            parallel
              .addTask(null)
              .for(-123);

            done(new Error('Expected to throw'));
          } catch (e) {
            expect(e).to.be.an.instanceof(TypeError);
            expect(e.message).to.equal('Task command must be a string, number, or symbol, but got object.');
          }
        })
        .then(() => slaves.kill())
        .then(() => done())
        .catch(e => done(e));
    });
  });
});
