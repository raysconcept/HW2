
const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('-CF-');
logger.info("LOADED configMain.js");

// application selector; modules can vary per client
const camSystemRasp =false;
const camSystemGopro=false;

logger.info("============================================== APPLICATIONS");
logger.info("camSystemRasp:"+camSystemRasp);
logger.info("camSystemGopro:"+camSystemGopro);
logger.info("==============================================");
//

// utility functions
const toInt = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toFloat = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
};
/**
 * @fileoverview Configuration module for the Hot Wheels project
 * @module config
 * @description Contains configuration settings for server, database, robot serial port,
 * application parameters, and video timings
 */

/**
 * Server configuration options
 * @typedef {Object} ServerConfig
 * @property {number} port - Port number for the server (3001, 3000 for Android)
 * @property {string} corsOrigin - Allowed CORS origin
 */

const os = require('os');

function getNetworkIp() {
    try {
        const HW_interfaces = os.networkInterfaces();
        for (const HW_interfaceName of Object.keys(HW_interfaces)) {
            for (const HW_interface of HW_interfaces[HW_interfaceName]) {
                // IPv4 and not internal (not localhost)
                if (HW_interface.family === 'IPv4' && !HW_interface.internal) {
                    logger.info("IP is on:" + HW_interface.address);
                    return HW_interface.address;
                }
            }
        }
    } catch (err) {
        logger.error(`networkInterfaces failed (${err.message || err}); falling back to 127.0.0.1`);
    }
    return '127.0.0.1'; // fallback
}

const DEFAULT_SERVER_IP = getNetworkIp();//'192.168.0.187';
function isIpAvailable(ip) {
    if (!ip || ip === 'localhost') return false;

    try {
        const HW_interfaces = os.networkInterfaces();
        for (const HW_interfaceName of Object.keys(HW_interfaces)) {
            for (const HW_interface of HW_interfaces[HW_interfaceName]) {
                if (HW_interface.family === 'IPv4' && HW_interface.address === ip) {
                    return true;
                }
            }
        }
    } catch (err) {
        logger.error(`networkInterfaces failed (${err.message || err}); treating ${ip} as unavailable`);
    }
    return false;
}

const requestedBindIp = process.env.HW_SERVER_IP;
// Avoid crashing on interface lookup issues; just honor requested IP or fall back to defaults.
const serverBindIp = requestedBindIp || DEFAULT_SERVER_IP || '0.0.0.0';
const serverAdvertisedIp = process.env.HW_SERVER_IP_HOST || serverBindIp || DEFAULT_SERVER_IP;

const serverConfig = {
  /** Port number for the server (3001, 3000 for Android) */
  port: toInt(process.env.HW_SERVER_PORT, 3001),
  /** Allowed CORS origin */
  corsOrigin: process.env.HW_SERVER_CORS_ORIGIN || 'http://localhost',

  /** Server bind and advertised addresses */
  ip: serverAdvertisedIp,
  bindIp: serverBindIp,
  serverExitIfNoLan:true, /* exit server startup if lan is disconnected */
};

/**
 * Database configuration options
 * @typedef {Object} DbConfig
 * @property {string} host - Database host address
 * @property {string} user - Database username
 * @property {string} password - Database password
 * @property {string} database - Database name
 */
const dbConfig = {
  /** Database host address */
  host: process.env.HW_DB_HOST || 'localhost',
  /** Database username */
  user: process.env.HW_DB_USER || 'root',
  /** Database password */
  password: process.env.HW_DB_PASSWORD || '',
  /** Database name */
  //database: 'hw11_2_jazan'
  dbName: process.env.HW_DB_NAME || 'hw11_2_jazan',
  dbNameDev: process.env.HW_DB_NAME_DEV || 'hw11_dev'
};

/**
 * Serial port configuration options
 * @typedef {Object} SerialConfig
 * @property {string} port - Serial port identifier
 * @property {number} baudRate - Communication speed in bits per second
 */
const serialConfig = {
  /** Serial port identifier */
  port: process.env.HW_SERIAL_PORT || 'COM5',
  /** Communication speed in bits per second */
  baudRate: toInt(process.env.HW_SERIAL_BAUDRATE, 115200)
};

/**
 * ESP32 TCP configuration options
 * @typedef {Object} EspConfig
 * @property {string} hostESP1 - ESP32 IP address
 * @property {number} portESP1 - ESP32 TCP port
 * @property {number} reconnectDelay - Delay between reconnection attempts in milliseconds
 * @property {boolean} enabled - flag if the robot is enabled or not
 */
const espConfig = {
  // ESP1 // config of devices moved to configDevices.js 

  // REPLACE BY configDevices
  // hostESP1: '192.168.1.47', // see serial monitor on ESP to find the correct hostESP address
  // portESP1: 3002, // ESP32 TCP port 

};


