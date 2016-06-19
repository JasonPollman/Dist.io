/* eslint-env node, mocha */
/* eslint-disable prefer-arrow-callback, func-names */
'use strict';

const commands = require('../lib/Commands');
const expect = require('chai').expect;

describe('Commands', function () {
  describe('Commands.REMOTE_KILL', function () {
    it('Should throw if an unknown signal is passed', () => {
      expect(commands.REMOTE_KILL.bind(commands, 'foo')).to.throw(Error);
      expect(commands.REMOTE_KILL.bind(commands, '')).to.throw(Error);
      expect(commands.REMOTE_KILL.bind(commands, [])).to.throw(Error);
      expect(commands.REMOTE_KILL.bind(commands, () => {})).to.throw(Error);
      expect(commands.REMOTE_KILL.bind(commands, 123)).to.throw(Error);
    });

    it('Should *not* throw if an known signal is passed', () => {
      expect(commands.REMOTE_KILL.bind(commands, 'SIGINT')).to.not.throw(Error);
      expect(commands.REMOTE_KILL.bind(commands, 'SIGKILL')).to.not.throw(Error);
      expect(commands.REMOTE_KILL.bind(commands, 'SIGTERM')).to.not.throw(Error);
      expect(commands.REMOTE_KILL.bind(commands, 'SIGBREAK')).to.not.throw(Error);
      expect(commands.REMOTE_KILL.bind(commands, 'SIGSTOP')).to.not.throw(Error);
      expect(commands.REMOTE_KILL.bind(commands, 'SIGHUP')).to.not.throw(Error);
    });
  });
});
