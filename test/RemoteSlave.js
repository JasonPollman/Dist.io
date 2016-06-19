/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const RemoteSlave = require('../lib/RemoteSlave');
const expect = require('chai').expect;
const fork = require('child_process').fork;
const path = require('path');

describe('RemoteSlave Class', function () {
  let mpserver;
  let s;

  before((done) => {
    mpserver = fork(path.join(__dirname, '..', 'bin', 'distio-serve'), ['--port=1395'], { silent: true });
    s = new RemoteSlave({
      host: 'localhost:1395',
      script: path.join(__dirname, 'data', 'simple-slave-i.js'),
    }, { forkOptions: { silent: false } });
    done();
  });

  after(() => {
    s.kill();
    mpserver.kill('SIGINT');
  });

  describe('RemoteSlave#constructor', () => {
    let mpserver2;
    let s2;

    before((done) => {
      mpserver2 = fork(path.join(__dirname, '..', 'bin', 'distio-serve'), ['--port=1395'], { silent: true });
      done();
    });

    after(() => {
      mpserver2.kill('SIGINT');
    });

    it('Should throw if not given a script path', (done) => {
      try {
        s2 = new RemoteSlave({ host: 'localhost:1395' });
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
        done();
      }
    });
  });

  describe('RemoteSlave#kill', () => {
    let mpserver3;
    let s3;

    before((done) => {
      mpserver3 = fork(path.join(__dirname, '..', 'bin', 'distio-serve'), ['--port=1440'], { silent: true });
      done();
    });

    after(() => {
      mpserver3.kill('SIGINT');
    });

    it('Should kill with SIGKILL by default', (done) => {
      s3 = new RemoteSlave({ host: 'localhost:1440', script: path.join(__dirname, 'data', 'simple-slave-i.js') });
      s3.kill();
      done();
    });
  });

  describe('RemoteSlave#slaveResponseListener', () => {
    it('Should handle various message types', (done) => {
      s.on('uncaughtException', function oue(e) {
        s.removeListener('uncaughtException', oue);
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('test');
        expect(e.name).to.equal('test');
        expect(e.stack).to.equal('foo');
        done();
      });

      expect(s.slaveResponseListener({})).to.equal(undefined);
      expect(s.slaveResponseListener({
        sent: Date.now(),
        title: 'SlaveIOException',
        error: { message: 'test', stack: 'foo', name: 'test' },
        from: s.id,
      })).to.equal(undefined);
    });
  });

  describe('RemoteSlave#slaveResponseListener, II', () => {
    it('Should handle various message types', (done) => {
      expect(s.slaveResponseListener({})).to.equal(undefined);
      expect(s.slaveResponseListener({
        sent: Date.now(),
        title: 'SlaveIOException',
        error: { message: 'test', stack: 'foo', name: 'test' },
        from: 987654,
      })).to.equal(undefined);
      done();
    });
  });

  describe('RemoteSlave#slaveResponseListener, III', () => {
    it('Should handle various message types', (done) => {
      s.onUncaughtException(e => {
        s.onUncaughtException(() => {});
        expect(e).to.be.an.instanceof(Error);
        expect(e.message).to.equal('test');
        expect(e.name).to.equal('test');
        expect(e.stack).to.equal('foo');
        done();
      });

      expect(s.slaveResponseListener({})).to.equal(undefined);
      expect(s.slaveResponseListener({
        sent: Date.now(),
        title: 'SlaveIOException',
        error: { message: 'test', stack: 'foo', name: 'test' },
        from: s.id,
      })).to.equal(undefined);
    });
  });

  describe('RemoteSlave#isSlaveMessage', () => {
    it('Should return false if a "non-SlaveMessage" is passed', () => {
      expect(s.isSlaveMessage()).to.equal(false);
      expect(s.isSlaveMessage('string')).to.equal(false);
      expect(s.isSlaveMessage([])).to.equal(false);
      expect(s.isSlaveMessage(() => {})).to.equal(false);

      expect(s.isSlaveMessage({
        sent: Date.now(),
        title: 'SlaveIOResponse',
        request: {},
      })).to.equal(false);
    });
  });

  describe('RemoteSlave#checkLocation', () => {
    it('Should accept valid URL Strings', () => {
      expect(s.checkLocation('http://www.google.com')).to.equal('http://www.google.com');
      expect(s.checkLocation('192.168.0.1')).to.equal('http://192.168.0.1');
      expect(s.checkLocation('https://192.168.0.1')).to.equal('https://192.168.0.1');
      expect(s.checkLocation('https://localhost')).to.equal('https://localhost');
      expect(s.checkLocation('localhost')).to.equal('http://localhost');
      expect(s.checkLocation('https://localhost:80')).to.equal('https://localhost:80');
    });

    it('Should throw given invalid URL Strings', () => {
      expect(s.checkLocation.bind(s, 'http:123//www.google.com123')).to.throw(TypeError);
      expect(s.checkLocation.bind(s, 'abcd://www.google.com')).to.throw(TypeError);
      expect(s.checkLocation.bind(s, 'localhost@123')).to.throw(TypeError);
    });
  });
});