/**
 * Robot configuration options
 * @typedef {Object} RobotConfig 
 * @property {number} robotRepeatInterval - Interval between robot pick attempts in milliseconds (default: 10 seconds)
 * @property {string} host - Robot controller IP address
 * @property {number} port - Robot controller port number
 * @property {number} sleeptime - Sleep duration between robot actions in seconds
 * @property {number} deltaX - X-axis movement increment in millimeters
 * @property {number} deltaY - Y-axis movement increment in millimeters  
 * @property {number} homeX - Home X position in millimeters (relative to left top)
 * @property {number} homeY - Home Y position in millimeters (relative to left top)
 * @property {number} calibrationAngleDEG - Front view calibration angle in degrees
 * @property {number} safeOffsetForTest - Safety margin for testing in meters
 * @property {number} PICK_HOVER_Z - Hover height for picking in meters
 * @property {number} PICK_MOVE_IN_DISTANCE - Forward movement distance from hover position in meters
 * @property {number} PICK_MOVE_UP_DISTANCE - Upward movement after picking in meters
 * @property {number} PICK_MOVE_OUT_DISTANCE - Retraction distance in meters
 * @property {number} PICK_ANGLEDEG - Picking angle in degrees
 * @property {boolean} enabled - flag if the robot is enabled or not
 */
const robotConfig = {
  /** testing vending process when robot is not available, for development */
  overrideRobotAvailabilityForTesting: toBool(process.env.HW_ROBOT_OVERRIDE_AVAILABLE, false),
  /** Log robot actions */
  logRobotAction: toBool(process.env.HW_ROBOT_LOG_ACTIONS, true),
  logRobotActionUpdateDisplay: toBool(process.env.HW_ROBOT_LOG_ACTIONS_BROADCAST, false),
  /** Delay before attempting automatic reconnect (ms) */
  reconnectDelayMs: toInt(process.env.HW_ROBOT_RECONNECT_DELAY_MS, 5000),
  /** Machine configuration selection */
  // machineConfigFileName: '../config/configRobot/HW_robot_config.js', // HW_10_USA, HW_KSA_TAIF, HW_KSA_TABUK, HW_KSA_MAKKAH, HW_KSA_JAZAN, HW_KSA_MADINAH
  machineConfigFileName: '../config/configRobot.js',/** Robot host address */
  host: process.env.HW_ROBOT_HOST || '192.168.1.11',
  /** Robot port number */
  port: toInt(process.env.HW_ROBOT_PORT, 30002),
  /** Robot feedback port number */
  feedbackPort: toInt(process.env.HW_ROBOT_FEEDBACK_PORT, 30003),
  /** Change in angle for terminal calibration, in degrees */
  calibrationAngleDelta: toFloat(process.env.HW_ROBOT_CALIBRATION_ANGLE_DELTA, 0.2),
  /** Number of tracks */
  /** TODO: RAY: THIS SHOULD BE NR OF DROPOFFS. basic=2, extended=4 MOVE TO VENDINGCONFIG */
  //numTracks: 2
  enabled: toBool(process.env.HW_ROBOT_ENABLED, true)
};


/**
 * Dashboard configuration options
 * @typedef {Object} VendingConfig
 * @property {number} qrCodeCreateNum - Number of QR codes to create
 * @property {string} qrCodePath - Path to the QR code images
 */
const vendingConfig = {
  /** Number of QR codes to create */
  qrCodeCreateNum: 20,
  /** Path to the QR code images */
  qrCodePath: "public/qr/",
  /** Path to the QR code images */
  qrCodePathOperator: "public/qrOperator/",
  /** Number of cars per order */
  /// TODO  
  //numCarsToPickup: 3,
  /** max number of cars in a cassette (different for basic and extended version) */

  //
  /** Maximum number of cars that can be stored in a cassette */
  /// TODO  
  maxCarsInCassette: 8,
  maxAmountCarsInCassette: 8,

  /** include a bonus car */
  hasBonusCar: false,
  /** dropoffs */
  /// TODO 
  numTracks: 2,

  /** Interval for updating cue line in milliseconds */
  timeUpdateCueLine: 2000,
  /** Interval for updating order processor in milliseconds */
  timeUpdateOrderProcessor: 2000,

  /** Site location identifier, used in Frontend Terminals, GLOBALS.SITE_LOCATION*/
  // siteLocation: 'locationToBeUpdatedInConfig'
}

/**
 * Dashboard configuration options
 * @typedef {Object} SecurityConfig
 * @property {number} qrCodeCreateNum - Number of QR codes to create
 * @property {string} qrCodePath - Path to the QR code images
 */
const securityConfig = {
  /** Use authentication for certain terminals */
  useAuthentication: false,
};

/**
 * @typedef {Object} ConfigExports
 * @property {ServerConfig} serverConfig - Server configuration settings
 * @property {DbConfig} dbConfig - Database configuration settings
 * @property {SerialConfig} serialConfig - Serial port configuration settings 
 */

/** @type {ConfigExports} */
module.exports = {
  serverConfig,
  securityConfig,
  dbConfig,
  vendingConfig,
  robotConfig,
  serialConfig,
  espConfig
};
