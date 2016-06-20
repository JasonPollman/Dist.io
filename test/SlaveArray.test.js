/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const SlaveArray = require('../lib/SlaveArray');
const path = require('path');
const Slave = require('../lib/Slave');
const expect = require('chai').expect;
const master = require('../').Master;
const ResponseArray = require('../lib/ResponseArray');

describe('SlaveArray Class', function () {
  describe('SlaveArray#constructor', function () {
    it('Should throw when given non-Slave objects', (done) => {
      try {
        const s = new SlaveArray(1, 2, 3); // eslint-disable-line
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
        expect(e.message).to.equal('Cannot insert non-Slave object into SlaveArray!');
      }

      let slave;
      try {
        const location = path.join(__dirname, 'data', 'simple-slave-a-2.js');
        slave = new Slave(location); // eslint-disable-line

        const s = new SlaveArray(slave, slave, 1); // eslint-disable-line
        done(new Error('Expected to throw'));
      } catch (e) {
        expect(e).to.be.an.instanceof(TypeError);
        expect(e.message).to.equal('Cannot insert non-Slave object into SlaveArray!');
        slave.kill();
        done();
      }
    });
  });

  describe('SlaveArray#exit', function () {
    this.slow(1000);

    it('Should behave exactly like SlaveArray#close', (done) => {
      const location = path.join(__dirname, 'data', 'simple-slave-b.js');
      const slave = new Slave(location); // eslint-disable-line
      const s = new SlaveArray(slave);

      const p = s.exit();
      expect(p).to.be.an.instanceof(Promise);

      p.then(status => {
        expect(status).to.equal(true);
        done();
      })
      .catch(e => {
        done(e);
      });
    });
  });

  describe('SlaveArray#random', function () {
    it('Should return a random slave...', (done) => {
      const location = path.join(__dirname, 'data', 'simple-slave-a-2.js');
      const slave = new Slave(location); // eslint-disable-line
      const slave2 = new Slave(location); // eslint-disable-line
      const slave3 = new Slave(location); // eslint-disable-line
      const s = new SlaveArray(slave, slave2, slave3);

      for (let i = 0; i < 100; i++) {
        expect(s.random).to.be.oneOf([slave, slave2, slave3]);
      }
      done();
    });

    it('Should return null if the array is smpty', (done) => {
      const s = new SlaveArray();
      for (let i = 0; i < 100; i++) expect(s.random).to.equal(null);
      done();
    });
  });

  describe('SlaveArray#push', function () {
    it('Should push in new slaves', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));

      const location = path.join(__dirname, 'data', 'simple-slave-a-2.js');
      const slave = new Slave(location); // eslint-disable-line

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(2);
      expect(slaves.push).to.be.a('function');

      expect(slaves.push(slave)).to.equal(3);
      slaves.exit();
      done();
    });

    it('Should throw when pushing a non-Response object', function (done) {
      this.slow(1000);
      const r = new SlaveArray();
      expect(r.push.bind(r, [])).to.throw(TypeError);
      expect(r.push.bind(r, {})).to.throw(TypeError);
      expect(r.push.bind(r, () => {})).to.throw(TypeError);
      expect(r.push.bind(r, 'string')).to.throw(TypeError);
      expect(r.push.bind(r, 123)).to.throw(TypeError);
      done();
    });
  });

  describe('SlaveArray#concat', function () {
    it('Should concat slave arrays', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));
      const otherSlaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));

      const location = path.join(__dirname, 'data', 'simple-slave-a-2.js');
      const slave = new Slave(location); // eslint-disable-line

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(2);
      expect(slaves.concat).to.be.a('function');

      const newSlaveArray = slaves.concat(otherSlaves);
      expect(newSlaveArray.length).to.equal(4);
      expect(newSlaveArray).to.be.an.instanceof(SlaveArray);
      slaves.exit();
      done();
    });

    it('Should throw if any argument isn\'t a slave array', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));

      const location = path.join(__dirname, 'data', 'simple-slave-a-2.js');
      const slave = new Slave(location); // eslint-disable-line

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(2);
      expect(slaves.concat).to.be.a('function');

      expect(slaves.concat.bind(slaves, 1, 'string')).to.throw(TypeError);
      slaves.exit();
      done();
    });
  });

  describe('SlaveArray#unshift', function () {
    it('Should unshift in new slaves', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));

      const location = path.join(__dirname, 'data', 'simple-slave-a-2.js');
      const slave = new Slave(location); // eslint-disable-line

      expect(slaves).to.be.an.instanceof(SlaveArray);
      expect(slaves.length).to.equal(2);
      expect(slaves.unshift).to.be.a('function');

      expect(slaves.unshift(slave)).to.equal(3);
      slaves.exit();
      done();
    });

    it('Should throw when pushing a non-Response object', function (done) {
      this.slow(1000);
      const r = new SlaveArray();
      expect(r.unshift.bind(r, [])).to.throw(TypeError);
      expect(r.unshift.bind(r, {})).to.throw(TypeError);
      expect(r.unshift.bind(r, () => {})).to.throw(TypeError);
      expect(r.unshift.bind(r, 'string')).to.throw(TypeError);
      expect(r.unshift.bind(r, 123)).to.throw(TypeError);
      done();
    });
  });

  describe('SlaveArray#exec', function () {
    it('Should send a command to all slaves in the array', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-b.js'));
      expect(slaves).to.be.an.instanceof(SlaveArray);

      slaves.exec('echo', 1234, function (err, responses) {
        expect(err).to.equal(null);
        expect(responses).to.be.an.instanceof(ResponseArray);
        expect(responses.length).to.equal(2);
        expect(responses.values).to.eql([1234, 1234]);
        slaves.exit();
        done();
      });
    });
  });

  describe('SlaveArray#do', function () {
    it('Should be an alias for SlaveArray#exec', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-b.js'));
      expect(slaves).to.be.an.instanceof(SlaveArray);

      slaves.do('echo', 1234, function (err, responses) {
        expect(err).to.equal(null);
        expect(responses).to.be.an.instanceof(ResponseArray);
        expect(responses.length).to.equal(2);
        expect(responses.values).to.eql([1234, 1234]);
        slaves.exit();
        done();
      });
    });
  });

  describe('SlaveArray#then', function () {
    it('Should allow chaining for Master#create.slaves', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-b.js'));
      expect(slaves).to.be.an.instanceof(SlaveArray);

      expect(slaves.then([])).to.be.an.instanceof(Promise);
      expect(slaves.then({})).to.be.an.instanceof(Promise);
      expect(slaves.then(() => {})).to.be.an.instanceof(Promise);
      expect(slaves.then('string')).to.be.an.instanceof(Promise);
      expect(slaves.then(123)).to.be.an.instanceof(Promise);
      expect(slaves.then(new Promise(() => new Promise(() => {})))).to.be.an.instanceof(Promise);
      done();
    });
  });

  after((done) => {
    Slave.getSlavesWithPath(path.join(__dirname, 'data', 'simple-slave-a-2.js')).kill();
    done();
  });
});
