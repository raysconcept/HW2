/**
 * @fileoverview ESP controller for handling TCP communication with ESP32 LED controller
 * @module HW_ESP_TCP
 * @requires net
 * @requires winston
 */

const net = require('net');
const { createModuleLogger } = require('../config/logger.js');
const logger = createModuleLogger('ETCP');

let tcpClient = null;
let ESP_isConnected = false;
let reconnectTimeout = null;
let dataBuffer = '';
let currentConfig = null;
let lastESPStatusChange = null;
let lastESPRemote = null;
let statusInterval = null;


///////////////////////////////////////////////////////////////////////////////////////

/**
 * @function HW_ESP_SIO
 * @description Handles SocketIO events for ESP communication
 * @param {Object} GLOBALS - The global context object
 */
function HW_ESP_SIO(GLOBALS) {
  logger.debug("LOADED HW_ESP_TCP / HW_ESP_SIO");

  GLOBALS.SIO.sockets.on('connection', (socket) => {
    socket.on('MFC_ESP_COMMAND', (data) => {
      // logger.debug("SocketIO ESP Command: " + JSON.stringify(data));
      sendCommandToESP(data);
    });

    socket.on('ESP_STATUS_REQUEST', () => {
      // logger.debug("SocketIO ESP Status Request");
      sendCommandToESP({ command: 'get_status' });
    });

    socket.on('MFC_ESP_GET_STATUS', () => {
      logger.debug('MFC_ESP_GET_STATUS');
      sendMessageToESP({ action: 'getStatus' });

    });

    socket.on('MFC_ESP_NEW_LEDEFFECT', (xx) => {
      logger.debug('MFC_ESP_NEW_LEDEFFECT');
      sendMessageToESP({ action: 'new_led_effect', message: xx });

    });

    // parse MESSAGE FROM OPERATOR of the AVFX page
    socket.on("MFO", function (e) {
      let terminal = e.split("___")[0];
      let action = e.split("___")[1];
      let message = e.split("___")[2];
      let macAddress = e.split("___")[3];

      logger.debug(`Order Processor SIO MFO action: ${action}`);

      // Map traditional MFO actions to ESP32 commands
      let espCommand = null;

      switch (action) {
        case "AVFX": // RUN LEDS ROBOTWHEEL
          logger.debug(`Order Processor SIO MFO action: ${action}`);
          break;
        default:
          logger.warn(`Unknown MFO action: ${action}`);
      }

      if (espCommand) {
        logger.debug(`Sending ESP32 command for ${action}: ${JSON.stringify(espCommand)}`);
        sendCommandToESP(espCommand);
      }
    });
  });
}

/**
 * @function sendCommandToESP
 * @description Sends a JSON command to the ESP32
 * //@param {Object} command - The command object to send
 */
function getActiveSocket() {
  return tcpClient || G_ESPsocket;
}

function sendCommandToESP(command) {
  const socket = getActiveSocket();
  if (!ESP_isConnected || !socket) {
    logger.warn("Cannot send command - not connected to ESP32");
    return false;
  }

  try {
    const jsonCommand = JSON.stringify(command) + '\n';
    socket.write(jsonCommand);
    logger.debug("Sent command to ESP32: " + jsonCommand.trim());
    return true;
  } catch (error) {
    logger.error("Error sending command to ESP32: " + error.message);
    return false;
  }
}

function sendMessageToESP(m) {
  logger.debug("send to ESP:" + m);
  const action = m.action;
  const message = m.message;
  const jsonCommand = JSON.stringify(m) + '\n';
  if (G_ESPsocket) {

    try {
      G_ESPsocket.write(jsonCommand);
      return true;
    } catch (error) {
      logger.error("Error sending command to ESP32: " + error.message);
      return false;
    }
  } else {
    logger.warn("G_ESPsocket Cannot send command - not connected to ESP32");
  }

  /*
    if (!ESP_isConnected || !tcpClient) {
      logger.warn("Cannot send command - not connected to ESP32");
      return false;
    }
  
    try {
      G_ESPsocket.write("LEDFX_GREEN_GLOW");
  
      // const jsonCommand = JSON.stringify(command) + '\n';
      // tcpClient.write(jsonCommand);
      // logger.debug("Sent command to ESP32: " + jsonCommand.trim());
      return true;
    } catch (error) {
      logger.error("Error sending command to ESP32: " + error.message);
      return false;
    }*/

};

