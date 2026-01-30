//mocking the robot connection for debug
const HW_ROBOT_MOCK = process.env.HW_ROBOT_MOCK === 'true';

// enable custom logging
const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('ROBO');

const config = require('../config/configMain');
const calibrationStore = require('../config/calibrationStore');


// READ MACHINE INFO FROM DATABASE

logger.info("LOAD ROBOT URSCRIPTS");

let robotScripts = require('./HW_ROBOT_UR_SCRIPTS.js');
const fs = require('fs');
const path = require('path');

const net = require('net');

/* function unused
function delaySafeFile(ms) {
    logger.info("delaySafeFile ms:" + ms);
    return new Promise(resolve => setTimeout(resolve, ms));
}
*/
/*
The X509Certificate class in Node.js is used for working with X.509 certificates, 
which are a standard format for public key certificates. 
X.509 certificates are commonly used in TLS/SSL to secure communication over the internet, 
such as HTTPS connections.
*/
const { X509Certificate } = require('crypto');

let reloadRobotScripts = function reloadRobotScriptsImpl() {
    try {
        const modulePath = require.resolve('./HW_ROBOT_UR_SCRIPTS.js');
        try {
            const robotConfigPath = require.resolve(path.join(__dirname, config.robotConfig.machineConfigFileName));
            delete require.cache[robotConfigPath];
        } catch (cfgErr) {
            logger.warn(`Unable to purge robot config cache: ${cfgErr.message}`);
        }
        delete require.cache[modulePath];
        robotScripts = require('./HW_ROBOT_UR_SCRIPTS.js');
        logger.info('Reloaded HW_ROBOT_UR_SCRIPTS to pick up latest calibration data.');
    } catch (err) {
        logger.error(`Failed to reload HW_ROBOT_UR_SCRIPTS: ${err.message}`);
    }
};

const CALIBRATION_REFERENCE_TRAVEL_MM = 1265;

const orientationVerificationDefault = () => ({
    ...calibrationStore.DEFAULT_ORIENTATION_VERIFICATION
});

function cloneWorkflowDefaults() {
    return {
        orientation: { ...calibrationStore.DEFAULT_WORKFLOW.orientation },
        translation: { ...calibrationStore.DEFAULT_WORKFLOW.translation }
    };
}

function ensureWorkflowState(state) {
    if (!state.workflow || typeof state.workflow !== 'object') {
        state.workflow = cloneWorkflowDefaults();
    } else {
        state.workflow.orientation = {
            ...calibrationStore.DEFAULT_WORKFLOW.orientation,
            ...(state.workflow.orientation || {})
        };
        state.workflow.translation = {
            ...calibrationStore.DEFAULT_WORKFLOW.translation,
            ...(state.workflow.translation || {})
        };
    }
    return state.workflow;
}

function hasCalibrationData(calibration) {
    if (!calibration) return false;
    const orientation = calibration.orientation || {};
    const translation = calibration.translation || {};
    const workflow = ensureWorkflowState(calibration);

    const orientationData = Boolean(
        orientation.cassette1Reference ||
        orientation.cassette153Corner ||
        orientation.vectorLengthMm ||
        orientation.alphaDeg ||
        orientation.verified
    );

    const translationData = Boolean(
        translation.cassette1Reference ||
        translation.cassette1Aligned ||
        translation.offsetXmm ||
        translation.offsetYmm ||
        translation.verified
    );

    const workflowFlags = Object.values(workflow.orientation || {}).some(Boolean) ||
        Object.values(workflow.translation || {}).some(Boolean);

    return orientationData || translationData || workflowFlags;
}

//////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////// VARS

let robotSocket = null;

// Initialize global robot object
let robotStatus = {
    isConnected: false,
    isAvailable: false,
    isRobotOn: false,
    isProtectiveStop: false,
    isProgramRunning: false,
    joints: [],
    tcpM: [],
    tcpR: []
};

let robotStatusLastUpdate = 0;
let robotConnectionMonitor = null;

let robotReconnectTimer = null;

function scheduleRobotReconnect(GLOBALS) {
    if (!config.robotConfig.enabled) return;
    if (robotReconnectTimer) return;

    const delay = config.robotConfig.reconnectDelayMs || 3000;
    logger.info(`Scheduling robot reconnect attempt in ${delay}ms`);

    robotReconnectTimer = setTimeout(async () => {
        robotReconnectTimer = null;
        try {
            await HW_ROBOT_INIT(GLOBALS);
            logger.info('Robot reconnect attempt succeeded');
        } catch (err) {
            logger.error('Robot reconnect attempt failed: ' + err.message);
            scheduleRobotReconnect(GLOBALS);
        }
    }, delay);
}

function markRobotDisconnected(GLOBALS, reason) {
    const message = reason || 'unknown reason';
    if (robotStatus.isConnected) {
        logger.warn(`Marking robot disconnected (${message})`);
    }
    robotStatus.isConnected = false;
    robotStatus.isAvailable = false;
    robotStatus.isRobotOn = false;
    robotStatus.isProtectiveStop = false;
    robotStatus.isProgramRunning = false;
    robotStatus.joints = [];
    robotStatus.tcpM = [];
    robotStatus.tcpR = [];
    updateRobotStateDisplay(GLOBALS);
}

function ensureRobotConnectionMonitor(GLOBALS) {
    if (robotConnectionMonitor) return;
    const staleThreshold = config.robotConfig.connectionStaleMs || 2000;
    const intervalMs = Math.min(1000, staleThreshold);
    robotConnectionMonitor = setInterval(() => {
        const now = Date.now();
        if (robotStatus.isConnected && now - robotStatusLastUpdate > staleThreshold) {
            markRobotDisconnected(GLOBALS, `no telemetry for ${staleThreshold}ms`);
            scheduleRobotReconnect(GLOBALS);
        }
    }, intervalMs);
}


//////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////// SERVER METHODS

// Combine HW_ROBOT_INIT and HW_ROBOT_CONNECT
async function HW_ROBOT_INIT(GLOBALS) {

    if (HW_ROBOT_MOCK) {
        robotStatus.isConnected = true;
        robotStatus.isAvailable = true;
        robotStatus.isRobotOn = true;
        robotStatus.isProtectiveStop = false;
        robotStatus.isProgramRunning = false;
        robotStatusLastUpdate = Date.now();
        // updateRobotStateDisplay(GLOBALS);
        setInterval(() => {
            robotStatus.isProgramRunning = !robotStatus.isProgramRunning;
            updateRobotStateDisplay(GLOBALS);
        }, 5000);
        return Promise.resolve(); // skip real connect
        }

    if (typeof GLOBALS.onSocketConnected === 'function' && !GLOBALS._robotStatusSocketHandlerRegistered) {
        GLOBALS.onSocketConnected((socket) => {
            updateRobotStateDisplay(GLOBALS, socket);
        });
        GLOBALS._robotStatusSocketHandlerRegistered = true;
    }

    logger.debug("Initializing robot...");
    return new Promise((resolve, reject) => {
        let initCompleted = false;
        const HW_ROBOT_HOST = config.robotConfig.host;
        const HW_ROBOT_PORT = config.robotConfig.port;

        // Create local socket first
        robotSocket = new net.Socket();
        robotSocket.setNoDelay(true);

        const isTestEnv = Boolean(process.env.JEST_WORKER_ID);
        logger.debug(`HW_ROBOT_INIT test environment detected: ${isTestEnv}`);
        const configuredTimeout = config.robotConfig.connectionTimeoutMs;
        const socketTimeoutMs =
            (configuredTimeout && configuredTimeout > 0)
                ? configuredTimeout
                : (isTestEnv ? 100 : 3000);

        if (socketTimeoutMs > 0) {
            robotSocket.setTimeout(socketTimeoutMs);
        }

        logger.info("Connecting to Robot, IP " + HW_ROBOT_HOST + ", Port " + HW_ROBOT_PORT);

        // Handle timeout
        robotSocket.on('timeout', () => {
            if (socketTimeoutMs <= 0) {
                robotSocket.setTimeout(0);
                logger.debug('Robot socket timeout ignored (no timeout configured)');
                return;
            }
            logger.error('Robot connection timeout');
            robotSocket.destroy();
            robotStatus.isConnected = false;
            robotStatus.isAvailable = false;
            robotStatus.isRobotOn = false;
            robotStatus.isProgramRunning = false;
            updateRobotStateDisplay(GLOBALS);
            scheduleRobotReconnect(GLOBALS);
            if (!initCompleted) {
                reject(new Error('Connection timeout'));
            }
        });

        robotSocket.connect(HW_ROBOT_PORT, HW_ROBOT_HOST, async () => {
            robotStatus.isConnected = true;
            robotStatus.isAvailable = false;
            robotStatusLastUpdate = Date.now();
            ensureRobotConnectionMonitor(GLOBALS);

            logger.info('ROBOT socket is connected. Sending STOP signal and initialize gripper');

            // Stop all movements
            try {
                await HW_ROBOT_STOP(GLOBALS);

                // Initialize the gripper
                await HW_ROBOT_G_ACTIVATE(GLOBALS);
                await new Promise(resolve => setImmediate(resolve));
            } catch (err) {
                logger.error('Failed to send initialization commands to robot:', err.message);
            }

            updateRobotStateDisplay(GLOBALS);

            initCompleted = true;

            if (isTestEnv && robotSocket && !robotSocket.destroyed) {
                logger.debug('Test-mode requesting graceful socket close after init');
                robotSocket.end();
            }

            resolve(); // Resolve when connection is established
        });

        // Handle socket close event
        const handleRobotDisconnect = (reason) => {
            const processDisconnect = () => {
                const disconnectReason = reason || 'close';
                logger.warn(`HW_ROBOT_SOCKET disconnected (${disconnectReason})`);
                if (robotSocket) {
                    try {
                        robotSocket.destroy();
                    } catch (err) {
                        logger.debug(`Error destroying robot socket after disconnect: ${err.message}`);
                    }
                    robotSocket = null;
                }
                markRobotDisconnected(GLOBALS, disconnectReason);
                if (GLOBALS.ESP_FUNCTIONS) {
                    GLOBALS.ESP_FUNCTIONS.broadcastToAllESP32("ROBOT_DISCONNECTED");
                }
                scheduleRobotReconnect(GLOBALS);
            };

            if (isTestEnv && initCompleted) {
                setImmediate(processDisconnect);
            } else {
                processDisconnect();
            }
        };

        robotSocket.on('end', () => handleRobotDisconnect('end'));
        robotSocket.on('close', () => handleRobotDisconnect('close'));

        // Handle socket error event
        robotSocket.on('error', (error) => {
            logger.error('HW_ROBOT_SOCKET encountered an error:', error);
            handleRobotDisconnect('error');
            reject(error);
        });

        ///////////////////////////////////////////
        // RECEIVING ROBOT DATA

        robotSocket.on('data', data => {
            robotStatus.isConnected = true;
            robotStatusLastUpdate = Date.now();
            handleRobotSocketData(GLOBALS, data);
        });
    });
}
function HW_ROBOT_HTTP(GLOBALS) {
    logger.debug("Initializing robot...");
    return new Promise(async (resolve, reject) => {
        try {
            HW_ROBOT_HTTPCALLS(GLOBALS);
            if (!GLOBALS._robotReconnectListenerAttached) {
                GLOBALS.SIO.on('connection', (socket) => {
                    socket.on('ROBOT_RECONNECT', async () => {
                        try {
                            await HW_ROBOT_INIT(GLOBALS);
                            updateRobotStateDisplay(GLOBALS);
                            socket.emit('ROBOT_RECONNECTED');
                        } catch (error) {
                            socket.emit('ROBOT_RECONNECT_FAILED', error.message);
                        }
                    });
                });
                GLOBALS._robotReconnectListenerAttached = true;
            }
            resolve();
        } catch (error) {
            logger.error('Failed to initialize robot express:', error.message);
            reject(error);
        }
    });
}
/////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////// LOGIC METHODS

/**
 * Writes a script to the robot socket and adds a message to the robot log if provided
 * @param {*} GLOBALS 
 * @param {*} script the script to send to the robot
 * @param {*} robotLogMessage if not null, it will be added to the robot log
 * @returns {Promise<boolean>} resolves true if the script was sent successfully, false otherwise
 */
function writeToRobotSocket(GLOBALS, script, robotLogMessage = null) {

    // check safety if robot is halted, if halted, dont send anything
    if (GLOBALS.ROBOT_HALTED == false) {

        // Check if robot is connected
        if (!robotStatus.isConnected) {
            // show the script anyway even when the robot is not connected
            if (config.robotConfig.logRobotAction) { logger.debug(script); }

            logger.error("Cannot write to robot socket - robot is not connected");
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            try {
                robotSocket.write(script + '\n', function () {
                    // Extract first non-empty line of script for logging context
                    const firstLine = script
                        .replace(/\r/g, '')
                        .split('\n')
                        .find(line => line.trim()) || '';

                    logger.info("Script sent to Robot: '" + firstLine + "' ...");

                    if (config.robotConfig.logRobotAction) {
                        logger.debug(script);
                    }

                    // if (robotLogMessage && robotLogMessage !== "") {
                    // const now = "[" + new Date().toLocaleTimeString() + "]";
                    // @todo: get ROBOTLOG pointer into GLOBALS
                    // GLOBALS.ROBOTLOG += now + robotLogMessage + "\n";
                    // }

                    // Check for reserved keywords in script, usually means there's an error
                    if (script.includes('undefined') ||
                        script.includes('object') ||
                        script.includes('NaN') ||
                        script.includes('null') ||
                        script.includes('Infinity')) {
                        logger.warn("Script contains reserved keywords. This may cause issues.");
                    }

                    if (script.includes('undefined')) {
                        logger.warn("Script contains undefined");
                    }
                    if (script.includes('object')) {
                        logger.warn("Script contains object");
                    }
                    if (script.includes('NaN')) {
                        logger.warn("Script contains NaN");
                    }
                    if (script.includes('null')) {
                        logger.warn("Script contains null");
                    }
                    if (script.includes('Infinity')) {
                        logger.warn("Script contains Infinity");
                    }

                    resolve(true);
                });
            } catch (error) {
                logger.error("Error writing to robot socket:", error);
                resolve(false);
            }
        });
    } else { logger.debug("TRYING TO WRITE TO ROBOT SOCKET, BUT ROBOT IS HALTED"); }
}

// Offsets and types for robot socket data
const PKG_MIN_LENGTH = 5;
const PKG_LENGTH_OFFSET = 0;
const PKG_TYPE_OFFSET = 4;
const SUBPKG_HEADER_LENGTH = 5;
const SUBPKG_LENGTH_OFFSET = 0;
const SUBPKG_TYPE_OFFSET = 4;

const PKG_TYPE_ROBOT_STATE = 16;
const SUBTYPE_ROBOT_MODE = 0;
const SUBTYPE_JOINT_DATA = 1;
const SUBTYPE_CARTESIAN_INFO = 4;

/**
 * Handles robot socket data
 * @param {Object} GLOBALS - The application context
 * @param {Buffer} data - The data received from the robot
 */
function handleRobotSocketData(GLOBALS, data) {
    try {
        if (data.length < PKG_MIN_LENGTH) return;

        const pkgLen = data.readUInt32BE(PKG_LENGTH_OFFSET);
        const pkgType = data.readUInt8(PKG_TYPE_OFFSET);
        if (pkgType !== PKG_TYPE_ROBOT_STATE) return;

        let offset = 0;
        while (offset + SUBPKG_HEADER_LENGTH < pkgLen) {
            const subLen = data.readUInt32BE(SUBPKG_HEADER_LENGTH + offset + SUBPKG_LENGTH_OFFSET);
            const subType = data.readUInt8(SUBPKG_HEADER_LENGTH + offset + SUBPKG_TYPE_OFFSET);
            const subPkg = data.subarray(
                SUBPKG_HEADER_LENGTH + offset,
                SUBPKG_HEADER_LENGTH + offset + subLen
            );

            if (subType === SUBTYPE_ROBOT_MODE) {
                handleRobotModeData(subPkg);
            } else if (subType === SUBTYPE_JOINT_DATA) {
                robotStatus.joints = parseJointData(subPkg);
            } else if (subType === SUBTYPE_CARTESIAN_INFO) {
                const { xyzMm, rxyz } = parseCartesianInfo(subPkg);
                robotStatus.tcpM = xyzMm;
                robotStatus.tcpR = rxyz;
            }
            offset += subLen;
        }
        updateRobotStateDisplay(GLOBALS);
    } catch (err) {
        logger.error("Error parsing robot data:", err);
    }
}

