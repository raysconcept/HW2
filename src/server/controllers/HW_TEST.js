// enable custom logging
const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('TEST');
logger.debug('-----------------------TEST');
function HW_TEST_SIO(GLOBALS) {
    // Set up event handlers once at server startup
    GLOBALS.SIO.sockets.on('connection', (socket) => {

        socket.on('test', (data) => {
            logger.info('test from terminal, id: ' + socket.id + " / data: " + data);
            socket.emit('server_response', `Server received`); // "${data}"
        });

        socket.on('disconnect', () => {
            logger.info('disconnect:' + socket.id);
        });

        

        // logger.info('BACK-END ID: ' + socket.id);

    });
}

module.exports = {
    HW_TEST_SIO
}