// enable custom logging
const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('SIO_');

/**
 * Initialize Socket.IO server and connection management
 * @param {Object} GLOBALS - The global context
 * @returns {Promise} A promise that resolves when initialization is complete
 */
async function SIO_INIT(GLOBALS) {
    return new Promise((resolve) => {

        // Initialize TERMINALS array in GLOBALS
        GLOBALS.TERMINALS = [];

        // START the http server using Express's listen() method
        // store the instance of the server in GLOBALS
        const bindAddress = GLOBALS.S1_BIND_IP || GLOBALS.S1_IPADRESS;
        const HTTP_SERVER = GLOBALS.Express.listen(GLOBALS.S1_PORT, bindAddress, () => {
            if (bindAddress === GLOBALS.S1_IPADRESS) {
                logger.info(`Express server is listening for HTTP connections on ${bindAddress}:${GLOBALS.S1_PORT}`);
            } else {
                logger.info(`Express server bound to ${bindAddress}:${GLOBALS.S1_PORT} (advertised as ${GLOBALS.S1_IPADRESS})`);
            }
        });

        // SOCKET IO SERVER (RUNS OVER HTTP)
        // integrates Socket.IO with the existing Express HTTP server, 
        // enabling real-time bidirectional communication between the server and clients
        // Socket.IO will run on the same port as the HTTP server, upgrading connections to WebSocket when possible
        const { Server } = require('socket.io');
        GLOBALS.SIO = new Server(HTTP_SERVER);

        // Modules register themselves
        const connectionCallbacks = []; // Stores all registered callbacks
        const siteConnectionCallbacks = [];

        // Modules call this to register their connection handlers
        function onSocketConnected(callback) {
            connectionCallbacks.push(callback);
        }
        function onSiteSocketConnected(callback) {
            siteConnectionCallbacks.push(callback);
        }
        GLOBALS.onSocketConnected = onSocketConnected;
        GLOBALS.onSiteSocketConnected = onSiteSocketConnected;

        // Set up connection handling
        GLOBALS.SIO.sockets.on('connection', function (socket) {
            logger.info("New socket connection attempt - ID: " + socket.id);

            // Call all registered connection callbacks
            connectionCallbacks.forEach(cb => cb(socket));

            // Add to list of connected terminals
            GLOBALS.TERMINALS.push(socket);
            logger.info("Terminal added. New count: " + GLOBALS.TERMINALS.length);

            // Handle disconnection
            socket.on('disconnect', function () {
                logger.info("Client " + socket.id + " disconnected. Removing from list of connected terminals");
                for (let x = 0; x < GLOBALS.TERMINALS.length; x++) {
                    if (GLOBALS.TERMINALS[x].id == socket.id) {
                        // CLEAN UP LIST OF CONNECTED TERMINALS 
                        GLOBALS.TERMINALS.splice(x, 1);
                        break; // Exit loop after removing the terminal
                    }
                }
            });

            // Clean up any orphaned terminals
            let terminalcounter = 0;
            GLOBALS.TERMINALS.forEach(function (t) {
                terminalcounter++;
                if (t.connected == false) {
                    GLOBALS.TERMINALS.splice(GLOBALS.TERMINALS.indexOf(t), 1); // remove from array terminals
                    logger.debug("Removed disconnected terminal from array: " + t.id);
                } else {
                    logger.info('Connected terminal: [' + terminalcounter + "] " + t.id + " (total:" + GLOBALS.TERMINALS.length + ")");
                }
            });
        });

        // Optional namespace for site clients
        GLOBALS.SIO.of('/site').on('connection', (socket) => {
            logger.info("Site namespace connection - ID: " + socket.id);
            siteConnectionCallbacks.forEach(cb => cb(socket));
            socket.on('disconnect', () => {
                logger.info("Site client " + socket.id + " disconnected");
            });
        });

        logger.info("--- SIO_INIT Socket.IO server initialized");
        resolve();
    });
}

// Single module.exports statement
module.exports = {
    SIO_INIT
};
