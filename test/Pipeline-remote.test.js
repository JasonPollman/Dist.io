/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const master = require('../').Master;
const path = require('path');
const expect = require('chai').expect;
const Response = require('../lib/Response');
const fork = require('child_process').fork;

describe('Pipeline Pattern (Remote)', function () {
  this.timeout(3000);
  this.slow(1000);
  let mpserver;

  const a = {
    host: 'localhost:1245',
    path: path.join(__dirname, 'data', 'slave-pipeline-a.js'),
  };
  const b = {
    host: 'localhost:1245',
    path: path.join(__dirname, 'data', 'slave-pipeline-b.js'),
  };

  before((done) => {
    mpserver = fork(path.join(__dirname, '..', 'bin', 'distio-serve'), ['--port=1245'], { silent: true });
    setTimeout(() => {
      done();
    }, 1000);
  });

  after(done => {
    setTimeout(() => {
      mpserver.kill('SIGINT');
      done();
    }, 1000);
  });

  it('Master#createPipeline.addTask should return an object with a id symbol', function (done) {
    const slaveA = master.createRemoteSlave(a);
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    const addedTask = pipeline.addTask('auth');
    expect(addedTask).to.be.an('object');
    expect(addedTask.id).to.be.a('symbol');

    const addedTaskPostSlaveAssignment = addedTask.for(slaveA);
    expect(addedTaskPostSlaveAssignment.id).to.be.a('symbol');

    const addedTaskPostSlaveAssignmentB = addedTask.for(slaveB);
    expect(addedTaskPostSlaveAssignmentB.id).to.be.a('symbol');

    expect(addedTaskPostSlaveAssignment.id).to.equal(addedTask.id);
    expect(addedTaskPostSlaveAssignmentB.id).to.equal(addedTask.id);
    done();
  });

  it('Master#createPipeline.removeTask should remove a task', function (done) {
    const slaveA = master.createRemoteSlave(a);
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    const addedTask = pipeline.addTask('auth').for(slaveA);
    expect(pipeline.taskCount()).to.equal(1);
    const addedTask2 = pipeline.addTask('auth').for(slaveA);
    expect(pipeline.taskCount()).to.equal(2);
    const addedTask3 = pipeline.addTask('auth').for(slaveB);
    expect(pipeline.taskCount()).to.equal(3);
    expect(pipeline.removeTask(Symbol()).removed).to.equal(false);
    expect(pipeline.taskCount()).to.equal(3);
    expect(pipeline.removeTask('string').removed).to.equal(false);
    expect(pipeline.taskCount()).to.equal(3);
    expect(pipeline.removeTask([]).removed).to.equal(false);
    expect(pipeline.taskCount()).to.equal(3);
    expect(pipeline.removeTask(123).removed).to.equal(false);
    expect(pipeline.taskCount()).to.equal(3);
    expect(pipeline.removeTask(addedTask).removed).to.equal(true);
    expect(pipeline.taskCount()).to.equal(2);
    expect(pipeline.removeTask(addedTask2.id).removed).to.equal(true);
    expect(pipeline.taskCount()).to.equal(1);
    expect(pipeline.removeTask(addedTask3).removed).to.equal(true);
    expect(pipeline.taskCount()).to.equal(0);
    done();
  });

  it('Master#createPipeline.execute should simply resolve with null if the pipeline is empty', function (done) {
    const slaveA = master.createRemoteSlave(a);
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    const addedTask = pipeline.addTask('auth').for(slaveA);
    expect(pipeline.taskCount()).to.equal(1);
    const addedTask2 = pipeline.addTask('auth').for(slaveA);
    expect(pipeline.taskCount()).to.equal(2);
    const addedTask3 = pipeline.addTask('auth').for(slaveB);
    expect(pipeline.taskCount()).to.equal(3);
    expect(pipeline.removeTask(Symbol()).removed).to.equal(false);
    expect(pipeline.taskCount()).to.equal(3);
    expect(pipeline.removeTask('string').removed).to.equal(false);
    expect(pipeline.taskCount()).to.equal(3);
    expect(pipeline.removeTask([]).removed).to.equal(false);
    expect(pipeline.taskCount()).to.equal(3);
    expect(pipeline.removeTask(123).removed).to.equal(false);
    expect(pipeline.taskCount()).to.equal(3);
    expect(pipeline.removeTask(addedTask).removed).to.equal(true);
    expect(pipeline.taskCount()).to.equal(2);
    expect(pipeline.removeTask(addedTask2.id).removed).to.equal(true);
    expect(pipeline.taskCount()).to.equal(1);
    expect(pipeline.removeTask(addedTask3).removed).to.equal(true);
    expect(pipeline.taskCount()).to.equal(0);

    pipeline.execute('token-1', (err, res) => {
      expect(err).to.equal(null);
      expect(res).to.equal(null);

      pipeline.execute()
        .then(() => done())
        .catch(done);
    });
  });

  it('Should pipe reponses from one result to the next (Promises)', function (done) {
    const slaveA = master.createRemoteSlave(a);
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    pipeline
      .addTask('auth')
      .for(slaveA)
      .addTask('get')
      .for(slaveB)
      .execute('token-1')
      .then(res => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.eql({ username: 'williamriker', password: 'mypassword' });
      })
      .then(() => pipeline.execute('token-2'))
      .then(res => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.eql({ username: 'jeanlucpicard', password: 'mypassword' });
        done();
      })
      .catch(e => done(e));
  });

  it('Should pipe reponses from one result to the next (Callbacks)', function (done) {
    const slaveA = master.createRemoteSlave(a);
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    pipeline
      .addTask('auth')
      .for(slaveA)
      .addTask('get')
      .for(slaveB)
      .execute('token-1', { timeout: 10000 }, function (err, res) {
        expect(err).to.equal(null);
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.eql({ username: 'williamriker', password: 'mypassword' });

        pipeline.execute('token-2', function (err, res) { // eslint-disable-line no-shadow
          expect(err).to.equal(null);
          expect(res).to.be.an.instanceof(Response);
          expect(res.error).to.equal(null);
          expect(res.value).to.eql({ username: 'jeanlucpicard', password: 'mypassword' });
          done();
        });
      });
  });

  it('Should reject if a task was added without a slave (Promises)', function (done) {
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    pipeline.addTask('auth');
    pipeline.addTask('get')
      .for(slaveB)
      .execute('token-1')
      .catch(e => {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('Task "auth" is missing a slave. Did you forget to chain ".for"?');
        done();
      });
  });

  it('Should reject if a task was added without a slave (Callbacks)', function (done) {
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    pipeline.addTask('auth');
    pipeline.addTask('get')
      .for(slaveB)
      .execute('token-1', function (e, res) {
        expect(res).to.equal(null);
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('Task "auth" is missing a slave. Did you forget to chain ".for"?');
        done();
      });
  });

  it('Should intercept responses and allow the user to modify them (Callbacks)', function (done) {
    const slaveA = master.createRemoteSlave(a);
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    pipeline
      .addTask('auth')
      .for(slaveA)
      .intercept(res => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.equal(123);
        res.value = 456;
      })
      .addTask('get')
      .for(slaveB)
      .intercept('foo') // Silent fail...
      .execute('token-1', function (e, res) {
        expect(e).to.equal(null);
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.eql({ username: 'jeanlucpicard', password: 'mypassword' });
        done();
      });
  });

  it('Should intercept responses and allow the user to modify them (Promises)', function (done) {
    const slaveA = master.createRemoteSlave(a);
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    pipeline
      .addTask('auth')
      .for(slaveA)
      .intercept(res => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.equal(123);
        res.value = 456;
      })
      .addTask('get')
      .for(slaveB)
      .intercept([]) // Silent fail...
      .execute('token-1')
      .then(res => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.eql({ username: 'jeanlucpicard', password: 'mypassword' });
        done();
      })
      .catch(e => done(e));
  });

  it('Should catch errors in intercepts', function (done) {
    const slaveA = master.createRemoteSlave(a);
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    pipeline
      .addTask('auth')
      .for(slaveA)
      .intercept(res => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.equal(123);
        res.value = 456;
        throw new Error('test throw');
      })
      .addTask('get')
      .for(slaveB)
      .execute('token-1')
      .catch(e => {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('test throw');
        done();
      });
  });

  it('Should break from intercepts when the "exit" callback is invoked', function (done) {
    const slaveA = master.createRemoteSlave(a);
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    pipeline
      .addTask('auth')
      .for(slaveA)
      .intercept((res, exit) => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.equal(123);
        res.value = 987;
        exit();
      })
      .addTask('get')
      .for(slaveB)
      .execute('token-1')
      .then(res => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.eql(987);
        done();
      })
      .catch(e => done(e));
  });

  it('Should break from intercepts when the "exit" callback is invoked, passing a value to exit', function (done) {
    const slaveA = master.createRemoteSlave(a);
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    pipeline
      .addTask('auth')
      .for(slaveA)
      .intercept((res, exit) => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.equal(123);
        res.value = 456;
        exit('string');
      })
      .addTask('get')
      .for(slaveB)
      .execute('token-1')
      .then(res => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.eql('string');
        done();
      })
      .catch(e => done(e));
  });

  it('Should break from intercepts when the "exit" callback is invoked, passing an error to exit', function (done) {
    const slaveA = master.createRemoteSlave(a);
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    pipeline
      .addTask('auth')
      .for(slaveA)
      .intercept((res, exit) => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.equal(123);
        exit(new Error('test'));
      })
      .addTask('get')
      .for(slaveB)
      .execute('token-1')
      .then(res => {
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.be.an.instanceof(Error);
        expect(res.error.message).to.equal('test');
        expect(res.value).to.eql(123);
        done();
      })
      .catch(e => done(e));
  });

  it('Should throw if a non-Slave arugment is passed to ".for"', function (done) {
    const slaveB = master.createRemoteSlave(b);
    const pipeline = master.create.pipeline();

    try {
      pipeline
        .addTask('auth')
        .for('non-existent slave')
        .addTask('get')
        .for(slaveB)
        .execute('token-1')
        .then(() => {
          done(new Error('Expected to throw'));
        });
    } catch (e) {
      expect(e).to.be.an.instanceof(Error);
      expect(e.message).to.equal('Master#pipeline.task.for.slave requires an instanceof Slave.');
      done();
    }
  });
});
