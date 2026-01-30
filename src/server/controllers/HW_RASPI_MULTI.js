/**
 * @fileoverview Multi-Raspberry Pi controller for handling multiple TCP connections
 * @module HW_RASPI_MULTI
 * @requires net
 * @requires winston
 */

const net = require('net');
const { createModuleLogger } = require('../config/logger.js');
const logger = createModuleLogger('MRPI');

// Store multiple Raspberry Pi connections
const raspiConnections = new Map(); // Map<raspiId, connectionObject>
let reconnectTimeouts = new Map(); // Map<raspiId, timeoutId>

/**
 * Connection object structure:
 * {
 *   id: 'raspi1',
 *   client: net.Socket,
 *   isConnected: boolean,
 *   config: { host, port, name },
 *   dataBuffer: ''
 * }
 */

///////////////////////////////////////////////////////////////////////////////////////

/**
 * @function addRaspberryPi
 * @description Add a new Raspberry Pi to the connection pool
 * @param {string} raspiId - Unique identifier for the Raspberry Pi
 * @param {Object} config - Raspberry Pi configuration {host, port, name}
 */
function addRaspberryPi(raspiId, config) {
  if (raspiConnections.has(raspiId)) {
    logger.warn(`Raspberry Pi ${raspiId} already exists. Updating configuration.`);
  }
  
  const connectionObj = {
    id: raspiId,
    client: null,
    isConnected: false,
    config: config,
    dataBuffer: '',
    heartbeatInterval: null
  };
  
  raspiConnections.set(raspiId, connectionObj);
  logger.info(`Raspberry Pi ${raspiId} added: ${config.host}:${config.port} (${config.name})`);
}

/**
 * @function connectToRaspberryPi
 * @description Connect to a specific Raspberry Pi
 * @param {string} raspiId - Raspberry Pi identifier
 * @param {Object} GLOBALS - Global context object
 */
function connectToRaspberryPi(raspiId, GLOBALS) {
  return new Promise((resolve, reject) => {
    const connection = raspiConnections.get(raspiId);
    if (!connection) {
      reject(new Error(`Raspberry Pi ${raspiId} not found`));
      return;
    }

    logger.info(`Connecting to Raspberry Pi ${raspiId} at ${connection.config.host}:${connection.config.port}...`);

    connection.client = new net.Socket();
    // No timeout - wait indefinitely for connection
    
    // Enable TCP keepalive to prevent 30-second disconnections
    connection.client.setKeepAlive(true, 10000); // Send keepalive every 10 seconds
    connection.client.setNoDelay(true); // Disable Nagle's algorithm for faster response
    
    let promiseHandled = false;

    connection.client.connect(connection.config.port, connection.config.host, () => {
      if (promiseHandled) return;
      promiseHandled = true;
      
      logger.info(`✅ Connected to Raspberry Pi ${raspiId} (${connection.config.name})!`);
      connection.isConnected = true;
      
      // Notify clients about successful connection
      GLOBALS.SIO.emit("RASPI_RESPONSE", {
        from: `RASPI_${raspiId}`,
        action: "CONNECTED",
        message: { status: "connected", raspiId: raspiId },
        raw: `Raspberry Pi ${raspiId} connected`
      });
      
      // No timeout to disable
      
      // Clear reconnect timeout
      if (reconnectTimeouts.has(raspiId)) {
        clearTimeout(reconnectTimeouts.get(raspiId));
        reconnectTimeouts.delete(raspiId);
      }

      // Send initial status request
      setTimeout(() => {
        sendCommandToRaspberryPi(raspiId, { command: 'get_status' });
      }, 1000);
      
      // Set up heartbeat to prevent connection drops
      connection.heartbeatInterval = setInterval(() => {
        if (connection.isConnected) {
          sendCommandToRaspberryPi(raspiId, { command: 'ping' });
        }
      }, 20000); // Send ping every 20 seconds to keep connection alive

      resolve(connection.client);
    });

    connection.client.on('data', (data) => {
      handleData(raspiId, GLOBALS, data);
    });

    connection.client.on('close', () => {
      logger.warn(`Raspberry Pi ${raspiId} connection closed`);
      connection.isConnected = false;
      
      // Clear heartbeat interval
      if (connection.heartbeatInterval) {
        clearInterval(connection.heartbeatInterval);
        connection.heartbeatInterval = null;
      }
      
      // Notify clients about disconnection
      GLOBALS.SIO.emit("RASPI_RESPONSE", {
        from: `RASPI_${raspiId}`,
        action: "DISCONNECTED",
        message: { status: "disconnected", raspiId: raspiId },
        raw: `Raspberry Pi ${raspiId} disconnected`
      });

      scheduleReconnect(raspiId, GLOBALS);
    });

    connection.client.on('error', (error) => {
      logger.error(`Raspberry Pi ${raspiId} connection error: ${error.message}`);
      connection.isConnected = false;
      
      // Clear heartbeat interval on error
      if (connection.heartbeatInterval) {
        clearInterval(connection.heartbeatInterval);
        connection.heartbeatInterval = null;
      }
      
      if (!promiseHandled) {
        promiseHandled = true;
        reject(new Error(`Raspberry Pi ${raspiId} connection failed: ${error.message}`));
      }
    });

    // No timeout handler - connections wait indefinitely
  });
}

/**
 * @function sendCommandToRaspberryPi
 * @description Send command to specific Raspberry Pi
 * @param {string} raspiId - Raspberry Pi identifier
 * @param {Object} command - Command object to send
 */
