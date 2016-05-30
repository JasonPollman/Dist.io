/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const ResponseArray = require('../lib/ResponseArray');
const Response = require('../lib/Response');
const expect = require('chai').expect;

describe('ResponseArray Class', function () {
  it('Should construct properly', function (done) {
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
