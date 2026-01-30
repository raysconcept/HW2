// enable custom logging
const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('VEND');

const FREEPASS_QR_CODE = "HWQR_________FREEPASS";


/**
 * Register event handlers for MFC messages on SocketIO
 * @param {*} GLOBALS 
 */
function HW_VENDING_SIO(GLOBALS) {
    // Set up event handlers once at server startup
    GLOBALS.SIO.sockets.on('connection', (socket) => {
        socket.on("MFC", function (e) {

            let terminal = e.split("___")[0];
            let action = e.split("___")[1];
            let message = e.split("___")[2];
            let macAddress = e.split("___")[3];
            logger.debug(`Vending SIO MFC action: ${action}`);
            handleMFCAction(socket, GLOBALS, action, message);
        });
    });
};

async function handleMFCAction(socket, GLOBALS, action, message) {
    try {

        let r_terminal;
        let r_action;
        let r_e;
        let r_m;
        switch (action) {
            case "CLIENT_GETCARSINCAT":
                logger.info("MFCcase: CLIENT_GETCARSINCAT:" + message);
                const CATID = message;
                //const CARSINCAT = await GLOBALS.DB_QS.HW_DB_GET_CARS_IN_CATEGORIE(GLOBALS, CATID);
                const CARSINCAT = await HW_VENDING_GET_CARSINCATEGORIE_ARRAY(GLOBALS, CATID);
                // logger.warn("CARSINCAT" + CARSINCAT);
                /*
                r_terminal = ""
                r_action = "SIO_LISTCARSINCAT";
                r_e = "MFS_VENDING";
                r_m = r_terminal + "___" + r_action + "___" + CARSINCAT;
                logger.debug("SENDING CARSINCAT");
                */
                //GLOBALS.SIO.emit(r_e, r_m); // message to ONE client 


                GLOBALS.SIO.emit("MFS_VENDING_JSON", {  // Send as structured object
                    action: "SIO_LISTCARSINCAT",
                    terminal: "",
                    carsincat: CARSINCAT  // Send the array directly
                });
                break;

            case "CLIENT_GETCATS":
                logger.info("MFCcase: CLIENT_GETCATS:" + message);
                const CATEGORIES = await HW_VENDING_GET_CATS(GLOBALS);
                GLOBALS.SIO.emit("MFS_VENDING_JSON", {  // Send as structured object
                    action: "SIO_LISTCATS",
                    terminal: "",
                    categories: CATEGORIES  // Send the array directly
                });
                break;
        }
    } catch (err) {
        logger.error("Error in handleMFCAction:", err);
        socket.emit("MFS", `___ERROR___${err.message}`);
    }
}

function HW_VENDING_INIT(GLOBALS) {
    logger.debug("LOADED HW_VENDING INIT");

    GLOBALS.Express.post("/CLIENT_GET_LANGUAGE", function (req, res) {
        HW_VENDING_L_CLIENT_GET_LANGUAGE(GLOBALS, req, res);
    });

    GLOBALS.Express.post("/CLIENT_CAR_RESERVE_MIN", function (req, res) {
        HW_VENDING_L_CLIENT_CAR_RESERVE_MIN(GLOBALS, req, res);
    });

    GLOBALS.Express.post("/CLIENT_CAR_RESERVE_ADD", function (req, res) {
        HW_VENDING_L_CLIENT_CAR_RESERVE_ADD(GLOBALS, req, res);
    });

    GLOBALS.Express.post("/CLIENT_QR_CHECK_VALIDITY", function (req, res) {
        HW_VENDING_L_CLIENT_QR_CHECK_VALIDITY(GLOBALS, req, res);
    });

    GLOBALS.Express.post("/CLIENT_ORDER_PLACED", function (req, res) {
        logger.info("/CLIENT_ORDER_PLACED");
        HW_VENDING_L_CLIENT_ORDER_PLACED(GLOBALS, req, res);
    });

}

