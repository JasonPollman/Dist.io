/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const master = require('../').Master;
const path = require('path');
const slaveJS = path.join('test', 'data', 'scatter-slave.js');
const expect = require('chai').expect;
const ResponseArray = require('../lib/ResponseArray');
const fork = require('child_process').fork;

describe('Scatter Pattern (Remote Slaves)', function () {
  this.timeout(4000);
  this.slow(2500);

  let mpserver = null;
  const connectOptions = {
    location: '127.0.0.1:1337',
    path: slaveJS,
  };

  before(() => {
    mpserver = fork(path.join(__dirname, '..', 'bin', 'distio-serve'), ['--port=1337'], { silent: true });
  });

  after(done => {
    setTimeout(() => {
      mpserver.kill('SIGINT');
      done();
    }, 1000);
  });

  it('Should scatter data amongst slaves (Promises)', function (done) {
    const slaves = master.createRemoteSlaves(5, connectOptions, { alias: 'scatter-remote' });
    const scatter = master.create.scatter('echo');

    scatter
      .data('hello', 'world')
      .gather(slaves[0], slaves[1])
      .then(res => {
        expect(res).to.be.an.instanceof(ResponseArray);
        expect(res.length).to.equal(2);
        expect(res.sortBy('value').joinValues(', ')).to.equal('hello, world');
        expect(res.sortBy('value', 'desc').joinValues(', ')).to.equal('world, hello');
        slaves.kill();
        done();
      })
      .catch(e => done(e));
  });

  it('Should scatter data amongst slaves (Callbacks)', function (done) {
    try {
      master.createRemoteSlaves('asd', connectOptions);
      done(new Error('Expected to throw'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
    }

    const slaves = master.createRemoteSlaves(5, connectOptions);
    const scatter = master.create.scatter('echo');

    scatter
      .data('hello', 'world')
      .gather(slaves[0], slaves[1], function (err, res) {
        expect(err).to.equal(null);
        expect(res).to.be.an.instanceof(ResponseArray);
        expect(res.length).to.equal(2);
        expect(res.sortBy('value').joinValues(', ')).to.equal('hello, world');
        expect(res.sortBy('value', 'desc').joinValues(', ')).to.equal('world, hello');
        slaves.kill();
        done();
      });
  });

  it('Should simply resolve if no data is provided (Promises)', function (done) {
    const slaves = master.createRemoteSlaves(5, connectOptions);
    const scatter = master.create.scatter('echo');

    scatter
      .data()
      .gather(slaves[0], slaves[1])
      .then(res => {
        expect(res).to.be.an.instanceof(ResponseArray);
        expect(res.length).to.equal(0);
        expect(res.sortBy('value').joinValues(', ')).to.equal('');
        expect(res.sortBy('value', 'desc').joinValues(', ')).to.equal('');
        slaves.kill();
        done();
      })
      .catch(e => done(e));
  });

  it('Should simply resolve if no data is provided (Callbacks)', function (done) {
    const slaves = master.createRemoteSlaves(5, connectOptions);
    const scatter = master.create.scatter('echo');

    scatter
      .data()
      .gather(slaves[0], slaves[1], function (err, res) {
        expect(err).to.equal(null);
        expect(res).to.be.an.instanceof(ResponseArray);
        expect(res.length).to.equal(0);
        expect(res.sortBy('value').joinValues(', ')).to.equal('');
        expect(res.sortBy('value', 'desc').joinValues(', ')).to.equal('');
        slaves.kill();
        done();
      });
  });

  it('Should throw if no slaves are given (Promises)', function (done) {
    const slaves = master.createRemoteSlaves(5, connectOptions);
    const scatter = master.create.scatter('echo');

    scatter
      .data('hello', 'world')
      .gather()
      .then(() => {
        done(new Error('Expected to throw'));
      })
      .catch(e => {
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('Cannot gather without at least one slave!');
        slaves.kill();
        done();
      });
  });

  it('Should throw if no slaves are given (Callbacks)', function (done) {
    const slaves = master.createRemoteSlaves(5, connectOptions);
    const scatter = master.create.scatter('echo');

    scatter
      .data('hello')
      .gather(function (e, res) {
        expect(res).to.be.an.instanceof(ResponseArray);
        expect(res.length).to.equal(0);
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('Cannot gather without at least one slave!');
        slaves.kill();
        done();
      });
  });
});
