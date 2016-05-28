/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

process.argv.push('--dist-io-slave-id=10009', '--dist-io-slave-alias=test-alias');
const slave = require('./data/simple-slave-b');
const expect = require('chai').expect;

describe('SlaveChildProcess Class', function () {
  describe('SlaveChildProcess#id', function () {
    it('Should return the slave\'s id', () => {
      expect(slave.id).to.equal(10009);
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

  it('Should respond to commands', function (done) {
    this.timeout(5500);
    this.slow(5000);

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

    slave.on('task started', (task, data, meta) => {
      expect(task).to.equal('echo');
      expect(data).to.equal(request.data);
      expect(meta).to.equal(request.meta);
    });

    slave.on('task completed', (task, res, data, meta) => {
      expect(task).to.equal('echo');
      expect(res).to.equal('world!');
      expect(data).to.equal(request.data);
      expect(meta).to.equal(request.meta);
    });

    process.emit('message', request);
  });
});
