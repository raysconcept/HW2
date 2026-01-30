/**
 * @module HW_DATABASE
 * @description Core database operations module for the HotWheels application.
 * Handles all database interactions including:
 * - Database connection management
 * - Car inventory management
 * - Order processing
 * - QR code management
 * - Race time tracking
 * - Cassette management
 * 
 * @requires mysql
 * @requires winston
 */
const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('DB__');
logger.info("LOADED HW_DB");


const config = require('../config/configMain');
const mysql = require('mysql2');

//////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////// VARS

/**
 * @type {string}
 * @description Database name from configuration
 */
const DBNAME = config.dbConfig.dbName;

logger.info("DBNAME:" + DBNAME)

/**
 * @type {string}
 * @description Database user from configuration
 */
const DBUSER = config.dbConfig.user;

/**
 * @type {string}
 * @description Database host from configuration
 */
const DBHOST = config.dbConfig.host;

/**
 * @type {string}
 * @description Database password from configuration
 */
const DBPASS = config.dbConfig.password;

let DB_ACTIVE = "";

let dbConnection;

//////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////// SERVER METHODS

/**
 * @function HW_DB_HTTP
 * @description Sets up POST route handlers for database operations in the application.
 * Handles various database-related POST requests including:
 * - Creating new categories
 * - Updating car category IDs
 * - Other database management operations
 * 
 * @returns {Promise<void>}
 */
async function HW_DB_HTTP(GLOBALS) {
    logger.info("Setting up Database POST commands");


    GLOBALS.Express.post("/DB_SWITCH_TO_DEVMODE", function (req, res) {
        logger.info("Switching to developer database");
        HW_DB_INIT(GLOBALS, true);
        res.json({ success: true, systemMode: GLOBALS.SYSTEMMODE });

        GLOBALS.SIO.emit("SYSTEM_MODE_CHANGED", { systemMode: GLOBALS.SYSTEMMODE });


        //GLOBALS.SIO.emit("MFS","x___SYSTEM_DEVMODE");
        GLOBALS.SIO.emit("SYSTEM_DEVMODE");

        GLOBALS.SYSTEMMODE = "SYSTEM_DEVMODE";
    });

    GLOBALS.Express.post("/DB_SWITCH_TO_RETAILMODE", function (req, res) {
        logger.info("Switching to retail database");
        HW_DB_INIT(GLOBALS, false);
        res.json({ success: true, systemMode: GLOBALS.SYSTEMMODE });

        GLOBALS.SIO.emit("SYSTEM_MODE_CHANGED", { systemMode: GLOBALS.SYSTEMMODE });


        GLOBALS.SYSTEMMODE = "SYSTEM_RETAILMODE";
        //GLOBALS.SIO.emit("MFS","x___SYSTEM_RETAILMODE");

    });

}


/**
 * @function HW_DB_INIT
 * @description Initializes the database connection and sets up the application context
 * @returns {Promise<Object>} A Promise that resolves with the database connection
 * @throws {Error} If database initialization fails
 */
async function HW_DB_INIT(GLOBALS, isDev = false) {
    try {
        DB_ACTIVE = "";
        if (isDev == true) {
            DB_ACTIVE = config.dbConfig.dbNameDev;
            GLOBALS.SYSTEMMODE="SYSTEM_DEVMODE";
            logger.info("db DEVELOPER" + DB_ACTIVE);
        } else {
            GLOBALS.SYSTEMMODE="SYSTEM_RETAILMODE";
            DB_ACTIVE = config.dbConfig.dbName;
            logger.info("db RETAIL" + DB_ACTIVE);
        }

        logger.warn("Creating database connection: Host " + DBHOST + ", User " + DBUSER + ", DB Name " + DB_ACTIVE);

        // Create and establish database connection
        await new Promise((resolve, reject) => {
            dbConnection = mysql.createConnection({
                host: DBHOST,
                user: DBUSER,
                password: DBPASS,
                database: DB_ACTIVE
            });

            // Handle connection events
            dbConnection.connect((err) => {
                if (err) {
                    logger.error('Error creating database connection: ' + err.stack);
                    reject(err);
                    return;
                }
                logger.info("Successfully created database connection. " + "State: " + dbConnection.state + ", ThreadId: " + dbConnection.threadId);
                resolve(dbConnection);
            });

            // Handle errors after initial connection
            dbConnection.on('error', (err) => {
                logger.error('Database error: ' + err.stack);
                if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                    logger.error('Database connection was closed.');
                } else if (err.code === 'ER_CON_COUNT_ERROR') {
                    logger.error('Database has too many connections.');
                } else if (err.code === 'ECONNREFUSED') {
                    logger.error('Database connection was refused.');
                }
                reject(err);
            });
        });

        // Get all tables for verification
        await HW_DB_GET_ALL_TABLES(GLOBALS);

        // Notify system of successful connection
        const FROM = "S1_HW_DATABASE";
        const ACTION = "DATABASECONFIRMCONNECT";
        const MSG = "S1_HW_DATABASE: db connection okay";
        GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);

        await HW_DB_MACHINE_CONFIG(GLOBALS);

    } catch (error) {
        logger.error("Error initializing database (" + error + "). Open XAMPP Control Panel and start MySQL.");
        throw error;
    }
}


