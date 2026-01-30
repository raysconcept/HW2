// enable custom logging
const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('QR__');

const config = require('../config/configMain');
const fs = require('fs');

/**
 * Register event handlers for MFC messages on SocketIO
 * @param {*} GLOBALS 
 */
function HW_ORDER_QR_SIO(GLOBALS) {
    // Set up event handlers once at server startup
    GLOBALS.SIO.sockets.on('connection', (socket) => {
        socket.on("MFO", function (e) {
            // logger.debug("Message From Operator (MFO) received");

            let terminal = e.split("___")[0];
            let action = e.split("___")[1];
            let message = e.split("___")[2];
            let macAddress = e.split("___")[3];

            logger.debug(`Order QR SIO MFO action: ${action}`);
            handleMFOAction(socket, GLOBALS, action, message);
        });
    });
}

/**
 * Handle MFO actions asynchronously
 */
async function handleMFOAction(socket, GLOBALS, action, message) {
    try {
        switch (action) {

            case "QR_PRINT_LIST":
                logger.info("QR_PRINT_LIST, log QR's as printed");

                for (const QRDATA of GLOBALS.QR_PRINTSET) {
                    logger.debug("printed:" + QRDATA);
                    const today = new Date();
                    const dateString = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
                    await GLOBALS.DB_QS.Query(
                        'UPDATE hwv00_orders SET orderTimeQrPrinted = ? WHERE orderQr = ?',
                        [dateString, QRDATA]
                    );
                    await GLOBALS.DB_QS.Query(
                        'UPDATE hwv00_orders SET orderStatus = \"printed\" WHERE orderQr = ?',
                        [QRDATA]
                    );
                }
                break;

            case "OPERATOR_QR_FREEPASS":
                logger.info("OPERATOR_QRFREEPASS");
                await HW_DB_OPERATOR_QRCREATE_TAG_FREEPASS(GLOBALS);
                break;

            case "OPERATOR_QR_TESTPASS":
                logger.info("OPERATOR_QRTESTPASS");
                await HW_DB_OPERATOR_QRCREATE_TAG_TESTPASS(GLOBALS);
                break;

            case "OPERATOR_QR_TAG":
                logger.info("OPERATOR_QR_TAG");
                await HW_DB_OPERATOR_QRCREATE_TAG(GLOBALS);
                break;

            case "OPERATOR_CREATE_QRCODES":
                logger.info("OPERATOR_CREATE_QRCODES");
                const createdQRData = await HW_DB_ORDER_QRCREATE(GLOBALS);
                logger.debug("SENDING UPDATED QRCODES AFTER CREATE");
                const createR = `___SIO_LIST_QR___${createdQRData}`;
                socket.emit("MFS", createR);
                break;

            case "OPERATOR_GET_QRVALIDCODES":
                logger.info("OPERATOR_GET_QRVALIDCODES");
                const validQRData = await HW_DB_ORDER_GET_QRVALID(GLOBALS);
                const validR = `___SIO_LIST_QR___${validQRData}`;
                logger.debug("SENDING QRCODES VALID");
                socket.emit("MFS", validR);
                break;
        }
    } catch (err) {
        logger.error("Error in handleMFOAction:", err);
        socket.emit("MFS", `___ERROR___${err.message}`);
    }
}

/**
 * @function HW_DB_OPERATOR_QRCREATE_TAG
 * @description Generates new QR codes and adds them to the database
 * @param {Object} GLOBALS - The application context
 * @returns {Promise<string>} Path to generated QR code
 */
function HW_DB_OPERATOR_QRCREATE_TAG(GLOBALS) {
    return new Promise((resolve, reject) => {
        logger.debug("HW_DB_OPERATOR_QRCREATE_TAG");
        const qr = require('qrcode');
        const qrData = "HWQR_________OPERATOR";
        fs.mkdirSync(config.vendingConfig.qrCodePathOperator, { recursive: true });
        let QRpathAndFile = config.vendingConfig.qrCodePathOperator + qrData + ".png";
        logger.debug("HW_DB_OPERATOR_QRCREATE_TAG" + QRpathAndFile);

        qr.toFile(QRpathAndFile, qrData, {
            errorCorrectionLevel: 'H'
        }, (err) => {
            if (err) {
                logger.error("QR CREATION ERROR:", err);
                reject(new Error(`QR generation failed: ${err.message}`));
            } else {
                logger.debug("QR generated at:", QRpathAndFile);
                resolve(QRpathAndFile);
            }
        });
    });
}

