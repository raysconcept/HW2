// enable custom logging
const { createModuleLogger } = require('../config/logger');
const { exec } = require('child_process');
const logger = createModuleLogger('ROUT');

const { checkPassword } = require('../security/authentication');
const config = require('../config/configMain');

// Page handler functions
const handle_HW_INVENTORY = async function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_INVENTORY`);
    try {
        const RES_CATEGORIES = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_categories');
        const RES_CARS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_cars');
        logger.debug(`sending list inventory / categories to terminal (` + RES_CATEGORIES.length + ') categories');
        res.render('__HW_INVENTORY', {
            PATH: req.path,
            GLOBALS: GLOBALS,
            CATEGORIES: RES_CATEGORIES,
            CARS: RES_CARS,
            SITE_LOCATION: GLOBALS.SITE_LOCATION
        });
    } catch (err) {
        logger.error('GLOBALS.DB_QS.Query Error : ' + err.stack);
        res.status(500).send('Database error');
    }
};

const handle_HW_ORDERCUE = function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_ORDERCUE`);
    res.render('__HW_ORDERCUE', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};

const handle_HW_ORDERS = async function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_ORDERS`);
    try {
        const RES_ORDERS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_orders');
        logger.debug(`HW_ROUTING / HW_ORDERS  _ sending list categories to terminal (` + RES_ORDERS.length + ') orders');
        res.render('__HW_ORDERS', {
            PATH: req.path,
            GLOBALS: GLOBALS,
            ORDERS: RES_ORDERS,
            SITE_LOCATION: GLOBALS.SITE_LOCATION
        });
    } catch (err) {
        logger.error('HW_ROUTING / HW_ORDERS Error showing orders: ' + err.stack);
        res.status(500).send('Database error');
    }
};


const handle_DEVICE_ESP_page = function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_DEVICE_ESP`);
    res.render('__HW_DEVICE_ESP', { //
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};

const handle_HW_DEVICE_CAMS_GOPRO = function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_DEVICE_CAMS_GOPRO`);
    res.render('__HW_DEVICE_CAMS_GOPRO', { //
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};

const handle_HW_DEVICE_CAMS_RASPI = function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_RASPI`);
    res.render('__HW_DEVICE_CAMS_RASPI', { //
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};


const handle_HW_AVFX_OLD = function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_AVFX_OLD`);
    res.render('__HW_AVFX_OLD', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};

const handle_HW_AVFX = function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_AVFX`);
    GLOBALS.ESP = "yes";
    res.render('__HW_AVFX', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};

const handle_HW_VIDEOPLAYER = function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_VIDEOPLAYER`);
    res.render('__HW_VIDEOPLAYER', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};

const handle_HW_DUAL_PI_RECORDING = function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_DUAL_PI_RECORDING`);
    res.render('__HW_DUAL_PI_RECORDING', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};