async function HW_VENDING_L_CLIENT_ORDER_PLACED(GLOBALS, req, res) {
    try {
        logger.info("ORDER: HW_VENDING: CLIENT_ORDER_PLACED");

        if (req?.body?.userName) {
            const updateData = {
                orderUserName: req.body.userName,
                orderUserEmail: req.body.userEmail,
                orderQr: req.body.userQR,
                orderCars: "[" + req.body.userCars + "]",
                orderStatus: 'inCue',
                orderTimeQrPrinted: '',
                orderTimeQrScanned: new Date(),
                orderTimeCarsPicked: '',
                terminal_id: req.body.terminalId || '1'
            };

            // TODO: used for testing, remove later
            if (!updateData.orderQr) {
                logger.warn("QR code was empty, using FREEPASS code");
                updateData.orderQr = FREEPASS_QR_CODE;
            }

            const sql = 'UPDATE hwv00_orders SET orderUserName = ?, orderUserEmail = ?, orderQr = ?, orderCars = ?, orderStatus = ?, orderTimeQrScanned = ?, orderTimeCarsPicked = ?, terminal_id = ? WHERE orderQr = ?';

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

            const result = await GLOBALS.DB_QS.Query(sql, params);

            if (result.affectedRows > 0) {
                logger.debug('CLIENT_ORDER_PLACED: Rows updated: ' + result.affectedRows);
                logger.info("CLIENT_ORDER_PLACED Order Placed: " + JSON.stringify(updateData));
                return res.json({ success: true });
            }

            if (updateData.orderQr === FREEPASS_QR_CODE) {
                logger.warn('CLIENT_ORDER_PLACED: FREEPASS QR not found, creating fallback order automatically');
                await upsertFallbackOrder(GLOBALS, updateData);
                logger.info("CLIENT_ORDER_PLACED Fallback order created: " + JSON.stringify(updateData));
                return res.json({ success: true, fallbackCreated: true });
            }

            logger.warn('CLIENT_ORDER_PLACED: No rows matching the condition found');
            res.status(404).json({ error: 'Order not found' });
        } else {
            logger.warn('CLIENT_ORDER_PLACED Unable to retrieve userName. Check the object structure.');
            res.status(400).json({ error: 'Missing userName in request' });
        }
    } catch (err) {
        logger.error('Error in CLIENT_ORDER_PLACED:', err);
        res.status(500).json({ error: 'Database error' });
    }
}

async function upsertFallbackOrder(GLOBALS, orderData) {
    const sql = `
        INSERT INTO hwv00_orders
            (orderQr, orderStatus, orderCars, orderUserName, orderUserEmail, orderTimeQrPrinted, orderTimeQrScanned, orderTimeCarsPicked, terminal_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            orderStatus = VALUES(orderStatus),
            orderCars = VALUES(orderCars),
            orderUserName = VALUES(orderUserName),
            orderUserEmail = VALUES(orderUserEmail),
            orderTimeQrScanned = VALUES(orderTimeQrScanned),
            orderTimeCarsPicked = VALUES(orderTimeCarsPicked),
            terminal_id = VALUES(terminal_id)
    `;

    const params = [
        orderData.orderQr,
        orderData.orderStatus,
        orderData.orderCars,
        orderData.orderUserName,
        orderData.orderUserEmail,
        orderData.orderTimeQrPrinted || '',
        orderData.orderTimeQrScanned,
        orderData.orderTimeCarsPicked,
        orderData.terminal_id
    ];

    await GLOBALS.DB_QS.Query(sql, params);
}

async function HW_VENDING_L_CLIENT_QR_CHECK_VALIDITY(GLOBALS, req, res) {
    try {
        if (req?.body?.userQR) {
            const userQR = req.body.userQR;
            logger.info("HW_POST CLIENT_QR_CHECK_VALIDITY: Validating QR code: " + userQR);

            const results = await GLOBALS.DB_QS.Query(
                "SELECT * FROM hwv00_orders WHERE orderQr = ? AND orderStatus = ?",
                [userQR, 'printed']
            );

            if (results.length > 0) {
                logger.info("HW_POST CLIENT_QR_CHECK_VALIDITY: is valid");
                res.json({ valid: true });
            } else {
                logger.warn("HW_POST CLIENT_QR_CHECK_VALIDITY: Invalid or already used QR code: " + userQR);
                res.json({ valid: false });
            }
        } else {
            logger.warn('HW_POST CLIENT_QR_CHECK_VALIDITY Invalid request: Missing userQR');
            res.status(400).json({ valid: false, error: 'Missing QR code' });
        }
    } catch (err) {
        logger.error('Error in CLIENT_QR_CHECK_VALIDITY:', err);
        res.status(500).json({ valid: false, error: 'Database error' });
    }
}

async function HW_VENDING_L_CLIENT_CAR_RESERVE_ADD(GLOBALS, req, res) {
    try {
        logger.info("RECEIVED CLIENT_CAR_RRESERVE_ADD");
        if (req?.body?.carAsset) {
            const CAR_ASSET = req.body.carAsset;

            const result = await GLOBALS.DB_QS.Query(
                'UPDATE hwv00_cars SET carReserved = carReserved + 1 WHERE carAssets = ?',
                [CAR_ASSET]
            );

            if (result.affectedRows === 0) {
                logger.warn(`No car found with asset: ${CAR_ASSET}`);
                return res.status(404).json({ error: 'Car not found' });
            }

            logger.info(`Successfully incremented reservation for car: ${CAR_ASSET}`);
            res.json({ success: true, message: 'Reservation updated' });
        } else {
            logger.warn('Unable to process CLIENT_CAR_RESERVATION_ADD - missing carAsset');
            res.status(400).json({ error: 'Missing carAsset in request' });
        }
    } catch (err) {
        logger.error('Error in CLIENT_CAR_RESERVE_ADD:', err);
        res.status(500).json({ error: 'Database error' });
    }
}

