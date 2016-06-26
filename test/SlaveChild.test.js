/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names, require-jsdoc, global-require */
'use strict';

describe('SlaveChildProcess Class', function () {
  process.argv = process.argv.slice(0, 2);
  process.argv.push(
    '--dist-io-slave-id=10009', '--dist-io-slave-alias=test-alias', '--dist-io-slave-title=slave-child-test'
  );

  function throwError() {
    throw new Error('foo');
  }

  const slave = require('./data/simple-slave-b');
  const expect = require('chai').expect;

  slave.task('throw', () => {
    throw new Error('oops');
  });

  slave.task('throw2', (data, done) => {
    done(new Error('oops'));
  });

  slave.task(123, (data, done) => {
    done(new Error('oops'));
  });

  describe('SlaveChildProcess#id', function () {
    it('Should return the slave\'s id', () => {
      expect(slave.id).to.equal(10009);
      expect(slave.serverId).to.equal(10009);
      expect(slave.remoteId).to.equal(null);
      expect(slave.wasProxied).to.equal(false);
    });
  });

  describe('SlaveChildProcess#alias', function () {
    it('Should return the slave\'s alias', () => {
      expect(slave.alias).to.equal('test-alias');
    });
  });

  describe('SlaveChildProcess#task', function () {
    it('Should throw if the listener already exists', (done) => {
      expect(slave.task('foo', () => {})).to.equal(slave);
      expect(slave.task.bind(slave, 'foo', () => {})).to.throw(TypeError);
      expect(slave.task.bind(slave, 'foo')).to.throw(TypeError);
      done();
    });
  });

  describe('SlaveChildProcess command response, part I', function () {
    it('Should respond to known commands', function (done) {
      process.send = (m) => {
        expect(m.data).to.equal('world!');
        done();
      };

      const request = {
        rid: 0,
        title: 'MasterIOMessage',
        for: 0,
        command: 'echo',
        secretNumber: 123456789,
        secretId: 'secret id',
        data: 'world!',
        meta: null,
      };

      slave.on('task started', function testListener(task, data, meta) {
        slave.removeListener('task started', testListener);
        expect(task).to.equal('echo');
        expect(data).to.equal(request.data);
        expect(meta).to.equal(request.meta);
      });

      slave.on('task completed', function testListener(task, err, res, data, meta) {
        slave.removeListener('task completed', testListener);
        expect(task).to.equal('echo');
        expect(res).to.equal('world!');
        expect(err).to.equal(null);
        expect(data).to.equal(request.data);
        expect(meta).to.equal(request.meta);
      });

      process.emit('message', request);
    });

    it('Should respond to unknown commands with an error', function (done) {
      process.send = (m) => {
        expect(m.data).to.equal(undefined);
        expect(m.error).to.be.an('object');
        expect(m.error.message).to.equal(`Slave #${slave.id} does not listen to task "doesnt exist"`);
        done();
      };

      const request = {
        rid: 0,
        title: 'MasterIOMessage',
        for: 0,
        command: 'doesnt exist',
        secretNumber: 123456789,
        secretId: 'secret id',
        data: 'world!',
        meta: null,
      };

      slave.on('task started', function testListener(task, data, meta) {
        slave.removeListener('task started', testListener);
        expect(task).to.equal('doesnt exist');
        expect(data).to.equal(request.data);
        expect(meta).to.equal(request.meta);
      });

      slave.on('task completed', function testListener(task, err, res, data, meta) {
        slave.removeListener('task completed', testListener);
        expect(task).to.equal('doesnt exist');
        expect(res).to.equal(null);
        expect(err).to.be.an.instanceof(ReferenceError);
        expect(err.message).to.equal(`Slave #${slave.id} does not listen to task "doesnt exist"`);
        expect(err.name).to.equal('ReferenceError');
        expect(err.stack).to.be.a('string');
        expect(data).to.equal(request.data);
        expect(meta).to.equal(request.meta);
      });

      process.emit('message', request);
    });

    it('Should respond to errors within a user "task" callback with an error', function (done) {
      process.send = (m) => {
        expect(m.data).to.equal(undefined);
        expect(m.error).to.be.an('object');
        expect(m.error.message).to.equal('oops');
        done();
      };

      const request = {
        rid: 0,
        title: 'MasterIOMessage',
        for: 0,
        command: 'throw',
        secretNumber: 123456789,
        secretId: 'secret id',
        data: 'world!',
        meta: null,
      };

      slave.on('task started', function testListener(task, data, meta) {
        slave.removeListener('task started', testListener);
        expect(task).to.equal('throw');
        expect(data).to.equal(request.data);
        expect(meta).to.equal(request.meta);
      });

      slave.on('task completed', function testListener(task, err, res, data, meta) {
        slave.removeListener('task completed', testListener);
        expect(task).to.equal('throw');
        expect(res).to.equal(null);
        expect(err).to.be.an.instanceof(Error);
        expect(err.message).to.equal('oops');
        expect(err.name).to.equal('Error');
        expect(err.stack).to.be.a('string');
        expect(data).to.equal(request.data);
        expect(meta).to.equal(request.meta);
      });

      process.emit('message', request);
    });

    it('Should respond to errors returned from a user "task" callback (using the done function) with an error', function (done) { // eslint-disable-line max-len
      process.send = (m) => {
        expect(m.data).to.equal(undefined);
        expect(m.error).to.be.an('object');
        expect(m.error.message).to.equal('oops');
        done();
      };

      const request = {
        rid: 0,
        title: 'MasterIOMessage',
        for: 0,
        command: 'throw2',
        secretNumber: 123456789,
        secretId: 'secret id',
        data: 'world!',
        meta: null,
      };

      slave.on('task started', function testListener(task, data, meta) {
        slave.removeListener('task started', testListener);
        expect(task).to.equal('throw2');
        expect(data).to.equal(request.data);
        expect(meta).to.equal(request.meta);
      });

      slave.on('task completed', function testListener(task, err, res, data, meta) {
        slave.removeListener('task completed', testListener);
        expect(task).to.equal('throw2');
        expect(res).to.equal(null);
        expect(err).to.be.an.instanceof(Error);
        expect(err.message).to.equal('oops');
        expect(err.name).to.equal('Error');
        expect(err.stack).to.be.a('string');
        expect(data).to.equal(request.data);
        expect(meta).to.equal(request.meta);
      });

      process.emit('message', request);
    });

    it('Should not intercept non-master messages', (done) => {
      process.send = () => {
        done(new Error('Should have never gotten here...'));
      };

      const request = {
        rid: 0,
        title: 'blah...',
        for: 0,
        command: 'doesnt exist',
        secretNumber: 123456789,
        secretId: 'secret id',
        data: 'world!',
        meta: null,
      };

      process.emit('message', request);
      done();
    });
  });

  describe('SlaveChildProcess#isPaused, SlaveChildProcess#pause, SlaveChildProcess#resume', function () {
    it('Shouldn\'t be paused, by default', () => {
      expect(slave.resume()).to.equal(slave);
      expect(slave.isPaused).to.equal(false);
    });

    it('Should pause when SlaveChildProcess#pause is called', () => {
      expect(slave.pause()).to.equal(slave);
      expect(slave.isPaused).to.equal(true);
    });

    it('Should resume when SlaveChildProcess#resume is called', () => {
      expect(slave.pause()).to.equal(slave);
      expect(slave.isPaused).to.equal(true);
      expect(slave.resume()).to.equal(slave);
      expect(slave.isPaused).to.equal(false);
    });

    it('Should respond with an error when paused', function (done) {
      process.send = (m) => {
        expect(m.data).to.equal(undefined);
        expect(m.error).to.be.an('object');
        expect(m.error.message).to.equal(`Slave #${slave.id} is not currently accepting messages.`);
        expect(m.error.name).to.equal('Error');
        done();
      };

      const request = {
        rid: 0,
        title: 'MasterIOMessage',
        for: 0,
        command: 'paused',
        secretNumber: 123456789,
        secretId: 'secret id',
        data: null,
        meta: null,
        sent: Date.now(),
      };

      slave.pause();
      process.emit('message', request);
      slave.resume();
    });
  });

  describe('SlaveChildProcess Basic Built in Commands', function () {
    it('ACK Command', function (done) {
      process.send = (m) => {
        expect(m).to.be.an('object');
        done();
      };

      const request = {
        rid: 0,
        title: 'MasterIOMessage',
        for: 0,
        command: '__dist.io__ack__',
        secretNumber: 123456789,
        secretId: 'secret id',
        data: null,
        meta: null,
        sent: Date.now(),
      };

      slave.on('task started', function testListener(task, data, meta) {
        slave.removeListener('task started', testListener);
        expect(task).to.equal('__dist.io__ack__');
        expect(data).to.equal(null);
        expect(meta).to.equal(request.meta);
      });

      slave.on('task completed', function testListener(task, err, res, data, meta) {
        slave.removeListener('task completed', testListener);
        expect(task).to.equal('__dist.io__ack__');
        expect(data).to.equal(null);
        expect(err).to.equal(null);
        expect(meta).to.equal(request.meta);
        expect(res).to.be.an('object');
        expect(res.from).to.equal(slave.id);
        expect(res.sent).to.be.a('number');
        expect(res.responded).to.be.a('number');
        expect(res.uptime).to.be.a('number');
        expect(res.message).to.match(
          /^Slave acknowledgement from=\d+, received=\d+ responded=\d+, started=\d+, uptime=\d+$/
        );
      });

      process.emit('message', request);
    });

    it('NULL Command', function (done) {
      process.send = (m) => {
        expect(m).to.be.an('object');
        done();
      };

      const request = {
        rid: 0,
        title: 'MasterIOMessage',
        for: 0,
        command: '__dist.io__null__',
        secretNumber: 123456789,
        secretId: 'secret id',
        data: null,
        meta: null,
        sent: Date.now(),
      };

      slave.on('task started', function testListener(task, data, meta) {
        slave.removeListener('task started', testListener);
        expect(task).to.equal('__dist.io__null__');
        expect(data).to.equal(null);
        expect(meta).to.equal(request.meta);
      });

      slave.on('task completed', function testListener(task, err, res, data, meta) {
        slave.removeListener('task completed', testListener);
        expect(task).to.equal('__dist.io__ack__');
        expect(err).to.equal(null);
        expect(data).to.equal(null);
        expect(meta).to.equal(request.meta);
        expect(res).to.be.equal(null);
      });

      process.emit('message', request);
    });

    it('EXIT Command', function (done) {
      process.send = (m) => {
        expect(m).to.be.an('object');
        expect(m.data).to.equal(true);
        expect(process.listenerCount('message')).to.equal(0);
        done();
      };

      const request = {
        rid: 0,
        title: 'MasterIOMessage',
        for: 0,
        command: '__dist.io__exit__',
        secretNumber: 123456789,
        secretId: 'secret id',
        data: null,
        meta: null,
        sent: Date.now(),
      };

      slave.on('task started', function testListener(task, data, meta) {
        slave.removeListener('task started', testListener);
        expect(task).to.equal('__dist.io__exit__');
        expect(data).to.equal(null);
        expect(meta).to.equal(request.meta);
      });

      slave.on('task completed', function testListener(task, err, res, data, meta) {
        slave.removeListener('task completed', testListener);
        expect(task).to.equal('__dist.io__exit__');
        expect(err).to.equal(null);
        expect(data).to.equal(null);
        expect(meta).to.equal(request.meta);
        expect(res).to.be.equal(true);
      });

      process.emit('message', request);
    });
  });

  describe('Sending exceptions to the master process', function () {
    it('Should send an uncaught exception to the master process', function (done) {
      process.send = (m) => {
        expect(m.data).to.equal(undefined);
        expect(m.error).to.be.an('object');
        expect(m.error.message).to.equal('foo');
        expect(m.error.name).to.equal('Error');
        done();
      };

      try {
        throwError();
      } catch (e) {
        process.emit('uncaughtException', e);
      }
    });
  });
});