/**
 * @function handleTcpData
 * @description Handles TCP data from the ESP32
 * @param {Object} GLOBALS - The global context object
 * @param {Buffer} data - The TCP data from the ESP32
 */
function handleData(GLOBALS, data) {
  dataBuffer += data.toString();
  let messages = dataBuffer.split('\n');

  // Process all complete messages
  for (let i = 0; i < messages.length - 1; i++) {
    let messageStr = messages[i].trim();
    if (messageStr.length > 0) {
      try {
        const jsonMessage = JSON.parse(messageStr);
        logger.debug("==Received from ESP32: " + messageStr);

        // Forward message to SocketIO clients
        const FROM = "ESP32";
        const ACTION = jsonMessage.type || "MESSAGE";
        const MSG = JSON.stringify(jsonMessage);

        GLOBALS.SIO.emit("ESP_RESPONSE", {
          from: FROM,
          action: ACTION,
          message: jsonMessage,
          raw: MSG
        });

      } catch (error) {
        logger.warn("==Invalid JSON received from ESP32: " + messageStr);
        // Still forward as raw message
        GLOBALS.SIO.emit("ESP_RESPONSE", {
          from: "ESP32",
          action: "RAW",
          message: { raw: messageStr },
          raw: messageStr
        });
      }
    }
  }

  // Keep the last (possibly incomplete) message in the buffer
  dataBuffer = messages[messages.length - 1];
}

/**
 * @function connectToESP32
 * @description Establishes TCP connection to ESP32
 * @param {Object} GLOBALS - The global context object
 * @returns {Promise} Promise that resolves when connected
 */


const ESPnet = require('net');
let G_ESPconnected = false;
let G_ESPsocket = null; // Declare variable to track the socket

function updateESPConnectionState(isConnected, GLOBALS, details = {}) {
  const prev = ESP_isConnected || G_ESPconnected;
  ESP_isConnected = isConnected;
  G_ESPconnected = isConnected;
  lastESPStatusChange = Date.now();
  lastESPRemote = details.remote ?? lastESPRemote;

  if (GLOBALS?.SIO?.emit && prev !== isConnected) {
    GLOBALS.SIO.emit('ESP_STATUS', {
      connected: isConnected,
      timestamp: lastESPStatusChange,
      remote: isConnected ? lastESPRemote : null
    });
  }
}

