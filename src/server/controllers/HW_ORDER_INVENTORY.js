// enable custom logging
const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('INVT');

/**
 * Register event handlers for MFC messages on SocketIO
 * @param {*} GLOBALS 
 */
function HW_INVENTORY_SIO(GLOBALS) {
    // Set up event handlers once at server startup
    GLOBALS.SIO.sockets.on('connection', (socket) => {
        socket.on("MFO", function (e) {
            let terminal = e.split("___")[0];
            let action = e.split("___")[1];
            let message = e.split("___")[2];
            let macAddress = e.split("___")[3];

            logger.debug(`Inventory SIO MFO action: ${action}`);
            handleMFOAction(socket, GLOBALS, action, message);
        });
    });
}

function handleMFOAction(socket, GLOBALS, action, message) {


    switch (action) {

        case "DEV_FIVE_ORDERS":
            logger.warn("========================= DEV_FIVE_ORDERS");
            DEV_DB_POPULATE(GLOBALS, "DEV_FIVE_ORDERS");
            break;

        case "DEV_ONE_PICKING":
            logger.warn("========================= DEV_ONE_PICKING");
            DEV_DB_POPULATE(GLOBALS, "DEV_ONE_PICKING");
            break;

        case "DEV_CUELINE_EMPTY":
            logger.warn("========================= DEV_CUELINE_EMPTY");
            DEV_DB_POPULATE(GLOBALS, "DEV_CUELINE_EMPTY");
            break;

        case "DEV_CUELINE_FULL":
            logger.warn("========================= DEV_CUELINE_FULL");
            DEV_DB_POPULATE(GLOBALS, "DEV_CUELINE_FULL");
            break;

        case "DEV_MACHINE_EMPTY":
            logger.warn("========================= DEV_MACHINE_EMPTY");
            DEV_DB_POPULATE(GLOBALS, "DEV_MACHINE_EMPTY");
            break;

        case "DEV_MACHINE_FULL":
            logger.warn("========================= DEV_MACHINE_FULL");
            DEV_DB_POPULATE(GLOBALS, "DEV_MACHINE_FULL");
            break;

        case "OPERATOR_addToWareHouse":
            logger.info("handleMFOAction OPERATOR_addToWareHouse");
            break;

        case "OPERATOR_emptyCarsFromCassetteToWarehouse":
            let casNrEmtpy = message;
            logger.debug("handleMFOAction OPERATOR_emptyCarsFromCassetteToWarehouse, casnr:" + casNrEmtpy);
            HW_DB_INVENTORY_EMPTYCASSETTE(GLOBALS, casNrEmtpy, (err, data) => {
                if (err) {
                    logger.error("OPERATOR_emptyCarsFromCassetteToWarehouse An error occurred:", err);
                } else {
                    logger.info("casNr " + casNrEmtpy + " was emptied");
                }
            });
            break;

        case "OPERATOR_fillUpCassette":
            logger.info("handleMFOAction OPERATOR_fillUpCassette");
            let casNrFill = message;

            HW_DB_INVENTORY_FILLCASSETTE(GLOBALS, casNrFill, (err, data) => {
                if (err) {
                    logger.error("An error occurred in OPERATOR_fillUpCassette:", err);
                } else {
                    logger.info("casNr " + casNrFill + " was filled up");
                }
            });
            break;

        case "OPERATOR_GETINVENTORY_ALL":
            logger.info("handleMFOAction OPERATOR_GETINVENTORY_ALL");

            HW_DB_INVENTORY_READ(GLOBALS, "ALL", (err, data) => {
                if (err) {
                    logger.error("An error occurred in OPERATOR_GETINVENTORY_ALL:", err);
                } else {
                    const Rterminal = ""
                    const Raction = "SIO_LISTINVENTORY";
                    const Rmessage = data;
                    const E = "MFS";
                    var R = Rterminal + "___" + Raction + "___" + Rmessage;
                    logger.debug("SENDING INVENTORY");
                    socket.emit(E, R); // message to ONE client 
                }
            });
            break;

        case "OPERATOR_GETINVENTORY_FILL":
            HW_DB_INVENTORY_READ(GLOBALS, "FILL", (err, data) => {
                if (err) {
                    logger.error("An error occurred in OPERATOR_GETINVENTORY_FILL:", err);
                } else {
                    const Rterminal = ""
                    const Raction = "SIO_LISTINVENTORY";
                    const Rmessage = data;
                    const E = "MFS";
                    var R = Rterminal + "___" + Raction + "___" + Rmessage;
                    logger.debug(" SENDING INVENTORY");
                    socket.emit(E, R); // message to ONE client 
                }
            });
            break;

        case "OPERATOR_GETINVENTORY_WAREHOUSE":
            const type = action.replace("OPERATOR_GETINVENTORY_", "");
            HW_DB_INVENTORY_READ(GLOBALS, type, (err, data) => {
                if (err) {
                    logger.error(`An error occurred in ${action}:`, err);
                } else {
                    const Rterminal = ""
                    const Raction = "SIO_LISTINVENTORY";
                    const Rmessage = data;
                    const E = "MFS";
                    var R = Rterminal + "___" + Raction + "___" + Rmessage;
                    logger.debug("SENDING INVENTORY");
                    socket.emit(E, R); // message to ONE client 
                }
            });
            break;
    }
}

