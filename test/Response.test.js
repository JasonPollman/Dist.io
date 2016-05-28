/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const Response = require('../lib/Response');
const ResponseError = require('../lib/ResponseError');
const expect = require('chai').expect;

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
});
