/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const Response = require('../lib/Response');
const ResponseError = require('../lib/ResponseError');
const expect = require('chai').expect;
const master = require('../').Master;
const path = require('path');

describe('Response Class', function () {
  it('Should construct properly', function (done) {
    try {
      const x = new Response(); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Response constructor argument #0 (message) expected an object, but got undefined.');
    }

    try {
      const x = new Response(function () {}); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Response constructor argument #0 (message) expected an object, but got function.');
    }

    try {
      const x = new Response('string'); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Response constructor argument #0 (message) expected an object, but got string.');
    }

    try {
      const x = new Response(123); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Response constructor argument #0 (message) expected an object, but got number.');
    }

    try {
      const x = new Response(null); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('Response constructor argument #0 (message) cannot be null.');
    }

    const x = new Response({ error: { message: 'hello world' } }); // eslint-disable-line
    expect(x.error).to.be.an.instanceof(ResponseError);
    expect(x.error.message).to.equal('hello world');
    done();
  });

  describe('Response#txid', function () {
    it('Should return the reponse\'s rid', function (done) {
      const x = new Response({});
      expect(x.txid).to.match(/^\d+$/);
      done();
    });
  });

  describe('Response#val, Response#data, Response#value', function () {
    it('Should set the responses value', function (done) {
      const x = new Response({});
      x.val = 5;
      expect(x.val).to.equal(5);
      expect(x.value).to.equal(5);
      expect(x.data).to.equal(5);

      x.value = 'string';
      expect(x.val).to.equal('string');
      expect(x.value).to.equal('string');
      expect(x.data).to.equal('string');

      const obj = {};
      x.data = obj;
      expect(x.val).to.equal(obj);
      expect(x.value).to.equal(obj);
      expect(x.data).to.equal(obj);
      done();
    });
  });

  describe('Response#pipe', function () {
    it('Should pipe responses from one slave to the next', function (done) {
      const s1 = master.create.slave(path.join(__dirname, 'data', 'simple-slave-c.js'));
      const s2 = master.create.slave(path.join(__dirname, 'data', 'simple-slave-b.js'));

      s1.exec('echo')
        .then(res => res.pipe('echo').to(s2))
        .then(res => {
          expect(res.value).to.equal(s1.id);
          s2.exec('echo', 'hello')
            .then(res2 => res2.pipe('echo').to(s1))
            .then(res2 => {
              expect(res2.value).to.equal(s1.id);
              done();
            })
            .catch(e => done(e));
        })
        .catch(e => done(e));
    });
  });
});