function sendCommandToRaspberryPi(raspiId, command) {
  const connection = raspiConnections.get(raspiId);
  
  if (!connection) {
    logger.warn(`Raspberry Pi ${raspiId} not found`);
    return false;
  }
  
  if (!connection.isConnected || !connection.client) {
    logger.warn(`Cannot send command to Raspberry Pi ${raspiId} - not connected`);
    return false;
  }

  try {
    const jsonCommand = JSON.stringify(command) + '\n';
    connection.client.write(jsonCommand);
    logger.debug(`Sent command to Raspberry Pi ${raspiId}: ${jsonCommand.trim()}`);
    return true;
  } catch (error) {
    logger.error(`Error sending command to Raspberry Pi ${raspiId}: ${error.message}`);
    return false;
  }
}

/**
 * @function sendCommandToAllRaspberryPis
 * @description Send command to all connected Raspberry Pis
 * @param {Object} command - Command object to send
 */
function sendCommandToAllRaspberryPis(command) {
  let successCount = 0;
  
  raspiConnections.forEach((connection, raspiId) => {
    if (sendCommandToRaspberryPi(raspiId, command)) {
      successCount++;
    }
  });
  
  logger.debug(`Command sent to ${successCount}/${raspiConnections.size} Raspberry Pis`);
  return successCount;
}

/**
 * @function handleData
 * @description Handle data from specific Raspberry Pi
 */
function handleData(raspiId, GLOBALS, data) {
  const connection = raspiConnections.get(raspiId);
  if (!connection) return;
  
  connection.dataBuffer += data.toString();
  let messages = connection.dataBuffer.split('\n');

  for (let i = 0; i < messages.length - 1; i++) {
    let messageStr = messages[i].trim();
    if (messageStr.length > 0) {
      try {
        const jsonMessage = JSON.parse(messageStr);
        logger.debug(`Received from Raspberry Pi ${raspiId}: ${messageStr}`);
        
        GLOBALS.SIO.emit("RASPI_RESPONSE", {
          from: `RASPI_${raspiId}`,
          action: jsonMessage.type || "MESSAGE",
          message: { ...jsonMessage, raspiId: raspiId },
          raw: messageStr
        });

      } catch (error) {
        logger.warn(`Invalid JSON from Raspberry Pi ${raspiId}: ${messageStr}`);
        GLOBALS.SIO.emit("RASPI_RESPONSE", {
          from: `RASPI_${raspiId}`,
          action: "RAW",
          message: { raw: messageStr, raspiId: raspiId },
          raw: messageStr
        });
      }
    }
  }
  
  connection.dataBuffer = messages[messages.length - 1];
}

/**
 * @function scheduleReconnect
 * @description Schedule reconnection for specific Raspberry Pi
 */
function scheduleReconnect(raspiId, GLOBALS) {
  const connection = raspiConnections.get(raspiId);
  if (!connection || reconnectTimeouts.has(raspiId)) return;

  logger.info(`Scheduling Raspberry Pi ${raspiId} reconnect in 10 seconds`);
  
  const timeoutId = setTimeout(() => {
    reconnectTimeouts.delete(raspiId);
    connectToRaspberryPi(raspiId, GLOBALS).catch(error => {
      logger.error(`Raspberry Pi ${raspiId} reconnection failed: ${error.message}`);
    });
  }, 10000);
  
  reconnectTimeouts.set(raspiId, timeoutId);
}

/**
 * @function getConnectionStatus
 * @description Get status of all Raspberry Pi connections
 */
function getConnectionStatus() {
  const status = {};
  
  raspiConnections.forEach((connection, raspiId) => {
    status[raspiId] = {
      connected: connection.isConnected,
      host: connection.config.host,
      port: connection.config.port,
      name: connection.config.name
    };
  });
  
  return status;
}

/**
 * @function HW_RASPI_MULTI_SIO
 * @description Handle Socket.IO events for multi-Raspberry Pi communication
 */
function HW_RASPI_MULTI_SIO(GLOBALS) {
  logger.debug("LOADED HW_RASPI_MULTI_SIO");
  
  GLOBALS.SIO.sockets.on('connection', (socket) => {
    // Send command to specific Raspberry Pi
    socket.on('MFC_RASPI_COMMAND_TARGETED', (data) => {
      const { raspiId, command } = data;
      logger.debug(`Targeted command to Raspberry Pi ${raspiId}: ${JSON.stringify(command)}`);
      sendCommandToRaspberryPi(raspiId, command);
    });

    // Send command to all Raspberry Pis
    socket.on('MFC_RASPI_COMMAND_ALL', (command) => {
      logger.debug(`Broadcast command to all Raspberry Pis: ${JSON.stringify(command)}`);
      sendCommandToAllRaspberryPis(command);
    });

    // Get status of all Raspberry Pis
    socket.on('RASPI_STATUS_REQUEST_ALL', () => {
      const status = getConnectionStatus();
      socket.emit('RASPI_STATUS_RESPONSE', status);
    });

    // Combined command to both ESP32s and Raspberry Pis
    socket.on('MFC_ALL_DEVICES_COMMAND', (command) => {
      logger.debug(`Broadcasting to ALL devices: ${JSON.stringify(command)}`);
      
      // Send to all Raspberry Pis
      const raspiCount = sendCommandToAllRaspberryPis(command);
      
      // Send to all ESP32s if the multi-ESP module is available
      let espCount = 0;
      try {
        const espMulti = require('../../../HW_ESP_MULTI.js');
        espCount = espMulti.sendCommandToAll(command);
      } catch (error) {
        logger.debug('ESP Multi module not available or not loaded');
      }
      
      logger.info(`Broadcast sent to ${raspiCount} Raspberry Pis and ${espCount} ESP32s`);
    });
  });
}

module.exports = {
  addRaspberryPi,
  connectToRaspberryPi,
  sendCommandToRaspberryPi,
  sendCommandToAllRaspberryPis,
  getConnectionStatus,
  HW_RASPI_MULTI_SIO
};
