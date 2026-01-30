/**
 * @module auth
 * @description Authentication middleware for HOTWHEELS terminals.
 * This module handles password-based authentication for different terminals in the system.
 * Each terminal can have its own password, and some terminals may not require authentication.
 */

const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('AUTH');

/**
 * @constant {Object} TERMINAL_PASSWORDS
 * @description Map of terminal names to their corresponding passwords.
 * Empty string values indicate no password is required for that terminal.
 */
const TERMINAL_PASSWORDS = {

    // developer / install / calibration
    'HW_DEVELOPER': 'dev123',
    'HW_ROBOT': 'robot123',
    // robot calibration has additional password: calibration123

    // vending administration
    'HW_INVENTORY': 'admin123',
    'HW_ORDERS': 'admin123',
    'HW_QR': 'admin123',

    // daily machine operation
    'HW_AVFX': 'operation123',
    'HW_AVFX_SUM': 'operation123',
    //'HW': 'operation123', // No password required, operator logs in via operator QR tag

    // public (no password)
    //'HW_VENDING': '',  // No password required
    //'HW_ORDERCUE': '',  // No password required
    //'HW_LEADERBOARD': ''  // No password required

};

/**
 * Determines if a given path requires authentication.
 * @param {string} path - The request path to check
 * @returns {boolean} True if the path requires authentication, false otherwise
 */
function requiresAuth(path) {
    const terminal = path.split('/')[1];
    return TERMINAL_PASSWORDS[terminal] !== undefined && TERMINAL_PASSWORDS[terminal] !== '';
}

/**
 * Middleware function to check password authentication.
 * If authentication is required and the password is correct, proceeds to the next middleware.
 * If authentication fails, renders a password form.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function checkPassword(req, res, next) {
    const path = req.path;

    // Skip authentication for paths that don't require it
    if (!requiresAuth(path)) {
        return next();
    }

    // Check if password is provided in the request
    const providedPassword = req.body.password;
    // Extract terminal name from URL path
    const terminal = path.split('/')[1];
    const correctPassword = TERMINAL_PASSWORDS[terminal];

    logger.debug(`Terminal: ${terminal}, Requires password: ${providedPassword ? 'yes' : 'no'}`);

    // Check if provided password matches the correct one
    if (providedPassword === correctPassword) {
        logger.info(`Password correct for ${terminal}`);
        return next();
    }

    // Render password form if authentication failed
    logger.debug(`Password required for ${terminal}`);
    res.render('__HW_PASSWORD', {
        PATH: path,
        TERMINAL: terminal,
        ERROR: providedPassword ? 'Incorrect password' : null
    });
}

/**
 * @exports auth
 * @type {Object}
 * @property {Function} requiresAuth - Function to check if a path requires authentication
 * @property {Function} checkPassword - Middleware function to handle password authentication
 */
module.exports = {
    requiresAuth,
    checkPassword
}; 