/**
 * @function HW_DB_OPERATOR_QRCREATE_TAG_TESTPASS
 * @description Generates new QR codes and adds them to the database
 * @param {Object} GLOBALS - The application context
 * @returns {Promise<string>} Path to generated QR code
 */
function HW_DB_OPERATOR_QRCREATE_TAG_TESTPASS(GLOBALS) {
    return new Promise((resolve, reject) => {
        logger.debug("HW_DB_OPERATOR_QRCREATE_TAG_TESTPASS");
        const qr = require('qrcode');
        const qrData = "HWQR_________TESTPASS";
        fs.mkdirSync(config.vendingConfig.qrCodePathOperator, { recursive: true });
        let QRpathAndFile = config.vendingConfig.qrCodePathOperator + qrData + ".png";

        qr.toFile(QRpathAndFile, qrData, {
            errorCorrectionLevel: 'H'
        }, async (err) => {
            if (err) {
                logger.error("QR CREATION ERROR:", err);
                reject(new Error(`QR generation failed: ${err.message}`));
                return;
            }

            try {
                await upsertSpecialQr(GLOBALS, {
                    orderQr: qrData,
                    orderUserName: 'test',
                    orderUserEmail: 'test@test.com'
                });
                logger.debug("QR generated and recorded at:", QRpathAndFile);
                resolve(QRpathAndFile);
            } catch (dbErr) {
                reject(dbErr);
            }
        });
    });
}

async function upsertSpecialQr(GLOBALS, { orderQr, orderUserName, orderUserEmail }) {
    const ORDER_NEW = {
        orderQr,
        orderStatus: 'open',
        orderCars: '',
        orderUserName,
        orderUserEmail,
        orderTimeQrPrinted: '',
        orderTimeQrScanned: '',
        orderTimeCarsPicked: '',
        time_1: 0,
        time_2: 0,
        time_3: 0,
        time_4: 0,
        time_5: 0,
        terminal_id: '1'
    };

    try {
        await GLOBALS.DB_QS.Query(
            `INSERT INTO hwv00_orders SET ?
             ON DUPLICATE KEY UPDATE
                orderUserName = VALUES(orderUserName),
                orderUserEmail = VALUES(orderUserEmail),
                orderStatus = VALUES(orderStatus),
                orderCars = VALUES(orderCars)`,
            ORDER_NEW
        );
        logger.debug(`Special QR ${orderQr} recorded/updated in database`);
    } catch (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR') {
            logger.warn(`Schema mismatch while inserting ${orderQr}, attempting sanitized insert`);
            const columns = await GLOBALS.DB_QS.Query('SHOW COLUMNS FROM hwv00_orders');
            const allowed = new Set(columns.map(col => col.Field));
            const sanitized = {};
            Object.entries(ORDER_NEW).forEach(([key, value]) => {
                if (allowed.has(key)) {
                    sanitized[key] = value;
                }
            });
            if (!sanitized.orderQr) {
                sanitized.orderQr = orderQr;
            }
            await GLOBALS.DB_QS.Query(
                `INSERT INTO hwv00_orders SET ?
                 ON DUPLICATE KEY UPDATE
                    orderUserName = VALUES(orderUserName),
                    orderUserEmail = VALUES(orderUserEmail),
                    orderStatus = VALUES(orderStatus)`,
                sanitized
            );
            logger.debug(`Sanitized insert succeeded for ${orderQr}`);
        } else {
            logger.error(`Failed to record special QR ${orderQr}:`, err);
            throw err;
        }
    }
}

/**
 * @function HW_DB_OPERATOR_QRCREATE_TAG_FREEPASS
 * @description Generates new QR codes and adds them to the database
 * @param {Object} GLOBALS - The application context
 * @returns {Promise<string>} Path to generated QR code
 */
