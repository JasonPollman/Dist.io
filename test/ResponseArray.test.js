/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const ResponseArray = require('../lib/ResponseArray');
const Response = require('../lib/Response');
const expect = require('chai').expect;
const master = require('../lib/Master');
const path = require('path');

describe('ResponseArray Class', function () {
  describe('ResponseArray#joinValues', function () {
    it('Should join the response values contained within the array', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));
      master.tell(...slaves).to('echo', function (err, responses) {
        expect(err).to.equal(null);

        expect(responses).to.be.an.instanceof(ResponseArray);
        expect(responses.length).to.equal(2);
        expect(responses.joinValues).to.be.a('function');

        responses.sortBy('value');
        expect(responses.joinValues(':')).to.equal(`${slaves[0].id}:${slaves[1].id}`);
        master.kill(slaves);
        done();
      });
    });
  });

  describe('ResponseArray#sum', function () {
    it('Should add the values of all the response objects', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));
      master.tell(...slaves).to('echo', function (err, responses) {
        expect(err).to.equal(null);

        expect(responses).to.be.an.instanceof(ResponseArray);
        expect(responses.length).to.equal(2);
        expect(responses.sum).to.be.a('number');

        responses.sortBy('value');
        expect(responses.sum).to.equal(slaves[0].id + slaves[1].id);

        responses[0].value = NaN;
        expect(responses.sum).to.be.NaN; // eslint-disable-line
        master.kill(slaves);
        done();
      });
    });
  });

  describe('ResponseArray#product', function () {
    it('Should multiply the values of all the response objects', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));
      master.tell(...slaves).to('echo', function (err, responses) {
        expect(err).to.equal(null);

        expect(responses).to.be.an.instanceof(ResponseArray);
        expect(responses.length).to.equal(2);
        expect(responses.product).to.be.a('number');

        responses.sortBy('value');
        expect(responses.product).to.equal(slaves[0].id * slaves[1].id);

        responses[0].value = NaN;
        expect(responses.product).to.be.NaN; // eslint-disable-line
        master.kill(slaves);
        done();
      });
    });
  });

  describe('ResponseArray#push', function () {
    it('Should push in new responses', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));
      master.tell(...slaves).to('echo', function (err, responses) {
        expect(err).to.equal(null);

        expect(responses).to.be.an.instanceof(ResponseArray);
        expect(responses.length).to.equal(2);
        expect(responses.push).to.be.a('function');

        responses.sortBy('value');
        expect(responses.push(new Response({}))).to.equal(3);
        master.kill(slaves);
        done();
      });
    });

    it('Should throw when pushing a non-Response object', function (done) {
      this.slow(1000);
      const r = new ResponseArray();
      expect(r.push.bind(r, [])).to.throw(TypeError);
      expect(r.push.bind(r, {})).to.throw(TypeError);
      expect(r.push.bind(r, () => {})).to.throw(TypeError);
      expect(r.push.bind(r, 'string')).to.throw(TypeError);
      expect(r.push.bind(r, 123)).to.throw(TypeError);
      done();
    });
  });

  describe('ResponseArray#unshift', function () {
    it('Should unshift in new responses', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));
      master.tell(...slaves).to('echo', function (err, responses) {
        expect(err).to.equal(null);

        expect(responses).to.be.an.instanceof(ResponseArray);
        expect(responses.length).to.equal(2);
        expect(responses.unshift).to.be.a('function');

        responses.sortBy('value');
        expect(responses.unshift(new Response({}))).to.equal(3);
        master.kill(slaves);
        done();
      });
    });

    it('Should throw when pushing a non-Response object', function (done) {
      this.slow(1000);
      const r = new ResponseArray();
      expect(r.unshift.bind(r, [])).to.throw(TypeError);
      expect(r.unshift.bind(r, {})).to.throw(TypeError);
      expect(r.unshift.bind(r, () => {})).to.throw(TypeError);
      expect(r.unshift.bind(r, 'string')).to.throw(TypeError);
      expect(r.unshift.bind(r, 123)).to.throw(TypeError);
      done();
    });
  });

  describe('ResponseArray#sortBy', function () {
    it('Should sort responses by their properties', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));
      master.tell(...slaves).to('echo', function (err, responses) {
        expect(err).to.equal(null);

        expect(responses).to.be.an.instanceof(ResponseArray);
        expect(responses.length).to.equal(2);
        expect(responses.sortBy).to.be.a('function');

        responses.sortBy('value');
        expect(responses[0].value).to.equal(slaves[0].id);
        expect(responses[1].value).to.equal(slaves[1].id);

        responses.sortBy('value', 'desc');
        expect(responses[0].value).to.equal(slaves[1].id);
        expect(responses[1].value).to.equal(slaves[0].id);
        master.kill(slaves);
        done();
      });
    });

    it('Should throw when trying to sort by an undefined property', function (done) {
      this.slow(1000);

      const slaves = master.create.slaves(2, path.join(__dirname, 'data', 'simple-slave-c.js'));
      master.tell(...slaves).to('echo', function (err, responses) {
        expect(err).to.equal(null);

        expect(responses).to.be.an.instanceof(ResponseArray);
        expect(responses.length).to.equal(2);
        expect(responses.sortBy).to.be.a('function');

        expect(responses.sortBy.bind(responses, 'undefined')).to.throw(TypeError);

        try {
          responses.sortBy('bad property');
          done(new Error('Expected to throw'));
        } catch (e) {
          expect(e.message).to.equal('Response has no property "bad property"');
        }

        master.kill(slaves);
        done();
      });
    });

    it('Should return the response array when it has no arguments', function (done) {
      this.slow(1000);
      const responses = new ResponseArray();
      expect(responses.sortBy('value')).to.equal(responses);
      done();
    });
  });

  it('Should throw on invalid constructor arguments', function (done) {
    try {
      const x = new ResponseArray('string'); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Cannot insert non-Response object into ResponseArray!');
    }

    try {
      const x = new ResponseArray([]); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Cannot insert non-Response object into ResponseArray!');
    }

    try {
      const x = new ResponseArray(() => {}); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Cannot insert non-Response object into ResponseArray!');
    }

    try {
      const x = new ResponseArray(new Response({}), []); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Cannot insert non-Response object into ResponseArray!');
    }

    let x = new ResponseArray(); // eslint-disable-line
    expect(x.length).to.equal(0);
    expect(x.averageResponseTime).to.equal(0);

    const d = Date.now();
    x = new ResponseArray(new Response({ request: { sent: d - 5 }, received: d })); // eslint-disable-line
    expect(x.length).to.equal(1);
    expect(x.averageResponseTime).to.gte(5);
    expect(x.averageResponseTime).to.lte(6);
    done();
  });
});
