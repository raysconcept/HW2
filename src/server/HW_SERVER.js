/**
 * @fileoverview Main server file for the HotWheels application
 * @module HW_SERVER
 * @requires express
 * @requires socket.io
 * @requires serialport
 * @requires winston
*/

/**
 * @namespace HW_SERVER
 * @description Main server implementation for the HotWheels application
*/

/**
 * @namespace GLOBALS
 * @description Global variables for the application's core controllers
 */
let GLOBALS = {};

// crypto (TODO what is this again?)
const { X509Certificate } = require('crypto');

// LOGGER
const { createModuleLogger } = require('./config/logger.js');
const logger = createModuleLogger('SRVR');

logger.info("SERVER STARTED");

let config = null;
let HW_ORDER_QR = null;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @function step1
 * @description Loads main configuration file, initializes Express and Socket.io server
 */
//const { exec } = require('child_process');
//const util = require('util');
//const execPromise = util.promisify(exec);
const os = require('os');
async function CHECK_LAN_CONNECTION_AT_STARTUP() {
  const interfaces = os.networkInterfaces();

  let hasLanConnection = false;
  let hasWifiConnection = false;
  const detectedIps = new Set();
  const advertisedIp = config?.serverConfig?.ip;
  const bindIp = config?.serverConfig?.bindIp;

  Object.keys(interfaces).forEach(interfaceName => {
    const lowerName = interfaceName.toLowerCase();
    const isEthernet = lowerName.includes('ethernet') ||
      lowerName.includes('eth') ||
      lowerName.includes('lan') ||
      lowerName.includes('local area connection') ||
      (lowerName.startsWith('en') && !lowerName.startsWith('wl')); // handle Linux eno*/enp* names

    const isWifi = lowerName.includes('wi-fi') ||
      lowerName.includes('wifi') ||
      lowerName.includes('wireless') ||
      lowerName.includes('wlan') ||
      lowerName.startsWith('wl');

    interfaces[interfaceName].forEach(interface => {
      if (interface.family === 'IPv4' && !interface.internal && interface.address) {
        detectedIps.add(interface.address);

        if (isEthernet) {
          hasLanConnection = true;
          logger.info(`LAN (Ethernet) detected: ${interface.address}`);
        } else if (isWifi) {
          hasWifiConnection = true;
          logger.info(`WiFi detected: ${interface.address}`);
        } else {
          logger.warn(`Other interface (${interfaceName}): ${interface.address}`);
        }
      }
    });
  });

  const bindIpNeedsCheck = bindIp && bindIp !== '0.0.0.0';
  const bindIpMissing = bindIpNeedsCheck && !detectedIps.has(bindIp);

  const advertisedDiffers = advertisedIp &&
    advertisedIp !== '0.0.0.0' &&
    advertisedIp !== bindIp;
  const advertisedMissing = advertisedDiffers && !detectedIps.has(advertisedIp);

  if (advertisedMissing) {
    logger.warn(`Configured server IP (${advertisedIp}) not found on any active network interface.`);
    logger.warn('Update HW_SERVER_IP_HOST / HW_SERVER_IP to match an available interface.');
  }

  if (bindIpMissing) {
    logger.warn(`Bind IP (${bindIp}) not found on any active network interface.`);
    if (config.serverConfig.serverExitIfNoLan) {
      logger.warn(`Exiting because bind IP is unreachable and serverExitIfNoLan is enabled.`);
      //process.exit(1);
    }
  } else if (!hasLanConnection) {
    logger.warn("No LAN (Ethernet) connection detected. Robot peripherals may be unreachable.");
    if (config.serverConfig.serverExitIfNoLan) {
      logger.warn("Continuing because the configured server IP is present on a non-LAN interface.");
    }
  }
  logger.warn(`LAN: ${hasLanConnection}, WiFi: ${hasWifiConnection}`);
}