function HW_DB_OPERATOR_QRCREATE_TAG_FREEPASS(GLOBALS) {
    return new Promise((resolve, reject) => {
        logger.debug("HW_DB_OPERATOR_QRCREATE_TAG_FREEPASS");


        const qr = require('qrcode');
        const qrData = "HWQR_________FREEPASS";
        fs.mkdirSync(config.vendingConfig.qrCodePathOperator, { recursive: true });
        let QRpathAndFile = config.vendingConfig.qrCodePathOperator + qrData + ".png";

        qr.toFile(QRpathAndFile, qrData, {
            errorCorrectionLevel: 'H'
        }, async (err) => {
            if (err) {
                logger.error("QR CREATION ERROR:", err);
                reject(new Error(`QR generation failed: ${err.message}`));
                return;
            }

            try {
                await upsertSpecialQr(GLOBALS, {
                    orderQr: qrData,
                    orderUserName: 'freepass',
                    orderUserEmail: 'freepass@example.com'
                });
                logger.debug("QR generated and recorded at:", QRpathAndFile);
                resolve(QRpathAndFile);
            } catch (dbErr) {
                reject(dbErr);
            }
        });
    });
}

/**
 * @function HW_DB_ORDER_QRCREATE
 * @description Generates new QR codes and adds them to the database
 * @param {Object} GLOBALS - The application context
 * @returns {Promise<string>} HTML formatted message with QR codes
 */
async function HW_DB_ORDER_QRCREATE(GLOBALS) {
    logger.debug("HW_DB_ORDER_QRCREATE");
    const qr = require('qrcode');
    const util = require('util');
    const qrToFile = util.promisify(qr.toFile);

    logger.debug("creating " + config.vendingConfig.qrCodeCreateNum + " new QR codes");

    // Ensure QR code directory exists
    try {
        fs.mkdirSync(config.vendingConfig.qrCodePath, { recursive: true });
        logger.debug('QR code directory verified: ' + config.vendingConfig.qrCodePath);
    } catch (err) {
        logger.error('Error creating QR code directory: ' + err);
        throw err;
    }

    // Create QR codes and database entries
    const promises = [];
    for (let qrloop = 0; qrloop < config.vendingConfig.qrCodeCreateNum; qrloop++) {

        let qrData = "";
        if (GLOBALS.SYSTEMMODE == "SYSTEM_RETAILMODE") {
            qrData = "HWQR" + new Date().getTime() + "_" + (qrloop + 1).toString().padStart(3, '0');
        }
        if (GLOBALS.SYSTEMMODE == "SYSTEM_DEVMODE") {
            qrData = "DVQR" + new Date().getTime() + "_" + (qrloop + 1).toString().padStart(3, '0');
        }
        let QRpathAndFile = config.vendingConfig.qrCodePath + qrData + ".png";

        // Create QR code file
        fs.mkdirSync(config.vendingConfig.qrCodePath, { recursive: true });
        fs.mkdirSync(config.vendingConfig.qrCodePathOperator, { recursive: true });

        promises.push(
            qrToFile(QRpathAndFile, qrData) //, { errorCorrectionLevel: 'H' }
                .then(async () => {
                    const ORDER_NEW = {
                        orderQr: qrData,
                        orderStatus: "open",
                        orderCars: '',
                        orderUserName: '',
                        orderUserEmail: '',
                        orderTimeQrPrinted: '',
                        orderTimeQrScanned: '',
                        orderTimeCarsPicked: '',
                        time_1: 0,
                        time_2: 0,
                        time_3: 0,
                        time_4: 0,
                        time_5: 0,
                        terminal_id: 0
                    };

                    try {
                        await GLOBALS.DB_QS.Query('INSERT INTO hwv00_orders SET ?', ORDER_NEW);
                        logger.debug('Added QR to database: ' + qrData);
                    } catch (err) {
                        if (err.code === 'ER_BAD_FIELD_ERROR') {
                            logger.warn('hwv00_orders schema missing columns; attempting fallback insert');
                            try {
                                const columns = await GLOBALS.DB_QS.Query('SHOW COLUMNS FROM hwv00_orders');
                                const allowed = new Set(columns.map(col => col.Field));
                                const sanitized = {};
                                Object.entries(ORDER_NEW).forEach(([key, value]) => {
                                    if (allowed.has(key)) {
                                        sanitized[key] = value;
                                    }
                                });
                                if (!sanitized.orderQr) {
                                    sanitized.orderQr = qrData;
                                }
                                if (!sanitized.orderStatus) {
                                    sanitized.orderStatus = 'open';
                                }
                                await GLOBALS.DB_QS.Query('INSERT INTO hwv00_orders SET ?', sanitized);
                                logger.debug('Fallback QR insert succeeded for ' + qrData);
                            } catch (fallbackErr) {
                                logger.error('Fallback insert failed:', fallbackErr);
                                throw fallbackErr;
                            }
                        } else if (err.code === 'ER_DUP_ENTRY') {
                            logger.warn('Duplicate QR detected: ' + qrData + ' – skipping');
                        } else {
                            logger.error('Error inserting QR into database:', err);
                            throw err;
                        }
                    }
                })
        );
    }

    // Wait for all QR codes to be created and inserted
    await Promise.all(promises);

    // Get updated list of QR codes
    logger.debug("HW_DB_ORDER_QRCREATE getting full list of QR");

    try {
        const RES_QRS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_orders', []);

        if (RES_QRS.length < 1) {
            logger.warn("No QR codes found in database");
            return "No QR codes found in database";
        }

        let MSG = "HW_DB.QRCREATE => UPDATED QR LIST AFTER CREATING NEW ONES:";
        MSG += "<div class=blockContent>";

        RES_QRS.forEach((row) => {
            MSG += "<div class=blockContent>";
            MSG += "<div class=item>" + row.orderQr + "status:" + row.orderStatus + "</div>";
            MSG += "<img class=qr_hwlogo src='/hw_img/Hot_Wheels_logo.svg.png'>";
            MSG += "<img class=qr_img src='/qr/" + row.orderQr + ".png'>";
            MSG += "</div>";
        });

        MSG += "</div>";
        return MSG;

    } catch (err) {
        logger.error('Error retrieving QR codes:', err);
        throw err;
    }
}

