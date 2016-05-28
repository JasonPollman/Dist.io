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
