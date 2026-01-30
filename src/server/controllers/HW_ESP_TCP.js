const net = require('net');
const { createModuleLogger } = require('../config/logger.js');
const logger = createModuleLogger('ETCP');


module.exports = {
  ESP_INIT: (GLOBALS) => {
    const tcpServer = net.createServer((socket) => {
      logger.info('ESP32 socket connected:', socket.remoteAddress);

      GLOBALS.ESP_SOCKETS.add(socket);
      logger.info("total ESP sockets connected:" + GLOBALS.ESP_SOCKETS.size);

      socket.on('data', (data) => {
        const message = data.toString().trim();
        logger.info('data received from ESP32:', message);

        if (message === 'ESP32_CONNECTED') {
          const command = {
            action: "new_led_effect",
            message: "LED_WHEEL_GREEN"
          };
          socket.write(JSON.stringify(command) + '\n');
        }
      });

      socket.on('close', () => {
        console.log('ESP32 disconnected');
        GLOBALS.ESP_SOCKETS.delete(socket);
        //connectedSockets.delete(socket);
      });

      socket.on('error', (err) => {
        console.log('Socket error:', err);
        GLOBALS.ESP_SOCKETS.delete(socket);
        // connectedSockets.delete(socket);
      });
    });

    // Start TCP server
    tcpServer.listen(3002, () => {
      console.log('TCP server for ESP32 listening on port 3002');
    });

    // Return functions that can be used elsewhere
    return {
      broadcastToAllESP32: (cmnd) => {
        //const command = JSON.stringify({ message }) + '\n';
        GLOBALS.ESP_SOCKETS.forEach(socket => {
          if (!socket.destroyed) {
            let message=cmnd+"\n";
            logger.info("send to all esp:" + message);
            socket.write(message);
          }
        });
      },

      getConnectedCount: () => {
        return GLOBALS.ESP_SOCKETS.size;

      },
      // Add other functions as needed
    };
  }
};
