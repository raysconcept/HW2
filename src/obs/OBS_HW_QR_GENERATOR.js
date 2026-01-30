// https://blog.logrocket.com/create-read-qr-codes-node-js/

// enable custom logging
const logger = require('../server/config/logger');

const fs = require('fs');
const qr = require('qrcode');

// Data for the QR code
const data = 'Hello, World!';

// Generate the QR code
qr.toFile('qr-code.png', data, {
    errorCorrectionLevel: 'H' // High error correction level
}, (err) => {
    if (err) {
        logger.error(err);
        return;
    }
    logger.info('QR code generated successfully!');
});