async function HW_VENDING_L_CLIENT_CAR_RESERVE_MIN(GLOBALS, req, res) {
    try {
        logger.info("RECEIVED CLIENT_CAR_RESERVATION_MIN");
        if (req?.body?.carAsset) {
            const CAR_ASSET = req.body.carAsset;

            // First check current value to prevent going below 0
            const selectResult = await GLOBALS.DB_QS.Query(
                'SELECT carReserved FROM hwv00_cars WHERE carAssets = ?',
                [CAR_ASSET]
            );

            if (selectResult.length === 0) {
                logger.warn(`No car found with asset: ${CAR_ASSET}`);
                return res.status(404).json({ error: 'Car not found' });
            }

            const currentReserved = selectResult[0].carReserved;

            // Only decrement if > 0
            if (currentReserved > 0) {
                const updateResult = await GLOBALS.DB_QS.Query(
                    'UPDATE hwv00_cars SET carReserved = carReserved - 1 WHERE carAssets = ? AND carReserved > 0',
                    [CAR_ASSET]
                );

                if (updateResult.affectedRows === 0) {
                    logger.warn(`Decrement failed for car: ${CAR_ASSET}`);
                    return res.status(400).json({ error: 'Cannot decrement below 0' });
                }

                logger.info(`Successfully decremented reservation for car: ${CAR_ASSET}`);
                res.json({
                    success: true,
                    message: 'Reservation decremented',
                    newValue: currentReserved - 1
                });
            } else {
                logger.warn(`Attempted to decrement below 0 for car: ${CAR_ASSET}`);
                res.status(400).json({
                    error: 'Reservation already at 0',
                    currentValue: currentReserved
                });
            }
        } else {
            logger.warn('Missing carAsset in CLIENT_CAR_RESERVATION_REMOVE request');
            res.status(400).json({ error: 'Missing carAsset in request' });
        }
    } catch (err) {
        logger.error('Error in CLIENT_CAR_RESERVE_MIN:', err);
        res.status(500).json({ error: 'Database error' });
    }
}

async function HW_VENDING_L_CLIENT_GET_LANGUAGE(GLOBALS, req, res) {
    try {
        logger.info("HW_VENDING_L_CLIENT_GET_LANGUAGE" + req?.body?.lang);
        const USERLANG = req?.body?.lang || "ENG";

        const results = await GLOBALS.DB_QS.Query(
            "SELECT * FROM hwv00_lang WHERE UI_LANGUAGE = ?",
            [USERLANG]
        );

        if (results.length > 0) {
            logger.debug("CLIENT_GET_LANGUAGE:, " + USERLANG);
            const UI_LANG = JSON.stringify(results[0], null, 2);
            res.send(UI_LANG);
        } else {
            logger.warn(`No language data found for ${USERLANG}`);
            res.status(404).json({ error: 'Language not found' });
        }
    } catch (err) {
        logger.error('Error in CLIENT_GET_LANGUAGE:', err);
        res.status(500).json({ error: 'Database error' });
    }
}


/**
 * @function HW_VENDING_GET_CARSINCATEGORIE_ARRAY
 * @description Retrieves cars within a specific category and returns as array
 * @param {Object} GLOBALS - The application context
 * @param {string} categoryId - The ID of the category to filter by
 * @returns {Promise<Array>} - A Promise that resolves with an array of car objects
 */