async function step1() {

  logger.info("STEP 1: SERVER ENVIRONMENT");

  const envIp = process.env.HW_SERVER_IP_HOST || process.env.HW_SERVER_IP || 'undefined';
  logger.info("SERVER IS ON IP:" + envIp);

  return new Promise(async (resolve, reject) => {

    try {
      // CONFIG 
      const configPath = './config/configMain';
      logger.debug("Loading configuration from: " + configPath);
      config = require(configPath);
      GLOBALS.config = config;

      const devicesPath = './config/configDevices';
      logger.debug("Loading devices config from: " + devicesPath);
      const configDevices = require(devicesPath);

      GLOBALS.configDevices = configDevices.configDevicesList;
      const LL = GLOBALS.configDevices.raspberryPiDevices.length;

      CHECK_LAN_CONNECTION_AT_STARTUP();

      GLOBALS.SYSTEMMODE = "SYSTEM_RETAILMODE";
      GLOBALS.ROBOT_HALTED = true; // start in robot halted mode, is overriden by config settings



      //const robotConfigPath = './config/configRobot/HW_robot_config';
      const robotConfigPath = './config/configRobot';
      logger.debug("Loading robotConfig config from: " + robotConfigPath);
      const robotConfig = require(robotConfigPath);
      GLOBALS.robotConfig = robotConfig;
      GLOBALS.ROBOT_HALTED = GLOBALS.robotConfig.robot_halted_at_startup; // save in GLOBALS.ROBOT_HALTED
      logger.warn("GLOBALS.ROBOT_HALTED:" + GLOBALS.ROBOT_HALTED);



      const bodyParser = require("body-parser");
      const ip = require("ip");
      // const S1_HTTP = require('http');

      GLOBALS.SITE_LOCATION = config.vendingConfig.siteLocation;
      GLOBALS.S1_PORT = config.serverConfig.port;
      GLOBALS.S1_BIND_IP = config.serverConfig.bindIp || '0.0.0.0';

      // Determine the advertised server IP; fall back to bind IP or localhost if the lookup fails.
      let serverIp = config.serverConfig.ip;
      if (!serverIp) {
        try {
          serverIp = ip.address();
        } catch (ipErr) {
          logger.warn(`Failed to resolve host IP automatically (${ipErr.message}).`);
        }
      }
      if (!serverIp) {
        serverIp = GLOBALS.S1_BIND_IP || '127.0.0.1';
        logger.warn(`Falling back to bind IP (${serverIp}) for advertised address.`);
      }
      GLOBALS.S1_IPADRESS = serverIp;

      logger.info(`Server bind IP: ${GLOBALS.S1_BIND_IP}, advertised IP: ${GLOBALS.S1_IPADRESS}`);

      // Express initialization
      const express = require("express");
      GLOBALS.Express = express();

      // Configure Express middleware
      GLOBALS.Express.set('view engine', 'ejs');
      GLOBALS.Express.use(bodyParser.urlencoded({ extended: true }));
      GLOBALS.Express.use(express.static("public"));
      GLOBALS.Express.use(express.json());

      // The cors middleware is added to handle Cross-Origin Resource Sharing
      // configured to allow requests from a specific origin (from config) and port
      const cors = require('cors');
      GLOBALS.Express.use(cors({
        origin: `${config.serverConfig.corsOrigin}:${config.serverConfig.port}`
      }));
      resolve();
    } catch (err) {
      logger.error('Step 1 failed:', err.message);
      reject(err);
    }
  });
}

/**
 * @function step2
 * @description Loads main configuration file, initializes Express and Socket.io server
 */
