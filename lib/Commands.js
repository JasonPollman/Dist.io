/**
 * @file
 * Common commands that the slave/master classes will use.
 * @copyright © 2016 Jason James Pollman
 */

/**
 * A set of symbols used for common commands to send to the slave process.
 * @module DistIO/Commands
 */

/**
 * The command for the slave to gracefully exit.
 * @type {Symbol}
 */
exports.EXIT = Symbol();

/**
 * A command that does nothing.
 * @type {Symbol}
 */
exports.NULL = Symbol();

/**
 * An acknowledgement command.
 * @type {Symbol}
 */
exports.ACK = Symbol();

/**
 * A remote kill SIGINT command — for remote slaves only.
 * @type {Symbol}
 */
exports.REMOTE_KILL_SIGINT = Symbol();

/**
 * A remote kill SIGTERM command — for remote slaves only.
 * @type {Symbol}
 */
exports.REMOTE_KILL_SIGTERM = Symbol();

/**
 * A remote kill SIGHUP command — for remote slaves only.
 * @type {Symbol}
 */
exports.REMOTE_KILL_SIGHUP = Symbol();

/**
 * A remote kill SIGKILL command — for remote slaves only.
 * @type {Symbol}
 */
exports.REMOTE_KILL_SIGKILL = Symbol();

/**
 * A remote kill SIGBREAK command — for remote slaves only.
 * @type {Symbol}
 */
exports.REMOTE_KILL_SIGBREAK = Symbol();

/**
 * A remote kill SIGPIPE command — for remote slaves only.
 * @type {Symbol}
 */
exports.REMOTE_KILL_SIGPIPE = Symbol();

/**
 * A remote kill SIGSTOP command — for remote slaves only.
 * @type {Symbol}
 */
exports.REMOTE_KILL_SIGSTOP = Symbol();

/**
 * Gets the remote kill command specified by the "singal" param — for remote slaves only.
 * @param {String} signal The command symbol to retrieve for the given singal.
 * @return {Symbol} The symbol for the given singal.
 */
exports.REMOTE_KILL = (signal) => {
  if (!exports[`REMOTE_KILL_${signal.toUpperCase()}`]) throw new Error(`Unknown kill signal "${signal.toUpperCase()}"`);
  return exports[`REMOTE_KILL_${signal.toUpperCase()}`];
};
