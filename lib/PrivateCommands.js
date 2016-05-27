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