async function step2() {
  return new Promise(async (resolve, reject) => {
    logger.info("STEP 2: CONFIGURATIONS");
    try {
      logger.debug('----------------------- require DB.HW_DB_HTTP');
      await require('./controllers/HW_DB.js').HW_DB_HTTP(GLOBALS);

      // Start Socket.IO early so downstream modules can register socket handlers safely
      logger.debug('----------------------- require SIO_INIT');
      const { SIO_INIT } = require('./controllers/HW_CORE_SIO.js');
      await SIO_INIT(GLOBALS);

      // Initialize HTTP endpoints after Express/SIO are ready
      logger.info("require HW_INVENTORY_HTTP");
      require("./controllers/HW_ORDER_INVENTORY.js").HW_INVENTORY_HTTP(GLOBALS);
      logger.info("require HW_ROBOT_HTTP");
      await require('./controllers/HW_ROBOT_MODULE.js').HW_ROBOT_HTTP(GLOBALS);
      logger.info("require HW_DB_HTTP");
      await require('./controllers/HW_DB.js').HW_DB_HTTP(GLOBALS);
      logger.info("require ORDER_PROCESSOR_HTTP");
      await require('./controllers/HW_ORDER_PROCESSOR.js').ORDER_PROCESSOR_HTTP(GLOBALS);
      /*
      logger.info("require HW_VIDEO_UPLOAD");
      require('./controllers/HW_VIDEO_UPLOAD.js').HW_VIDEO_UPLOAD_INIT(GLOBALS);
      logger.info("require HW_DUAL_PI_RECORDING");
      require('./controllers/HW_DUAL_PI_RECORDING.js').HW_DUAL_PI_RECORDING_HTTP(GLOBALS);
*/


      // Step 2: Initialize socket modules
      // Each module registers its connection handler via GLOBALS.onSocketConnected
      // and sets up its socket event listeners
      // logger.debug('----------------------- require TEST.HW_TEST_SIO');
      // require("./controllers/HW_TEST.js").HW_TEST_SIO(GLOBALS);

      logger.debug('----------------------- require HW_ORDER_VENDING.js');
      require("./controllers/HW_ORDER_VENDING.js").HW_VENDING_SIO(GLOBALS);
      logger.debug('----------------------- require HW_ORDER_INVENTORY.js');
      require("./controllers/HW_ORDER_INVENTORY.js").HW_INVENTORY_SIO(GLOBALS);
      logger.debug('----------------------- require HW_ORDER_QR.js');
      if (!HW_ORDER_QR) {
        HW_ORDER_QR = require("./controllers/HW_ORDER_QR.js");
      }
      HW_ORDER_QR.HW_ORDER_QR_SIO(GLOBALS);
      logger.debug('----------------------- require HW_ORDER_PROCESSOR.js');
      require("./controllers/HW_ORDER_PROCESSOR.js").ORDER_PROCESSOR_SIO(GLOBALS);
      //logger.debug('----------------------- require HW_ESP_TCP.js');
      //require("./controllers/HW_ESP_TCP.js").HW_ESP_SIO(GLOBALS);
      //require("./test_esp_tcp2.js");

      if (GLOBALS.config.camSystemRasp) {
        logger.debug('----------------------- require HW_RASPI_MULTI_SIO.js');
        require("./controllers/HW_RASPI_MULTI.js").HW_RASPI_MULTI_SIO(GLOBALS);
      }
      resolve();
    } catch (err) {
      logger.error('Step2 failed:', err.message);
      logger.error('Step2 Full error:', err);
      logger.error('Step2 Stack trace:', err.stack);
      reject(err);
    }
  });
}

/**
 * @function step3
 * @description Initializes the database
 */



async function step3() {
  return new Promise(async (resolve, reject) => {

    logger.debug("STEP3, DATABASE");
    logger.info("Database Control Panel: http://localhost/phpmyadmin/index.php");
    logger.info("Firewall settings: C:\\Program Files\\AvastSoftware\\Avast\\AvastUI.exe");

    try {
      // Initialize database and store connection in app context
      await require('./controllers/HW_DB.js').HW_DB_INIT(GLOBALS);
      GLOBALS.DB_QS = require('./controllers/HW_DB');
      resolve();
    } catch (err) {
      logger.error('Step 3 failed:', err.message);
      logger.error('Failed to initialize database:', err.message);
      reject(err);
    }
  });
}

