/**
 * @fileoverview Winston logger configuration for HotWheels application
 * @requires winston
 * @requires winston-daily-rotate-file
 * @requires path
 * @requires fs
 */

/**
 * @namespace Logger
 * @description Custom logging implementation using Winston. Use Baretrail log viewer to view logs.
 * @see {@link https://github.com/winstonjs/winston}
 * @see {@link https://www.baremetalsoft.com/baretail/}
 */

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');
require('winston-daily-rotate-file');

/* -------------------------------------------------------------------------- */

/**
 * @type {string}
 * @description Path to the logs directory in project root
 */
const logsDir = path.join(__dirname, '../../../logs');

/**
 * @function ensureLogsDirectory
 * @description Creates the logs directory if it doesn't exist
 */
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}


/**
 * @type {Object}
 * @description Winston logger configuration
 * @property {string} level - Logging level (debug, info, warn, error)
 * @property {Object} format - Log format configuration
 * @property {Array} transports - Log output destinations
 */
const logger = createLogger({
  level: 'debug',   // debug, info, warn, error
  format: format.combine(
    format.errors({ stack: true }),
    format.splat(),
    format.timestamp(),
    format((info) => {
      // Pad the level before colorization
      info.level = info.level.padEnd(5, ' ');
      return info;
    })(),
    format.colorize(),
    format.printf((info) => {
      const { level, message, timestamp } = info;
      const moduleName = info.module || 'root';
      const base = `${timestamp} [${level}] [${moduleName}]: ${message}`;

      const splat = info[Symbol.for('splat')];
      const splatText = splat && splat.length
        ? splat.map((entry) => {
          if (entry instanceof Error && entry.stack) {
            return `\n${entry.stack}`;
          }
          if (typeof entry === 'object') {
            return `\n${JSON.stringify(entry, null, 2)}`;
          }
          return ` ${entry}`;
        }).join('')
        : '';

      const stackText = info.stack ? `\n${info.stack}` : '';

      return `${base}${splatText}${stackText}`;
    })
  ),

  // transports allow the log to be written to multiple destinations
  transports: [
    // Console output
    new transports.Console(),

    // File output - new file each day
    new transports.File({
      filename: path.join(logsDir, `server-${new Date().toISOString().split('T')[0]}.log`)
    }),
    new transports.DailyRotateFile({
      filename: path.join(logsDir, 'server-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});




/* -------------------------------------------------------------------------- */

/**
 * @function createModuleLogger
 * @description Creates a child logger instance for a specific module
 * @param {string} moduleName - The name of the module creating the logger
 * @returns {Object} A Winston logger instance configured for the specific module
 */
const createModuleLogger = (moduleName) => {
  return logger.child({ module: moduleName });
};


/**
 * @type {Function}
 * @description Original console.log function
 */
const originalConsoleLog = console.log;

/**
 * @type {Function}
 * @description Original console.error function
 */
const originalConsoleError = console.error;

/**
 * @type {Function}
 * @description Original console.warn function
 */
const originalConsoleWarn = console.warn;

/**
 * @type {Function}
 * @description Original console.info function
 */
const originalConsoleInfo = console.info;

/**
 * @function console.log
 * @description Override console.log to use Winston logger
 * @param {...*} args - Arguments to log
 */
console.log = function () {
  logger.info(Array.from(arguments).join(' '));
  originalConsoleLog.apply(console, arguments);
};

/**
 * @function console.error
 * @description Override console.error to use Winston logger
 * @param {...*} args - Arguments to log
 */
console.error = function () {
  logger.error(Array.from(arguments).join(' '));
  originalConsoleError.apply(console, arguments);
};

/**
 * @function console.warn
 * @description Override console.warn to use Winston logger
 * @param {...*} args - Arguments to log
 */
console.warn = function () {
  logger.warn(Array.from(arguments).join(' '));
  originalConsoleWarn.apply(console, arguments);
};

/**
 * @function console.info
 * @description Override console.info to use Winston logger
 * @param {...*} args - Arguments to log
 */
console.info = function () {
  logger.info(Array.from(arguments).join(' '));
  originalConsoleInfo.apply(console, arguments);
};

/* -------------------------------------------------------------------------- */

/**
 * @exports logger
 * @description Exports the configured Winston logger instance and createModuleLogger function
 * @type {Object}
 */
module.exports = {
  logger,
  createModuleLogger
};

logger.debug("Log started. Logs saved at " + logsDir);