//////////////////////////////////////////

/**
 * Moves the robot to drop a car at the specified drop point
 * @param {Object} GLOBALS - The application context
 * @param {number} dropPoint - The drop point number (1 to config.robotConfig.numTracks)
 */
function HW_ROBOT_MOVE_DROP(GLOBALS, dropPoint) {
    logger.info(`Running HW_ROBOT_MOVE_DROP for drop point ${dropPoint}`);

    let robot_action = "def ROBOT_MOVE_DROP(): \n";
    robot_action += robotScripts.ROBOTFUNCTIONS + "\n";

    // move to safe position
    robot_action += "  ROBOT_MOVE_SAFE_MID() \n";

    // make sure gripper is closed
    robot_action += "  G_CLOSE_LOW() \n";
    robot_action += robotScripts.CALL_SLEEP + `\n`;
    robot_action += robotScripts.CALL_ROBOT_TANGO_TO_DROP;
    robot_action += BUILDSCRIPT_DROPOFF(dropPoint);
    robot_action += "\nend";

    writeToRobotSocket(GLOBALS, robot_action);
}

/////////////////////////////////////////////////////////////////////////

function HW_ROBOT_HTTPCALLS(GLOBALS) {
    logger.info("LOADED HW_ROBOT_CALLS");

    const disabledMessage = 'Robot calibration disabled in configuration (HW_ROBOT_ENABLED=false).';
    const offlineMessage = 'Robot controller is offline. Connect the robot and refresh this page.';

    /**
     * Returns true when calibration HTTP APIs may execute, otherwise sends a JSON reply.
     */
    function ensureCalibrationAvailable(res) {
        if (!config.robotConfig.enabled) {
            res.status(503).json({ success: false, error: disabledMessage });
            return false;
        }
        if (!robotStatus.isConnected) {
            res.status(503).json({ success: false, error: offlineMessage });
            return false;
        }
        return true;
    }

    // Expose calibration UI at /HW_ROBOT_CALIBRATION (renamed from /robot/calibration).
    GLOBALS.Express.get("/HW_ROBOT_CALIBRATION", async (req, res) => {
        try {
            if (!config.robotConfig.enabled) {
                return res.render('__HW_ROBOT_CALIBRATION_UNAVAILABLE', { message: disabledMessage });
            }
            if (!robotStatus.isConnected) {
                return res.render('__HW_ROBOT_CALIBRATION_UNAVAILABLE', { message: offlineMessage });
            }

            const calibration = await calibrationStore.loadCalibration();
            res.render('__HW_ROBOT_CALIBRATION', {
                calibration,
                robotStatus: getRobotStatusSnapshot(),
                referenceTravelMm: CALIBRATION_REFERENCE_TRAVEL_MM,
                calibrationFile: calibrationStore.CALIBRATION_FILE,
                hasExistingCalibration: hasCalibrationData(calibration)
            });
        } catch (err) {
            logger.error(`Failed to render calibration page: ${err.message}`);
            res.status(500).send("Calibration page unavailable");
        }
    });

    GLOBALS.Express.get("/api/calibration/state", async (req, res) => {
        try {
            if (!ensureCalibrationAvailable(res)) return;

            const calibration = await calibrationStore.loadCalibration();
            res.json({
                success: true,
                calibration,
                robotStatus: getRobotStatusSnapshot(),
                referenceTravelMm: CALIBRATION_REFERENCE_TRAVEL_MM,
                calibrationFile: calibrationStore.CALIBRATION_FILE
            });
        } catch (err) {
            logger.error(`Failed to read calibration state: ${err.message}`);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    GLOBALS.Express.get("/api/calibration/robot-status", (req, res) => {
        res.json({
            success: true,
            robotStatus: getRobotStatusSnapshot()
        });
    });

    GLOBALS.Express.post("/api/calibration/reset", async (req, res) => {
        try {
            if (!ensureCalibrationAvailable(res)) return;

            const calibration = await calibrationStore.saveCalibration(calibrationStore.DEFAULT_STATE);
            res.json({ success: true, calibration });
        } catch (err) {
            logger.error(`Failed to reset calibration: ${err.message}`);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    GLOBALS.Express.post("/api/calibration/verify", async (req, res) => {
        const phase = (req.body?.phase || '').toString().toLowerCase();
        const flag = req.body?.verified !== undefined ? Boolean(req.body.verified) : true;

        if (!['orientation', 'translation'].includes(phase)) {
            return res.status(400).json({ success: false, error: "Unsupported calibration phase" });
        }

        try {
            if (!ensureCalibrationAvailable(res)) return;

            const calibration = await calibrationStore.updateCalibration((state) => {
                const updated = { ...state };
                const workflow = ensureWorkflowState(updated);
                if (phase === 'orientation') {
                    updated.orientation = {
                        ...updated.orientation,
                        verified: flag,
                        verification: flag ? {
                            ...updated.orientation.verification,
                            stage: null,
                            cassette1Confirmed: Boolean(updated.orientation.verification?.cassette1Confirmed),
                            cassette153Confirmed: Boolean(updated.orientation.verification?.cassette153Confirmed)
                        } : orientationVerificationDefault()
                    };
                    workflow.orientation.verified = flag;
                    if (!flag) {
                        workflow.translation.verified = false;
                        updated.translation = { ...updated.translation, verified: false };
                    }
                } else {
                    updated.translation = { ...updated.translation, verified: flag };
                    workflow.translation.verified = flag;
                }
                return updated;
            });
            res.json({ success: true, calibration });
        } catch (err) {
            logger.error(`Failed to verify calibration phase: ${err.message}`);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    GLOBALS.Express.post("/api/calibration/capture", async (req, res) => {
        const pointId = (req.body?.pointId || '').toString();
        const assignments = {
            orientation_cassette1_reference: (state, point) => {
                const workflow = ensureWorkflowState(state);
                state.orientation = {
                    ...state.orientation,
                    cassette1Reference: point,
                    cassette153Reference: null,
                    cassette153Corner: null,
                    vectorLengthMm: null,
                    verified: false,
                    verification: orientationVerificationDefault()
                };
                workflow.orientation.gotoComplete = true;
                workflow.orientation.alignmentReady = true;
                workflow.orientation.travelReady = false;
                workflow.orientation.travelComplete = false;
                workflow.orientation.baselineCaptured = false;
                workflow.orientation.verified = false;
                workflow.translation.gotoComplete = false;
                workflow.translation.referenceCaptured = false;
                workflow.translation.alignedCaptured = false;
                workflow.translation.verified = false;
                state.translation = {
                    ...state.translation,
                    cassette1Reference: null,
                    cassette1Aligned: null,
                    offsetXmm: null,
                    offsetYmm: null,
                    verified: false,
                    lastComputedAt: null
                };
                computeOrientationCalibration(state);
            },
            orientation_cassette153_corner: (state, point) => {
                const workflow = ensureWorkflowState(state);
                state.orientation = {
                    ...state.orientation,
                    cassette153Corner: point,
                    verified: false,
                    verification: orientationVerificationDefault()
                };
                workflow.orientation.cornerCaptured = true;
                workflow.orientation.verified = false;
                workflow.translation.verified = false;
                computeOrientationCalibration(state);
            },
            translation_cassette1_reference: (state, point) => {
                const workflow = ensureWorkflowState(state);
                state.translation = {
                    ...state.translation,
                    cassette1Reference: point,
                    verified: false
                };
                workflow.translation.referenceCaptured = true;
                workflow.translation.verified = false;
                computeTranslationCalibration(state);
            },
            translation_cassette1_aligned: (state, point) => {
                const workflow = ensureWorkflowState(state);
                state.translation = {
                    ...state.translation,
                    cassette1Aligned: point,
                    verified: false
                };
                workflow.translation.alignedCaptured = true;
                workflow.translation.verified = false;
                computeTranslationCalibration(state);
            }
        };

        if (!assignments[pointId]) {
            return res.status(400).json({ success: false, error: "Unsupported calibration capture point" });
        }

        if (!ensureCalibrationAvailable(res)) return;

        if (!Array.isArray(robotStatus.tcpM) || robotStatus.tcpM.length < 3) {
            return res.status(503).json({ success: false, error: "Robot position unavailable" });
        }

        const [x, y, z] = robotStatus.tcpM;
        const capturePoint = capturePointTemplate();

        try {
            const calibration = await calibrationStore.updateCalibration((state) => {
                const next = { ...state };
                assignments[pointId](next, capturePoint(x, y, z));
                return next;
            });
            if (pointId === 'orientation_cassette153_corner') {
                // Persist the freshly computed angle so verification runs with the updated frame
                await applyOrientationCalibration(calibration);
            }
            res.json({
                success: true,
                calibration,
                pointId,
                robotStatus: getRobotStatusSnapshot()
            });
        } catch (err) {
            logger.error(`Failed to capture calibration point (${pointId}): ${err.message}`);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    GLOBALS.Express.post("/api/calibration/command", async (req, res) => {
        const action = (req.body?.action || '').toString();
        const payload = req.body?.payload || {};
        const context = (payload.context || req.body.context || '').toString();

        try {
            if (!ensureCalibrationAvailable(res)) return;

            if (action === 'orientationVerifyStart') {
                try {
                    const calibration = await calibrationStore.loadCalibration();
                    const workflow = ensureWorkflowState(calibration);
                    const orientationReady = workflow.orientation.baselineCaptured && workflow.orientation.cornerCaptured;
                    if (!orientationReady) {
                        return res.status(409).json({
                            success: false,
                            error: "Complete Steps 1–5 before running the orientation verification routine."
                        });
                    }

                    const verification = calibration.orientation?.verification || {};
                    if (verification.stage) {
                        return res.status(409).json({
                            success: false,
                            error: "Orientation verification is already in progress."
                        });
                    }

                    const alphaDeg = calibration?.orientation?.alphaDeg;
                    if (alphaDeg === null || alphaDeg === undefined || !Number.isFinite(alphaDeg)) {
                        return res.status(409).json({
                            success: false,
                            error: "Orientation angle unavailable. Complete calibration steps again."
                        });
                    }

                    await applyOrientationCalibration(calibration);

                    const moveResult = await HW_ROBOT_MOVE_TO_CASSETTE(GLOBALS, 1, 'Orientation verification: cassette 1');
                    if (!moveResult.success) {
                        logger.warn(`Orientation verification move to cassette 1 failed (${moveResult.reason || 'unknown'})`);
                        return res.status(503).json({ success: false, error: "Failed to move to cassette 1 for verification." });
                    }

                    const calibrationUpdated = await calibrationStore.updateCalibration((state) => {
                        const updated = { ...state };
                        const wf = ensureWorkflowState(updated);
                        wf.orientation.verified = false;
                        updated.orientation = {
                            ...updated.orientation,
                            verified: false,
                            verification: {
                                stage: 'cassette1_capture',
                                cassette1Confirmed: false,
                                cassette153Confirmed: false,
                                cassette1Pose: null,
                                cassette153Pose: null
                            }
                        };
                        return updated;
                    });

                    return res.json({
                        success: true,
                        stage: 'cassette1_capture',
                        calibration: calibrationUpdated
                    });
                } catch (err) {
                    logger.error(`Failed to start orientation verification: ${err.message}`);
                    return res.status(500).json({ success: false, error: err.message });
                }
            }

            if (action === 'orientationVerifyConfirm') {
                const stage = (payload.stage || '').toString().toLowerCase();
                if (!['cassette1_capture', 'cassette153_capture', 'final_confirm'].includes(stage)) {
                    return res.status(400).json({ success: false, error: "Unsupported orientation verification stage." });
                }

                try {
                    const calibration = await calibrationStore.loadCalibration();
                    const verification = calibration.orientation?.verification || {};

                    if (stage === 'cassette1_capture') {
                        if (verification.stage !== 'cassette1_capture') {
                            return res.status(409).json({
                                success: false,
                                error: "Cassette 1 verification is not pending."
                            });
                        }

                        if (!Array.isArray(robotStatus.tcpM) || robotStatus.tcpM.length < 3) {
                            return res.status(503).json({ success: false, error: "Robot position unavailable" });
                        }

                        const capturePoint = capturePointTemplate();
                        const cassette1Pose = capturePoint(robotStatus.tcpM[0], robotStatus.tcpM[1], robotStatus.tcpM[2]);

                        const moveResult = await HW_ROBOT_MOVE_TO_CASSETTE(GLOBALS, 153, 'Orientation verification: cassette 153');
                        if (!moveResult.success) {
                            logger.warn(`Orientation verification move to cassette 153 failed (${moveResult.reason || 'unknown'})`);
                            return res.status(503).json({ success: false, error: "Failed to move to cassette 153 for verification." });
                        }

                        const calibrationUpdated = await calibrationStore.updateCalibration((state) => {
                            const updated = { ...state };
                            const wf = ensureWorkflowState(updated);
                            wf.orientation.verified = false;
                            updated.orientation = {
                                ...updated.orientation,
                                verified: false,
                                verification: {
                                    stage: 'cassette153_capture',
                                    cassette1Confirmed: true,
                                    cassette153Confirmed: Boolean(verification.cassette153Confirmed),
                                    cassette1Pose,
                                    cassette153Pose: verification.cassette153Pose || null
                                }
                            };
                            return updated;
                        });

                        return res.json({
                            success: true,
                            stage: 'cassette153_capture',
                            calibration: calibrationUpdated
                        });
                    }

                    if (stage === 'cassette153_capture') {
                        if (verification.stage !== 'cassette153_capture') {
                            return res.status(409).json({
                                success: false,
                                error: "Cassette 153 verification is not pending."
                            });
                        }

                        if (!Array.isArray(robotStatus.tcpM) || robotStatus.tcpM.length < 3) {
                            return res.status(503).json({ success: false, error: "Robot position unavailable" });
                        }

                        const capturePoint = capturePointTemplate();
                        const cassette153Pose = capturePoint(robotStatus.tcpM[0], robotStatus.tcpM[1], robotStatus.tcpM[2]);

                        const calibrationUpdated = await calibrationStore.updateCalibration((state) => {
                            const updated = { ...state };
                            const wf = ensureWorkflowState(updated);
                            wf.orientation.verified = false;
                            updated.orientation = {
                                ...updated.orientation,
                                verified: false,
                                verification: {
                                    stage: 'final_confirm',
                                    cassette1Confirmed: Boolean(verification.cassette1Confirmed),
                                    cassette153Confirmed: true,
                                    cassette1Pose: verification.cassette1Pose || null,
                                    cassette153Pose
                                }
                            };
                            return updated;
                        });

                        return res.json({
                            success: true,
                            stage: 'final_confirm',
                            calibration: calibrationUpdated
                        });
                    }

                    if (verification.stage !== 'final_confirm') {
                        return res.status(409).json({
                            success: false,
                            error: "Final verification confirmation is not pending."
                        });
                    }

                    const calibrationUpdated = await calibrationStore.updateCalibration((state) => {
                        const updated = { ...state };
                        const wf = ensureWorkflowState(updated);
                        wf.orientation.verified = true;
                        updated.orientation = {
                            ...updated.orientation,
                            verified: true,
                            verification: {
                                stage: null,
                                cassette1Confirmed: true,
                                cassette153Confirmed: true,
                                cassette1Pose: verification.cassette1Pose || null,
                                cassette153Pose: verification.cassette153Pose || null
                            }
                        };
                        return updated;
                    });

                    return res.json({
                        success: true,
                        completed: true,
                        calibration: calibrationUpdated
                    });
                } catch (err) {
                    logger.error(`Failed to confirm orientation verification stage (${stage}): ${err.message}`);
                    return res.status(500).json({ success: false, error: err.message });
                }
            }

            if (action === 'orientationVerifyReject') {
                try {
                    await setCalibrationAngle(0);

                    const calibration = await calibrationStore.updateCalibration((state) => {
                        const updated = { ...state };
                        updated.orientation = {
                            ...calibrationStore.DEFAULT_STATE.orientation,
                            verification: orientationVerificationDefault()
                        };
                        updated.translation = { ...calibrationStore.DEFAULT_STATE.translation };
                        updated.workflow = {
                            orientation: { ...calibrationStore.DEFAULT_WORKFLOW.orientation },
                            translation: { ...calibrationStore.DEFAULT_WORKFLOW.translation }
                        };
                        return updated;
                    });

                    return res.json({ success: true, reset: true, calibration });
                } catch (err) {
                    logger.error(`Failed to reject orientation verification: ${err.message}`);
                    return res.status(500).json({ success: false, error: err.message });
                }
            }

            if (action === 'orientationAlignConfirm') {
                if (!Array.isArray(robotStatus.tcpM) || robotStatus.tcpM.length < 3) {
                    return res.status(503).json({ success: false, error: "Robot position unavailable" });
                }

                const [x, y, z] = robotStatus.tcpM;
                const capturePoint = capturePointTemplate();
                const alignPose = capturePoint(x, y, z);

                try {
                    const calibration = await calibrationStore.updateCalibration((state) => {
                        const updated = { ...state };
                        const workflow = ensureWorkflowState(updated);

                        workflow.orientation.gotoComplete = true;
                        workflow.orientation.alignmentReady = true;
                        workflow.orientation.travelReady = false;
                        workflow.orientation.travelComplete = false;
                        workflow.orientation.baselineCaptured = false;
                        workflow.orientation.cornerCaptured = false;
                        workflow.orientation.verified = false;

                        updated.orientation = {
                            ...updated.orientation,
                            cassette1Reference: alignPose,
                            cassette153Reference: null,
                            cassette153Corner: null,
                            vectorLengthMm: null,
                            alphaDeg: null,
                            verified: false,
                            lastComputedAt: null,
                            verification: orientationVerificationDefault()
                        };

                        workflow.translation.gotoComplete = false;
                        workflow.translation.referenceCaptured = false;
                        workflow.translation.alignedCaptured = false;
                        workflow.translation.verified = false;

                        updated.translation = {
                            ...updated.translation,
                            cassette1Reference: null,
                            cassette1Aligned: null,
                            offsetXmm: null,
                            offsetYmm: null,
                            verified: false,
                            lastComputedAt: null
                        };

                        return updated;
                    });
                    return res.json({ success: true, action, calibration });
                } catch (err) {
                    logger.error(`Failed to confirm alignment: ${err.message}`);
                    return res.status(500).json({ success: false, error: err.message });
                }
            }

            if (action === 'gotoCassette') {
                const casNr = Number(payload.casNr || payload.cassette || 1);
                let targetPose = null;
                try {
                    const { pose } = await getCassettePose(GLOBALS, casNr);
                    targetPose = pose;
                } catch (err) {
                    logger.error(`Failed to determine cassette ${casNr} pose: ${err.message}`);
                    return res.status(500).json({ success: false, error: err.message });
                }

                const success = await HW_ROBOT_CALIBRATION_GOTO_CASSETTE(GLOBALS, casNr);

                await calibrationStore.updateCalibration((state) => {
                    const updated = { ...state };
                    const workflow = ensureWorkflowState(updated);

                    if (context === 'orientation') {
                        workflow.orientation.gotoComplete = false;
                        workflow.orientation.alignmentReady = false;
                        workflow.orientation.travelReady = false;
                        workflow.orientation.travelComplete = false;
                        workflow.orientation.baselineCaptured = false;
                        workflow.orientation.cornerCaptured = false;
                        workflow.orientation.verified = false;

                        updated.orientation = {
                            ...updated.orientation,
                            cassette1Reference: null,
                            cassette153Reference: null,
                            cassette153Corner: null,
                            vectorLengthMm: null,
                            alphaDeg: null,
                            verified: false,
                            lastComputedAt: null,
                            verification: orientationVerificationDefault()
                        };

                        workflow.translation.gotoComplete = false;
                        workflow.translation.referenceCaptured = false;
                        workflow.translation.alignedCaptured = false;
                        workflow.translation.verified = false;
                        updated.translation = {
                            ...updated.translation,
                            cassette1Reference: null,
                            cassette1Aligned: null,
                            offsetXmm: null,
                            offsetYmm: null,
                            verified: false,
                            lastComputedAt: null
                        };
                    } else if (context === 'translation') {
                        workflow.translation.gotoComplete = false;
                        workflow.translation.referenceCaptured = false;
                        workflow.translation.alignedCaptured = false;
                        workflow.translation.verified = false;
                        updated.translation = {
                            ...updated.translation,
                            cassette1Reference: null,
                            cassette1Aligned: null,
                            offsetXmm: null,
                            offsetYmm: null,
                            verified: false,
                            lastComputedAt: null
                        };
                    }
                    return updated;
                });

                let gotoCompleted = false;

                if (success) {
                    const idle = await waitForRobotIdle(60000, 200);
                    if (!idle) {
                        logger.warn(`Timed out waiting for robot to reach cassette ${casNr}.`);
                    } else {
                        let poseReached = true;
                        if (targetPose) {
                            const toleranceMm = 15.0;
                            const targetPoseMm = {
                                x: targetPose.x * 1000,
                                y: targetPose.y * 1000,
                                z: targetPose.z * 1000
                            };
                            poseReached = await waitForRobotPose(targetPoseMm, toleranceMm, 60000, 200, 800);
                            if (!poseReached) {
                                if (Array.isArray(robotStatus.tcpM) && robotStatus.tcpM.length >= 3) {
                                    const [x, y, z] = robotStatus.tcpM;
                                    const dx = (x - targetPoseMm.x).toFixed(1);
                                    const dy = (y - targetPoseMm.y).toFixed(1);
                                    const dz = (z - targetPoseMm.z).toFixed(1);
                                    logger.warn(`Robot did not reach cassette ${casNr} target pose within ${toleranceMm}mm tolerance. Δ=(${dx}, ${dy}, ${dz}) mm`);
                                } else {
                                    logger.warn(`Robot did not reach cassette ${casNr} target pose within ${toleranceMm}mm tolerance.`);
                                }
                            }
                        }

                        if (poseReached) {
                            gotoCompleted = true;
                            try {
                                await calibrationStore.updateCalibration((state) => {
                                    const updated = { ...state };
                                    const workflow = ensureWorkflowState(updated);
                                    if (context === 'orientation') {
                                        workflow.orientation.gotoComplete = true;
                                    } else if (context === 'translation') {
                                        workflow.translation.gotoComplete = true;
                                    }
                                    return updated;
                                });
                            } catch (err) {
                                gotoCompleted = false;
                                logger.error(`Failed to finalise goto cassette ${casNr}: ${err.message}`);
                            }
                        }
                    }
                }

                return res.json({ success, action, casNr, gotoCompleted });
            }

            if (action === 'orientationTravelSafe') {
                const requestedDistance = Number(payload.distance || payload.distanceMm || CALIBRATION_REFERENCE_TRAVEL_MM);
                const travelDistance = Math.abs(requestedDistance);

                if (!travelDistance) {
                    return res.status(400).json({ success: false, error: "Safe travel requires a non-zero distance." });
                }

                const currentCalibration = await calibrationStore.loadCalibration();
                const alignPoint = currentCalibration?.orientation?.cassette1Reference;

                if (!alignPoint) {
                    return res.status(409).json({
                        success: false,
                        error: "Cassette 1 reference not captured. Complete Step 2 before performing safe travel."
                    });
                }

                const success = await HW_ROBOT_CALIBRATION_TRAVEL_SAFE(GLOBALS, requestedDistance);

                await calibrationStore.updateCalibration((state) => {
                    const updated = { ...state };
                    const workflow = ensureWorkflowState(updated);

                    workflow.orientation.travelReady = false;
                    workflow.orientation.travelComplete = false;
                    workflow.orientation.baselineCaptured = false;
                    workflow.orientation.cornerCaptured = false;
                    workflow.orientation.verified = false;

                    updated.orientation = {
                        ...updated.orientation,
                        cassette153Reference: null,
                        cassette153Corner: null,
                        vectorLengthMm: null,
                        alphaDeg: null,
                        verified: false,
                        lastComputedAt: null,
                        verification: orientationVerificationDefault()
                    };

                    workflow.translation.gotoComplete = false;
                    workflow.translation.referenceCaptured = false;
                    workflow.translation.alignedCaptured = false;
                    workflow.translation.verified = false;

                    updated.translation = {
                        ...updated.translation,
                        cassette1Reference: null,
                        cassette1Aligned: null,
                        offsetXmm: null,
                        offsetYmm: null,
                        verified: false,
                        lastComputedAt: null
                    };

                    return updated;
                });

                let travelCompleted = false;

                if (success) {
                    const idle = await waitForRobotIdle(60000, 200);

                    if (!idle) {
                        logger.warn('Timed out waiting for robot to finish safe travel.');
                    } else {
                        const moved = await waitForRobotDisplacement(alignPoint, travelDistance, 5.0, 60000, 200);
                        if (!moved) {
                            logger.warn('Robot displacement after safe travel was less than expected.');
                        } else {
                            travelCompleted = true;

                            if (Array.isArray(robotStatus.tcpM) && robotStatus.tcpM.length >= 3) {
                                const [x, y, z] = robotStatus.tcpM;
                                const dx = x - alignPoint.x;
                                const dy = y - alignPoint.y;
                                const dz = z - alignPoint.z;
                                const resultingDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                                if (Math.abs(resultingDistance - travelDistance) > 10) {
                                    logger.warn(`Safe travel final pose differs from expectation by ${Math.abs(resultingDistance - travelDistance).toFixed(2)} mm.`);
                                }
                            } else {
                                logger.warn('Safe travel completed but TCP pose sample unavailable for validation.');
                            }
                        }
                    }

                    if (travelCompleted) {
                        await calibrationStore.updateCalibration((state) => {
                            const updated = { ...state };
                            const workflow = ensureWorkflowState(updated);
                            workflow.orientation.travelReady = true;
                            workflow.orientation.travelComplete = true;
                            return updated;
                        });
                    }
                }

                return res.json({ success, action, distance: requestedDistance, travelCompleted });
            }

            if (action === 'orientationBaselineConfirm') {
                const latestCalibration = await calibrationStore.loadCalibration();
                const travelReady = Boolean(latestCalibration?.workflow?.orientation?.travelReady);

                if (!travelReady) {
                    return res.status(409).json({
                        success: false,
                        error: "Safe travel not complete. Wait for Step 3 to finish before recording the baseline."
                    });
                }

                const idle = await waitForRobotIdle(60000, 200);
                if (!idle) {
                    return res.status(503).json({ success: false, error: "Robot is still moving. Please wait and try again." });
                }

                if (!Array.isArray(robotStatus.tcpM) || robotStatus.tcpM.length < 3) {
                    return res.status(503).json({ success: false, error: "Robot position unavailable" });
                }

                const baselinePose = {
                    x: Number(robotStatus.tcpM[0].toFixed(3)),
                    y: Number(robotStatus.tcpM[1].toFixed(3)),
                    z: Number(robotStatus.tcpM[2].toFixed(3)),
                    capturedAt: new Date().toISOString()
                };

                try {
                    await calibrationStore.updateCalibration((state) => {
                        const updated = { ...state };
                        const workflow = ensureWorkflowState(updated);

                        workflow.orientation.travelReady = true;
                        workflow.orientation.travelComplete = true;
                        workflow.orientation.baselineCaptured = true;
                        workflow.orientation.cornerCaptured = false;
                        workflow.orientation.verified = false;

                        updated.orientation = {
                            ...updated.orientation,
                            cassette153Reference: baselinePose,
                            vectorLengthMm: null,
                            alphaDeg: null,
                            verified: false,
                            lastComputedAt: null,
                            verification: orientationVerificationDefault()
                        };

                        computeOrientationCalibration(updated);
                        return updated;
                    });
                    return res.json({ success: true, action });
                } catch (err) {
                    logger.error(`Failed to confirm orientation baseline: ${err.message}`);
                    return res.status(500).json({ success: false, error: err.message });
                }
            }

            if (action === 'moveLinear') {
                const speed = (payload.speed || 'slow').toString();
                const success = await HW_ROBOT_CALIBRATION_MOVE_LINEAR(
                    GLOBALS,
                    payload.deltaMm || payload.delta || payload,
                    speed
                );
                if (context === 'orientation_travel') {
                    await calibrationStore.updateCalibration((state) => {
                        const updated = { ...state };
                        const workflow = ensureWorkflowState(updated);
                        workflow.orientation.travelReady = false;
                        workflow.orientation.travelComplete = false;
                        workflow.orientation.baselineCaptured = false;
                        workflow.orientation.cornerCaptured = false;
                        workflow.orientation.verified = false;
                        updated.orientation = {
                            ...updated.orientation,
                            cassette153Reference: null,
                            cassette153Corner: null,
                            vectorLengthMm: null,
                            alphaDeg: null,
                            verified: false,
                            lastComputedAt: null,
                            verification: orientationVerificationDefault()
                        };
                        workflow.translation.verified = false;
                        workflow.translation.referenceCaptured = false;
                        workflow.translation.alignedCaptured = false;
                        workflow.translation.gotoComplete = false;
                        updated.translation = {
                            ...updated.translation,
                            cassette1Reference: null,
                            cassette1Aligned: null,
                            offsetXmm: null,
                            offsetYmm: null,
                            verified: false,
                            lastComputedAt: null
                        };
                        return updated;
                    });
                }
                return res.json({ success, action, speed });
            }

            if (action === 'nudge') {
                const direction = (payload.direction || req.body.direction || '').toString().toLowerCase();
                const handlers = {
                    left: () => HW_ROBOT_MOVE_REL_LEFT(GLOBALS),
                    right: () => HW_ROBOT_MOVE_REL_RIGHT(GLOBALS),
                    up: () => HW_ROBOT_MOVE_REL_UP(GLOBALS),
                    down: () => HW_ROBOT_MOVE_REL_DOWN(GLOBALS),
                    in: () => HW_ROBOT_MOVE_REL_IN(GLOBALS),
                    out: () => HW_ROBOT_MOVE_REL_OUT(GLOBALS)
                };

                const handler = handlers[direction];
                if (!handler) {
                    return res.status(400).json({ success: false, error: "Unsupported nudge direction" });
                }
                handler();
                return res.json({ success: true, action, direction });
            }

            return res.status(400).json({ success: false, error: `Unsupported calibration action: ${action}` });
        } catch (err) {
            logger.error(`Calibration command failed (${action}): ${err.message}`);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    GLOBALS.Express.post("/HW_ROBOT_COMMAND", async function (req, res) {
        let cmnd = req.body.cmnd;

        logger.info("HWROBOT received a command " + cmnd);

        // =========================================================================================
        //                                                               FUNCTIONS ARE HANDLED BELOW
        // =========================================================================================
        const MSG = "HWROBOTCOMMAND received: " + cmnd;
        const FROM = "S1HWCOM";
        const ACTION = "ROBOT_UPDATE";
        GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);

        try {

            if (cmnd == "RFO_ROBOTUPDATE") {
                HW_DASHBOARD_ROBOTUPDATE(GLOBALS);
            }

            if (cmnd == "ROBOT_CONNECT") {
                await HW_ROBOT_INIT(GLOBALS);
            }
            if (cmnd == "ROBOT_STOP") {
                GLOBALS.ROBOT_HALTED = true; // safety to prevent robot picking from cueline (used in orderprocessor.js)
                await HW_ROBOT_STOP(GLOBALS);
            }

            if (cmnd == "ROBOT_UNHALT") {
                await HW_ROBOT_UNHALT(GLOBALS);
                //GLOBALS.ROBOT_HALTED = false; // robot can continue picking from cueline
            }

            if (cmnd == "LIST_ROBOTFUNCTIONS") {
                logger.debug("== HW_ROBOT_COMMAND LIST_ROBOTFUNCTIONS");
                // send list back
                const MSG = "LIST_ROBOTFUNCTIONS: " + robotScripts.ROBOTFUNCTIONS;
                const FROM = "S1HWCOM";
                const ACTION = "ROBOTUPDATE";
                GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);
                logger.info("LIST_ROBOTFUNCTIONS" + robotScripts.ROBOTFUNCTIONS + "\n == END OF LIST_ROBOTFUNCTIONS == ");
            }

            ///////////////////////////////////////////// CALIBRATION 1

            if (cmnd == "CALIBRATION_DROPOFF_1_SAVE") {
                logger.info("== HW_ROBOT_COMMAND: CALIBRATION_DROPOFF_1_SAVE");
                HW_ROBOT_CALIBRATION_DROP1_SAVE(GLOBALS);
            }

            if (cmnd == "CALIBRATION_DROPOFF_1_TEST") {
                logger.info("== HW_ROBOT_COMMAND: CALIBRATION_DROPOFF_1_TEST");
                HW_ROBOT_CALIBRATION_DROP1_TEST(GLOBALS);
            }
            if (cmnd == "CALIBRATION_DROPOFF_1_SEQ") {
                logger.info("== HW_ROBOT_COMMAND: CALIBRATION_DROPOFF_1_SEQ");
                HW_ROBOT_CALIBRATION_DROP1_SEQ(GLOBALS);
            }
            ///////////////////////////////////////////// CALIBRATION 2

            if (cmnd == "CALIBRATION_DROPOFF_2_SAVE") {
                logger.info("== HW_ROBOT_COMMAND: CALIBRATION_DROPOFF_2_SAVE");
                HW_ROBOT_CALIBRATION_DROP2_SAVE(GLOBALS);
            }

            if (cmnd == "CALIBRATION_DROPOFF_2_TEST") {
                logger.info("== HW_ROBOT_COMMAND: CALIBRATION_DROPOFF_2_TEST");
                HW_ROBOT_CALIBRATION_DROP2_TEST(GLOBALS);
            }
            if (cmnd == "CALIBRATION_DROPOFF_2_SEQ") {
                logger.info("== HW_ROBOT_COMMAND: CALIBRATION_DROPOFF_2_SEQ");
                HW_ROBOT_CALIBRATION_DROP2_SEQ(GLOBALS);
            }

            if (cmnd == "CALIBRATION_SAVE_ANGLE") {
                logger.warn("Obsolete command");
                // logger.info("== HW_ROBOT_COMMAND: CALIBRATION_SAVE_ANGLE calibrationAngleDEG:" + robotScripts.calibrationAngleDEG);
                //HW_ROBOT_CALIBRATION_ANGLE_PLUS(GLOBALS);
            }
            if (cmnd == "CALIBRATION_ANGLE_PLUS") {
                logger.info("== HW_ROBOT_COMMAND: CALIBRATION_ANGLE_PLUS");
                HW_ROBOT_CALIBRATION_ANGLE_PLUS(GLOBALS);
            }

            if (cmnd == "CALIBRATION_ANGLE_MINUS") {
                logger.info("== HW_ROBOT_COMMAND: CALIBRATION_ANGLE_MINUS");
                HW_ROBOT_CALIBRATION_ANGLE_MINUS(GLOBALS);
            }



            if (cmnd == "ROBOT_TEST_TANGO_TO_DROP") {
                HW_ROBOT_MOVE_TANGO_TO_DROP(GLOBALS);
            }
            if (cmnd == "ROBOT_TEST_TANGO_TO_MID") {
                HW_ROBOT_MOVE_TANGO_TO_MID(GLOBALS);
            }

            ///////////////////////////////////////////// GRIPPER

            if (cmnd == "GACTIVATE") {
                await HW_ROBOT_G_ACTIVATE(GLOBALS);
            }
            if (cmnd == "GCLOSE_LOW") {
                await HW_ROBOT_G_CLOSE_LOW(GLOBALS);
            }
            if (cmnd == "GCLOSE_MEDIUM") {
                await HW_ROBOT_G_CLOSE_MEDIUM(GLOBALS);
            }
            if (cmnd == "GCLOSE_HIGH") {
                await HW_ROBOT_G_CLOSE_HIGH(GLOBALS);
            }
            if (cmnd == "GOPEN") {
                await HW_ROBOT_G_OPEN(GLOBALS);
            }

            ////////////////////////////////////////////// LOOK AROUND

            if (cmnd == "G_LOOK_RIGHT") {
                HW_ROBOT_G_LOOK_RIGHT(GLOBALS);
            }
            if (cmnd == "G_LOOK_LEFT") {
                HW_ROBOT_G_LOOK_LEFT(GLOBALS);
            }
            // if (cmnd == "GET_TCP_POSITION") {
            //     HW_ROBOT_GET_TCP_POSITION(GLOBALS); // werkt niet
            // }

            ///////////////////////////////////////////// MOVE

            if (cmnd == "DROP1") {
                logger.info("== HW_ROBOT_COMMAND: DROP1");
                HW_ROBOT_MOVE_DROP(GLOBALS, 1);
            }
            if (cmnd == "DROP2") {
                logger.info("== HW_ROBOT_COMMAND: DROP2");
                HW_ROBOT_MOVE_DROP(GLOBALS, 2);
            }
            if (cmnd == "DROP3") {
                logger.info("== HW_ROBOT_COMMAND: DROP3");
                HW_ROBOT_MOVE_DROP(GLOBALS, 3);
            }
            if (cmnd == "DROP4") {
                logger.info("== HW_ROBOT_COMMAND: DROP4");
                HW_ROBOT_MOVE_DROP(GLOBALS, 4);
            }

            ////////////////////////////////////////////// MOVE ARM

            if (cmnd == "MOVE_PRESENT_CAR") {
                HW_ROBOT_MOVE_PRESENT_CAR(GLOBALS);
            }
            if (cmnd == "MOVE_HOME_MID") {
                HW_ROBOT_MOVE_SAFE_MID(GLOBALS);
            }
            if (cmnd == "MOVE_HOME_LEFT") {
                HW_ROBOT_MOVE_SAFE_LEFT(GLOBALS);
            }
            if (cmnd == "MOVE_HOME_RIGHT") {
                HW_ROBOT_MOVE_SAFE_RIGHT(GLOBALS);
            }
            if (cmnd == "MOVE_LEFT") {
                HW_ROBOT_MOVE_REL_LEFT(GLOBALS);
            }
            if (cmnd == "MOVE_RIGHT") {
                HW_ROBOT_MOVE_REL_RIGHT(GLOBALS);
            }
            if (cmnd == "MOVE_SAFE_CROWD") {
                HW_ROBOT_MOVE_SAFE_CROWD(GLOBALS);
            }
            if (cmnd == "MOVE_IN") {
                HW_ROBOT_MOVE_REL_IN(GLOBALS);
            }
            if (cmnd == "MOVE_OUT") {
                HW_ROBOT_MOVE_REL_OUT(GLOBALS);
            }
            if (cmnd == "MOVE_UP") {
                HW_ROBOT_MOVE_REL_UP(GLOBALS);
            }
            if (cmnd == "MOVE_DOWN") {
                HW_ROBOT_MOVE_REL_DOWN(GLOBALS);
            }

            if (cmnd == "MOVE_DIAG") {
                HW_ROBOT_MOVE_REL_DIAG(GLOBALS);
            }

            ///////////////////////////////////////////// TEST ROBOT TO CASSETTE

            if (cmnd == "G_PICKANGLE") {
                HW_G_PICKANGLE(GLOBALS);
            }

            if (cmnd == "DEV_PICK_OUT") {
                HW_ROBOT_PICKOUT(GLOBALS);
            }


            if (cmnd === "TESTRUN_1" || cmnd === "TEST_RUN_1") {
                HW_TESTRUN_1(GLOBALS); 
               
            }

            if (cmnd === "TESTRUN_2" || cmnd === "TEST_RUN_2") {
                // make a loop for each cassete in the 1/3 (left) 
                HW_TESTRUN_2(GLOBALS);
            }
            if (cmnd === "TESTRUN_3" || cmnd === "TEST_RUN_3") {
                // make a loop for each cassete in the 1/3 (right) 
                HW_TESTRUN_3(GLOBALS);
            }


            if (cmnd == "DEV_PICK_OUT") {
                HW_ROBOT_PICKOUT(GLOBALS);
            }
            let cmndGetCassette = cmnd.substring(0, 3);

            if (cmndGetCassette == "CAS") {
                let casNrIn = cmnd.substring(3);
                await HW_ROBOT_POINT_AND_PICK(GLOBALS, casNrIn, false);
            } else if (cmndGetCassette == "PIC") {
                let casNrIn = cmnd.substring(3);
                await HW_ROBOT_POINT_AND_PICK(GLOBALS, casNrIn, true);
            }

            // Send success response
            res.status(200).json({ status: 'success', message: `Command ${cmnd} processed successfully` });
        } catch (error) {
            logger.error(`Error processing command ${cmnd}:`, error);
            res.status(500).json({ status: 'error', message: `Error processing command: ${error.message}` });
        }
    });
}

// =========================================================================================
//                                                                                 FUNCTIONS
// AFTER PROCESSING THE FUNCTION CALL, SEND RESULT IN MESSAGE BACK VIA S2_IO TO CLIENT (MFS)
// CLIENT HANDLES THE INCOMMING MESSAGE IN _S2.ejs =>  S2.on("MFS", function (e) {
//
// =========================================================================================
let calibrationAngleDelta = config.robotConfig.calibrationAngleDelta;



///////////////////////////////////////////////////////// 
// RAY CALIBRATION                              DROPOFF1
///////////////////////////////////////////////////////// 
let jointsDrop1 = [];
function HW_ROBOT_CALIBRATION_DROP1_SAVE(GLOBALS) {

    // move robot manually to dropoff1 in freedrive mode    
    // read the position (joint angles) from the robot (tcp is aligned with track)
    // to RAD (rounded to 0.001)
    const roundtodecimals = 3;
    const j0 = robotStatus.joints[0] * (Math.PI / 180);
    jointsDrop1[0] = parseFloat(j0.toFixed(roundtodecimals));

    const j1 = robotStatus.joints[1] * (Math.PI / 180);
    jointsDrop1[1] = parseFloat(j1.toFixed(roundtodecimals));

    const j2 = robotStatus.joints[2] * (Math.PI / 180);
    jointsDrop1[2] = parseFloat(j2.toFixed(roundtodecimals));

    const j3 = robotStatus.joints[3] * (Math.PI / 180);
    jointsDrop1[3] = parseFloat(j3.toFixed(roundtodecimals));

    const j4 = robotStatus.joints[4] * (Math.PI / 180);
    jointsDrop1[4] = parseFloat(j4.toFixed(roundtodecimals));

    const j5 = robotStatus.joints[5] * (Math.PI / 180);
    jointsDrop1[5] = parseFloat(j5.toFixed(roundtodecimals));

    logger.debug("CATCH drop1 joints: joints (DEG)=" + robotStatus.joints);
    logger.debug("SAVE joints: joints (RAD)=" + jointsDrop1);

    updateRobotConfig(jointsDrop1);

    async function updateRobotConfig(jointsDrop1) {
        logger.info("jointsDrop1[0]:" + jointsDrop1[0]);
        let JointsAreValid = jointsDrop1.every(value =>
            typeof value === 'number' &&
            !isNaN(value) &&
            isFinite(value)
        );
        if (JointsAreValid) {
            logger.info("JointsAreValid");
            //const configPath = path.join(__dirname, '../config/configRobot/HW_robot_config.js');
            const configPath = path.join(__dirname, '../config/configRobot.js');
            try {
                // Read the existing file
                const fileContent = await fs.promises.readFile(configPath, 'utf8');
                logger.info('===> Original file content:', fileContent);
                if (fileContent === "" || fileContent === null) {
                    logger.warn('File is empty after read');
                    //throw new Error('File is empty after read');
                } else {
                    logger.warn('FileContent had content');
                };

                // Find the dropOffs.drop1Joints line and replace it                
                // const droparray = "[" + jointsDrop1.join(',') + "]";
                // Match "drop1Joints: [ ... ]" including surrounding whitespace and optional trailing comma
                //  - Group 1 captures the prefix before the values (`drop1Joints: [` + whitespace)
                //  - Group 2 captures the suffix (`]` + optional spaces/comma) so we keep the original formatting
                const dropRegex = /(drop1Joints:\s*\[)[^\]]*(\]\s*,?)/;
                if (!dropRegex.test(fileContent)) {
                    // Bail out loudly if the config doesn't contain the expected entry
                    // (avoids silently writing to the wrong place when the config format changes)
                    //throw new Error('drop1Joints definition not found in HW_robot_config.js');
                    throw new Error('drop1Joints definition not found in configRobot.js');
                }
                const updatedContent = fileContent.replace(
                    dropRegex,
                    // Replace only the array contents, preserving prefix/suffix (indentation, trailing comma, comments)
                    (_, prefix, suffix) => `${prefix}${jointsDrop1.join(', ')}${suffix}`
                );

                // Write the updated content back to the file
                await fs.promises.writeFile(configPath, updatedContent, 'utf8');
                logger.info('Successfully updated drop1Joints with:' + jointsDrop1);
                logger.info('File saved: ' + configPath);
                reloadRobotScripts();
            } catch (error) {
                logger.error('Error updating config file:', error);
            }
        } else { logger.warn("JOINTS FOR DROP ARE NOT VALID abort"); }
    }
    // think about: if robot shuts down in any of these steps, and restarts, 
    // it should perform a save movement (not touching the track) before going to safe_mid
    // best option: do a move out of 100mm (slowly) after startup, then go to safe_mid
}

function HW_ROBOT_CALIBRATION_DROP1_TEST(GLOBALS) {
    logger.debug("HW_ROBOT_CALIBRATION_DROP1_TEST" + jointsDrop1);
    // write to robot
    let MOVETODROPTEST = "  movej([" + jointsDrop1 + "],a=0.01,v=0.01,t=5)";
    logger.info("S1HWCOM ROBOT_STOP");
    let CHECKMOVE =
        "def ROBOT_DROP1_CHECK():\n" +
        robotScripts.ROBOTFUNCTIONS +
        // can test imediate after safe positions
        // moving the robot a bit out, and then back to the saved position
        robotScripts.CALL_ROBOT_MOVE_OUT + "\n" +
        MOVETODROPTEST + "\n" +
        "end";
    logger.info("sending:" + CHECKMOVE);
    return writeToRobotSocket(GLOBALS, CHECKMOVE);
}

///////////////////////////////////////////////////////// 
// RAY CALIBRATION                              DROPOFF2
///////////////////////////////////////////////////////// 
let jointsDROP2 = [];
function HW_ROBOT_CALIBRATION_DROP2_SAVE(GLOBALS) {

    // move robot manually to dropoff1 in freedrive mode    
    // read the position (joint angles) from the robot (tcp is aligned with track)
    // to RAD (rounded to 0.001)
    const roundtodecimals = 3;
    const j0 = robotStatus.joints[0] * (Math.PI / 180);
    jointsDROP2[0] = parseFloat(j0.toFixed(roundtodecimals));

    const j1 = robotStatus.joints[1] * (Math.PI / 180);
    jointsDROP2[1] = parseFloat(j1.toFixed(roundtodecimals));

    const j2 = robotStatus.joints[2] * (Math.PI / 180);
    jointsDROP2[2] = parseFloat(j2.toFixed(roundtodecimals));

    const j3 = robotStatus.joints[3] * (Math.PI / 180);
    jointsDROP2[3] = parseFloat(j3.toFixed(roundtodecimals));

    const j4 = robotStatus.joints[4] * (Math.PI / 180);
    jointsDROP2[4] = parseFloat(j4.toFixed(roundtodecimals));

    const j5 = robotStatus.joints[5] * (Math.PI / 180);
    jointsDROP2[5] = parseFloat(j5.toFixed(roundtodecimals));

    logger.debug("CATCH DROP2 joints: joints (DEG)=" + robotStatus.joints);
    logger.debug("SAVE joints: joints (RAD)=" + jointsDROP2);

    updateRobotConfig(jointsDROP2);
    async function updateRobotConfig(jointsDROP2) {
        logger.info("jointsDROP2[0]:" + jointsDROP2[0]);
        let JointsAreValid = jointsDROP2.every(value =>
            typeof value === 'number' &&
            !isNaN(value) &&
            isFinite(value)
        );
        if (JointsAreValid) {
            logger.info("JointsAreValid");
            //const configPath = path.join(__dirname, '../config/configRobot/HW_robot_config.js');
            const configPath = path.join(__dirname, '../config/configRobot.js');
            try {
                // Read the existing file
                const fileContent = await fs.promises.readFile(configPath, 'utf8');
                logger.info('===> Original file content:', fileContent);
                if (fileContent === "" || fileContent === null) {
                    logger.warn('File is empty after read');
                    //throw new Error('File is empty after read');
                } else {
                    logger.warn('FileContent had content');
                };

                // Find the dropOffs.DROP2Joints line and replace it                
                // const droparray = "[" + jointsDROP2.join(',') + "]";
                // Match "DROP2Joints: [ ... ]" including surrounding whitespace and optional trailing comma
                //  - Group 1 captures the prefix before the values (`DROP2Joints: [` + whitespace)
                //  - Group 2 captures the suffix (`]` + optional spaces/comma) so we keep the original formatting
                const dropRegex = /(drop2Joints:\s*\[)[^\]]*(\]\s*,?)/;
                if (!dropRegex.test(fileContent)) {
                    // Bail out loudly if the config doesn't contain the expected entry
                    // (avoids silently writing to the wrong place when the config format changes)
                    throw new Error('DROP2Joints definition not found in HW_robot_config.js');
                }
                const updatedContent = fileContent.replace(
                    dropRegex,
                    // Replace only the array contents, preserving prefix/suffix (indentation, trailing comma, comments)
                    (_, prefix, suffix) => `${prefix}${jointsDROP2.join(', ')}${suffix}`
                );

                // Write the updated content back to the file
                await fs.promises.writeFile(configPath, updatedContent, 'utf8');
                logger.info('Successfully updated DROP2Joints with:' + jointsDROP2);
                logger.info('File saved: ' + configPath);
                reloadRobotScripts();
            } catch (error) {
                logger.error('Error updating config file:', error);
            }
        } else { logger.warn("JOINTS FOR DROP ARE NOT VALID abort"); }
    }
    // think about: if robot shuts down in any of these steps, and restarts, 
    // it should perform a save movement (not touching the track) before going to safe_mid
    // best option: do a move out of 100mm (slowly) after startup, then go to safe_mid
}

function HW_ROBOT_CALIBRATION_DROP2_TEST(GLOBALS) {
    logger.debug("HW_ROBOT_CALIBRATION_DROP2_TEST" + jointsDROP2);
    // write to robot
    let MOVETODROPTEST = "  movej([" + jointsDROP2 + "],a=0.01,v=0.01,t=5)";
    logger.info("S1HWCOM ROBOT_STOP");
    let CHECKMOVE =
        "def ROBOT_DROP2_CHECK():\n" +
        robotScripts.ROBOTFUNCTIONS +
        // can test imediate after safe positions
        // moving the robot a bit out, and then back to the saved position
        robotScripts.CALL_ROBOT_MOVE_OUT + "\n" +
        MOVETODROPTEST + "\n" +
        "end";
    logger.info("sending:" + CHECKMOVE);
    return writeToRobotSocket(GLOBALS, CHECKMOVE);
}

function HW_ROBOT_CALIBRATION_DROP2_SEQ(GLOBALS) {
    logger.debug("HW_ROBOT_CALIBRATION_DROP2_SEQ");
    // write to robot
    let DROP2_SEQ =
        "def ROBOT_DROP2_SEQ():\n" +
        robotScripts.ROBOTFUNCTIONS +
        // "ROBOT_TANGO_TO_DROP()\n" + 
        //movel([${machineConfig.dropOffs.DROP2Joints}], a=0.01, v=0.01, t=10, r=0)
        // ROBOT_DROP_RELEASE_SEQUENCE() 
        robotScripts.CALL_ROBOT_MOVE_DROP2_SEQUENCE + "\n" +
        "end";
    logger.info("sending:" + DROP2_SEQ);
    return writeToRobotSocket(GLOBALS, DROP2_SEQ);
}
////////////////////////////////////////////////////////
function HW_ROBOT_CALIBRATION_DROP1_SEQ(GLOBALS) {
    logger.debug("HW_ROBOT_CALIBRATION_DROP1_SEQ");
    // write to robot
    let DROP1_SEQ =
        "def ROBOT_DROP1_SEQ():\n" +
        robotScripts.ROBOTFUNCTIONS +
        // "ROBOT_TANGO_TO_DROP()\n" + 
        //movel([${machineConfig.dropOffs.drop1Joints}], a=0.01, v=0.01, t=10, r=0)
        // ROBOT_DROP_RELEASE_SEQUENCE() 
        robotScripts.CALL_ROBOT_MOVE_DROP1_SEQUENCE + "\n" +
        "end";
    logger.info("sending:" + DROP1_SEQ);
    return writeToRobotSocket(GLOBALS, DROP1_SEQ);
}


function HW_ROBOT_CALIBRATION_ANGLE_PLUS(GLOBALS) {
    logger.info("HW_ROBOT_CALIBRATION_ANGLE_PLUS");
    robotScripts.CALIBRATION_ANGLE_PLUS(calibrationAngleDelta);

    let calibrationAngleDeltaRAD = calibrationAngleDelta * Math.PI / 180;

    let FROM = "HWROBOT";
    let ACTION = "ROBOTUPDATE_CALIBRATION_UPDATE";
    let MSG = "calculateCalibration ANGLE:" + robotScripts.calibrationAngleDEG;
    GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);

    let robot_action =
        "def CALIBRATION_PLUS_MOVE_DOWN_NOW():"
        + "\n" + robotScripts.ROBOTFUNCTIONS
        + "\n  movel(pose_trans(get_actual_tcp_pose(),p[0,0,0,0,0," + calibrationAngleDeltaRAD + ")," + robotScripts.robot_avr_slow + ")"
        + "\n" + robotScripts.CALL_MOVE_DOWN
        + "\n" + robotScripts.CALL_MOVE_UP
        + "\nend";

    writeToRobotSocket(GLOBALS, robot_action);

    FROM = "S1HWCOM";
    ACTION = "ROBOTUPDATE_CALIBRATION_UPDATE";
    MSG = "CALIBRATION ANGLE ADJUSTED TO:" + robotScripts.calibrationAngleDEG;
    GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);
}

function HW_ROBOT_CALIBRATION_ANGLE_MINUS(GLOBALS) {
    logger.info("HW_ROBOT_CALIBRATION_ANGLE_MINUS");
    robotScripts.CALIBRATION_ANGLE_MINUS(calibrationAngleDelta);

    let calibrationAngleDeltaRAD = -calibrationAngleDelta * Math.PI / 180;

    let FROM = "HWROBOT";
    let ACTION = "ROBOTUPDATE_CALIBRATION_UPDATE";
    let MSG = "calculateCalibration ANGLE:" + robotScripts.calibrationAngleDEG;
    GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);

    let robot_action =
        "def CALIBRATION_MINUS_MOVE_DOWN_NOW():"
        + "\n" + robotScripts.ROBOTFUNCTIONS
        + "\n  movel(pose_trans(get_actual_tcp_pose(),p[0,0,0,0,0," + calibrationAngleDeltaRAD + ")," + robotScripts.robot_avr_slow + ")"
        + "\n" + robotScripts.CALL_MOVE_DOWN
        + "\n" + robotScripts.CALL_MOVE_UP
        + "\nend";

    writeToRobotSocket(GLOBALS, robot_action);

    FROM = "S1HWCOM";
    ACTION = "ROBOTUPDATE_CALIBRATION_UPDATE";
    MSG = "CALIBRATION ANGLE ADJUSTED TO:" + robotScripts.calibrationAngleDEG;
    GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);
}

function HW_DASHBOARD_ROBOTUPDATE(GLOBALS) {
    logger.info("HW_DASHBOARD_ROBOTUPDATE");

    const FROM = "S1HWCOM";
    const ACTION = "ROBOTUPDATE";
    let MSG = "HW_DASHBOARD_ROBOTUPDATE";

    // Build status message from robotStatus
    MSG += "<br>xxxRobot Status:";
    MSG += "<br>Connected: " + robotStatus.isConnected;
    MSG += "<br>Available: " + robotStatus.isAvailable;
    MSG += "<br>Robot On: " + robotStatus.isRobotOn;
    MSG += "<br>Protective Stop: " + robotStatus.isProtectiveStop;
    MSG += "<br>Program Running: " + robotStatus.isProgramRunning;

    if (robotStatus.joints) {
        MSG += "<br>Joints: " + robotStatus.joints.join(', ');
    }
    if (robotStatus.tcpM) {
        MSG += "<br>TCP Position: " + robotStatus.tcpM.join(', ');
    }
    if (robotStatus.tcpR) {
        MSG += "<br>TCP Rotation: " + robotStatus.tcpR.join(', ');
    }

    const timestamp = "[" + new Date().toLocaleTimeString() + "]";
    MSG += "<br>Last Update: " + timestamp;

    GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);
    logger.debug(timestamp + " Robot Status Update: " + MSG);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


function HW_ROBOT_MOVE_TANGO_TO_DROP(GLOBALS) {
    logger.debug("TANGO_TO_DROP");

    let robot_action =
        "def test_tango_mid_to_drop():\n"
        + robotScripts.ROBOTFUNCTIONS + "\n"
        + robotScripts.CALL_ROBOT_TANGO_TO_DROP + "\n"
        + "end\n";
    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_TANGO_TO_MID(GLOBALS) {
    logger.debug("TANGO_TO_MID");

    let robot_action =
        "def test_tango_drop_to_mid():\n"
        + robotScripts.ROBOTFUNCTIONS + "\n"
        + robotScripts.CALL_ROBOT_TANGO_TO_MID + "\n"
        + "end\n";
    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_POINT_CASSETTE(posx, posy, posz, casNr) {
    const script = "\n  # HW_ROBOT_GETCARS_POINT_AT_CASSETTE" + "\n" +
        BUILDSCRIPT_CASSETTE_POINT(posx, posy, posz, casNr);

    return script;
}

// GLOBALS, 
// userOrder.cassettesX[i], 
// userOrder.cassettesY[i], 
// userOrder.cassettesZ[i], 
// userOrder.cassettesId[i], 
// userOrder.terminalId
function HW_ROBOT_PICK_CAR(GLOBALS, posx, posy, posz, casNr, terminalId, dropAferPick=true) {

    logger.info("HW_ROBOT_PICK_CAR");

    let MOVECOMMAND = BUILDSCRIPT_CASSETTE_POINT(posx, posy, posz, casNr);
    // pick the car
    MOVECOMMAND += "\n  # PICK CAR";
    MOVECOMMAND += robotScripts.CALL_PICKOUT_CAR_SMALL;

    if (dropAferPick){
        // VIA SAFE POSITION LEFT OR RIGHT
        if (posx >= 0) {
            MOVECOMMAND += "  " + robotScripts.CALL_ROBOT_MOVE_SAFE_RIGHT;
        } else {
            MOVECOMMAND += "  " + robotScripts.CALL_ROBOT_MOVE_SAFE_LEFT;
        }
        // Get terminal ID, default to 1 if not provided, Cap at configured number of tracks
        let dropLocation = Math.min(terminalId, config.robotConfig.numTracks);

        // Validate drop location
        if (!dropLocation) {
            logger.warn('Drop location is null or undefined, defaulting to track 1');
            dropLocation = 1;
        }

        // Use the new drop car function with number parameter
        MOVECOMMAND += "\n";
        MOVECOMMAND += BUILDSCRIPT_DROPOFF(dropLocation);

    } else {
        MOVECOMMAND += "\n";
        MOVECOMMAND += robotScripts.CALL_ROBOT_MOVE_SAFE_MID;
    }

    if (GLOBALS.ROBOT_HALTED == false) {
        GLOBALS.ESP_FUNCTIONS.broadcastToAllESP32("ROBOT_PICKING");
    }
    return MOVECOMMAND;
}

async function HW_ROBOT_POINT_AND_PICK(GLOBALS, casNrIn, pickCar = true) {
    try {
        logger.info(`Point and pick operation for cassette ${casNrIn}, pickCar: ${pickCar}`);

        const RES_CASS = await GLOBALS.DB_QS.Query(
            'SELECT * FROM hwv00_cassettes WHERE casNr = ?',
            [casNrIn]
        );

        // check if car is in any cassette
        if (RES_CASS.length > 0) {
            let userOrder = {};
            let carIndex = 0;

            // [0] is the cassette with the highest amount of cars
            const casNr = RES_CASS[0].casNr;
            const casRow = RES_CASS[0].casRow;
            const casColumn = RES_CASS[0].casColumn;

            userOrder.cassettesId = [];
            userOrder.cassettesX = [];
            userOrder.cassettesY = [];
            userOrder.cassettesZ = [];

            // calculate cassette position and save it in userOrder
            HW_ROBOT_CALC_POSXY_FROM_CASNR(GLOBALS, userOrder, casNr, casRow, casColumn, carIndex);

            let ROBOTPICKSCRIPT = "";
            ROBOTPICKSCRIPT += "\ndef ROBOT_POINT_AT_CASSETTE():";
            ROBOTPICKSCRIPT += robotScripts.ROBOTFUNCTIONS;
            ROBOTPICKSCRIPT += robotScripts.CALL_ROBOT_MOVE_SAFE_MID;

            let repeats = 1;
            for (let i = 0; i < repeats; i++) {
                ROBOTPICKSCRIPT += "\n  # PICK_ONE_CAR_XY /  repeats for testing:(" + i + "/" + repeats + ")\n";

                if (pickCar) {
                    logger.info("PICK CAR FROM CASSETTE casNr: " + casNrIn);
                    ROBOTPICKSCRIPT += HW_ROBOT_PICK_CAR(GLOBALS, userOrder.cassettesX[0], userOrder.cassettesY[0], userOrder.cassettesZ[0], casNrIn, userOrder.terminalId);
                    ROBOTPICKSCRIPT += robotScripts.CALL_ROBOT_MOVE_SAFE_MID;
                } else {
                    logger.info("POINT AT CASSETTE casNr: " + casNrIn);
                    ROBOTPICKSCRIPT += HW_ROBOT_POINT_CASSETTE(userOrder.cassettesX[0], userOrder.cassettesY[0], userOrder.cassettesZ[0], casNrIn);
                }
            }
            ROBOTPICKSCRIPT += "\nend";
            ROBOTPICKSCRIPT += "\n# _____________________________________________";
            ROBOTPICKSCRIPT += "\n#                             END OF SCRIPT ";
            ROBOTPICKSCRIPT += "\n# _____________________________________________";

            writeToRobotSocket(GLOBALS, ROBOTPICKSCRIPT, false);

            if (GLOBALS.ROBOT_HALTED == false) {
                GLOBALS.ESP_FUNCTIONS.broadcastToAllESP32("ROBOT_PICKING");
            }

        } else {
            logger.warn(`No cassette found with number: ${casNrIn}`);
        }
    } catch (err) {
        logger.error('Error in HW_ROBOT_POINT_AND_PICK:', err);
        throw err;
    }

}


function HW_ROBOT_PROCESS_ORDER(GLOBALS, userOrder) {
    // logger.debug("HW_ROBOT_GETCARS");
    // logger.debug("Order: " + JSON.stringify(userOrder));

    // Set robot as unavailable while processing order
    robotStatus.isAvailable = false;

    logger.debug(`Robot notification socket will target ${GLOBALS.S1_IPADRESS}:${config.robotConfig.feedbackPort}`);

    let ROBOTPICKSCRIPT = "";
    ROBOTPICKSCRIPT += "\ndef ROBOTPICK():";
    ROBOTPICKSCRIPT += robotScripts.ROBOTFUNCTIONS + "\n";

    for (let i = 0; i < userOrder.userCars.length; i++) {
        logger.debug("Processing car: " + userOrder.userCars[i]);
        if (userOrder.cassettesX[i] !== undefined &&
            userOrder.cassettesY[i] !== undefined &&
            userOrder.cassettesZ[i] !== undefined &&
            userOrder.cassettesId[i] !== undefined) {

            ROBOTPICKSCRIPT += "\n  # _____________________ PICKING CAR:" + (i + 1);

            ROBOTPICKSCRIPT += HW_ROBOT_PICK_CAR(GLOBALS, userOrder.cassettesX[i], userOrder.cassettesY[i], userOrder.cassettesZ[i], userOrder.cassettesId[i], userOrder.terminalId);
        } else {
            logger.warn("No position or cassette found for car: " + userOrder.userCars[i]);
        }
    }

    // Add completion notification
    ROBOTPICKSCRIPT += "\n # ALL CARS ARE PROCESSED--------------------";
    ROBOTPICKSCRIPT += robotScripts.CALL_ROBOT_MOVE_SAFE_MID;

    // Add completion notification using a separate notification socket
    ROBOTPICKSCRIPT += "\n # Notify completion";
    // Potential bug is here: 
    ROBOTPICKSCRIPT += `\n  socket_open("${GLOBALS.S1_IPADRESS}", ${config.robotConfig.feedbackPort}, "NotificationSocket")`;
    ROBOTPICKSCRIPT += "\n  socket_send_string(\"hallo from robot\", \"NotificationSocket\")";
    ROBOTPICKSCRIPT += "\n  socket_send_byte(10, \"NotificationSocket\")";
    ROBOTPICKSCRIPT += "\n  socket_close(\"NotificationSocket\")";
    ROBOTPICKSCRIPT += "\nend";

    // Add the function call to execute the script
    ROBOTPICKSCRIPT += "\nROBOTPICK()";


    writeToRobotSocket(GLOBALS, ROBOTPICKSCRIPT);


    // send update to robot.ejs
    const MSG = ROBOTPICKSCRIPT;
    const FROM = "ROBOTJS";
    const ACTION = "ROBOT_COMMANDS_SEND"; // HANDLED IN S2 (ON MFS)
    GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);

    if (GLOBALS.ROBOT_HALTED == false) {
        logger.info("CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC ROBOT_PICKING");
        logger.info("CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC ROBOT_PICKING");
        logger.info("CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC ROBOT_PICKING");
        GLOBALS.SIO.emit("ROBOT_PICKING");
    } else {
        logger.info("LLLLLLLLLLLLLLLLLLLL PICKING BUT GLOBALS.ROBOT_HALTED:" + GLOBALS.ROBOT_HALTED);
    }

    return ROBOTPICKSCRIPT;
}


//////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////// PARSE ROBOT DATA

const ROBOT_CONNECTED_OFFSET = 8;
const ROBOT_POWER_ON_OFFSET = 10;
const PROTECTIVE_STOP_OFFSET = 12;
const PROGRAM_RUNNING_OFFSET = 13;

/**
 * Handles robot mode data from the subpackage
 * @param {Buffer} subPackage - The subpackage containing robot mode data
 * @returns {void}
 */
function handleRobotModeData(subPackage) {
    const payloadStart = SUBPKG_HEADER_LENGTH;
    if (subPackage.length < payloadStart + PROGRAM_RUNNING_OFFSET + 1) {
        logger.debug("Robot mode subpackage too short to parse status flags");
        return;
    }

    robotStatus.isConnected = Boolean(subPackage.readUInt8(payloadStart + ROBOT_CONNECTED_OFFSET));
    robotStatus.isRobotOn = Boolean(subPackage.readUInt8(payloadStart + ROBOT_POWER_ON_OFFSET));
    robotStatus.isProtectiveStop = Boolean(subPackage.readUInt8(payloadStart + PROTECTIVE_STOP_OFFSET));
    robotStatus.isProgramRunning = Boolean(subPackage.readUInt8(payloadStart + PROGRAM_RUNNING_OFFSET));
    if (config.robotConfig.logRobotActionUpdateDisplay) {
        logger.debug(`Robot mode flags: connected=${robotStatus.isConnected}, powerOn=${robotStatus.isRobotOn}, protectiveStop=${robotStatus.isProtectiveStop}, programRunning=${robotStatus.isProgramRunning}`);
    }

    // Update robot availability based on program running state
    const newAvailability = !robotStatus.isProgramRunning;
    if (robotStatus.isAvailable !== newAvailability) {
        robotStatus.isAvailable = newAvailability;
        logger.debug(`Robot availability updated to ${robotStatus.isAvailable}`);
    }
}

/**
 * Updates the robot state display in the UI
 * @param {Object} GLOBALS - The application context
 * @returns {void}
 */
function updateRobotStateDisplay(GLOBALS, target) {
    const emitter = target && typeof target.emit === 'function'
        ? target
        : (GLOBALS && GLOBALS.SIO && typeof GLOBALS.SIO.emit === 'function' ? GLOBALS.SIO : null);

    if (!emitter) {
        logger.debug("Skipping robot status broadcast - Socket.IO emitter unavailable");
        return;
    }

    // If halted, STOP overrides other states; avoid pick/idle emits while halted.
    if (GLOBALS.ROBOT_HALTED && GLOBALS.ESP_FUNCTIONS) {
        if (!GLOBALS._espStopNotified) {
            logger.info("sending to ESP ROBOT_STOP (halted)");
            GLOBALS.ESP_FUNCTIONS.broadcastToAllESP32("ROBOT_STOP");
            GLOBALS._espStopNotified = true;
        }
    } else {
        GLOBALS._espStopNotified = false;
        if (GLOBALS.robotIsRunning != robotStatus.isProgramRunning) {
            // alert change
            if (GLOBALS.ESP_FUNCTIONS != undefined) {
                if (robotStatus.isProgramRunning) {
                    logger.info("sending to ESP ROBOT_PICKING");
                    GLOBALS.ESP_FUNCTIONS.broadcastToAllESP32("ROBOT_PICKING");
                }
                if (!robotStatus.isProgramRunning) {
                    logger.info("sending to ESP ROBOT_IDLE");
                    GLOBALS.ESP_FUNCTIONS.broadcastToAllESP32("ROBOT_IDLE");
                }
            } else {
                logger.error("GLOBALS.ESP_FUNCTIONS not loaded yet or not working");
            }
            // save status to global 
            GLOBALS.robotIsRunning = robotStatus.isProgramRunning;
        }
    }
    //logger.info("robotstatusRunning:" + robotStatus.isProgramRunning);
    const FROM = "HWROBOT";
    const ACTION = "ROBOT_STATUS_UPDATE";
    const MSG = JSON.stringify({
        isConnected: robotStatus.isConnected,
        isAvailable: robotStatus.isAvailable,
        isRobotOn: robotStatus.isRobotOn,
        isProtectiveStop: robotStatus.isProtectiveStop,
        isProgramRunning: robotStatus.isProgramRunning,
        joints: robotStatus.joints,
        tcpM: robotStatus.tcpM,
        tcpR: robotStatus.tcpR
    });
    if (config.robotConfig.logRobotActionUpdateDisplay) {
        logger.debug(`Broadcasting robot status: ${MSG}`);
    }
    emitter.emit("MFS", `${FROM}___${ACTION}___${MSG}`);
    const siteAction = "SITE_" + ACTION;
    if (GLOBALS && GLOBALS.SIO && typeof GLOBALS.SIO.emit === 'function') {
        GLOBALS.SIO.emit("SITE_MFS", `${FROM}___${siteAction}___${MSG}`);
    }
}

function radiansToDeg(r) {
    return Number((r * 180 / Math.PI).toFixed(2));
}

function parseJointData(buf) {
    /* skip the sub-header */
    const payloadStart = SUBPKG_HEADER_LENGTH;
    const bodyBytes = buf.length - payloadStart;
    const stride = bodyBytes / 6;                 // bytes per joint block

    const jointsDeg = [];
    for (let j = 0; j < 6; ++j) {
        const q_actual = buf.readDoubleBE(payloadStart + j * stride); // first double
        jointsDeg.push(radiansToDeg(q_actual));
    }
    return jointsDeg;                                   // [deg, …] length 6
}

function parseCartesianInfo(buf) {
    const payloadStart = SUBPKG_HEADER_LENGTH;  // header skipped
    const tcp = [];
    for (let k = 0; k < 6; ++k)
        tcp.push(buf.readDoubleBE(payloadStart + k * 8));

    // Convert to mm and round to 2 decimal places
    const xyzMm = tcp.slice(0, 3).map(m => Number((m * 1000).toFixed(2))); // mm
    // Keep radians but round to 2 decimal places
    const rxyz = tcp.slice(3).map(r => Number(r.toFixed(2)));             // rad
    return { xyzMm, rxyz };
}

function HW_ROBOT_LOG_STATUS(GLOBALS) {
    logger.debug(`Robot State: ${robotStatus.isRobotOn}, Protective Stop: ${robotStatus.isProtectiveStop}, Program Running: ${robotStatus.isProgramRunning}`);
    logger.debug(`Joint positions (deg): ${robotStatus.joints.join(', ')}`);
}

/////////////////////////////////////////////////////////////////////////// HELPERS

function HW_ROBOT_CALC_POSXY_FROM_CASNR(GLOBALS, userOrder, casNr, casRow, casColumn, carIndex) {
    logger.debug(`CALC_CASSETTE_POS inputs: casNr: ${casNr}, casRow: ${casRow}, casColumn: ${casColumn}, carIndex: ${carIndex}`);

    let calibrationX = 0; // from database todo: make definition in config
    let calibrationY = 0; // from database

    // Calculate base positions before rotation ----  
    let casX_beforeAngleCorrection = 0.001 * (calibrationX + robotScripts.deltaX * casColumn);
    let casY_beforeAngleCorrection = 0.001 * (calibrationY - robotScripts.deltaY * casRow);

    // let casX_afterAngleCorrection = 0;
    // let casY_afterAngleCorrection = 0;
    //Clock-wise rotation of the calibration angle
    // if (robotScripts.calibrationAngleRAD <= 0) {
    //     casX_afterAngleCorrection = 0.001 * robotScripts.homeX +
    //         (casX_beforeAngleCorrection * Math.cos(robotScripts.calibrationAngleRAD) -
    //             casY_beforeAngleCorrection * Math.sin(robotScripts.calibrationAngleRAD));

    //     casY_afterAngleCorrection = 0.001 * robotScripts.homeY +
    //         (casX_beforeAngleCorrection * Math.sin(robotScripts.calibrationAngleRAD) +
    //             casY_beforeAngleCorrection * Math.cos(robotScripts.calibrationAngleRAD));
    // } else {
    //     //Counterclock-wise rotation of the calibration angle
    //     // alpha < 0
    //     casX_afterAngleCorrection = 0.001 * robotScripts.homeX +
    //         (casX_beforeAngleCorrection * Math.cos(robotScripts.calibrationAngleRAD) -
    //             casY_beforeAngleCorrection * Math.sin(robotScripts.calibrationAngleRAD));
    //     casY_afterAngleCorrection = 0.001 * robotScripts.homeY +
    //         (casX_beforeAngleCorrection * Math.sin(robotScripts.calibrationAngleRAD) +
    //             casY_beforeAngleCorrection * Math.cos(robotScripts.calibrationAngleRAD));
    // }

    // Apply rotation matrix transformation
    // [cos(θ) -sin(θ)] [x]
    // let casX_afterAngleCorrection = robotScripts.homeX * 0.001 +
    //     (casX_beforeAngleCorrection * Math.cos(robotScripts.calibrationAngleRAD) -
    //         casY_beforeAngleCorrection * Math.sin(robotScripts.calibrationAngleRAD));

    let casX_afterAngleCorrection =
        ((robotScripts.homeX * 0.001 + casX_beforeAngleCorrection) * Math.cos(robotScripts.calibrationAngleRAD) -
            (robotScripts.homeY * 0.001 + casY_beforeAngleCorrection) * Math.sin(robotScripts.calibrationAngleRAD));


    // [sin(θ)  cos(θ)] [y]
    // let casY_afterAngleCorrection = robotScripts.homeY * 0.001 +
    //     (casX_beforeAngleCorrection * Math.sin(robotScripts.calibrationAngleRAD) +
    //         casY_beforeAngleCorrection * Math.cos(robotScripts.calibrationAngleRAD));

    let casY_afterAngleCorrection =
        ((robotScripts.homeX * 0.001 + casX_beforeAngleCorrection) * Math.sin(robotScripts.calibrationAngleRAD) +
            (robotScripts.homeY * 0.001 + casY_beforeAngleCorrection) * Math.cos(robotScripts.calibrationAngleRAD));


    // if there is a custom offset for this cassette, use it, otherwise its 0
    let cassetteCustomZOffset = 0;
    if (casNr in robotScripts.cassettesZ) {
        logger.debug(`Using custom offset for cassette ${casNr}: ${robotScripts.cassettesZ[casNr]}`);
        cassetteCustomZOffset = robotScripts.cassettesZ[casNr] / 1000;
    }

    if (casY_afterAngleCorrection > 0) {
        cassetteCustomZOffset = casY_afterAngleCorrection * 30 / 700;
    }


    // Base Z cassete offset, plus specific offset, plus safety offset
    let casZ_afterDepthCorrection = robotScripts.PICK_HOVER_Z - cassetteCustomZOffset + robotScripts.safetyZOffset + 20 * 0.001;

    userOrder.cassettesId[carIndex] = casNr;
    userOrder.cassettesX[carIndex] = casX_afterAngleCorrection;
    userOrder.cassettesY[carIndex] = casY_afterAngleCorrection;
    userOrder.cassettesZ[carIndex] = casZ_afterDepthCorrection;

    logger.debug("userOrder object:");
    logger.debug(JSON.stringify(userOrder));
}

/////////////////////////////////////////////////////////////////////////// SCRIPT BUILDER FUNCTIONS

function getRobotStatusSnapshot() {
    return {
        isConnected: robotStatus.isConnected,
        isAvailable: robotStatus.isAvailable,
        isRobotOn: robotStatus.isRobotOn,
        isProtectiveStop: robotStatus.isProtectiveStop,
        isProgramRunning: robotStatus.isProgramRunning,
        joints: robotStatus.joints,
        tcpM: robotStatus.tcpM,
        tcpR: robotStatus.tcpR
    };
}

function toNumber(value, digits = 3) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
    return Number(Number(value).toFixed(digits));
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function waitForRobotIdle(timeoutMs = 20000, pollMs = 200) {
    return new Promise((resolve) => {
        const start = Date.now();

        const check = () => {
            if (!robotStatus.isProgramRunning) {
                resolve(true);
                return;
            }
            if (Date.now() - start >= timeoutMs) {
                resolve(false);
                return;
            }
            setTimeout(check, pollMs);
        };

        check();
    });
}

function waitForRobotPose(target, toleranceMm = 1.0, timeoutMs = 20000, pollMs = 200, stableDurationMs = 0) {
    return new Promise((resolve) => {
        const start = Date.now();
        let withinSince = null;

        const check = () => {
            if (Array.isArray(robotStatus.tcpM) && robotStatus.tcpM.length >= 3) {
                const [x, y, z] = robotStatus.tcpM;
                const dx = x - target.x;
                const dy = y - target.y;
                const dz = z - target.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist <= toleranceMm) {
                    if (withinSince === null) {
                        withinSince = Date.now();
                    }
                    if (stableDurationMs <= 0 || (Date.now() - withinSince) >= stableDurationMs) {
                        resolve(true);
                        return;
                    }
                } else {
                    withinSince = null;
                }
            }

            if (Date.now() - start >= timeoutMs) {
                resolve(false);
                return;
            }

            setTimeout(check, pollMs);
        };

        check();
    });
}

function waitForRobotDisplacement(startPose, minDistanceMm, toleranceMm = 5.0, timeoutMs = 20000, pollMs = 200) {
    return new Promise((resolve) => {
        if (!startPose || typeof startPose.x !== 'number' || typeof startPose.y !== 'number' || typeof startPose.z !== 'number') {
            resolve(false);
            return;
        }

        const threshold = Math.max(0, minDistanceMm - toleranceMm);
        const start = Date.now();

        const check = () => {
            if (Array.isArray(robotStatus.tcpM) && robotStatus.tcpM.length >= 3) {
                const [x, y, z] = robotStatus.tcpM;
                const dx = x - startPose.x;
                const dy = y - startPose.y;
                const dz = z - startPose.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist >= threshold) {
                    resolve(true);
                    return;
                }
            }

            if (Date.now() - start >= timeoutMs) {
                resolve(false);
                return;
            }

            setTimeout(check, pollMs);
        };

        check();
    });
}

function computeOrientationCalibration(state) {
    const ref = state?.orientation?.cassette153Reference;
    const target = state?.orientation?.cassette153Corner;
    const cassette1 = state?.orientation?.cassette1Reference;
    const workflow = ensureWorkflowState(state);
    if (!ref || !target) return;

    const dx = target.x - ref.x;
    const dy = target.y - ref.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    state.orientation.vectorLengthMm = toNumber(distance, 3);
    workflow.orientation.baselineCaptured = Boolean(ref);
    workflow.orientation.cornerCaptured = Boolean(target);
    if (workflow.orientation.baselineCaptured) {
        workflow.orientation.travelReady = true;
        workflow.orientation.travelComplete = true;
    }

    if (distance <= 0) {
        state.orientation.alphaDeg = null;
        return;
    }

    const denominator = 2 * CALIBRATION_REFERENCE_TRAVEL_MM;
    const ratio = clamp(distance / denominator, -1, 1);
    let alphaRad = 2 * Math.asin(ratio);

    // Determine sign based on lateral deviation. Defaults to 0 (no rotation).
    let sign = Math.sign(dx);
    if (sign === 0 && cassette1 && ref) {
        const baselineVecX = ref.x - cassette1.x;
        const baselineVecY = ref.y - cassette1.y;
        const cross = baselineVecX * dy - baselineVecY * dx;
        sign = Math.sign(cross);
    }
    if (sign !== 0) {
        alphaRad *= sign;
    }

    const alphaDeg = alphaRad * (180 / Math.PI);
    state.orientation.alphaDeg = toNumber(alphaDeg, 6);
    state.orientation.lastComputedAt = new Date().toISOString();
}

function computeTranslationCalibration(state) {
    const ref = state?.translation?.cassette1Reference;
    const aligned = state?.translation?.cassette1Aligned;
    const workflow = ensureWorkflowState(state);
    if (!ref || !aligned) return;

    const offsetX = aligned.x - ref.x;
    const offsetY = aligned.y - ref.y;
    state.translation.offsetXmm = toNumber(offsetX, 3);
    state.translation.offsetYmm = toNumber(offsetY, 3);
    state.translation.lastComputedAt = new Date().toISOString();
    workflow.translation.referenceCaptured = Boolean(ref);
    workflow.translation.alignedCaptured = Boolean(aligned);
}

function capturePointTemplate() {
    const now = new Date().toISOString();
    return (x, y, z) => ({
        x: toNumber(x, 3),
        y: toNumber(y, 3),
        z: toNumber(z, 3),
        capturedAt: now
    });
}

async function getCassettePose(GLOBALS, casNr) {
    if (!GLOBALS?.DB_QS?.Query) {
        throw new Error('Database query interface unavailable');
    }

    const result = await GLOBALS.DB_QS.Query(
        'SELECT casNr, casRow, casColumn FROM hwv00_cassettes WHERE casNr = ? LIMIT 1',
        [casNr]
    );

    if (!Array.isArray(result) || result.length === 0) {
        throw new Error(`Cassette ${casNr} not found in database`);
    }

    const cassette = result[0];
    const userOrder = {
        cassettesId: [],
        cassettesX: [],
        cassettesY: [],
        cassettesZ: []
    };

    HW_ROBOT_CALC_POSXY_FROM_CASNR(
        GLOBALS,
        userOrder,
        cassette.casNr,
        cassette.casRow,
        cassette.casColumn,
        0
    );

    return {
        cassette,
        pose: {
            x: toNumber(userOrder.cassettesX[0], 4),
            y: toNumber(userOrder.cassettesY[0], 4),
            z: toNumber(userOrder.cassettesZ[0], 4)
        }
    };
}

async function HW_ROBOT_CALIBRATION_GOTO_CASSETTE(GLOBALS, casNr) {
    const { pose } = await getCassettePose(GLOBALS, casNr);

    const script = `
def CALIBRATION_GOTO_CASSETTE_${casNr}():
${robotScripts.ROBOTFUNCTIONS}
${BUILDSCRIPT_CASSETTE_POINT(pose.x, pose.y, pose.z, casNr)}
end`;

    return writeToRobotSocket(GLOBALS, script, `Calibration goto cassette ${casNr}`);
}

async function HW_ROBOT_MOVE_TO_CASSETTE(GLOBALS, casNr, label = '') {
    const { pose } = await getCassettePose(GLOBALS, casNr);

    const script = `
def CALIBRATION_VERIFY_CASSETTE_${casNr}():
${robotScripts.ROBOTFUNCTIONS}
${BUILDSCRIPT_CASSETTE_POINT(pose.x, pose.y, pose.z, casNr)}
end`;

    const descriptor = label || `Calibration verification goto cassette ${casNr}`;
    const success = await writeToRobotSocket(GLOBALS, script, descriptor);
    if (!success) {
        return { success: false, reason: 'socket_write_failed' };
    }

    const idle = await waitForRobotIdle(60000, 200);
    if (!idle) {
        return { success: false, reason: 'idle_timeout' };
    }

    const expectedPose = {
        x: pose.x * 1000,
        y: pose.y * 1000,
        z: pose.z * 1000
    };

    const reached = await waitForRobotPose(expectedPose, 15.0, 60000, 200, 800);
    if (!reached) {
        return { success: false, reason: 'pose_tolerance_failed', expectedPose };
    }

    return { success: true, expectedPose };
}

/*
// unused function
async function HW_ROBOT_MOVE_TO_CAPTURED_POSE(GLOBALS, poseMm, label = '') {
    if (!poseMm || typeof poseMm.x !== 'number' || typeof poseMm.y !== 'number' || typeof poseMm.z !== 'number') {
        return { success: false, reason: 'pose_missing' };
    }

    const poseMeters = {
        x: poseMm.x / 1000,
        y: poseMm.y / 1000,
        z: poseMm.z / 1000
    };

    const script = `
def CALIBRATION_VERIFY_CAPTURED():
${robotScripts.ROBOTFUNCTIONS}
${BUILDSCRIPT_CASSETTE_POINT(poseMeters.x, poseMeters.y, poseMeters.z, 0)}
end`;

    const descriptor = label || 'Calibration verification captured pose';
    const success = await writeToRobotSocket(GLOBALS, script, descriptor);
    if (!success) {
        return { success: false, reason: 'socket_write_failed' };
    }

    const idle = await waitForRobotIdle(60000, 200);
    if (!idle) {
        return { success: false, reason: 'idle_timeout' };
    }

    const expectedPose = {
        x: poseMm.x,
        y: poseMm.y,
        z: poseMm.z
    };

    const reached = await waitForRobotPose(expectedPose, 15.0, 60000, 200, 800);
    if (!reached) {
        return { success: false, reason: 'pose_tolerance_failed', expectedPose };
    }

    return { success: true, expectedPose };
}
    */

async function updateCalibrationAngleInConfig(newAngleDeg) {
    try {
        //const configPath = path.join(__dirname, '../config/configRobot/HW_robot_config.js');
        const configPath = path.join(__dirname, '../config/configRobot.js');

        const fileContent = await fs.readFile(configPath, 'utf8');
        const angleRegex = /(calibrationAngleDEG\s*:\s*)(-?\d+(?:\.\d+)?)/;
        if (!angleRegex.test(fileContent)) {
            //throw new Error('calibrationAngleDEG not found in HW_robot_config.js');
            throw new Error('calibrationAngleDEG not found in configRobot.js');
        }

        const formatted = toNumber(newAngleDeg, 6);
        if (formatted === null) {
            throw new Error('Computed calibration angle is not numeric');
        }

        const updated = fileContent.replace(angleRegex, (_, prefix) => `${prefix}${formatted}`);
        await fs.writeFile(configPath, updated, 'utf8');
        logger.info(`[CALIB] Updated calibrationAngleDEG in config to ${formatted}`);
    } catch (err) {
        logger.error(`Failed to persist calibrationAngleDEG (${err.message})`);
    }
}
async function setCalibrationAngle(newAngleDeg) {
    const formatted = toNumber(newAngleDeg, 6);
    if (formatted === null || !Number.isFinite(formatted)) {
        throw new Error('Invalid calibration angle value');
    }

    await updateCalibrationAngleInConfig(formatted);

    const currentAngle = robotScripts.calibrationAngleDEG;
    const delta = formatted - currentAngle;
    if (Math.abs(delta) < 1e-6) {
        return;
    }

    if (delta >= 0) {
        robotScripts.CALIBRATION_ANGLE_PLUS(delta);
    } else {
        robotScripts.CALIBRATION_ANGLE_MINUS(-delta);
    }

    logger.info(`[CALIB] Runtime calibrationAngleDEG updated from ${currentAngle} to ${robotScripts.calibrationAngleDEG}`);
}



async function applyOrientationCalibration(calibration) {
    const alphaDeg = calibration?.orientation?.alphaDeg;
    if (alphaDeg === null || alphaDeg === undefined || !Number.isFinite(alphaDeg)) {
        logger.warn('Orientation alphaDeg unavailable, skipping calibration angle update.');
        return;
    }

    try {
        await setCalibrationAngle(alphaDeg);
    } catch (err) {
        logger.error(`Failed to apply orientation calibration angle: ${err.message}`);
    }
}


function normaliseDeltaMm(delta) {
    if (delta === null || delta === undefined) {
        return { x: 0, y: 0, z: 0 };
    }

    if (typeof delta === 'number') {
        return { x: delta, y: 0, z: 0 };
    }

    if (Array.isArray(delta)) {
        return {
            x: Number(delta[0] || 0),
            y: Number(delta[1] || 0),
            z: Number(delta[2] || 0)
        };
    }

    if (typeof delta === 'object') {
        return {
            x: Number(delta.x || delta.X || 0),
            y: Number(delta.y || delta.Y || 0),
            z: Number(delta.z || delta.Z || 0)
        };
    }

    throw new Error('Unsupported deltaMm payload');
}

function mmToMeters(valueMm) {
    return Number((Number(valueMm || 0) / 1000).toFixed(6));
}

async function HW_ROBOT_CALIBRATION_MOVE_LINEAR(GLOBALS, deltaMm, speed = 'slow') {
    const { x, y, z } = normaliseDeltaMm(deltaMm);

    if (x === 0 && y === 0 && z === 0) {
        throw new Error('Calibration move requires a non-zero delta');
    }

    const dx = mmToMeters(x);
    const dy = mmToMeters(y);
    const dz = mmToMeters(z);

    const velocity = speed === 'fast' ? robotScripts.robot_avr : robotScripts.robot_avr_slow;

    const script = `
def CALIBRATION_MOVE_LINEAR():
${robotScripts.ROBOTFUNCTIONS}
  movel(pose_trans(get_actual_tcp_pose(),p[${dx},${dy},${dz},0,0,0]),${velocity})
  sleep(0.5)
end`;

    return writeToRobotSocket(GLOBALS, script, `Calibration move linear Δmm=(${x},${y},${z})`);
}

async function HW_ROBOT_CALIBRATION_TRAVEL_SAFE(GLOBALS, distanceMm) {
    const distance = Math.abs(Number(distanceMm || 0));
    if (distance === 0) {
        throw new Error('Calibration travel requires non-zero distance');
    }

    const dx = mmToMeters(-distance); // negative X axis corresponds to cassette depth towards the back

    const script = `
def CALIBRATION_SAFE_TRAVEL():
${robotScripts.ROBOTFUNCTIONS}
  local start_pose = get_actual_tcp_pose()
${robotScripts.CALL_ROBOT_MOVE_SAFE_LEFT}
  movel(pose_trans(start_pose,p[${dx},0,0,0,0,0]),${robotScripts.robot_avr_slow})
  sleep(0.5)
end`;

    return writeToRobotSocket(GLOBALS, script, `Calibration safe travel ${-distance}mm`);
}

/**
 * Builds the robot script for pointing at a cassette
 * @param {number} posx - X position of the cassette
 * @param {number} posy - Y position of the cassette
 * @param {number} posz - Z position of the cassette
 * @param {string} casNr - Cassette number
 * @returns {string} The robot script for pointing at the cassette
 */
function BUILDSCRIPT_CASSETTE_POINT(posx, posy, posz, casNr) {
    logger.debug(`casNr: ${casNr}, x: ${posx}, y: ${posy}, z: ${posz}`);

    let script = "\n  # casNr:" + casNr + ", x:" + posx + ", y:" + posy + ", z:" + posz;

    script += "  " + robotScripts.CALL_ROBOT_MOVE_SAFE_MID;

    // VIA SAFE POSITION LEFT OR RIGHT
    if (posx >= 0) {
        script += "  " + robotScripts.CALL_ROBOT_MOVE_SAFE_RIGHT;
    } else {
        script += "  " + robotScripts.CALL_ROBOT_MOVE_SAFE_LEFT;
    }

    // MOVE TO CASSETTE
    script += "\n  movel(p[" + posx + "," + posy + "," + posz + ",2.2, 2.2, 0]," + robotScripts.robot_avr + ")";
    script += robotScripts.CALL_SLEEP + `\n`;
    return script;
}

/**
 * Builds the robot script for presenting a car
 * @returns {string} The robot script for presenting a car
 */
function BUILDSCRIPT_PRESENTCAR() {
    let script = "\n  # Present Car\n";
    script += robotScripts.CALL_ROBOT_MOVE_PRESENT_CAR;
    script += robotScripts.CALL_ROBOT_MOVE_IN;
    script += robotScripts.CALL_SLEEP + `\n`;
    script += robotScripts.CALL_ROBOT_MOVE_OUT;
    script += robotScripts.CALL_SLEEP + `\n`;
    script += robotScripts.CALL_ROBOT_MOVE_SAFE_MID;
    return script;
}


/**
 * Generates the robot script for dropping a car at the specified drop point
 * @param {number} dropPoint - The drop point number (1 to config.robotConfig.numTracks)
 * @returns {string} The robot script for dropping the car
 */
function BUILDSCRIPT_DROPOFF(dropPoint) {
    if (typeof dropPoint !== 'number') {
        logger.warn(`Invalid drop point type: ${typeof dropPoint}. Converting to number.`);
        dropPoint = Number(dropPoint);
    }

    // Validate drop point number against configured number of tracks
    if (dropPoint < 1 || dropPoint > config.robotConfig.numTracks) {
        logger.warn(`Invalid drop point: ${dropPoint}. Must be between 1 and ${config.robotConfig.numTracks}`);
        dropPoint = Math.min(Math.max(dropPoint, 1), config.robotConfig.numTracks);
    }

    let dropScript = `\n  #------------ DROP CAR AT TRACK ${dropPoint} ------------\n`;

    const sequenceKey = `CALL_ROBOT_MOVE_DROP${dropPoint}_SEQUENCE`;
    const dropSequence = robotScripts[sequenceKey];

    if (!dropSequence) {
        logger.error(`Drop sequence macro '${sequenceKey}' is undefined. Robot cannot move to track ${dropPoint} without calibration.`);
        dropScript += "  # Drop sequence unavailable - skipping drop\n";
        return dropScript;
    }

    dropScript += `  ${dropSequence}\n`;
    return dropScript;
}



////////////////////////////////////////////////////////////////  ASSEMBLE ROBOT FUNCTIONS

function HW_ROBOT_STOP(GLOBALS) {

    logger.warn("ROBOT_STOP");
    let STOPMOVEMENTS =
        "def ROBOTSTOP_MANUALLY():\n" +
        "  stopl(10)\n" +
        "end";

    if (robotSocket && robotStatus.isConnected) {
        robotSocket.write(STOPMOVEMENTS + '\n');
    } else {
        logger.warn("Cannot send ROBOT_STOP to robot - socket not connected");
    }

    // flag to prevent robot from picking cueline
    GLOBALS.ROBOT_HALTED = true;
    // to esp
    if (GLOBALS.ESP_FUNCTIONS) {
        GLOBALS.ESP_FUNCTIONS.broadcastToAllESP32("ROBOT_STOP");
    }

}
function HW_ROBOT_UNHALT(GLOBALS) {
    logger.info("HW_ROBOT_UNHALT");
    GLOBALS.ROBOT_HALTED = false;
    if (GLOBALS.ESP_FUNCTIONS) {
        GLOBALS.ESP_FUNCTIONS.broadcastToAllESP32("ROBOT_UNHALT");
    }

}
function HW_ROBOT_G_LOOK_LEFT(GLOBALS) {
    logger.info("HW_ROBOT_G_LOOK_LEFT");

    let robot_action = "";
    robot_action += "def ROBOT_G_LOOK_LEFT():\n";
    robot_action += robotScripts.ROBOTFUNCTIONS + "\n";
    robot_action += robotScripts.CALL_G_LOOK_LEFT + "\n";
    robot_action += "end\n";
    robot_action += "ROBOT_G_LOOK_LEFT()";

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_G_LOOK_RIGHT(GLOBALS) {
    logger.info("HW_ROBOT_G_LOOK_RIGHT");
    let robot_action = "";
    robot_action += "def ROBOT_G_LOOK_RIGHT():\n";
    robot_action += robotScripts.ROBOTFUNCTIONS + "\n";
    robot_action += robotScripts.CALL_G_LOOK_RIGHT + "\n";
    robot_action += "end\n";
    robot_action += "ROBOT_G_LOOK_RIGHT()";

    writeToRobotSocket(GLOBALS, robot_action);
}

//////////////////////////////////////////

function HW_ROBOT_G_ACTIVATE(GLOBALS) {
    logger.info("Activate Gripper");
    logger.warn("!!!!!!!!!!!!!!!!!!!!!U'RE ACTIVATING GRIPPER (maybe)!!!!!!!!!!");
    let robot_action =
        "def GripperActivate():\n"
        + robotScripts.ROBOTFUNCTIONS + "\n"
        + robotScripts.CALL_G_ACTIVATE + "\n"
        + "end" + "\n"
        + "G_ACTIVATE()";

    return writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_G_CLOSE_LOW(GLOBALS) {
    logger.info("S1HWCOM G CLOSE LOW");

    let robot_action =
        "def GripperCloseLow():\n"
        + robotScripts.ROBOTFUNCTIONS + "\n"
        + robotScripts.CALL_G_CLOSE_LOW + "\n"
        + "end" + "\n";
    //+ "G_CLOSE_LOW()";

    return writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_G_CLOSE_MEDIUM(GLOBALS) {
    logger.info("S1HWCOM G CLOSE MEDIUM");

    let robot_action =
        "def ROBOT_G_CLOSE_MEDIUM():\n"
        + robotScripts.ROBOTFUNCTIONS + "\n"
        + robotScripts.CALL_G_CLOSE_MID + "\n"
        + "end\n"
        + "ROBOT_G_CLOSE_MEDIUM()";

    return writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_G_CLOSE_HIGH(GLOBALS) {
    logger.info("S1HWCOM G CLOSE HIGH");

    let robot_action =
        "def GripperClose():\n"
        + robotScripts.ROBOTFUNCTIONS + "\n"
        + robotScripts.CALL_G_CLOSE_HIGH + "\n"
        + "end\n";

    return writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_G_OPEN(GLOBALS) {
    logger.info("S1HWCOM G OPEN");

    let robot_action =
        "def ROBOT_G_OPEN():\n"
        + robotScripts.ROBOTFUNCTIONS + "\n"
        + robotScripts.CALL_G_OPEN_FULL + "\n"
        + "end\n"
        + "ROBOT_G_OPEN()";

    return writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_PICKOUT(GLOBALS) {
    logger.info("HW_ROBOT_PICKOUT !!!!!!!!!!!!!!!!!!!!!!");

    let robot_action = `
def PICK_OUT_CAR():
${robotScripts.ROBOTFUNCTIONS}
${robotScripts.CALL_PICKOUT_CAR_SMALL}
end`;

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_G_PICKANGLE(GLOBALS) {
    logger.info("== S1HWCOM HW_G_PICKANGLE");

    let robot_action = `
def X_G_PICKANGLE():
${robotScripts.ROBOTFUNCTIONS}
${robotScripts.CALL_G_PICKANGLE}
${robotScripts.CALL_G_HORIZONTAL}
end`;

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_PRESENT_CAR(GLOBALS) {
    logger.info("HW_ROBOT_MOVE_PRESENT_CAR");

    let robot_action = "def HW_ROBOT_MOVE_PRESENT_CAR():\n";
    robot_action += robotScripts.ROBOTFUNCTIONS;
    robot_action += BUILDSCRIPT_PRESENTCAR();
    robot_action += "\nend";

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_SAFE_MID(GLOBALS) {
    logger.info("== S1HWCOM HW_ROBOT_MOVE_SAFE_MID");

    let robot_action = `
def ROBOT_MOVE_SAFE_MID():
${robotScripts.ROBOTFUNCTIONS}
${robotScripts.CALL_ROBOT_MOVE_SAFE_MID}
end`;

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_SAFE_LEFT(GLOBALS) {
    logger.info("== S1HWCOM HW_ROBOT_MOVE_SAFE_LEFT");

    let robot_action = `
def ROBOT_MOVE_SAFE_LEFT():
${robotScripts.ROBOTFUNCTIONS}
${robotScripts.CALL_ROBOT_MOVE_SAFE_LEFT}
end`;

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_SAFE_RIGHT(GLOBALS) {
    // wordt aangeroepen in dashboard
    // dit is NIET de moveHome die in client scripts wordt gebruikt 
    // daarvoor zijn bovenstaande

    logger.info("== S1HWCOM HW_ROBOT_MOVE_SAFE_RIGHT");

    let robot_action = `
def ROBOT_MOVE_SAFE_RIGHT():
${robotScripts.ROBOTFUNCTIONS}
${robotScripts.CALL_ROBOT_MOVE_SAFE_RIGHT} 
end`;

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_SAFE_CROWD(GLOBALS) {
    logger.info("== S1HWCOM HW_ROBOT_MOVE_SAFE_CROWD");

    let robot_action = `
def ROBOT_MOVE_SAFE_CROWD():
${robotScripts.ROBOTFUNCTIONS}
${robotScripts.CALL_ROBOT_MOVE_SAFE_CROWD}
end`;

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_REL_LEFT(GLOBALS) {
    logger.info("HW_ROBOT_MOVE_REL_LEFT");

    let robot_action = `
def MOVE_LEFT_NOW():
${robotScripts.ROBOTFUNCTIONS}
${robotScripts.CALL_MOVE_LEFT}
end`;

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_REL_RIGHT(GLOBALS) {
    logger.info("HW_ROBOT_MOVE_REL_RIGHT");
    let robot_action = `
def MOVE_RIGHT_NOW():
${robotScripts.ROBOTFUNCTIONS}
${robotScripts.CALL_MOVE_RIGHT}
end`;

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_REL_IN(GLOBALS) {
    logger.info("HW_ROBOT_MOVE_REL_IN");
    let robot_action = `
def MOVE_IN_NOW():
${robotScripts.ROBOTFUNCTIONS}
${robotScripts.CALL_ROBOT_MOVE_IN}
end`;

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_REL_OUT(GLOBALS) {
    logger.info("HW_ROBOT_MOVE_REL_OUT");

    let robot_action = `
def MOVE_OUT_NOW():
${robotScripts.ROBOTFUNCTIONS}
${robotScripts.CALL_ROBOT_MOVE_OUT}
end`;

    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_REL_UP(GLOBALS) {
    logger.info("HW_ROBOT_MOVE_REL_UP");
    let robot_action = "def MOVE_UP_NOW():\n";
    robot_action += robotScripts.ROBOTFUNCTIONS;
    robot_action += robotScripts.CALL_MOVE_UP;
    robot_action += "\nend";
    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_REL_DOWN(GLOBALS) {
    logger.info("HW_ROBOT_MOVE_REL_DOWN");
    let robot_action = "def MOVE_DOWN_NOW():\n";
    robot_action += robotScripts.ROBOTFUNCTIONS;
    robot_action += robotScripts.CALL_MOVE_DOWN;
    robot_action += "\nend";
    writeToRobotSocket(GLOBALS, robot_action);
}

function HW_ROBOT_MOVE_REL_DIAG(GLOBALS) {
    logger.info("HW_ROBOT_MOVE_REL_DIAG");
    let robot_action = "def MOVE_DIAG_NOW():\n";
    robot_action += robotScripts.ROBOTFUNCTIONS;
    robot_action += robotScripts.CALL_MOVE_DIAG;
    robot_action += "\nend";
    writeToRobotSocket(GLOBALS, robot_action);
}

function __setRobotSocketForTest(socket) {
    robotSocket = socket;
}

async function HW_TESTRUN_1(GLOBALS) {
    logger.info("HW_TESTRUN_1: building pick-only sweep for upper third segment cassettes");

    let script = "def RUN_THROUGH_1():\n";
    script += robotScripts.ROBOTFUNCTIONS; // shared UR helpers

    for (let casNr = 1; casNr <= 56; casNr++) {
        // Fetch cassette location
        const rows = await GLOBALS.DB_QS.Query(
            "SELECT casRow, casColumn FROM hwv00_cassettes WHERE casNr = ?", //run sql query to get the cassette info
            [casNr]
        );
        if (!rows.length) {
            logger.warn(`HW_TESTRUN_1: cassette ${casNr} not found in DB, skipping`);
            continue;
        }

        const { casRow, casColumn } = rows[0];
        const userOrder = { cassettesX: [], cassettesY: [], cassettesZ: [], cassettesId: [], terminalId: 1 };
        HW_ROBOT_CALC_POSXY_FROM_CASNR(GLOBALS, userOrder, casNr, casRow, casColumn, 0);

        script += `\n  # Cassette ${casNr}`;
        script += HW_ROBOT_PICK_CAR(
            GLOBALS,
            userOrder.cassettesX[0],
            userOrder.cassettesY[0],
            userOrder.cassettesZ[0],
            casNr,
            userOrder.terminalId,
            false // dropAfterPick -> false means pick-only + move to mid
        );
    }

    script += "\nend\nRUN_THROUGH_1()\n";

    writeToRobotSocket(GLOBALS, script);
    logger.info("HW_TESTRUN_1: script sent");
}
async function HW_TESTRUN_2(GLOBALS) {
    logger.info("HW_TESTRUN_2: building pick-only sweep for left third segment cassettes");

    const cassetteList = [
        59, 60, 61,
        65, 66, 67, 68,
        73, 74, 75, 76,
        81, 82, 83, 84,
        89, 90, 91, 92,
        97, 98, 99, 100, 101,
        107, 108, 109, 110, 111,
        117, 118, 119, 120, 121,
             127, 128, 129, 130,
             135, 136, 137, 138,
             143, 144, 145, 146,
                  151, 152, 153,
                  157, 158, 
                       161
    ];

    let script = "def RUN_THROUGH_2():\n";
    script += robotScripts.ROBOTFUNCTIONS;

    for (const casNr of cassetteList) {
        const rows = await GLOBALS.DB_QS.Query(
            "SELECT casRow, casColumn FROM hwv00_cassettes WHERE casNr = ?",
            [casNr]
        );
        if (!rows.length) {
            logger.warn(`HW_TESTRUN_2: cassette ${casNr} not found in DB, skipping`);
            continue;
        }

        const { casRow, casColumn } = rows[0];
        const userOrder = { cassettesX: [], cassettesY: [], cassettesZ: [], cassettesId: [], terminalId: 1 };
        HW_ROBOT_CALC_POSXY_FROM_CASNR(GLOBALS, userOrder, casNr, casRow, casColumn, 0);

        script += `\n  # Cassette ${casNr}`;
        script += HW_ROBOT_PICK_CAR(
            GLOBALS,
            userOrder.cassettesX[0],
            userOrder.cassettesY[0],
            userOrder.cassettesZ[0],
            casNr,
            userOrder.terminalId,
            false // pick-only + move to mid
        );
    }

    script += "\nend\nRUN_THROUGH_2()\n";

    writeToRobotSocket(GLOBALS, script);
    logger.info("HW_TESTRUN_2: script sent");
}
async function HW_TESTRUN_3(GLOBALS) {
    logger.info("HW_TESTRUN_3: building pick-only sweep for right third segment cassettes");

    const cassetteList = [
                     62, 63, 64,
                 69, 70, 71, 72,
                 77, 78, 79, 80,
                 85, 86, 87, 88,
                 93, 94, 95, 96,
        102, 103, 104, 105, 106,
        112, 113, 114, 115, 116,
        122, 123, 124, 125, 126,
        131, 132, 133, 134,
        139, 140, 141, 142,
        147, 148, 149, 150,
        154, 155, 156,
             159, 160, 
             162
    ];

    let script = "def RUN_THROUGH_3():\n";
    script += robotScripts.ROBOTFUNCTIONS;

    for (const casNr of cassetteList) {
        const rows = await GLOBALS.DB_QS.Query(
            "SELECT casRow, casColumn FROM hwv00_cassettes WHERE casNr = ?",
            [casNr]
        );
        if (!rows.length) {
            logger.warn(`HW_TESTRUN_3: cassette ${casNr} not found in DB, skipping`);
            continue;
        }

        const { casRow, casColumn } = rows[0];
        const userOrder = { cassettesX: [], cassettesY: [], cassettesZ: [], cassettesId: [], terminalId: 1 };
        HW_ROBOT_CALC_POSXY_FROM_CASNR(GLOBALS, userOrder, casNr, casRow, casColumn, 0);

        script += `\n  # Cassette ${casNr}`;
        script += HW_ROBOT_PICK_CAR(
            GLOBALS,
            userOrder.cassettesX[0],
            userOrder.cassettesY[0],
            userOrder.cassettesZ[0],
            casNr,
            userOrder.terminalId,
            false // pick-only + move to mid
        );
    }

    script += "\nend\nRUN_THROUGH_3()\n";

    writeToRobotSocket(GLOBALS, script);
    logger.info("HW_TESTRUN_3: script sent");
}

/////////////////////////////////////////////////////////////////////////////////////////

module.exports = {
    HW_ROBOT_INIT,
    HW_ROBOT_HTTP,
    HW_ROBOT_HTTPCALLS,
    //HW_ROBOT_GETCARS: HW_ROBOT_PROCESS_ORDER,
    HW_ROBOT_PROCESS_ORDER,
    HW_ROBOT_CALC_POSXY_FROM_CASNR,
    HW_ROBOT_CALIBRATION_GOTO_CASSETTE,
    HW_ROBOT_CALIBRATION_MOVE_LINEAR,
    HW_ROBOT_CALIBRATION_TRAVEL_SAFE,
    HW_ROBOT_LOG_STATUS,
    robotStatus,
    __TEST__: {
        handleRobotModeData,
        updateRobotStateDisplay,
        setRobotSocket: __setRobotSocketForTest,
        scheduleRobotReconnect,
        reloadRobotScripts,
        HW_ROBOT_CALIBRATION_DROP1_SAVE,
        HW_ROBOT_CALIBRATION_DROP2_SAVE,
        overrideReloadRobotScripts(mockFn) {
            if (typeof mockFn === 'function') {
                reloadRobotScripts = mockFn;
            }
        }
    }
};