const handle_HW_LEADERBOARD = function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_LEADERBOARD`);
    res.render('__HW_LEADERBOARD', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};

const handle_HW_VENDING_DEV = async function (req, res, GLOBALS) {
    const terminalId = req.query.terminal || '1';

    logger.debug(`${req.method} /HW_CLIENT, terminalId:${terminalId}`);

    try {
        //const CATS_VALID = await GLOBALS.DB_CAT.getCategories(GLOBALS);


        //const CATS_VALID = await require("./HW_ORDER_VENDING.js").HW_ORDER_VENDING_GETCATS(GLOBALS);
        //GLOBALS.CATS_VALID = CATS_VALID;
        // logger.warn("000000000000000000" + CATS_VALID);

        logger.warn("ROUTING CLIENT, GLOBALS.maxCarsPerOrder:" + GLOBALS.maxCarsPerOrder);
        res.render('__HW_VENDING_DEV', {
            PATH: req.path,
            GLOBALS: GLOBALS,
            SIO: GLOBALS.SIO,
            S1_IPADRESS: GLOBALS.S1_IPADRESS,
            S1_PORT: GLOBALS.S1_PORT,
            maxCarsPerOrder: GLOBALS.maxCarsPerOrder,
            TERMINAL_ID: terminalId//,            GLOBALS.maxCarsPerOrder: config.vendingConfig.numCarsToPickup
        });
    } catch (error) {
        logger.error('An error occurred rendering client: ', error);
        res.status(500).send('An error occurred getting the car categories');
    }
};


const handle_HW_VENDING = async function (req, res, GLOBALS) {
    const terminalId = req.query.terminal || '1';

    logger.debug(`${req.method} /HW_CLIENT, terminalId:${terminalId}`);

    try {
        //const CATS_VALID = await GLOBALS.DB_CAT.getCategories(GLOBALS);


        //const CATS_VALID = await require("./HW_ORDER_VENDING.js").HW_ORDER_VENDING_GETCATS(GLOBALS);
        //GLOBALS.CATS_VALID = CATS_VALID;
        // logger.warn("000000000000000000" + CATS_VALID);

        logger.warn("ROUTING CLIENT, GLOBALS.maxCarsPerOrder:" + GLOBALS.maxCarsPerOrder);
        res.render('__HW_VENDING', {
            PATH: req.path,
            GLOBALS: GLOBALS,
            SIO: GLOBALS.SIO,
            S1_IPADRESS: GLOBALS.S1_IPADRESS,
            S1_PORT: GLOBALS.S1_PORT,
            maxCarsPerOrder: GLOBALS.maxCarsPerOrder,
            TERMINAL_ID: terminalId//,            GLOBALS.maxCarsPerOrder: config.vendingConfig.numCarsToPickup
        });
    } catch (error) {
        logger.error('An error occurred rendering client: ', error);
        res.status(500).send('An error occurred getting the car categories');
    }
};

const handle_HW_BONUS = function (req, res, GLOBALS) {
    logger.info(`${req.method} /BONUS`);
    res.render('__HW_BONUS', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};
/*
const handle_HW_LEDS = function (req, res, GLOBALS) {
    logger.info(`${req.method} /HW_LEDS`);
    res.render('__HW_LEDS', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};*/

const handle_HW_DEVELOPER = function (req, res, GLOBALS) {
    logger.info(`${req.method} /HW_DEVELOPER`);
    res.render('__HW_DEVELOPER', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};

const handle_HW_ROBOT = async function (req, res, GLOBALS) {
    logger.info(`${req.method} /HW_ROBOT`);
    try {
        const RES_MACHINE = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_machine');
        logger.debug(`machine (${RES_MACHINE.length})`);
        logger.debug(`machine serialNr (${RES_MACHINE[0]?.robotSerialNr})`);
        res.render('__HW_ROBOT', {
            PATH: req.path,
            GLOBALS: GLOBALS,
            RES_MACHINE: RES_MACHINE[0]
        });
    } catch (err) {
        logger.error('error: ' + err.stack);
        res.status(500).send('Database error');
    }
};

const handle_HW_LINKPAGE = function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW`);
    res.render('__HW_LINKPAGE', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};