function HW_DB_INVENTORY_EMPTYCASSETTE(GLOBALS, casNr, callback) {
    HW_DB_INVENTORY_CAS_UPDATE_CARS(GLOBALS, casNr, callback, 'empty');
}

function HW_DB_INVENTORY_FILLCASSETTE(GLOBALS, casNr, callback) {
    HW_DB_INVENTORY_CAS_UPDATE_CARS(GLOBALS, casNr, callback, 'fill');
}


async function DEV_DB_POPULATE(GLOBALS, DB_ACTION) {

    // set to developer database
    const isDev = true;
    GLOBALS.DB_QS.HW_DB_INIT(GLOBALS, isDev);

    switch (DB_ACTION) {

        case "DEV_FIVE_ORDERS":
            logger.warn("xxxx DEV_FIVE_ORDERS");
            await DEV_FIVE_ORDERS(GLOBALS);
            break;

        case "DEV_CUELINE_EMPTY":
            logger.warn("xxxx DEV_CUELINE_EMPTY");
            //await DEV_CUELINE_EMPTY(GLOBALS);
            await GLOBALS.DB_QS.Query('UPDATE  hwv00_orders SET orderStatus = \"picked\" , orderTimeCarsPicked = \"' + new Date().getTime() + '\" WHERE orderStatus= \"inCue\"');
            break;

        case "DEV_CUELINE_FULL":
            await GLOBALS.DB_QS.Query('UPDATE hwv00_orders SET orderStatus = \"inCue\"');
            break;

        case "DEV_ONE_PICKING":
            logger.error("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
            await GLOBALS.DB_QS.Query(`UPDATE hwv00_orders SET orderStatus = 'picking' WHERE orderUserName = 'john'`);
            //await DEV_ONE_PICKING(GLOBALS);
            break;

        case "DEV_CUELINE_ALL_PICKING":
            await GLOBALS.DB_QS.Query('UPDATE hwv00_orders SET orderStatus = \"picking\"');

            break;

        case "DEV_MACHINE_EMPTY":
            logger.error("function not defined yet DEV_MACHINE_EMPTY");
            break;

        case "DEV_MACHINE_FULL":
            logger.error("function not defined yet DEV_MACHINE_FULL");
            break;

    }



}
async function DEV_MACHINE_FULL(GLOBALS) {
    function callback() {
        //logger.info("callbackking");
    }

    const isDev = true;
    GLOBALS.DB_QS.HW_DB_INIT(GLOBALS, isDev);
    // fill up all cassettes
    for (let c = 0; c < 162; c++) {
        let casNr = c;
        HW_DB_INVENTORY_CAS_UPDATE_CARS(GLOBALS, casNr, callback, 'fill');
    }

}
async function DEV_CUELINE_EMPTY(GLOBALS) {
    await GLOBALS.DB_QS.Query('UPDATE  hwv00_orders SET orderStatus = \"picked\" , orderTimeCarsPicked = \"' + new Date().getTime() + '\" WHERE orderStatus= \"inCue\"');
}



async function DEV_FIVE_ORDERS(GLOBALS) {


    const qty = 7;
    logger.info("xxx DEV_FIVE_ORDERS ");
    function callback() {
        //logger.info("callbackking");
    }
    const isDev = true;
    GLOBALS.DB_QS.HW_DB_INIT(GLOBALS, isDev);

    // car in order
    const cars = await GLOBALS.DB_QS.Query(
        'SELECT * FROM hwv00_cars'
    );
    let orderCars = [];
    let carNr = 0;
    let carNrMax = 3;
    for (const car of cars) {

        if (carNr < carNrMax) {
            logger.warn(carNr + "/" + car.carAssets);
            orderCars.push(car.carAssets); // add first 3 cars
        }
        carNr++;
    }

    await GLOBALS.DB_QS.Query('DELETE FROM hwv00_orders');

    // create QR orderscodes
    await DEV_DB_QRCREATE(GLOBALS, qty);




    const orders = await GLOBALS.DB_QS.Query(
        'SELECT * FROM hwv00_orders'
    );
    let orderNr = 0;
    let orderNrMax = qty;

    for (const order of orders) {
        // update orders in cueline

        let terminalNr = 1;
        orderNr++;
        if (orderNr % 2 === 0) {
            terminalNr = 2;
        }
        let userNames = ["jim", "lisa", "john", "nick", "jamie", "william", "sandy"];
        let userEmails = ["jim@mail.com", "lisa@mail.com", "john@mail.com", "nick@mail.com", "jamie@mail.com", "william@mail.com", "sandy@mail.com"];

        if (orderNr < orderNrMax) {

            let req = {};
            req.body = {};
            const updateData = {
                orderUserName: userNames[orderNr],
                orderUserEmail: userEmails[orderNr],
                orderQr: order.orderQr,
                orderCars: "[" + orderCars + "]",
                orderStatus: 'inCue',
                orderTimeQrScanned: new Date(),
                orderTimeCarsPicked: '',
                terminal_id: terminalNr//req.body.terminalId || '1'
            };
            const params = [
                updateData.orderUserName,
                updateData.orderUserEmail,
                updateData.orderQr,
                updateData.orderCars,
                updateData.orderStatus,
                updateData.orderTimeQrScanned,
                updateData.orderTimeCarsPicked,
                updateData.terminal_id,
                updateData.orderQr
            ];
            //GLOBALS.HW_VENDING_L_CLIENT_ORDER_PLACED(GLOBALS, req, callback);
            const sql = 'UPDATE hwv00_orders SET orderUserName = ?, orderUserEmail = ?, orderQr = ?, orderCars = ?, orderStatus = ?, orderTimeQrScanned = ?, orderTimeCarsPicked = ?, terminal_id = ? WHERE orderQr = ?';
            const result = await GLOBALS.DB_QS.Query(sql, params);
        }
    }

    // update history orders

}

async function DEV_DB_QRCREATE(GLOBALS, qty) {
    qty = 20;
    logger.debug("HW_DB_ORDER_QRCREATE");
    const fs = require('fs');
    const qr = require('qrcode');
    const util = require('util');
    const qrToFile = util.promisify(qr.toFile);

    logger.debug("creating " + GLOBALS.config.vendingConfig.qrCodeCreateNum + " new QR codes");

    // Ensure QR code directory exists
    try {
        fs.mkdirSync(GLOBALS.config.vendingConfig.qrCodePath, { recursive: true });
        logger.debug('QR code directory verified: ' + GLOBALS.config.vendingConfig.qrCodePath);
    } catch (err) {
        logger.error('Error creating QR code directory: ' + err);
        throw err;
    }

    // Create QR codes and database entries
    const promises = [];
    //for (let qrloop = 0; qrloop < GLOBALS.config.vendingConfig.qrCodeCreateNum; qrloop++) {
    for (let qrloop = 0; qrloop < qty; qrloop++) {
        const qrData = "DEVX" + new Date().getTime() + "_" + (qrloop + 1).toString().padStart(3, '0');
        let QRpathAndFile = GLOBALS.config.vendingConfig.qrCodePath + qrData + ".png";

        // Create QR code file
        promises.push(
            // qrToFile(QRpathAndFile, qrData, { errorCorrectionLevel: 'H' })
            qrToFile(QRpathAndFile, qrData)
                .then(async () => {
                    // Create database entry
                    const ORDER_NEW = {
                        orderQr: qrData,
                        orderStatus: "open",
                        orderTimeQrPrinted: ''
                    };

                    try {
                        const params = [ORDER_NEW];
                        await GLOBALS.DB_QS.Query('INSERT INTO hwv00_orders SET ?', params);
                        logger.debug('Added QR to database: ' + qrData);
                    } catch (err) {
                        logger.error('Error inserting QR into database:', err);
                        throw err;
                    }
                })
        );
    }

    // Wait for all QR codes to be created and inserted
    await Promise.all(promises);

    // Get updated list of QR codes
    logger.debug("HW_DB_ORDER_QRCREATE getting full list of QR");
}



async function HW_DB_INVENTORY_CAS_UPDATE_CARS(GLOBALS, casNr, callback, operationType) {
    try {
        logger.info(`HW_DB_${operationType.toUpperCase()}CASSETTE casNr: ${casNr}`);

        const cassette = await GLOBALS.DB_QS.Query(
            'SELECT * FROM hwv00_cassettes WHERE casNr = ?',
            [casNr]
        );

        const { casCarAmount: carsInCas, casCarAssets: carAssets } = cassette[0];
        let fillAmount, newCasAmount;

        if (operationType === 'empty') {
            fillAmount = -carsInCas;
            newCasAmount = 0;
        } else { // fill
            fillAmount = GLOBALS.maxAmountCarsInCassette - carsInCas;
            newCasAmount = GLOBALS.maxAmountCarsInCassette;
        }

        logger.info(`maxAmountCarsInCassette: ${GLOBALS.maxAmountCarsInCassette} carsInCas: ${carsInCas}`);

        logger.info(`${operationType} Cassette ${casNr} has ${carsInCas} cars, assets: ${carAssets}, fill amount: ${fillAmount}`);

        // Update warehouse
        await GLOBALS.DB_QS.Query(
            'UPDATE hwv00_cars SET carAmountWarehouse = carAmountWarehouse - ? WHERE carAssets = ?',
            [fillAmount, carAssets]
        );

        // Update cassette
        await GLOBALS.DB_QS.Query(
            'UPDATE hwv00_cassettes SET casCarAmount = ? WHERE casNr = ?',
            [newCasAmount, casNr]
        );

        if (operationType === 'empty') {
            const warehouseResult = await GLOBALS.DB_QS.Query(
                'SELECT carAmountWarehouse FROM hwv00_cars WHERE carAssets = ?',
                [carAssets]
            );
            logger.info(`Warehouse read success: ${JSON.stringify(warehouseResult)}`);
        }

        callback(null, { success: true });
    } catch (err) {
        logger.error(`Error in ${operationType} operation: ${err.stack}`);
        callback(err, null);
    }
}

async function HW_DB_INVENTORY_READ(GLOBALS, x, callback) {
    try {
        logger.info("HW_DB_INVENTORY_READ:" + x);

        // Get all cars
        const RES_CARS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_cars');
        logger.debug(`HW_DB_INVENTORY_READ _ SENDING LIST OF CARS (${RES_CARS.length})`);

        let MSG = "<div class=btn onclick=printDiv('inventory_list');>&#128438; print list</div>";
        MSG += "<div id=inventory_list>";
        MSG += `<div class=wide>HOTWHEELS /  CARS LIST INVENTORY => total cars:(${RES_CARS.length})</div>`;

        MSG += "<div class=inventory_list>";
        MSG += "<table width=100%>";
        MSG += "<tr>";
        MSG += "<td class=inventory_cell>IMG";
        MSG += "<td class=inventory_cell>CAR NAME";
        MSG += "<td class=inventory_cell>CATEGORY";
        MSG += "<td class=inventory_cell>CAR REF / 360";
        MSG += "<td class=inventory_cell>Amount In Cassette";
        MSG += "</tr>";

        for (const CAR of RES_CARS) {
            // Get category info
            const RES_CATEGORIES = await GLOBALS.DB_QS.Query(
                'SELECT * FROM hwv00_categories WHERE categoryId = ?',
                [CAR.carCategoryId]
            );
            const carCategoryName = RES_CATEGORIES.length > 0 ? RES_CATEGORIES[0].categoryName : 'Unknown Category';

            // Get cassette info
            const RES_CASSETTES = await GLOBALS.DB_QS.Query(
                'SELECT * FROM hwv00_cassettes WHERE casCarAssets = ?',
                [CAR.carAssets]
            );

            for (const CAS of RES_CASSETTES) {
                if (CAS.casCarAssets === CAR.carAssets) {
                    if (x == "ALL" || CAS.casCarAmount < GLOBALS.maxAmountCarsInCassette && x != "WAREHOUSE") {
                        MSG += "<tr>";
                        MSG += `<td class=inventory_cell><img class=inventory_image src='/hw_cars/${CAR.carAssets}/images/Photo001.png'>`;
                        MSG += `<td class=inventory_cell>${CAR.carName}`;
                        MSG += `<td class=inventory_cell>${carCategoryName}`;
                        MSG += `<td class=inventory_cell>${CAR.carAssets}`;
                        MSG += `<td class=inventory_cell>amount:${CAS.casCarAmount}`;
                        MSG += `<br>cassette: ${CAS.casNr}<br><button class=btn onclick=fillUpCassette(${CAS.casNr})>FILL UP (${GLOBALS.maxAmountCarsInCassette - CAS.casCarAmount})</button>`;
                        MSG += "<br>(load cars from warehouse into machine)";
                        MSG += `<br><button class=btn onclick=emptyCarsFromCassetteToWarehouse(${CAS.casNr})>TAKE OUT (${CAS.casCarAmount})</button>`;
                        MSG += "</tr>";
                    }
                }
            }

            if (x == "ALL" || x == "WAREHOUSE") {
                MSG += "<tr>";
                MSG += `<td class=inventory_cell_warehouse><img class=inventory_image src='/hw_cars/${CAR.carAssets}/images/Photo001.png'>`;
                MSG += `<td class=inventory_cell_warehouse>${CAR.carName}`;
                MSG += `<td class=inventory_cell_warehouse>${carCategoryName}`;
                MSG += `<td class=inventory_cell_warehouse>${CAR.carAssets}`;
                MSG += `<td class=inventory_cell_warehouse>warehouse:${CAR.carAmountWarehouse}`;
                //MSG += `<br><button class=btn onclick=updateWareHouse(${CAR.carAssets})> NEW ARRIVAL ${CAR.carAssets} </button>`;
                MSG += `<br><button class=btn onclick=updateWareHouse("${CAR.carAssets}")> UPDATE WAREHOUSE ${CAR.carAssets} </button>`;

                // MSG += "<br><button class=btn onclick=hello()>NEW ARRIVAL</button>";
                MSG += "</tr>";
            }
        }
        MSG += "</div></div>";
        callback(null, MSG);
    } catch (error) {
        logger.error('HW_DB_INVENTORY_READ error:' + error);
        callback(error, null);
    }
}

async function HW_DB_INSERT_CATEGORY_NEW(GLOBALS, CAT_NEW) {
    try {
        logger.debug("S1_HW_DATABASE:  HW_DB_INSERT_CATEGORY_NEW");
        const result = await GLOBALS.DB_QS.Query('INSERT INTO hwv00_categories SET ?', [CAT_NEW]);
        logger.debug('S1_HW_DATABASE:  HW_DB_INSERT_CATEGORY_NEW Inserted row with ID ' + result.insertId);
        GLOBALS.SIO.emit("MFS", "S1HWDB___S1HWDB_ALERT___NEW CATEGORY WAS ADDED:" + CAT_NEW.categoryName);
    } catch (err) {
        logger.error('S1_HW_DATABASE:  HW_DB_INSERT_CATEGORY_NEW Error inserting data: ' + err.stack);
    }
}

async function HW_DB_INSERT_CAR_NEW(GLOBALS, CAR_NEW) {
    try {
        logger.debug("HW_ORDER_INVENTORY:  HW_DB_INSERT_CAR_NEW" + CAR_NEW);
        const result = await GLOBALS.DB_QS.Query('INSERT INTO hwv00_cars SET ?', [CAR_NEW]);
        logger.debug('HW_ORDER_INVENTORY:  HW_DB_INSERT_CAR_NEW Inserted row with ID ' + result.insertId);
        GLOBALS.SIO.emit("MFS", "S1HWDB___S1HWDB_ALERT___NEW CAR WAS ADDED:" + CAR_NEW.carName);

    } catch (err) {
        logger.error('HW_ORDER_INVENTORY:  HW_DB_INSERT_CAR_NEW  Error inserting data: ' + err.stack);
    }
}



function HW_INVENTORY_HTTP(GLOBALS) {
    logger.debug('HW_INVENTORY_HTTP()' + GLOBALS);
    GLOBALS.Express.post("/HW_DB_CAT_NEW", async function (req, res) {
        try {
            let CAT_UID = new Date().getTime();
            const CAT_NEW = {
                categoryId: CAT_UID,
                categoryName: req.body.CAT_NAME
            }
            logger.debug("S1_HW_DATABASE: HW_DB_POSTCOMMANDS  => CATEGORY_NEW NAME=" + req.body.CAT_NAME);

            const RES_CATS = await GLOBALS.DB_QS.Query(
                "SELECT * FROM hwv00_categories WHERE categoryName = ?",
                [req.body.CAT_NAME]
            );

            if (RES_CATS.length > 0) {
                logger.debug("S1_HW_DATABASE: HW_DB_POSTCOMMANDS _ CATEGORY EXIST ALREADY");
                GLOBALS.SIO.emit("MFS", "S1HWDB___S1HWDB_ALERT___THIS CATEGORY EXISTS ALREADY: " + req.body.CAT_NAME);
            } else {
                await HW_DB_INSERT_CATEGORY_NEW(GLOBALS, CAT_NEW);
            }
        } catch (err) {
            logger.error('S1_HW_DATABASE: HW_DB_POSTCOMMANDS _ Error reading data: ' + err.stack);
        }
    });

    GLOBALS.Express.post("/HW_DB_CAR_NEW", async function (req, res) {
        try {
            let CAR_UID = new Date().getTime();
            const CAR_NEW = {
                carId: CAR_UID,
                carCategoryId: req.body.CAR_CATEGORY,
                carName: req.body.CAR_NAME,
                carAssets: req.body.CAR_ASSETS,
                carHeight: req.body.CAR_HEIGHT,
                carLength: req.body.CAR_LENGTH,
                carSpeed: req.body.CAR_SPEED,
                carAcceleration: req.body.CAR_ACC
            };

            logger.debug("S1_HW_DATABASE: HW_DB_POSTCOMMANDS => CAR_NEW NAME=" + req.body.CAR_NAME + " | in category: " + req.body.CAR_CATEGORY);

            const RES_CARS = await GLOBALS.DB_QS.Query(
                "SELECT * FROM hwv00_cars WHERE carName = ?",
                [req.body.CAR_NAME]
            );

            if (RES_CARS.length > 0) {
                logger.debug("HW_INVENTORY / HW_DB_CAR_NEW / CAR EXIST ALREADY");
                GLOBALS.SIO.emit("MFS", "S1HWDB___S1HWDB_ALERT___CAR_EXIST_ALREADY:" + req.body.CAR_NAME);
            } else {
                logger.debug("HW_INVENTORY / HW_DB_CAR_NEW / CALL INSERT_NEW_CAR");
                await HW_DB_INSERT_CAR_NEW(GLOBALS, CAR_NEW);
            }
        } catch (err) {
            logger.error('S1_HW_DATABASE: HW_DB_POSTCOMMANDS _ Error reading data: ' + err.stack);
        }
    });


    GLOBALS.Express.post("/HW_DB_WAREHOUSE_UPDATE", async function (req, res) {
        try {
            let CAR_ASSET = req.body.CAR_ASSET;
            let AMOUNT = req.body.WAREHOUSE_AMOUNT;
            logger.warn("--------------------------------------------" + CAR_ASSET + ":" + AMOUNT);

            // const result = await GLOBALS.DB_QS.Query('UPDATE hwv00_cars SET carAmountWarehouse =' + AMOUNT + ' WHERE carAssets ='+CAR_ASSET );
            const result = await GLOBALS.DB_QS.Query(
                'UPDATE hwv00_cars SET carAmountWarehouse = ? WHERE carAssets = ?',
                [AMOUNT, CAR_ASSET]
            );
            logger.warn("--------------------------------------------" +result);
            // await HW_DB_UPDATEWAREHOUSE(GLOBALS, CAR_ASSET, AMOUNT);

            GLOBALS.SIO.emit("MFS", "S1HWDB___S1HWDB_ALERT___UPDATINGWAREHOUSE " + CAR_ASSET + ":" + AMOUNT);

        } catch (err) {
            logger.error('S1_HW_DATABASE: HW_DB_POSTCOMMANDS _ Error reading data: ' + err.stack);
        }
    });



    //////////////////////////////////////////////////////////////////////////////////

    const multer = require('multer');
    const path = require('path');
    const fs = require('fs');
    const upload = multer({ dest: 'public/hw_cars' });
    GLOBALS.Express.post("/HW_DB_CAR_UPLOADPHOTOS", upload.single('file'), (req, res) => {

        logger.warn("------------------------------------------------------");
        const folderPath = 'public/hw_cars/' + req.body.folderPath + "/images/";

        logger.warn("folderPath:" + folderPath + "/images/");
        const fileName = req.body.fileName || req.file.originalname;

        // Create folder if it doesn't exist
        if (!fs.existsSync(folderPath)) {
            logger.warn("======================");
            fs.mkdirSync(folderPath, { recursive: true });
        }

        // Move file to target folder
        const targetPath = path.join(folderPath, fileName);
        fs.renameSync(req.file.path, targetPath);

        res.json({ success: true, path: targetPath });
    });

    logger.debug('LOADED HW_INVENTORY_HTTP()');
}

module.exports = {
    HW_INVENTORY_SIO,
    HW_INVENTORY_HTTP
}