async function HW_VENDING_GET_CARSINCATEGORIE_ARRAY(GLOBALS, categoryId) {
    logger.info("==== LOADED HW_DB_GET_CARS_IN_CATEGORIE_ARRAY");
    let foundcarAsset = [];
    let CARS_FILTERED = [];

    try {
        const RES_CARS = await GLOBALS.DB_QS.Query(
            `SELECT DISTINCT CARS.carAssets, CASS.casNr, CASS.casCarAmount, CASS.casValid
                FROM hwv00_cars CARS
                JOIN hwv00_cassettes CASS ON CARS.carAssets = CASS.casCarAssets            
                WHERE carCategoryId =? 
                ORDER BY CASS.casCarAmount DESC`,
            [categoryId]
        );

        RES_CARS.forEach(row => {
            logger.debug("CHECK carAssets : (" + row.carAssets + "/ categoryId" + categoryId + " / casNr" + row.casNr + ")");
            if (foundcarAsset.includes(row.carAssets)) {
                logger.info("-- car double:" + row.carAssets);
            } else {
                if (row.casValid == 0) {
                    logger.warn("-- CASSETTE (" + row.casNr + ") NOT VALID");
                } else if (row.casCarAmount < 4) {
                    logger.warn("-- NOT ENOUGH CARS in casssette (" + row.casNr + ")");
                } else {
                    CARS_FILTERED.push(row);
                    logger.debug("OKE:  car " + row.carAssets + "/ in cas " + row.casNr + "/ amount:" + row.casCarAmount);
                    foundcarAsset.push(row.carAssets);
                }
            }
        });

        return CARS_FILTERED;
    } catch (err) {
        logger.error("Error executing join query:", err);
        throw err;
    }
}
/**
 * @function getCategories
 * @description Retrieves categories and validates them
 * @param {Object} GLOBALS - The application context
 * @returns {Promise<Array>} - An array of valid categories
 */
async function HW_VENDING_GET_CATS(GLOBALS) {
    logger.info("HW_ORDER_VENDING_GETCATS");
    const logquery = false;
    if (!logquery) { logger.debug("logging for query in GETCATS turned of, only showing warnings"); }
    try {
        let RES_CATEGORIES;
        try {
            RES_CATEGORIES = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_categories');
        } catch (err) {
            logger.error('Error fetching categories: ' + err.stack);
            throw err;
        }

        let CATS_VALID = [];
        for (const category of RES_CATEGORIES) {
            let RES_CARS;
            try {
                if (logquery) { logger.debug("getting cars in cat" + category.categoryId); }
                RES_CARS = await GLOBALS.DB_QS.Query(
                    'SELECT * FROM hwv00_cars WHERE carCategoryId = ?',
                    [category.categoryId]
                );
            } catch (err) {
                logger.error('Error fetching cars for category: ' + category.categoryId);
                throw err;
            }

            let validCarsInCat = 0;
            for (const car of RES_CARS) {
                let RES_CASSETTES_WITH_THIS_CAR;
                try {
                    if (logquery) { logger.debug("finding cassettes for car" + car.carAssets); }
                    RES_CASSETTES_WITH_THIS_CAR = await GLOBALS.DB_QS.Query(
                        'SELECT * FROM hwv00_cassettes WHERE casCarAssets = ?',
                        [car.carAssets]
                    );
                } catch (err) {
                    logger.error('Error fetching cassettes for car: ' + car.carName);
                    throw err;
                }

                RES_CASSETTES_WITH_THIS_CAR.forEach((thisCassette) => {
                    let amount = thisCassette.casCarAmount;
                    let casValid = thisCassette.casValid;
                    let carValid = car.carValid;

                    if (carValid == true && casValid == true && amount > 3) {
                        validCarsInCat++;
                    }
                });
            }

            if (validCarsInCat > 0) {
                const randomIndex = Math.floor(Math.random() * (RES_CARS.length));
                let randomCar = RES_CARS[randomIndex];
                category.carAssets = randomCar.carAssets;
                category.categoryCarsQty = RES_CARS.length;
                CATS_VALID.push(category);
            } else {
                logger.warn("category has no valid cars:" + category.categoryId + "=" + category.categoryName);
            }
        }
        // SIO respond CATS in handleMFCAction
        let MSG = "<div class=ui_categoryArray id=ui_categoryArray>";
        CATS_VALID.forEach(CAT => {
            MSG += "<div onclick=SIO_getCarsInCat('" + CAT.categoryId + "') class=ui_categoryItem>";
            MSG += "<div class=\"ui_categoryItemName\">" + CAT.categoryName + "</div>";
            //MSG += CAT.categoryCarsQty;
            MSG += "<img class=\"ui_categoryImage\" src=\"hw_cars/" + CAT.carAssets + "/images/Photo010.png\">";
            MSG += "</div>";
        });
        MSG += "</div>";
        // logger.warn("SENDING CATS_VALID:" + CATS_VALID);
        return CATS_VALID;//MSG;//
    } catch (error) {
        logger.error('An error occurred while getting categories:', error);
        throw error; // Re-throw the error to handle it in the calling function
    }
}
module.exports = {
    HW_VENDING_INIT,
    HW_VENDING_SIO,
    __TEST__: {
        HW_VENDING_L_CLIENT_QR_CHECK_VALIDITY
    }
}