/**
 * @function step4
 * @description Initializes the  Robot
 */
async function step4() {
  logger.debug("step 4 LOAD ROBOT");
  return new Promise(async (resolve, reject) => {
    try {
      logger.info("-------------------- require HW_ROBOT_MODULE");
      GLOBALS.ROBOT_MODULE = require('./controllers/HW_ROBOT_MODULE.js');

      try {
        await GLOBALS.ROBOT_MODULE.HW_ROBOT_HTTPCALLS(GLOBALS);
        logger.info("Robot HTTP endpoints registered");
      } catch (err) {
        logger.error('Failed to register robot HTTP endpoints:', err.message);
      }

      if (config.robotConfig.enabled) {
        try {
          await GLOBALS.ROBOT_MODULE.HW_ROBOT_INIT(GLOBALS);
          logger.info("Robot connection established successfully");
        } catch (err) {
          logger.error('Failed to initialize robot:', err.message);
          // continue even if the physical robot is unavailable so HTTP routes stay enabled
        }

        // LOAD AGAIN ?? //
        try {
          await GLOBALS.ROBOT_MODULE.HW_ROBOT_HTTPCALLS(GLOBALS);
          logger.info("Robot calls loaded successfully");
        } catch (err) {
          logger.error('Failed to register robot HTTP endpoints:', err.message);
        }
      } else {
        logger.info('Robot module disabled via configuration');
      }

      resolve();
    } catch (err) {
      logger.error('Step 4 failed:', err.message);
      reject(err);
    }
  });
}

/**
 * @function step5
 * @description Initializes the routing and vending logic, and repeaters
 */
async function step5() {
  logger.debug("step 5 START REPEATERS");

  // VENDING
  logger.info("------------------ require HW_VENDING_INIT");
  require("./controllers/HW_ORDER_VENDING.js").HW_VENDING_INIT(GLOBALS);

  //require("./controllers/HW_ORDER_VENDING.js");
  // BROADCASTING
  logger.info("------------------ require HW_BROADCAST_INIT");
  require('./controllers/HW_BROADCASTING').HW_BROADCAST_INIT(GLOBALS, config);

  // ORDER PROCESSING TO PICKING
  logger.info("------------------ require ORDER_PROCESSOR_INIT");
  require('./controllers/HW_ORDER_PROCESSOR.js').ORDER_PROCESSOR_INIT(GLOBALS, config);

  logger.info("------------------ ensure operator QR codes");
  if (!HW_ORDER_QR) {
    HW_ORDER_QR = require("./controllers/HW_ORDER_QR.js");
  }
  await HW_ORDER_QR.HW_QR_ENSURE_SPECIAL_CODES(GLOBALS);
}

/**
 * @function step6
 * @description Initialize esp connections
 */
async function step6() {
  logger.debug("step 6 ESP CONNECTIONS");

  const HW_ESP = require("./controllers/HW_ESP_TCP");
  //GLOBALS.ESP_IPCONNECTIONS = [];
  GLOBALS.ESP_SOCKETS = new Set();//= [];
  GLOBALS.ESP_FUNCTIONS = HW_ESP.ESP_INIT(GLOBALS);

}
/**
 * @function step7
 * @description Initialize system monitor
 */
