/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const slave = require('./data/simple-slave-b');
const expect = require('chai').expect;

describe('SlaveChild Class', function () {
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