const handle_HW_QR = function (req, res, GLOBALS) {
    logger.warn(req.ip);
    logger.debug(`${req.method} /HW_QR`);
    res.render('__HW_QR', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};


const handle_HW_TESTS = function (req, res, GLOBALS) {
    logger.debug(`${req.method} /HW_TESTS`);
    res.render('__HW_TESTS', {
        PATH: req.path,
        GLOBALS: GLOBALS
    });
};

const handleRunTests = function (req, res) {
    logger.info('Running test suite from /HW_TESTS');
    exec('npx jest --runInBand', { cwd: process.cwd(), timeout: 120000 }, (error, stdout, stderr) => {
        res.json({
            success: !error,
            stdout,
            stderr,
            error: error ? error.message : null
        });
    });
};

const handle_DeviceESPAll_page = function (req, res) {
    logger.debug(`${req.method} /HW_DEVICE_ESP`);

};


exports.HW_ROUTING_INIT = function (GLOBALS) {
    logger.debug("LOADED HW_ROUTING");

    // Apply authentication middleware to all routes
    if (config.securityConfig.useAuthentication) {
        GLOBALS.Express.use(checkPassword);
    }

    // Helper function to bind GLOBALS to handlers
    const bindHandler = (handler) => (req, res) => handler(req, res, GLOBALS);

    // ========================================================================
    // PUBLIC SIDE
    // ========================================================================

    // PUBLIC (ON DISPLAYS OPEN TO PUBLIC TO VIEW) // Public routes (no authentication needed)
    GLOBALS.Express.get("/HW", bindHandler(handle_HW_LINKPAGE));
    GLOBALS.Express.get("/HW_ORDERCUE", bindHandler(handle_HW_ORDERCUE));
    GLOBALS.Express.get("/HW_LEADERBOARD", bindHandler(handle_HW_LEADERBOARD));
    GLOBALS.Express.get("/HW_VENDING", bindHandler(handle_HW_VENDING));
    GLOBALS.Express.get("/HW_VENDING_DEV", bindHandler(handle_HW_VENDING_DEV));

    // ========================================================================
    // BACK / INSTALLATION / ADMINISTTION  
    // ========================================================================  

    // SHOWCONTROLE / AVFX
    GLOBALS.Express.get("/HW_BONUS", bindHandler(handle_HW_BONUS));

    GLOBALS.Express.get("/HW_AVFX", bindHandler(handle_HW_AVFX));
    // in OLD: all esp and raspberrries were integrated. New version isolates all devices in separate ejs files
    GLOBALS.Express.get("/HW_AVFX_OLD", bindHandler(handle_HW_AVFX_OLD));


    // DEVICES CAMERA SYSTEMS   
    GLOBALS.Express.get("/HW_DEVICE_CAMS_RASPI", bindHandler(handle_HW_DEVICE_CAMS_RASPI));
    GLOBALS.Express.get("/HW_DEVICE_CAMS_GOPRO", bindHandler(handle_HW_DEVICE_CAMS_GOPRO));

    // DEVICES
    GLOBALS.Express.get("/HW_DEVICE_ESP", bindHandler(handle_DEVICE_ESP_page));

    // VIDEOS (DOWNLOADED / COMPILED)
    GLOBALS.Express.get("/HW_VIDEOPLAYER", bindHandler(handle_HW_VIDEOPLAYER));
    GLOBALS.Express.get("/HW_DUAL_PI_RECORDING", bindHandler(handle_HW_DUAL_PI_RECORDING));

    // OPERATION / ADMINISTRATION / ORDER PROCESSING
    GLOBALS.Express.get("/HW_QR", bindHandler(handle_HW_QR));
    GLOBALS.Express.get("/HW_INVENTORY", bindHandler(handle_HW_INVENTORY));
    GLOBALS.Express.get("/HW_ORDERS", bindHandler(handle_HW_ORDERS));

    // INSTALLATION / CONFIGURATION / SECURE PAGES // Protected routes (require authentication)
    GLOBALS.Express.get("/HW_ROBOT", bindHandler(handle_HW_ROBOT));

    // DEVELOPER (NEED AUTHENTIFICATION)
    GLOBALS.Express.get("/HW_DEVELOPER", bindHandler(handle_HW_DEVELOPER));
    GLOBALS.Express.get("/HW_TESTS", bindHandler(handle_HW_TESTS));
    GLOBALS.Express.post('/HW_TESTS/run', handleRunTests);

    // ========================================================================

    // Add POST routes for protected pages when authentication is enabled
    // passwords are listed in security/authentication.js

    if (config.securityConfig.useAuthentication) {
        // developer / installation / calibration: dev123
        GLOBALS.Express.post("/HW_DEVELOPER", bindHandler(handle_HW_DEVELOPER));
        GLOBALS.Express.post("/HW_ROBOT", bindHandler(handle_HW_ROBOT));

        // administration: admin123
        GLOBALS.Express.post("/HW_INVENTORY", bindHandler(handle_HW_INVENTORY));
        GLOBALS.Express.post("/HW_ORDERS", bindHandler(handle_HW_ORDERS));
        GLOBALS.Express.post("/HW_QR", bindHandler(handle_HW_QR));
        //GLOBALS.Express.post("/HW", bindHandler(handle_HW_LINKPAGE));

        // daily operation: operator123
        GLOBALS.Express.post("/HW_DEVICE_CAMS_GOPRO", bindHandler(handle_HW_DEVICE_CAMS_GOPRO));
        GLOBALS.Express.post("/HW_AVFX", bindHandler(handle_HW_AVFX));
        GLOBALS.Express.post("/HW_AVFX_SUM", bindHandler(handle_HW_AVFX));
        GLOBALS.Express.post("/HW_VIDEOPLAYER", bindHandler(handle_HW_VIDEOPLAYER));
        GLOBALS.Express.post("/HW_DUAL_PI_RECORDING", bindHandler(handle_HW_DUAL_PI_RECORDING));

        // public
        // GLOBALS.Express.get("/HW_VENDING", bindHandler(handle_HW_VENDING));



    }

    // Log server endpoints
    logger.info("Link page: http://" + GLOBALS.S1_IPADRESS + ":" + GLOBALS.S1_PORT + "/HW");
    logger.info("Link page alternative: http://localhost:3101/HW");

    logger.info("Robot Terminal: http://" + GLOBALS.S1_IPADRESS + ":" + GLOBALS.S1_PORT + "/HW_ROBOT");
    logger.info("Database Terminal: http://" + GLOBALS.S1_IPADRESS + ":" + GLOBALS.S1_PORT + "/HW_DATABASE");
    logger.info("Operator Terminal: http://" + GLOBALS.S1_IPADRESS + ":" + GLOBALS.S1_PORT + "/HW_OPERATION");
    logger.info("Client Terminal 1: http://" + GLOBALS.S1_IPADRESS + ":" + GLOBALS.S1_PORT + "/HW_CLIENT?t=1");
    logger.info("Client Terminal 2: http://" + GLOBALS.S1_IPADRESS + ":" + GLOBALS.S1_PORT + "/HW_CLIENT?t=2");
}
