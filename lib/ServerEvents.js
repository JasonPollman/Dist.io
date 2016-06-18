'use strict';
require('proto-lib').get('_');

const minimist = require('minimist');
const path = require('path');

const master = require('../').Master;
const commands = require('./Commands');
const Slave = require('./Slave');

let slaveIds = 10;
const remoteToLocalSlaveIdMap = {};

/**
 * Determines if the given message "m" is an init message.
 * @param {Object} m A socket message.
 * @return {Boolean|Array} Returns false if not, or the arguments from the init message if true.
 */
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

/**
 * Spawns a new slave.
 * @param {Socket} socket The socket.io instance.
 * @param {winston.Logger} log The logges instance associated with this process.
 * @param {Number} id The slave's remote id (from the remote master process).
 * @param {String} loc The location of the slave process to spawn.
 * @param {Obejct} options Options to spawn the slave process with.
 * @return {undefined}
 */
function initSlave(socket, log, id, loc, options) {
  const spawnPath = path.isAbsolute(loc) ? loc : path.resolve(path.join(__dirname, '..', loc));
  if (!options.forkOptions) options.forkOptions = {};
  options.forkOptions.silent = true;

  if (!remoteToLocalSlaveIdMap[socket.handshake.address]) remoteToLocalSlaveIdMap[socket.handshake.address] = {};
  remoteToLocalSlaveIdMap[socket.handshake.address][id] = slaveIds++;

  options.args.forEach((arg, i) => {
    if (/--dist-io-slave-id/.test(arg)) {
      options.args[i] = `--dist-io-slave-id=${remoteToLocalSlaveIdMap[socket.handshake.address][id]}`;
    }
  });

  log.spawn(`${socket.handshake.address} ...spawning... ${spawnPath}.`);
  const slave = master.createSlave(spawnPath, options);

  // Pass along stdout and stderr to the remote client...
  slave.on('stdout', m => socket.emit('stdout', m));
  slave.on('stderr', m => socket.emit('stderr', m));

  // Pass along exit and close messages to the remote client...
  slave.on('exited', () => socket.emit('remote slave exited', slave.id));
  slave.on('closed', () => socket.emit('remote slave closed', slave.id));
}

/**
 * Couples events between the given socket.io socket and the client.
 * @param {MasterProxyServer} server The MasterProxyServer instance.
 * @param {Object} socket A socket.io socket.
 * @param {winston.Logger} log A winston logger for logging purposes.
 * @return {undefined}
 */
function addSlaveServerEvents(server, socket, log) {
  const respond = {
    with: {
      /**
       * Send an error back to the client.
       * @param {Number} sid The slave id this error is in response to.
       * @param {String|Error} e The error to send.
       * @return {undefined}
       */
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

      /**
       * Respond to a request successfully.
       * @param {Response} res The response from the slave.
       * @return {undefined}
       */
      success: (res) => {
        socket.emit('message', res.raw);
      },
    },
  };

  // Handle disconnect...
  socket.on('disconnect', () => {
    remoteToLocalSlaveIdMap[socket.handshake.address] = undefined;
    log.disconnect(`${socket.handshake.address} disconnected.`);
  });

  // Handle messages from the client...
  socket.on('message', m => {
    const args = isInitMessageGetArgsOrFalse(m);

    if (args) {
      const id = args['dist-io-slave-id'];

      try { // Attempt to start the new slave process...
        initSlave(socket, log, id, m.path, m.options);
      } catch (e) {
        respond.with.error(id, e);
      }
    } else { // Proxy command to master on this machine...
      const localId = remoteToLocalSlaveIdMap[socket.handshake.address][m.for];
      const slave = master.slave(localId);

      if (!slave) {
        respond.with.error(m.for, new ReferenceError(`No slave with id ${m.for} exists!`));
        return;
      }

      if (Slave.isMasterMessage(m)) {
        log.verbose(`${socket.handshake.address} executing task "${m.command}" with slave L-${localId} (R-${m.for}).`);

        switch (m.command) {
          case '__dist.io__exit__': m.command = commands.EXIT; break;
          case '__dist.io__ack__': m.command = commands.ACK; break;
          case '__dist.io__null__': m.command = commands.NULL; break;
          default: /* Noop */
        }

        slave.exec(m.command, m.data, m.meta)
          .then(res => {
            // Send the results back to the remote master.
            respond.with.success(res);
            // If we got the command to exit, close the socket connection.
            switch (m.command) {
              case commands.EXIT:
                remoteToLocalSlaveIdMap[socket.handshake.address] = undefined;
                return socket.disconnect();

              default: return 0; /* Noop */
            }
          })
          .catch(e => {
            respond.with.error(m.for, e);
          });
      } else { // Invalid message sent, disconnect the client...
        log.error(`Client @${socket.handshake.address} send an invalid/malformed request, disconnecting.`);
      }
    }
  });
}

module.exports = addSlaveServerEvents;
