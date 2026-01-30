/**
 * @fileoverview ESP controller for handling serial communication
 * @module HW_ESP
 * @requires serialport
 * @requires winston
 */

const { createModuleLogger } = require('../config/logger.js');
const logger = createModuleLogger('ESP_');
let serialPort = null;
let dataBuffer = '';

///////////////////////////////////////////////////////////////////////////////////////

/**
 * @function HW_ESP_SIO
 * @description Handles SocketIO events for ESP communication
 * @param {Object} GLOBALS - The global context object
 */
function HW_ESP_SIO(GLOBALS) {
  logger.debug("LOADED HW_ESP_SIO");
  
  GLOBALS.SIO.sockets.on('connection', (socket) => {
    socket.on('SERIAL_IN', (data) => {
      logger.debug("SocketIO ESP: " + data);
    });
  });
}

/**
 * @function handleSerialData
 * @description Handles serial data from the ESP
 * @param {Object} GLOBALS - The global context object
 * @param {Buffer} data - The serial data from the ESP
 */
function handleSerialData(GLOBALS, data) {
  dataBuffer += data.toString();
  let messages = dataBuffer.split('#');

  // Process all complete messages, split by #
  for (let i = 0; i < messages.length - 1; i++) {
    let serialmsg = messages[i].trim();
    logger.debug("serialIncomming:" + serialmsg);

    // forward incoming serial data to SIO
    const FROM = "HWSERVER";
    const ACTION = "NOACTION";
    const MSG = serialmsg;

    // forward message to SIO.ejs
    GLOBALS.SIO.emit("SERIAL_IN", FROM + "___" + ACTION + "___" + MSG);
  }
  
  // Keep the last (possibly incomplete) message in the buffer
  dataBuffer = messages[messages.length - 1];
}

/**
 * @function handleSerialError
 * @description Handles serial errors
 * @param {string} portName - The name of the serial port
 * @param {Error} err - The error object
 */
function handleSerialError(portName, err) {
  logger.error("Serialport " + portName + " error: " + err.message);
}

/**
 * @function initializeSerialPort
 * @description Initializes the serial port connection with the ESP
 * @param {Object} config - Configuration object containing serial port settings
 * @returns {Promise<serialPort>} Promise that resolves with the SerialPort instance
 */
function SERIAL_INIT(GLOBALS, config) {
  return new Promise((resolve, reject) => {
    const SerialPort = require('serialport').SerialPort;

    // List available serial ports
    // SerialPort.list().then(ports => {
    //   if (ports.length === 0) {
    //     logger.warn("No serial ports available");
    //   } else {
    //     logger.debug("Available serialports");
    //     ports.forEach(port => {
    //       logger.debug(`Serialport: ${port.path}, manufacturer: ${port.manufacturer || 'N/A'}`);
    //     });
    //   }
    // }).catch(err => {
    //   logger.error("SerialPort error:" + err);
    // });

    const portName = config.serialConfig.port;

    serialPort = new SerialPort({
      path: portName,
      baudRate: config.serialConfig.baudRate
    });

    // Bind event handlers with proper context
    const dataHandler = (data) => handleSerialData(GLOBALS, data);

    const errorHandler = (err) => {
      handleSerialError(portName, err);
      // Clean up event listeners
      serialPort.removeListener('data', dataHandler);
      serialPort.removeListener('error', errorHandler);
      reject(err);
    };

    const openHandler = () => {
      logger.info(`Serial port ${portName} opened.`);
      // Remove the open handler since we only need it once
      serialPort.removeListener('open', openHandler);
      // resolve the promise when the serial port is opened
      resolve(serialPort);
    };

    // Set up event listeners
    serialPort.on('data', dataHandler);
    serialPort.on('error', errorHandler);
    serialPort.on('open', openHandler);
  });
}

module.exports = {
  SERIAL_INIT,
  HW_ESP_SIO
};
