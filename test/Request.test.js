/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const Request = require('../lib/Request');
const Response = require('../lib/Response');
const expect = require('chai').expect;
const Master = require('../').Master;
const path = require('path');

describe('Request Class', function () {
  it('Should type check constructor arguments', function (done) {
    try {
      const x = new Request(); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Request argument #0 (slave) expected a an instanceof Slave.');
    }

    try {
      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      const x = new Request(slave); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Request argument #4 (secretId) expected a string, but got undefined.');
    }

    try {
      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      const x = new Request(slave, 'echo', {}, 'testing', 'secret'); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Request argument #5 (secretNumber) expected a number, but got undefined.');
    }

    try {
      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      const x = new Request(slave, 'echo', 'bad meta', 'testing', 'secret', 1234); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Request argument #2 (meta) expected an object, but got undefined.');
    }

    try {
      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      const x = new Request(slave, {}, {}, 'testing', 'secret', 1234, Symbol(), () => {}); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Request constructor argument #0 (command) expect a string, but got object.');
    }
    done();
  });

  describe('Request#rid', function () {
    it('Should return the reponse\'s rid', function (done) {
      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      const x = new Request(slave, 'echo', {}, 'testing', 'secret', 1234567890, Symbol(), () => {});
      expect(x.rid).to.match(/^\d+$/);
      expect(x.id).to.match(/^\d+$/);
      done();
    });
  });

  describe('Request#onTimeout', function () {
    it('Should always return the request object', function (done) {
      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      const x = new Request(slave, 'echo', {}, 'testing', 'secret', 1234567890, Symbol(), () => {});
      expect(x.onTimeout({})).to.equal(x);
      expect(x.onTimeout([])).to.equal(x);
      expect(x.onTimeout(() => {})).to.equal(x);
      expect(x.onTimeout('string')).to.equal(x);
      expect(x.onTimeout(1234)).to.equal(x);
      expect(x.onTimeout()).to.equal(x);
      expect(x.onTimeout(null)).to.equal(x);
      done();
    });
  });

  describe('Request#hasTimedout', function () {
    it('Should throw if not provided a response', function (done) {
      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      const x = new Request(slave, 'echo', {}, 'testing', 'secret', 1234567890, Symbol(), () => {});
      expect(x.hasTimedout.bind(x, 'string')).to.throw(TypeError);
      done();
    });

    it('Should return false if no timeout is set', function (done) {
      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      const x = new Request(slave, 'echo', {}, 'testing', 'secret', 1234567890, Symbol(), () => {});
      const y = new Response({ error: { message: 'hello world' } });
      expect(x.hasTimedout(y)).to.equal(false);
      done();
    });

    it('Should return true if the timeout period has expired', function (done) {
      this.timeout(3000);
      this.slow(1500);

      const slave = Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'));
      const x = new Request(slave, 'echo', { timeout: 500 }, 'testing', 'secret', 1234567890, Symbol(), () => {});
      setTimeout(() => {
        const y = new Response({ error: { message: 'hello world' } });
        expect(x.hasTimedout(y)).to.equal(true);
        done();
      }, 550);
    });
  });
});
