/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const TimeoutResponse = require('../lib/TimeoutResponse');
const Master = require('../lib/Master');
const expect = require('chai').expect;
const path = require('path');

describe('TimeoutResponse Class', function () {
  it('Should construct properly', function (done) {
    try {
      const x = new TimeoutResponse(); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal('TimeoutResponse constructor expected argument #0 (slave) to be a Slave instance.');
    }

    try {
      const x = new TimeoutResponse(Master.createSlave(path.join(__dirname, 'data', 'simple-slave-b.js'))); // eslint-disable-line
      done(new Error('Should have thrown.'));
    } catch (e) {
      expect(e).to.be.an.instanceof(TypeError);
      expect(e.message).to.equal(
        'TimeoutResponse constructor expected argument #1 (request) to be a Request instance.'
      );
    }

    done();
  });
});
