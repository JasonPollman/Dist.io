/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const master = require('../').Master;
const path = require('path');
const slaveJS = path.join(__dirname, 'data', 'scatter-slave.js');
const expect = require('chai').expect;
const ResponseArray = require('../lib/ResponseArray');

describe('Scatter Pattern', function () {
  this.timeout(3000);
  this.slow(1000);

  it('Should scatter data amongst slaves (Promises)', function (done) {
    const slaves = master.createSlaves(5, slaveJS);
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
    const slaves = master.createSlaves(5, slaveJS);
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

  it('Should scatter data amongst slaves (Chunked data)', function (done) {
    const slaves = master.createSlaves(5, path.join(__dirname, 'data', 'scatter-slave-chunk.js'));
    const scatter = master.create.scatter('echo', { chunk: true });

    scatter
      .data('hello', 'world', 'goodbye', 'world')
      .gather(slaves[0], slaves[1], function (err, res) {
        expect(err).to.equal(null);
        expect(res).to.be.an.instanceof(ResponseArray);
        expect(res.length).to.equal(2);
        res.sortBy('rid');
        expect(res.values[0]).to.equal('hello+world');
        expect(res.values[1]).to.equal('goodbye+world');
        slaves.kill();
        done();
      });
  });

  it('Should scatter data amongst slaves (Errors returned)', function (done) {
    const slaves = master.createSlaves(5, path.join(__dirname, 'data', 'scatter-slave-error.js'));
    const scatter = master.create.scatter('echo', { chunk: true });

    scatter
      .data('hello', 'world', 'goodbye', 'world')
      .gather(slaves[0], slaves[1], function (err, res) {
        expect(err).to.equal(null);
        expect(res).to.be.an.instanceof(ResponseArray);
        expect(res.length).to.equal(2);
        res.sortBy('rid');
        expect(res.errors[0].message).to.equal('oops');
        expect(res.errors[1].message).to.equal('oops');
        expect(res.values[0]).to.equal(undefined);
        expect(res.values[1]).to.equal(undefined);
        slaves.kill();
        done();
      });
  });

  it('Should scatter data amongst slaves (Errors returned, catchAll)', function (done) {
    const slaves = master.createSlaves(5, path.join(__dirname, 'data', 'scatter-slave-error.js'));
    const scatter = master.create.scatter('echo', { chunk: true, catchAll: true });

    scatter
      .data('hello', 'world', 'goodbye', 'world')
      .gather(slaves[0], slaves[1], function (err, res) {
        expect(err.message).to.equal('oops');
        expect(res).to.equal(null);
        slaves.kill();
        done();
      });
  });

  it('Should simply resolve if no data is provided (Promises)', function (done) {
    const slaves = master.createSlaves(5, slaveJS);
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
    const slaves = master.createSlaves(5, slaveJS);
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
    const slaves = master.createSlaves(5, slaveJS);
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
    const slaves = master.createSlaves(5, slaveJS);
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