/**
 * @function HW_DB_ORDER_GET_QRVALID
 * @description Retrieves and displays valid QR codes from the database
 * @param {Object} GLOBALS - The application context
 * @returns {Promise<string>} HTML formatted message with valid QR codes
 */

async function HW_DB_ORDER_GET_QRVALID(GLOBALS) {
    let MSG = "";
    MSG += "<div class=btnWide onclick=printQR('DIV_QRCODES');>&#128438; print list </div>";
    MSG += "<div class=blockContent>";
    logger.debug("HW_DB_ORDER_GET_QRVALID");

    try {
        const RES_QRS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_orders WHERE orderStatus = ?', ['open']);
        logger.debug(`HW_DB_ORDER_GET_QRVALID _ sending list QR to terminal (${RES_QRS.length})`);

        // Delete all QR files first (do this ONCE, not in the loop)
        const fs = require('fs');
        const qr = require('qrcode');
        const util = require('util');
        const qrToFile = util.promisify(qr.toFile);
        const readdir = util.promisify(fs.readdir);
        const unlink = util.promisify(fs.unlink);

        try {
            const files = await readdir(GLOBALS.config.vendingConfig.qrCodePath);
            const deletePromises = files
                .filter(file => file.endsWith('.png'))
                .map(file => unlink(`${GLOBALS.config.vendingConfig.qrCodePath}/${file}`));
            await Promise.all(deletePromises);
            console.log('All PNG files deleted from directory');
        } catch (err) {
            console.error('Error deleting files:', err);
        }

        GLOBALS.QR_PRINTSET = new Set();
        // Generate all QR codes FIRST, then build HTML
        const qrCreationPromises = RES_QRS.map(async (row) => {
            const qrData = row.orderQr;

            if (row.orderStatus == "open") {
                // add to set to print
                GLOBALS.QR_PRINTSET.add(qrData);
                let QRpathAndFile = GLOBALS.config.vendingConfig.qrCodePath + qrData + ".png";

                // Create QR code file
                await qrToFile(QRpathAndFile, qrData);
                logger.warn(`QR code created: ${QRpathAndFile}`);

                return row; // Return the row for later use
            }
        });

        // Wait for ALL QR codes to be created
        const rowsWithQRCodes = await Promise.all(qrCreationPromises);
        logger.debug('All QR codes have been created');
        // Add a small delay to ensure file system has flushed writes
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Now build the HTML after all files are written
        MSG += "<div class=blockContainer id='DIV_QRCODES'>";
        MSG += "<div class=operator_instruction><h2>Instruction</h2></div>";
        MSG += "<div class=operator_instruction>Save the print in a PDF file (with a proper date in the name) and use that for actual printing.</div>";
        MSG += "<div class=operator_instruction>QR codes will be set to 'printed' after printing, so they can only be printed ONCE (to avoid doubles in circulation).</div>";
        MSG += "<div class=operator_instruction>QR codes will be set to 'inCue' after they have been scanned for vending and the cars have been selected (but not yet picked by the robot). This takes the queue lining (of the picking) into consideration. In case of system down/startup these QR codes are reset and can then be used again.</div>";
        MSG += "<div class=operator_instruction>QR codes will be set to 'processed' after the cars have actually been picked by the robot (it is now assumed that the client has received the cars). Scanning the QR will show information about the completed order process.</div>";

        MSG += "<div class=red>There are (" + RES_QRS.length + ") qr codes left valid</div>";

        // Now build HTML with the created QR codes
        rowsWithQRCodes.forEach((row) => {
            const qrtagfile = row.orderQr || '';
            let timeStamp;

            // Pattern-based timestamp (HWQR<epoch>_<seq>)
            const datum = qrtagfile.length >= 17 ? qrtagfile.substring(4, 17) : qrtagfile;
            const match = datum.match(/\d+/);
            if (match) {
                timeStamp = new Date(parseInt(match[0], 10));
            }

            // Fallback to orderTimeQrScanned if parsing failed
            if (!timeStamp || isNaN(timeStamp.getTime())) {
                timeStamp = row.orderTimeQrScanned ? new Date(row.orderTimeQrScanned) : null;
            }

            // Final fallback: current time
            if (!timeStamp || isNaN(timeStamp.getTime())) {
                timeStamp = new Date();
            }

            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            const monthIndex = timeStamp.getMonth();
            const monthName = months[monthIndex];
            const qrDateOfCreation = timeStamp.getFullYear() + "." + monthName + "." + timeStamp.getDate() + " (" + timeStamp.getHours() + ":" + timeStamp.getMinutes() + ")";
            const today = new Date();

            MSG += "<div class=QRtagBlock>";
            MSG += "<div class=blockContent>QRdate:" + qrDateOfCreation + " / printDate:" + today + "</div>";
            MSG += "<img class=qr_hwlogo src='/hw_img/Hot_Wheels_logo.svg.png'>";
            MSG += "<img class=qr_img src='/qr/" + row.orderQr + ".png'>";
            MSG += "<div class=qr_note>SCAN THIS CODE AT THE HOTWHEELS ROBOTIC GARAGE AND SELECT YOUR CARS. HAVE FUN!</div>";
            MSG += "</div>";
        });

        MSG += "</div>";
        MSG += "</div>";

        if (RES_QRS.length < 1) {
            return "QR have run out. You need to create new QR codes. Click CREATE QR CODES to generate new ones";
        }

        return MSG;

    } catch (err) {
        logger.error('Error retrieving valid QR codes:', err);
        throw err;
    }
}

async function HW_QR_ENSURE_SPECIAL_CODES(GLOBALS) {
    const tasks = [
        { name: 'OPERATOR', fn: HW_DB_OPERATOR_QRCREATE_TAG },
        { name: 'TESTPASS', fn: HW_DB_OPERATOR_QRCREATE_TAG_TESTPASS },
        { name: 'FREEPASS', fn: HW_DB_OPERATOR_QRCREATE_TAG_FREEPASS }
    ];

    for (const task of tasks) {
        try {
            await task.fn(GLOBALS);
            logger.info(`Ensured ${task.name} QR code exists`);
        } catch (err) {
            logger.error(`Failed to ensure ${task.name} QR code: ${err.message || err}`);
        }
    }
}

module.exports = {
    HW_ORDER_QR_SIO,
    HW_QR_ENSURE_SPECIAL_CODES,
    __TEST__: {
        HW_DB_ORDER_QRCREATE,
        HW_DB_OPERATOR_QRCREATE_TAG,
        HW_DB_OPERATOR_QRCREATE_TAG_TESTPASS,
        HW_DB_OPERATOR_QRCREATE_TAG_FREEPASS
    }
}
