/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const Slave = require('../lib/Slave');
const path = require('path');
const expect = require('chai').expect;
const exec = require('child_process').exec;
const pgrep = 'pgrep';

describe('Slave Class', function () {
  it('Should spawn a new slave, then kill it', function (done) {
    this.timeout(5500);
    this.slow(5000);

    const location = path.join(__dirname, 'data', 'simple-slave-a.js');
    const slave = new Slave(location);
    expect(slave).to.be.an.instanceof(Slave);
    expect(slave.id).to.match(/^\d+$/);
    expect(slave.alias).to.match(/^0x[a-z0-9]+$/);
    expect(slave.location).to.equal(location);
    expect(slave.toString()).to.equal(`Slave (id=${slave.id}, alias=${slave.alias})`);
    expect(slave.hasExited).to.equal(false);
    expect(slave.isConnected).to.equal(true);
    expect(slave.spawnError).to.equal(null);

    setTimeout(() => {
      exec(`${pgrep} SimpleSlaveA`, function (err, stdout) {
        expect(err).to.equal(null);
        expect(stdout.trim()).to.match(/^\d+\s*$/m);
        expect(slave.kill()).to.equal(slave);
        exec(`${pgrep} SimpleSlaveA`, function (e, sout) {
          expect(err).to.equal(null);
          expect(sout.trim()).to.match(/^$/);
          expect(slave.id).to.match(/^\d+$/);
          expect(slave.alias).to.match(/^0x[a-z0-9]+$/);
          expect(slave.location).to.equal(location);
          expect(slave.toString()).to.equal(`Slave (id=${slave.id}, alias=${slave.alias})`);
          expect(slave.hasExited).to.equal(true);
          expect(slave.isConnected).to.equal(false);
          expect(slave.spawnError).to.equal(null);
          done();
        });
      });
    }, 2000);
  });
});