async function step7() {


  /* only load raspberry modules if application is included in the system */
  
  if (GLOBALS.config.camSystemRasp) {


    logger.debug("step 7 LOAD RASPBERRIES");
    return new Promise(async (resolve, reject) => {
      try {

        // Initialize Multi-Raspberry Pi Communication
        logger.warn("============================================================");
        logger.info("LOAD MULTI-RASPBERRY PI MODULE");
        try {

          logger.info("-------------------- require HW_RASPI_MULTI");
          GLOBALS.HW_RASPI_MULTI = require('./controllers/HW_RASPI_MULTI.js');

          // Add all Raspberry Pis from device configuration
          const raspiDevices = GLOBALS.configDevices.raspberryPiDevices || [];
          //logger.info("============================================================");
          logger.info(`found ${raspiDevices.length} Raspberry Pi devices...`);
          //logger.info("============================================================");

          raspiDevices.forEach(raspiDevice => {
            GLOBALS.HW_RASPI_MULTI.addRaspberryPi(raspiDevice.id, {
              host: raspiDevice.host,
              port: raspiDevice.port,
              name: raspiDevice.name
            });
            logger.info(`Added Raspberry Pi: ${raspiDevice.name} (${raspiDevice.id}) at ${raspiDevice.host}:${raspiDevice.port}`);
          });

          // Auto-connection disabled - let test scripts handle connections as needed
          logger.info(`📡 Raspberry Pis configured but not auto-connected. Use test scripts to initiate connections.`);

          // Uncomment below to enable auto-connection on server startup:
          // raspiDevices.forEach(raspiDevice => {
          //   GLOBALS.HW_RASPI_MULTI.connectToRaspberryPi(raspiDevice.id, GLOBALS)
          //     .then(() => {
          //       logger.info(`✅ Raspberry Pi ${raspiDevice.id} connected successfully`);
          //     })
          //     .catch((err) => {
          //       logger.warn(`❌ Raspberry Pi ${raspiDevice.id} connection failed: ${err.message}`);
          //     });
          // });

        } catch (err) {
          logger.error('Failed to initialize Multi-Raspberry Pi system:', err.message);
          // Continue without multi-Raspberry Pi support
        }

        resolve();
      } catch (err) {
        logger.error('Step 4 failed:', err.message);
        reject(err);
      }

    })
  };


}

/**
 * @function step8
 * @description Initialize system monitor
 */
async function step8() {
  logger.debug("START SYSTEM MONITOR (TODO), pause 2sec");

  // Page Routing
  logger.info("-------------------- ROUTING");
  require("./controllers/HW_ROUTING.js").HW_ROUTING_INIT(GLOBALS);

  // setInterval(() => {
  //   console.log(`Memory usage: ${JSON.stringify(process.memoryUsage())}`);
  // }, 10000);

  // =======================================================================
  // hotwheels                                                    VIDEO SERVER
  // =======================================================================

  /**
   * @todo Implement video server communication
   * @todo Add proper error handling for video server connection
   * @todo Add reconnection logic for video server
   */
}



/////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * @function systemStartUp
 * @description Main function to start the system
 */
async function systemStartUp() {
  logger.debug("=================================================================== START");
  logger.debug("Initializing System");

  try {
    await step1();
    logger.debug("=================================================================== STEP 1 COMPLETE");

    await step2();
    logger.debug("=================================================================== STEP 2 COMPLETE");

    await step3();
    logger.debug("=================================================================== STEP 3 COMPLETE");

    await step4();
    logger.debug("=================================================================== STEP 4 COMPLETE");

    await step5();
    logger.debug("=================================================================== STEP 5 COMPLETE");

    await step6();
    logger.debug("=================================================================== STEP 6 COMPLETE");

    await step7();
    logger.debug("=================================================================== STEP 7 COMPLETE");

    await step8();
    logger.debug("=================================================================== STEP 8 COMPLETE");

    logger.debug("=================================================================== END");
    logger.info("System ready");

    // Log each property in GLOBALS
    // logger.info("GLOBALS contents:");
    // Object.entries(GLOBALS).forEach(([key, value]) => {
    //   // logger.debug(`${key}: ${JSON.stringify(value, null, 2)}`);
    //   logger.debug(`\t${key}`);

    // });

  } catch (err) {
    logger.error('System startup failed:', err.message);
    logger.error('Full error:', err);
    logger.error('Stack trace:', err.stack);
    process.exit(1);
  }
}

// START THE SYSTEM
systemStartUp();
