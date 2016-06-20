'use strict';
require('proto-lib').get('_');

const minimist = require('minimist');
const path = require('path');

const master = require('../').Master;
const commands = require('./Commands');
const Response = require('./Response');
const Slave = require('./Slave');

let slaveIds = 9000;
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
 * A timeout to prevent multiple slave count messages from triggering at once...
 * @type {Timeout|null}
 */
let msgTimeout = null;

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

  if (!remoteToLocalSlaveIdMap[socket.id]) remoteToLocalSlaveIdMap[socket.id] = {};
  remoteToLocalSlaveIdMap[socket.id][id] = slaveIds++;

  options.args.forEach((arg, i) => {
    if (/--dist-io-slave-id/.test(arg)) {
      options.args[i] = `--dist-io-slave-id=${remoteToLocalSlaveIdMap[socket.id][id]}`;
    }
  });

  // Add remote id...
  options.args.push(`--dist-io-slave-remote-id=${id}`);

  log.spawn(`${socket.handshake.address}${socket.id} is forking ${spawnPath}.`);

  let slave;
  try {
    options.group = socket.id;
    slave = master.createSlave(spawnPath, options);
  } catch (e) {
    socket.emit('spawn failed', e.message, spawnPath, options);
    return;
  }

  socket.emit('remote pid', slave.pid);

  // Pass along stdout and stderr to the remote client...
  slave.on('stdout', m => socket.emit('stdout', m));
  slave.on('stderr', m => socket.emit('stderr', m));

  // Pass along exit and close messages to the remote client...
  slave.on('exited', () => socket.emit('remote slave exited', slave.id));
  slave.on('killed', () => log.verbose(`Active slave count is now: ${master.slaveCount}`));

  slave.on('closed', () => {
    clearTimeout(msgTimeout);
    msgTimeout = setTimeout(() => log.verbose(`Active slave count is now: ${master.slaveCount}`), 100);

    socket.emit('remote slave closed', slave.id);
  });

  log.verbose(`Active slave count is now: ${master.slaveCount}`);
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
    delete remoteToLocalSlaveIdMap[socket.id];

    // Kill any slaves not closed by the remote master...
    master.kill.group(socket.id);
    log.disconnect(`Master process ${socket.handshake.address}${socket.id} disconnected.`);
  });

  // Handle messages from the client...
  socket.on('message', m => {
    const args = isInitMessageGetArgsOrFalse(m);

    if (args) {
      initSlave(socket, log, args['dist-io-slave-id'], m.path, m.options);
    } else { // Proxy command to master on this machine...
      const serverId = remoteToLocalSlaveIdMap[socket.id]
        ? remoteToLocalSlaveIdMap[socket.id][m.for]
        : -1;

      const slave = master.slave(serverId);

      if (!slave) {
        respond.with.error(m.for, new ReferenceError(`No slave with id ${m.for} exists!`));
        return;
      }

      if (Slave.isMasterMessage(m)) {
        log.verbose(
          `${socket.handshake.address} is ` +
          `executing task "${m.command}" with slave L-${serverId} (R-${m.for}).`
        );

        const originalCommand = m.command;
        const killMatch = m.command.match(/^__dist.io__remote__kill__([A-Z]+)__$/);

        // Delete any timeouts / catchAlls, they will be handled by the client master.
        if (m.meta.timeout) delete m.meta.timeout;
        if (m.meta.catchAll) delete m.meta.catchAll;

        if (killMatch) { // Request to forcefully kill the slave...
          log.warn(`${socket.handshake.address} has killed ${killMatch[1]} slave L${serverId} (R${m.for}).`);
          slave.kill(killMatch[1]);

          respond.with.success(new Response({
            title: 'SlaveIOResponse',
            sent: Date.now(),
            request: m,
            error: null,
            data: true,
            [m.secretId]: m.secretNumber,
          }));

          delete remoteToLocalSlaveIdMap[socket.id][m.for];
          socket.disconnect();
        } else { // Send standard slave request
          switch (m.command) {
            case '__dist.io__exit__': m.command = commands.EXIT; break;
            case '__dist.io__ack__': m.command = commands.ACK; break;
            case '__dist.io__null__': m.command = commands.NULL; break;
            default: /* Noop */
          }

          slave.exec(m.command, m.data, m.meta)
            .then(res => {
              // Re-establish the command, since we might have replaced with a symbol...
              const newCommand = m.command;
              m.command = originalCommand;
              let responseError = null;

              // Determine if we have a response error...
              if (res.error instanceof Error) responseError = res.error.raw;

              // Send the results back to the remote master.
              respond.with.success(new Response({
                title: 'SlaveIOResponse',
                sent: Date.now(),
                request: m,
                error: responseError,
                data: res.data,
                [m.secretId]: m.secretNumber,
              }));

              // If we got the command to exit, close the socket connection.
              switch (newCommand) {
                case commands.EXIT:
                  log.close(`${socket.handshake.address} has closed slave L${serverId} (R${m.for}).`);
                  delete remoteToLocalSlaveIdMap[socket.id][m.for];
                  return socket.disconnect();

                default: return null; /* Noop */
              }
            })
            .catch(e => {
              log.error(`Error executing task ${originalCommand}: ${e.message}`);
              respond.with.error(m.for, e);
            });
        }
      } else { // Invalid message sent, disconnect the client...
        log.error(`Client @${socket.handshake.address} send an invalid/malformed request, disconnecting.`);
        socket.disconnect();
      }
    }
  });
}

module.exports = addSlaveServerEvents;