function connectToESP32(GLOBALS) {
  updateESPConnectionState(false, GLOBALS);
  logger.info("==connectToESP32");
  return new Promise((resolve, reject) => {
    if (!currentConfig) {
      reject(new Error("ESP32 configuration not initialized"));
      return;
    }
   
   // logger.info(`==Starting RAW TCP Server for ESP32 on port ${GLOBALS.config.espConfig.portESP1}`);

    //let ESPsocket = null; // Declare variable to track the socket

    const ESPserver = ESPnet.createServer((ESPsocket) => {

      G_ESPsocket = ESPsocket; // Store the socket reference

      //const ESPInfo = `${ESPsocket.remoteAddress}:${ESPsocket.remotePort}`;
      const ESPInfo = `192.168.1.50:3002`; // match IP of ESP (run serial monitor on ESP to find it)
     
      logger.info(`✅ ==ESP32 connected: ${ESPInfo}`);
      updateESPConnectionState(true, GLOBALS, { remote: ESPInfo });

      // Clear the timeout since we connected successfully
      clearTimeout(connectionTimeout);

      /*resolve({
      ESPsocket: ESPsocket,
        ESPserver: ESPserver,
        ESPInfo: ESPInfo
      });*/

      resolve({
        ESPsocket: ESPsocket,
        ESPserver: '192.168.1.50',
        ESPInfo: ESPInfo
      });

      ESPsocket.on('data', (data) => {
        const message = data.toString().trim();
        logger.info(`📨 ==From ESP32: ${message}`);

        /*
        // Forward message to SocketIO clients
        const FROM = "ESP32";
        const ACTION = "action";//jsonMessage.type || "MESSAGE";
        const MSG = "message";//JSON.stringify(jsonMessage);

        GLOBALS.SIO.emit("ESP_RESPONSE", {
          from: FROM,
          action: ACTION,
          message: "message",//jsonMessage,
          raw: MSG
        });
*/

        if (message === 'ESP32_CONNECTED') {
          logger.info('🤝 ESP32 handshake received');
          const FROM = "ESP32";
          const ACTION = "status_update";//jsonMessage.type || "MESSAGE";
          const MSG = "ESP_CONNECTED";//JSON.stringify(jsonMessage);
          GLOBALS.SIO.emit("ESP_RESPONSE", {
            from: FROM,
            action: ACTION,
            message: MSG,//jsonMessage,
            raw: MSG
          });

        }

      });

      ESPsocket.on('close', () => {
        logger.warn(`❌ ==ESP32 disconnected: ${ESPInfo}`);
        updateESPConnectionState(false, GLOBALS);
        scheduleReconnect(GLOBALS);
      });
      ESPsocket.on('end', () => {
        logger.info('🔚 ==ESP32 ended the connection (FIN packet)');
        updateESPConnectionState(false, GLOBALS);
        scheduleReconnect(GLOBALS);
      });

      ESPsocket.on('error', (err) => {
        logger.error(`⚠️ ==TCP Error: ${err.message}`);
        updateESPConnectionState(false, GLOBALS);
        scheduleReconnect(GLOBALS);
      });

      //ESPsocket.write('HELLOFROMSERVER\n');
      GLOBALS.ESPsocket = ESPsocket;
    });

    ESPserver.on('connection', (err) => {
      logger.error(`[[[[[[[[[[[[[[[[[ ESP CONNECTED ]]]]]]]]]]]]]]]]]]]]]]]]]]]]]`);
      G_ESPsocket.write('HELLOFROMSERVER\n');
    });

    // Handle server errors
    ESPserver.on('error', (err) => {
      logger.error(`❌ ==TCP Server error: ${err.message}`);
      G_ESPconnected = false;
      clearTimeout(connectionTimeout);
      reject(err);
    });

    /*
        ESPserver.listen(GLOBALS.config.espConfig.portESP1, GLOBALS.IPAddress, () => {
          logger.info(`TCP server listening on ${GLOBALS.config.espConfig.portESP1}`);
          logger.info('Waiting for ESP32 connection...');
        });
        */


    //ESPserver.listen(GLOBALS.config.espConfig.portESP1, GLOBALS.IPAddress, () => {
    ESPserver.listen(GLOBALS.configDevices.esp32Devices[0].port, GLOBALS.configDevices.esp32Devices[0].host, () => {

      logger.info(`ESP_TCP server listening on ${GLOBALS.configDevices.esp32Devices[0].host} / ${GLOBALS.configDevices.esp32Devices[0].port}`);
      //logger.info(`TCP server listening on ${GLOBALS.config.espConfig.portESP1}`);
      logger.info('Waiting for ESP32 connection...');
    });


    // can you do this?
    ESPserver.on('end', () => {
      logger.info('==ESPserver end');
      updateESPConnectionState(false, GLOBALS);
      scheduleReconnect(GLOBALS);
    });

    // Optional: Timeout if no ESP32 connects within 30 seconds
    const connectionTimeout = setTimeout((ESPsocket) => {
      if (!ESPsocket) { // Check if no socket connected yet
        logger.error("xx ESP32 connection timeout - no device connected");
        ESPserver.close();
        updateESPConnectionState(false, GLOBALS);
        scheduleReconnect(GLOBALS);
        // reject(new Error("ESP32 connection timeout - no device connected within 30 seconds"));
      }
    }, 3000);
  });
}


function scheduleStatusCheck() {
  logger.info("scheduleStatusCheck G_ESPconnected:" + G_ESPconnected);

  if (!G_ESPconnected) {
    //connectToESP32(GLOBALS); 
  }
  /*
return {
  ESP_isConnected: ESP_isConnected,
  ESPlastConnectionTime: ESPlastConnectionTime,
  ESPInfo: ESPsocket ? `${ESPsocket.remoteAddress}:${ESPsocket.remotePort}` : null,
  serverStatus: ESPserver ? 'running' : 'stopped',
  serverPort: TCP_PORT,
  uptime: ESPlastConnectionTime ? Date.now() - ESPlastConnectionTime : null,
  bytesWritten: ESPsocket ? ESPsocket.bytesWritten : 0,
  bytesRead: ESPsocket ? ESPsocket.bytesRead : 0
};
*/

}

