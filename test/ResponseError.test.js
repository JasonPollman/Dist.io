/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const ResponseError = require('../lib/ResponseError');
const expect = require('chai').expect;

describe('ResponseError Class', function () {
  it('Should construct properly', function (done) {
    try {
      const x = new ResponseError(); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('ResponseError constructor argument #0 (e) expected an object, but got undefined.');
    }

    try {
      const x = new ResponseError(() => {}); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('ResponseError constructor argument #0 (e) expected an object, but got function.');
    }

    try {
      const x = new ResponseError(5); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('ResponseError constructor argument #0 (e) expected an object, but got number.');
    }

    try {
      const x = new ResponseError('string'); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('ResponseError constructor argument #0 (e) expected an object, but got string.');
    }

    let x = new ResponseError({});
    expect(x).to.be.an.instanceof(ResponseError);
    expect(x.message).to.equal('Unknown Response Error');

    x = new ResponseError({ message: 'test message' });
    expect(x).to.be.an.instanceof(ResponseError);
    expect(x.message).to.equal('test message');

    x = new ResponseError({ message: 'test message', name: 'test error' });
    expect(x).to.be.an.instanceof(ResponseError);
    expect(x.message).to.equal('test message');
    expect(x.name).to.equal('ResponseError: test error');

    x = new ResponseError({ message: 'test message', name: 'test error', stack: 'stack' });
    expect(x).to.be.an.instanceof(ResponseError);
    expect(x.message).to.equal('test message');
    expect(x.name).to.equal('ResponseError: test error');
    expect(x.stack).to.equal('stack');
    expect(x.raw).to.eql({
      message: 'test message',
      name: 'test error',
      stack: 'stack',
    });
    done();
  });
});
