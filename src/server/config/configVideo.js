const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('VIDE');
logger.debug("LOADED CONFIG VIDEO");

/**
 * @fileoverview Configuration module for the Hot Wheels project
 * @module config
 * @description Contains configuration settings for server, database, robot serial port,
 * application parameters, and video timings
 */

/**
 * Video segment timings
 * @typedef {Object} VideoTimings
 * @property {number} intro - Intro segment duration/offset
 * @property {number} start - Start segment duration/offset
 * @property {number} drop - Drop segment duration/offset
 * @property {number} looping - Looping segment duration/offset
 * @property {number} uTurn - U-turn segment duration/offset
 * @property {number} knot - Knot segment duration/offset
 * @property {number} flatrun - Flat run segment duration/offset
 * @property {number} jumps - Jumps segment duration/offset
 * @property {number} leaderboard - Leaderboard segment duration/offset
 * @property {number} outro - Outro segment duration/offset
 */

/**
 * Video configuration options
 * @typedef {Object} VideoConfig
 * @property {VideoTimings} durations - Duration settings for various video segments in seconds
 * @property {VideoTimings} offsets - Offset timings for various video segments in seconds
 */
const videoConfig = {
    /** Duration settings for various video segments in seconds */
    durations: {
        intro: 2,
        start: 2,
        drop: 2,
        looping: 2,
        uTurn: 2,
        knot: 2,
        flatrun: 2,
        jumps: 2,
        leaderboard: 2,
        outro: 2
    },
    /** Offset timings for various video segments in seconds */
    offsets: {
        intro: 0,
        start: 0.5,
        drop: 0,
        looping: 0,
        uTurn: 0,
        knot: 0,
        flatrun: 0,
        jumps: 0,
        leaderboard: 0,
        outro: 0
    }
};

/**
 * @typedef {Object} ConfigExports
 * @property {VideoConfig} videoConfig - Video timing configuration settings
 */

/** @type {ConfigExports} */
module.exports = {
    videoConfig,
};


