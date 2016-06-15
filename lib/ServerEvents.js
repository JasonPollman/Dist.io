'use strict';
require('proto-lib').get('_');

const minimist = require('minimist');
const master = require('../').Master;
const path = require('path');

function isInitMessageGetArgsOrFalse(m) {
  if (typeof m === 'object'
    && typeof m.count === 'number'
    && typeof m.path === 'string'
    && typeof m.options === 'object'
    && m.options.args instanceof Array
  ) {
    const args = minimist(m.options.args, { number: ['dist-io-slave-id'] });
    if (args['dist-io-slave-id']._.isNumeric()) return args;
  }
  return false;
}

function initSlave(socket, loc, options) {
  const spawnPath = path.isAbsolute(loc) ? loc : path.resolve(path.join(__dirname, '..', loc));
  if (!options.forkOptions) options.forkOptions = {};
  options.forkOptions.silent = true;
  const slave = master.createSlave(spawnPath, options);

  slave.on('stdout', m => {
    console.log('>>>>>>>>>>>>>>>>>>>>>>>>>');
    socket.emit('stdout', m);
  });
  slave.on('stderr', m => socket.emit('stderr', m));

  slave.on('exited', () => socket.emit('slave exited', slave.id));
  slave.on('closed', () => socket.emit('slave closed', slave.id));
}

function addSlaveServerEvents(server, socket, log) {
  const respond = {
    with: {
      error: (sid, e) => {
        log.warn(`Sending exception message from slave ${sid} to master @${socket.handshake.address}`);
        if (typeof e === 'string') e = new Error(e);
        socket.emit('message', {
          from: sid,
          title: 'SlaveIOException',
          sent: Date.now(),
          error: { name: `RemoteSlaveError: ${e.name}`, message: e.message, stack: e.stack },
        });
      },
    },
  };

  socket.on('message', m => {
    const args = isInitMessageGetArgsOrFalse(m);
    if (args) {
      try {
        initSlave(socket, m.path, m.options);
      } catch (e) {
        respond.with.error(args['dist-io-slave-id'], e);
      }
    } else {
      master.slave(m.for).exec(m.command)
        .then(res => {
          socket.emit('message', res.raw);

          switch (m.command) {
            case '__dist.io__exit__':
              socket.disconnect();
          }
        });
    }
  });
}

module.exports = addSlaveServerEvents;
