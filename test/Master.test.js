/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const Master = require('../lib/Master');
const path = require('path');
const expect = require('chai').expect;
const Response = require('../lib/Response');
const ResponseArray = require('../lib/ResponseArray');

describe('Master Class', function () {
  it('Master#createSlave: It should create new slave objects', function (done) {
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
        if (++completed === 2) done();
      })
      .catch(done);

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
        if (++completed === 2) done();
      })
      .catch(done);
  });

  it('Master#createSlaves: It should create multiple slave objects', function (done) {
    this.timeout(3000);
    this.slow(1000);
    let totalDone = 0;

    const slaves = Master.createSlaves(5, path.join(__dirname, 'data', 'simple-slave-c.js'));
    expect(slaves).to.be.an('array');
    expect(slaves.length).to.equal(5);

    Master.broadcast('echo')
      .then(responses => {
        responses.each((res, i, k) => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal(k + 1);
          expect(res.error).to.equal(null);
        });
        if (++totalDone === 2) done();
      });

    Master.broadcast('echo')
      .then(responses => {
        responses.each((res, i, k) => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal(k + 1);
          expect(res.error).to.equal(null);
        });
        const sum = responses.reduce(
          function (prev, curr) {
            return { value: prev.value + curr.value };
          },
          { value: 0 }
        ).value;

        expect(sum).to.equal(15);
        if (++totalDone === 2) done();
      });

    Master.broadcastTo('global', 'echo')
      .then(responses => {
        responses.each((res, i, k) => {
          expect(res).to.be.an.instanceof(Response);
          expect(res.value).to.equal(k + 1);
          expect(res.error).to.equal(null);
        });
        const sum = responses.reduce(
          function (prev, curr) {
            return { value: prev.value + curr.value };
          },
          { value: 0 }
        ).value;

        expect(sum).to.equal(15);
        if (++totalDone === 2) done();
      });

    Master.broadcastTo('non-existent', 'echo')
      .then(responses => {
        expect(responses).to.be.an.instanceof(ResponseArray);
        expect(responses.length).to.equal(0);
      });
  });
});