/*
logger.warn("=========================");
return new Promise((resolve, reject) => {
  if (!currentConfig) {
    reject(new Error("ESP32 configuration not initialized"));
    return;
  }

  logger.info(`Connecting to ESP32 at ${currentConfig.hostESP1}:${currentConfig.port}...`);

  tcpClient = new net.Socket();

  // Set up connection timeout
  // If the timeout is not big enough (at least 5 seconds), the connection will crash every few seconds
  tcpClient.setTimeout(5000);

  // Flag to track if promise has been resolved/rejected
  let promiseHandled = false;
//172.24.112.20
  //tcpClient.connect(3001, '192.168.1.45', () => {
    logger.warn(currentConfig.port +"/"+ currentConfig.host );
    tcpClient.connect(currentConfig.port, '192.168.1.45', () => {
    if (promiseHandled) return; // Prevent multiple resolutions
    promiseHandled = true;

    logger.info("Connected to ESP32 TCP server successfully!");
    updateESPConnectionState(true, GLOBALS, {
      remote: `${currentConfig.hostESP1}:${currentConfig.port}`
    });

    // Clear any existing reconnect timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    // Send initial status request
    setTimeout(() => {
      sendCommandToESP({ command: 'get_status' });
    }, 1000);

    resolve(tcpClient);
  });

  tcpClient.on('data', (data) => {
    handleData(GLOBALS, data);
  });

  tcpClient.on('close', () => {
    logger.warn("ESP32 TCP connection closed");
    updateESPConnectionState(false, GLOBALS);

    // Notify clients about disconnection
    GLOBALS.SIO.emit("ESP_RESPONSE", {
      from: "ESP32",
      action: "DISCONNECTED",
      message: { status: "disconnected" },
      raw: "ESP32 disconnected"
    });

    // Attempt to reconnect
    scheduleReconnect(GLOBALS);
  });

  tcpClient.on('error', (error) => {
    logger.error("ESP32 TCP connection error: " + error.message);
    updateESPConnectionState(false, GLOBALS);

    // Only reject if this is the initial connection attempt and promise hasn't been handled
    if (!ESP_isConnected && !promiseHandled) {
      promiseHandled = true;
      reject(error);
    }

    // Schedule reconnect for ongoing connection issues
    scheduleReconnect(GLOBALS);
  });

  tcpClient.on('timeout', () => {

    logger.error("ESP32 TCP connection timeout: see manual ESP connection in SW ARCHITECTURE");
    tcpClient.destroy();

    // Reject the promise if it hasn't been handled yet
    if (!promiseHandled) {
      promiseHandled = true;
      reject(new Error("ESP32 TCP connection timeout: see manual ESP connection in SW ARCHITECTUR"));
    }
  });
});
 
}
*/


/**
 * @function scheduleReconnect
 * @description Schedules a reconnection attempt
 * //@param {Object} GLOBALS - The global context object
 */
function clearReconnectTimer() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

function scheduleReconnect(GLOBALS) {
  logger.info("reconnect scheduler");
  if (reconnectTimeout || !currentConfig) return; // Already scheduled or no config

  const delay = Math.max(
    100,
    Number.isFinite(currentConfig?.reconnectDelay)
      ? currentConfig.reconnectDelay
      : 2000
  );

  logger.info(`Scheduling ESP32 reconnect in ${delay}ms`);

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectToESP32(GLOBALS).catch(error => {
      logger.error("Reconnection failed: " + error.message);
    });
  }, delay);

  if (typeof reconnectTimeout.unref === 'function') {
    reconnectTimeout.unref();
  }
};

function stopStatusHeartbeat() {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
}

function ensureStatusHeartbeat() {
  if (statusInterval) return;
  statusInterval = setInterval(() => {
    scheduleStatusCheck();
    logger.debug("sending hello to esp");
    if (G_ESPsocket != null) {
      // G_ESPsocket.write('HELLO FROM SERVER\n');
    } else {
      logger.debug("ESPsocket:" + G_ESPsocket);
    }
  }, 60000);

  if (typeof statusInterval.unref === 'function') {
    statusInterval.unref();
  }
}

/**
 * @function TCP_INIT
 * @description Initializes the TCP connection with the ESP32
 * @param {Object} GLOBALS - The global context object
 * @param {Object} config - Configuration object containing espConfig
 * @returns {Promise} Promise that resolves with the TCP client
 */
function ESP_INIT(GLOBALS, config = {}) {
  // Store the ESP configuration from configMain.js
  if (config.espConfig) {
    currentConfig = { ...config.espConfig };


    logger.info(`ESP32 Config loaded 1: ${GLOBALS.configDevices.esp32Devices[0].host}:${GLOBALS.configDevices.esp32Devices[0].port}`);

  } else {
    logger.error("No espConfig found in configuration");
    return Promise.reject(new Error("ESP32 configuration missing"));
  }
  ensureStatusHeartbeat();
  return connectToESP32(GLOBALS);
}

/**
 * @function getConnectionStatus
 * @description Returns the current connection status
 * @returns {Object} Connection status object
 */