/////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////// LOGIC METHODS

/**
 * @function query
 * @description Generic query function that returns a Promise
 * @param {string} sql - The SQL query string
 * @param {Array} [params] - Optional parameters for the query
 * @returns {Promise<any>} - Resolves with the query result
 */
function Query(sql, params = []) {
    return new Promise((resolve, reject) => {
        //logger.info("Query = dbConnection" + dbConnection);
        dbConnection.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}


/**
 * @function HW_DB_MACHINE_CONFIG
 * @description Retrieves machine configuration from the database
 * @param {Object} GLOBALS - The application context
 */
;
async function HW_DB_MACHINE_CONFIG(GLOBALS) {
    try {
        const RES_MACHINE = await Query('SELECT * FROM hwv00_machine');

        let thisVars = null;
        GLOBALS.maxAmountCarsInCassette = RES_MACHINE[0].maxAmountCarsInCassette;
        GLOBALS.maxCarsPerOrder = RES_MACHINE[0].maxCarsPerOrder;
        GLOBALS.nr_drops = RES_MACHINE[0].nr_drops;
        GLOBALS.nr_consoles = RES_MACHINE[0].nr_consoles;
        GLOBALS.robotSerialNr = RES_MACHINE[0].robotSerialNr;
        GLOBALS.gripperType = RES_MACHINE[0].gripperType;
        GLOBALS.gripperSerialNr = RES_MACHINE[0].gripperSerialNr;
        GLOBALS.calibrationAngle = RES_MACHINE[0].calibrationAngle;

        GLOBALS.machine = RES_MACHINE[0];


        logger.info("HW_DB_MACHINE_CONFIG loaded, from " + DB_ACTIVE);
        logger.info("HW_DB_MACHINE_CONFIG loaded, robotSerialNr " + GLOBALS.robotSerialNr);
    } catch (err) {
        logger.error('W_DB_CONFIG_READ Error: ' + err.stack);
    }
}


/**
 * @function DevPopulateRacetimes
 * @description Development function to populate race times with random data
 * @description Used for testing and development purposes only
 */
async function DevPopulateRacetimes() {
    logger.debug("Test populating race times");

    // procesflow:
    // create a list of 5 random cars => CARS_SELECTED
    // create random racing times => time1, time2, time3, time4, time5
    // update the first 25 orders (limit 25)
    /////////////////////////////////////////////////

    // Retrieve cars from the database
    let CARS_ARRAY = [];
    try {
        const results = await Query('SELECT * FROM hwv00_cars');

        results.forEach(CAR => {
            CARS_ARRAY.push(CAR.carAssets);
        });

        // Update the first 25 orders with random cars
        const orders = await Query('SELECT * FROM hwv00_orders LIMIT 25');
        for (const order of orders) {
            // Generate random race times and update orders
            let RACETIMES = [];
            let CARS_SELECTED = "";
            for (let t = 0; t < 5; t++) {
                let TIMERANDOM = Math.floor(Math.random() * 2000 + 2000); // between 2000 and 4000
                RACETIMES.push(TIMERANDOM);
                // pick random 4 cars
                let RANDOM = Math.floor(Math.random() * CARS_ARRAY.length); // Random index within CARS_ARRAY length
                let CAR = CARS_ARRAY[RANDOM];
                CARS_SELECTED += CAR.toString();
                if (t < 4) { CARS_SELECTED += "_"; }
            }
            let ORDERSTATUS = "raced";
            try {
                await Query(
                    `UPDATE hwv00_orders SET 
                        orderCars = ?, 
                        time1 = ?, 
                        time2 = ?,
                        time3 = ?,
                        time4 = ?,
                        time5 = ?,
                        orderStatus = ? 
                        WHERE orderQr = ?`,
                    [
                        CARS_SELECTED,
                        RACETIMES[0],
                        RACETIMES[1],
                        RACETIMES[2],
                        RACETIMES[3],
                        RACETIMES[4],
                        ORDERSTATUS,
                        order.orderQr
                    ]
                );
                logger.info("race times populated");
            } catch (err) {
                logger.error("Error updating order:", err);
            }
        }
    } catch (err) {
        logger.error("Error executing car or order query:", err);
    }
}


// Public interface

/////////////////////////////////////////////////////////////////////////////////////
//                                END OF EMPTY OR FILL CASSETTES AND UPDATE WAREHOUSE
/////////////////////////////////////////////////////////////////////////////////////


async function HW_DB_ORDER_ORDERS_ALL(appContext, timeFrame) {
    try {
        const RES_ORDERS = await Query('SELECT * FROM hwv00_orders');
        // You can add logic here to use RES_ORDERS as needed
        logger.debug(`HW_DB_ORDER_ORDERS_ALL: Retrieved ${RES_ORDERS.length} orders.`);
        // Example: return the orders if needed
        return RES_ORDERS;
    } catch (err) {
        logger.error('HW_DB_ORDER_ORDERS_ALL Error: ' + err.stack);
        throw err;
    }
}

/////////////////////////////////////////////////////////////////////////////////////

/**
 * @function HW_DB_GET_ALL_TABLES
 * @description Retrieves and logs all tables in the database
 * @param {Object} GLOBALS - globals, containing reference to active database
 */
async function HW_DB_GET_ALL_TABLES(GLOBALS) {
    try {
        const results = await Query('SHOW TABLES');
        logger.debug('HW_DB_GET_ALL_TABLES_______________LIST');
        results.forEach((row) => {
            logger.debug("\t" + row[`Tables_in_${DB_ACTIVE}`]);
        });
        logger.debug('HW_DB_GET_ALL_TABLES________END OF LIST');
    } catch (err) {
        logger.error('HW_DB_GET_ALL_TABLES _ Error querying database: ' + err.stack);
    }
}

/////////////////////////////////////////////////////////////

/**
 * @function HW_DB_GET_CARS_IN_CATEGORIE
 * @description Retrieves cars within a specific category
 * @param {Object} GLOBALS - The application context
 * @param {string} categoryId - The ID of the category to filter by
 * @returns {Promise<string>} - A Promise that resolves with the formatted HTML string
 */
/*
async function HW_DB_GET_CARS_IN_CATEGORIE(GLOBALS, categoryId) {
    logger.info("==== LOADED HW_DB_GET_CARS_IN_CATEGORIE");
    let MSG = "";
    MSG += "<div class=blockContent>";
    let foundcarAsset = [];

    try {
        const results = await Query(
            `SELECT DISTINCT CARS.carAssets, CASS.casNr, CASS.casCarAmount, CASS.casValid
                FROM hwv00_cars CARS
                JOIN hwv00_cassettes CASS ON CARS.carAssets = CASS.casCarAssets            
                WHERE carCategoryId =? 
                ORDER BY CASS.casCarAmount DESC`,
            [categoryId]
        );

        results.forEach(row => {
            logger.debug("CHECK carAssets : (" + row.carAssets + "/ categoryId" + categoryId + " / casNr" + row.casNr + ")");
            if (foundcarAsset.includes(row.carAssets)) {
                logger.info("-- car double:" + row.carAssets);
            } else {
                if (row.casValid == 0) {
                    logger.warn("-- CASSETTE (" + row.casNr + ") NOT VALID");
                } else if (row.casCarAmount < 4) {
                    logger.warn("-- NOT ENOUGH CARS in casssette (" + row.casNr + ")");
                    MSG += "<div class=blockContent>NOT ENOUGH CARS IN THIS CASSETTE</div>";
                } else {
                    logger.debug("OKE:  car " + row.carAssets + "/ in cas " + row.casNr + "/ amount:" + row.casCarAmount);
                    MSG += "<img class=ui_btn src='/hw_cars/" + row.carAssets + "/images/Photo001.png' onclick=carShow360('" + row.carAssets + "')>";
                    MSG += "</div>";
                    foundcarAsset.push(row.carAssets);
                }
            }
        });
        MSG += "</div>";
        return MSG;
    } catch (err) {
        logger.error("Error executing join query:", err);
        throw err;
    }
}
    */

/**
 * @function HW_DB_GET_CAR_MODEL
 * @description Retrieves car model information
 * @param {Object} appContext - The application context
 */
function HW_DB_GET_CAR_MODEL(appContext) {
    logger.warn("empty function ==== LOADED HW_DB_GET_CAR_MODEL");
}

/**
 * @function HW_DB_CAR_ORDERED
 * @description Handles the processing of a car order
 * @param {Object} appContext - The application context
 */
function HW_DB_CAR_ORDERED(appContext) {
    logger.warn("empty function ==== LOADED HW_DB_GET_CAR_MODEL");
}

/**
 * @function HW_DB_CAR_AMOUNT_ADD_TO_CASSETTE
 * @description Adds cars to a cassette
 * @param {Object} appContext - The application context
 */
function HW_DB_CAR_AMOUNT_ADD_TO_CASSETTE(appContext) {
    logger.warn("empty function LOADED HW_DB_CAR_AMOUNT_ADD_TO_CASSETTE");
}

/**
 * @function HW_DB_CAR_AMOUNT_DELETE_FROM_CASSETTE
 * @description Removes cars from a cassette
 * @param {Object} appContext - The application context
 */
function HW_DB_CAR_AMOUNT_DELETE_FROM_CASSETTE(appContext) {
    logger.warn("empty function LOADED HW_DB_CAR_AMOUNT_DELETE_FROM_CASSETTE");
}

/**
 * @function HW_DB_CAR_POSITION_CHANGE_CASSETTE
 * @description Changes the position of cars within a cassette
 * @param {Object} appContext - The application context
 */
function HW_DB_CAR_POSITION_CHANGE_CASSETTE(appContext) {
    logger.debug("==== LOADED HW_DB_GET_CAR_MODEL");
}

/**
 * @function HW_DB_CAR_POSITION_CHANGE
 * @description Changes the position of cars in the system
 * @param {Object} appContext - The application context
 */
function HW_DB_CAR_POSITION_CHANGE(appContext) {
    logger.debug("==== LOADED HW_DB_GET_CAR_MODEL");
}

/**
 * @function HW_DB_CAR_AMOUNT_LOAD_MACHINE_FULL
 * @description Loads the maximum amount of cars into the machine
 * @param {Object} appContext - The application context
 */
function HW_DB_CAR_AMOUNT_LOAD_MACHINE_FULL(appContext) {
    logger.debug("==== LOADED HW_DB_GET_CAR_MODEL");
}

/**
 * @function HW_DB_OPERATOR_LOGIN
 * @description Handles operator login and logs the event
 * @description Records login date and operator information
 */
function HW_DB_OPERATOR_LOGIN() {
    // date of login, who logged in
}

/**
 * @function HW_DB_GUEST_NAME_EMAIL_ENTERED
 * @description Records when a guest enters their name and email
 */
function HW_DB_GUEST_NAME_EMAIL_ENTERED() { }

/**
 * @function HW_DB_GUEST_LOGIN
 * @description Handles guest login process
 */
function HW_DB_GUEST_LOGIN() { }

/**
 * @function HW_DB_GUEST_HAS_PAYED
 * @description Records when a guest completes payment
 */
function HW_DB_GUEST_HAS_PAYED() { }


/**
 * @exports HW_DATABASE
 * @description Public API of the HotWheels database module.
 * Exports the following functions:
  */
module.exports = {
    HW_DB_INIT,
    DevPopulateRacetimes,
    HW_DB_HTTP,

    // HW_DB_GET_CARS_IN_CATEGORIE,
    HW_DB_GET_CAR_MODEL,
    HW_DB_GET_ALL_TABLES,

    HW_DB_ORDER_ORDERS_ALL,
    Query
}
