/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const master = require('../').Master;
const path = require('path');
const a = path.join(__dirname, 'data', 'slave-pipeline-a.js');
const b = path.join(__dirname, 'data', 'slave-pipeline-b.js');
const expect = require('chai').expect;
const Response = require('../lib/Response');

describe('Pipeline Pattern', function () {
  this.timeout(3000);
  this.slow(1000);

  it('Should pipe reponses from one result to the next (Promises)', function (done) {
    const slaveA = master.createSlave(a);
    const slaveB = master.createSlave(b);
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
    const slaveA = master.createSlave(a);
    const slaveB = master.createSlave(b);
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
    const slaveB = master.createSlave(b);
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
    const slaveB = master.createSlave(b);
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
    const slaveA = master.createSlave(a);
    const slaveB = master.createSlave(b);
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
      .execute('token-1', function (e, res) {
        expect(e).to.equal(null);
        expect(res).to.be.an.instanceof(Response);
        expect(res.error).to.equal(null);
        expect(res.value).to.eql({ username: 'jeanlucpicard', password: 'mypassword' });
        done();
      });
  });

  it('Should intercept responses and allow the user to modify them (Promises)', function (done) {
    const slaveA = master.createSlave(a);
    const slaveB = master.createSlave(b);
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
    const slaveA = master.createSlave(a);
    const slaveB = master.createSlave(b);
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
    const slaveA = master.createSlave(a);
    const slaveB = master.createSlave(b);
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
    const slaveA = master.createSlave(a);
    const slaveB = master.createSlave(b);
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
    const slaveA = master.createSlave(a);
    const slaveB = master.createSlave(b);
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
    const slaveB = master.createSlave(b);
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