function getConnectionStatus() {
  return {
    connected: ESP_isConnected || G_ESPconnected,
    host: currentConfig?.host || currentConfig?.hostESP1 || 'not configured',
    port: currentConfig?.port || currentConfig?.portESP1 || 'not configured',
    remote: lastESPRemote,
    updatedAt: lastESPStatusChange
  };
}

module.exports = {
  ESP_INIT,
  HW_ESP_SIO,
  sendCommandToESP,
  getConnectionStatus,
  __TEST__: {
    clearReconnectTimer,
    stopStatusHeartbeat,
    ensureStatusHeartbeat,
    _getReconnectDelay: () => currentConfig?.reconnectDelay,
    resetState() {
      clearReconnectTimer();
      stopStatusHeartbeat();
      dataBuffer = '';
      currentConfig = null;
      lastESPStatusChange = null;
      lastESPRemote = null;
      ESP_isConnected = false;
      G_ESPconnected = false;
      tcpClient = null;
      G_ESPsocket = null;
    }
  }
};


/*
// MAIN.CCP /////////////////////////////
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClient.h>
#if ESP_ARDUINO_VERSION < ESP_ARDUINO_VERSION_VAL(3,0,0)
#define ETH
#else
#include <ETH.h>
#endif

#include "utilities.h"
//#pragma once
//#define WAVESHARE_ESP32_S3_ETH
//#if defined(WAVESHARE_ESP32_S3_ETH)
//#define ETH_MISO_PIN                    12
//#define ETH_MOSI_PIN                    11
//#define ETH_SCLK_PIN                    13
//#define ETH_CS_PIN                      14
//#define ETH_INT_PIN                     10
//#define ETH_RST_PIN                     9
//#define ETH_ADDR                        1
//#define IR_FILTER_NUM                   -1
//#else
//#error "Use ArduinoIDE, please open the macro definition corresponding to the board above <utilities.h>"
//#endif
// end uitilities


// Use your computer's IP on the same subnet as ESP32
IPAddress nodejsServer(192, 168, 1, 2);  // Changed to 192.168.1.2
#define NODEJS_SERVER_PORT 3002

bool eth_connected = false;
WiFiClient tcpClient;
bool connectedToNodeJS = false;
unsigned long lastConnectionAttempt = 0;

void WiFiEvent(arduino_event_id_t event) {
  switch (event) {
    case ARDUINO_EVENT_ETH_GOT_IP:
      Serial.println("🎉 ETH Got IP Address!");
      Serial.print("ESP32 IP: ");
      Serial.println(ETH.localIP());
      Serial.print("Target Server: ");
      Serial.print(nodejsServer);
      Serial.print(":");
      Serial.println(NODEJS_SERVER_PORT);
      eth_connected = true;
      break;
    default:
      break;
  }
}

bool connectToNodeJS() {
  Serial.print("🔗 Connecting to Node.js at ");
  Serial.print(nodejsServer);
  Serial.print(":");
  Serial.println(NODEJS_SERVER_PORT);
  
  if (tcpClient.connect(nodejsServer, NODEJS_SERVER_PORT)) {
    Serial.println("✅ CONNECTED to Node.js TCP server!");
    connectedToNodeJS = true;
    tcpClient.println("ESP32_CONNECTED");
    return true;
  } else {
    Serial.println("❌ Connection failed");
    return false;
  }
}

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n🚀 ESP32 TCP CLIENT");
  Serial.println("Target: 192.168.1.2:3002");
  
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  
  WiFi.onEvent(WiFiEvent);
  ETH.begin(ETH_PHY_W5500, ETH_ADDR, ETH_CS_PIN, ETH_INT_PIN, ETH_RST_PIN,
            SPI3_HOST, ETH_SCLK_PIN, ETH_MISO_PIN, ETH_MOSI_PIN);
}

void loop() {
  Serial.print(".");
  if (eth_connected && !connectedToNodeJS) {
    if (millis() - lastConnectionAttempt > 5000) {
      connectToNodeJS();
      lastConnectionAttempt = millis();
    }
  }
  
  if (connectedToNodeJS && tcpClient.connected()) {
    if (tcpClient.available()) {
      String data = tcpClient.readStringUntil('\n');
      data.trim();
      Serial.print("📨 From Server: ");
      Serial.println(data);
    }
  }
  
  digitalWrite(LED_BUILTIN, connectedToNodeJS ? HIGH : LOW);
  delay(100);
}

*/
