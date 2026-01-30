const { createModuleLogger } = require('./logger');
const logger = createModuleLogger('-CFD');
logger.info(" LOADED configDevices.js");

/**
 * @fileoverview Device configuration module for ESP32 and Raspberry Pi devices
 * @module configDevices
 * @description Contains configuration settings for ESP32 and Raspberry Pi devices
 * with their IDs, names, network settings, and types
 */

/**
 * ESP32 device configuration
 * @typedef {Object} ESP32Device
 * @property {string} id - Unique identifier for the ESP32
 * @property {string} name - Human-readable name for the device
 * @property {string} host - IP address of the ESP32
 * @property {number} port - TCP port for communication
 * @property {string} type - Device type/category
 * @property {string} description - Description of device function
 */

/**
 * Raspberry Pi device configuration
 * @typedef {Object} RaspberryPiDevice
 * @property {string} id - Unique identifier for the Raspberry Pi
 * @property {string} name - Human-readable name for the device
 * @property {string} host - IP address of the Raspberry Pi
 * @property {number} port - TCP/HTTP port for communication
 * @property {string} type - Device type/category
 * @property {string} description - Description of device function
 */

/**
 * Device configuration options
 * @typedef {Object} DeviceConfig
 * @property {ESP32Device[]} esp32Devices - Array of ESP32 device configurations
 * @property {RaspberryPiDevice[]} raspberryPiDevices - Array of Raspberry Pi device configurations
 */
/*
  // hostESP1: '192.168.1.47', // see serial monitor on ESP to find the correct hostESP address
  // portESP1: 3002, // ESP32 TCP port 
*/
const configDevicesList = {
    /** ESP32 device configurations */ 
    esp32Devices: [
        {
            id: 'esp_led_controller',
            name: 'ESP32 LED Controller',
            //host: '192.168.1.47',
            host: '192.168.1.49', // retrieve by running serial monitor on esp 
            port: 3002,
            type: 'lighting',
            description: 'Main LED strip controller for track lighting'
        }
    ],
    

    /** Raspberry Pi device configurations */
    raspberryPiDevices: [
        {
            id: 'raspi_main',
            name: 'Main Raspberry Pi',
            host: '192.168.1.38',
            port: 3000,
            type: 'control',
            description: 'Main Raspberry Pi control system'
        },
        {
            id: 'raspi_sensor',
            name: 'Sensor Monitoring Pi',
            host: '192.168.1.39',
            port: 3000,
            type: 'sensors',
            description: 'Sensor data processing and monitoring'
        }
    ]
};

/**
 * @typedef {Object} ConfigExports
 * @property {configDevicesList} configDevicesList - Device configuration settings
 */

/** @type {ConfigExports} */
module.exports = {
    configDevicesList,
};
