'use strict';
require('proto-lib').get('_');

/**
 * @module DistIO/ServerEvents
 */

const minimist = require('minimist');
const path = require('path');

const master = require('../').Master;
const commands = require('./Commands');
const Response = require('./Response');
const Slave = require('./Slave');

let slaveIds = 9000;

/**
 * Maps remote slave ids to server slave ips.
 * @type {Object<Number>}
 */
const remoteToLocalSlaveIdMap = {};

/**
 * An array of functions to start slaves that are waiting for server.maxConcurrentSlaves to
 * drop below the threshold.
 * @type {Array<Function>}
 */
const queuedSlaves = [];

/**
 * An array of queued tasks for the slaves waiting in the "queueSlaves" array.
 * @type {Object<Array>}
 */
const queuedSlaveTasks = {};

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
    return args;
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
 * @param {MasterProxyServer} server A MasterProxyServer instance.
 * @param {Socket} socket The socket.io instance.
 * @param {winston.Logger} log The logges instance associated with this process.
 * @param {Number} id The slave's remote id (from the remote master process).
 * @param {String} loc The location of the slave process to spawn.
 * @param {Obejct} options Options to spawn the slave process with.
 * @return {undefined}
 */
function initSlave(server, socket, log, id, loc, options) {
  const spawnPath = path.join(server.root, loc.replace(server.root, ''));
  if (!options.forkOptions) options.forkOptions = {};
  options.forkOptions.silent = true;

  options.args.forEach((arg, i) => {
    if (/--dist-io-slave-id/.test(arg)) {
      options.args[i] = `--dist-io-slave-id=${remoteToLocalSlaveIdMap[socket.id][id]}`;
    }
  });

  // Add remote id...
  options.args.push(`--dist-io-slave-remote-id=${id}`);
  log.spawn(`${socket.handshake.address}${socket.id} is forking ${spawnPath}.`);

  let slave;
  let killTimeout;

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
  slave.on('killed', () => socket.emit('remote slave killed', slave.id));
  slave.on('closed', () => socket.emit('remote slave closed', slave.id));

  slave.on('exited', () => {
    clearTimeout(msgTimeout);
    clearTimeout(killTimeout);

    msgTimeout = setTimeout(() => log.verbose(`Active slave count is now: ${master.slaveCount}`), 100);

    log.close(`${socket.handshake.address} has killed/closed slave S${slave.id} (R${id}).`);
    socket.disconnect();

    if (master.slaveCount < server.maxConcurrentSlaves) {
      const fn = queuedSlaves.shift();
      if (fn) {
        log.verbose(
          'Executing next slave in the task execution queue. ' +
          `${queuedSlaves.length} pending tasks)`
        );
        fn();
      }
    }
  });

  log.verbose(`Active slave count is now: ${master.slaveCount}`);
  queuedSlaveTasks[socket.id].forEach(fn => {
    log.verbose(`Executing queued task (${queuedSlaveTasks[socket.id]} pending)...`);
    fn();
  });

  if (server.killSlavesAfter > 0) {
    killTimeout = setTimeout(() => {
      log.warn(`Slave S${slave.id} (R${id}) has been killed (timeout of ${server.killSlavesAfter}ms exceeded).`);
      slave.kill('SIGKILL');
      queuedSlaveTasks[socket.id].forEach(fn => {
        log.verbose(`Executing queued task (${queuedSlaveTasks[socket.id]} pending)...`);
        fn();
      });
    }, server.killSlavesAfter);
  }
}

/**
 * Executes a task against a slave.
 * @param {winston.Logger} log The logges instance associated with this process.
 * @param {Object} m The original message from the remote master process.
 * @param {Socket} socket The socket.io instance.
 * @param {Number} id The slave's remote id (from the remote master process).
 * @param {Object} respond An abstraction around sending responses.
 * @return {undefined}
 */
function executeTask(log, m, socket, id, respond) {
  const slave = master.slave(id);
  if (!slave) throw new Error(`Slave with id ${id} not found`);

  if (Slave.isMasterMessage(m)) {
    log.verbose(
      `${socket.handshake.address} is ` +
      `executing task "${m.command}" with slave S${id} (R${m.for}).`
    );

    const originalCommand = m.command;
    const killMatch = m.command.match(/^__dist.io__remote__kill__([A-Z]+)__$/);

    // Delete any timeouts / catchAlls, they will be handled by the client master.
    if (m.meta.timeout) delete m.meta.timeout;
    if (m.meta.catchAll) delete m.meta.catchAll;

    if (killMatch) { // Request to forcefully kill the slave...
      log.warn(`${socket.handshake.address} has killed (${killMatch[1]}) slave S${id} (R${m.for}).`);
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

      responseError: (req, message) => {
        socket.emit('message', {
          title: 'SlaveIOResponse',
          sent: Date.now(),
          request: req,
          error: {
            name: 'RequestAborted',
            message,
          },
          data: undefined,
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
    delete queuedSlaveTasks[socket.id];
    // Kill any slaves not closed by the remote master...
    master.kill.group(socket.id);
  });

  // Handle messages from the client...
  socket.on('message', m => {
    const args = isInitMessageGetArgsOrFalse(m);

    if (args) {
      if (!remoteToLocalSlaveIdMap[socket.id]) remoteToLocalSlaveIdMap[socket.id] = {};
      remoteToLocalSlaveIdMap[socket.id][args['dist-io-slave-id']] = slaveIds++;
      queuedSlaveTasks[socket.id] = [];

      if (master.slaveCount < server.maxConcurrentSlaves) {
        initSlave(server, socket, log, args['dist-io-slave-id'], m.path, m.options);
      } else {
        queuedSlaves.push(() => {
          initSlave(server, socket, log, args['dist-io-slave-id'], m.path, m.options);
        });
      }
    } else { // Proxy command to master on this machine...
      const serverId = remoteToLocalSlaveIdMap[socket.id]
        ? remoteToLocalSlaveIdMap[socket.id][m.for]
        : -1;

      const slave = master.slave(serverId);

      if (!slave) {
        if (typeof remoteToLocalSlaveIdMap[socket.id][m.for] !== 'number') {
          respond.with.error(m.for, new ReferenceError(`No slave with id ${m.for} exists!`));
        } else {
          if (queuedSlaveTasks[socket.id]) {
            queuedSlaveTasks[socket.id].push(() => {
              executeTask(log, m, socket, serverId, respond);
            });
          } else {
            respond.with.responseError('Slave was killed or closed during request.');
          }
        }
      } else {
        executeTask(log, m, socket, serverId, respond);
      }
    }
  });
}

module.exports = addSlaveServerEvents;
