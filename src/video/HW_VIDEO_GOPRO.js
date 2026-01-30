// enable custom logging
const { createModuleLogger } = require('../server/config/logger');
const logger = createModuleLogger('GoPro');

const axios = require('axios');
// HTTP Requests: Node.js does not have a built-in function like Python's requests.get(). 
// axios is a popular library for making HTTP requests in Node.js.
// The axios calls are asynchronous, so they are used with async/await syntax.

const { execSync } = require('child_process');
// Node.js uses the child_process module for running external commands.

const fs = require('fs');
// fs module (used with path for handling file paths) handles file system operations. 
// The fs module can operate in both synchronous and asynchronous modes.
const path = require('path');

const timeoutGoPro = 5000; // 5 seconds, axios timeout is in milliseconds
const timeTotalRecording = 5000; // 5 seconds
const timeoutForRequest = 1000;
const timeDelay = 1000;

// SET ZOOM (has no effect)
const GOPRO_ZOOM = new Array(9).fill(1);
GOPRO_ZOOM[0] = 0; // not used (start numbering at 1)
GOPRO_ZOOM[1] = 1
GOPRO_ZOOM[2] = 1
GOPRO_ZOOM[3] = 1
GOPRO_ZOOM[4] = 1
GOPRO_ZOOM[5] = 1
GOPRO_ZOOM[6] = 1
GOPRO_ZOOM[7] = 1
GOPRO_ZOOM[8] = 1

// SET FRAMERATE
const GOPRO_FPS = new Array(9).fill(2);
// PAL = 25
// NTSC = 30
let f = 2
// 0 = 240fps / 1=120fps / 2= 100fps / 5=60fps / 6=50fps  / 8=30fps / 9=25fps / 10=24fps / 13=200fps
GOPRO_FPS[0] = f // not used (start numbering at 1)
GOPRO_FPS[1] = f
GOPRO_FPS[2] = f
GOPRO_FPS[3] = f
GOPRO_FPS[4] = f
GOPRO_FPS[5] = f
GOPRO_FPS[6] = f
GOPRO_FPS[7] = f
GOPRO_FPS[8] = f

// SET IP
const GOPRO_BASE_URL_LIST = [
    "http://172.29.103.51:8080", // 1
    "http://172.26.167.51:8080", // 2 
    "http://172.23.181.51:8080", // 3 
    "http://172.20.106.51:8080", // 4 
    "http://172.28.172.51:8080", // 5
    "http://172.22.116.51:8080", // 6 
    "http://172.25.121.51:8080", // 7
    "http://172.21.188.51:8080"  // 8 
];

const GOPRO_JSON = [
    { ip: "http://172.21.188.51:8080", zoom: 50 }
];

let GOPRO_DOWNLOADED_PATH = new Array(GOPRO_BASE_URL_LIST.length).fill("");
let succesCams = [];
let failedCams = [];


 logger.info("rays_gopro_node.js running");


async function main() {
    await cams_record();
    // Any additional logic you want to run after cams_record
     logger.info('All tasks completed.');
}

// main().catch(logger.error); // REPLACED WITH BELLOW
main().catch(err => logger.error(err));


async function checkCameraConnection(GOPRO_BASE_URL) {
    try {
        // Attempt to fetch the camera state as a "ping"
        const getStateUrl = `${GOPRO_BASE_URL}/gopro/camera/state`;
        await axios.get(getStateUrl, { timeout: timeoutForRequest });
        return true; // Connection successful
    } catch (error) {
        logger.error(`Cannot connect to ${GOPRO_BASE_URL}:`, error.message);
        return false; // Connection failed
    }
}

async function cams_setPresets() {
     logger.info("=> cams_setPresets");
    try {
        await Promise.all(GOPRO_BASE_URL_LIST.map(async (GOPRO_BASE_URL, index) => {
            try {

                 logger.info(`${GOPRO_BASE_URL} running presets`);

                const set_usbControl0 = `${GOPRO_BASE_URL}/gopro/camera/control/wired_usb?p=0`;
                await axios.get(set_usbControl0, { timeout: timeoutForRequest });

                const set_usbControl1 = `${GOPRO_BASE_URL}/gopro/camera/control/wired_usb?p=1`;
                await axios.get(set_usbControl1, { timeout: timeoutForRequest });
                 logger.info(`Successfully set usbControle for ${GOPRO_BASE_URL}`);

                const set_keepAlive = `${GOPRO_BASE_URL}/gopro/camera/keep_alive`;
                await axios.get(set_keepAlive, { timeout: timeoutForRequest });
                 logger.info(`Successfully set set_keepAlive for ${GOPRO_BASE_URL}`);

                fps = GOPRO_FPS[index + 1]
                set_fps = `${GOPRO_BASE_URL}/gopro/camera/setting?setting=3&option=` + fps;
                await axios.get(set_fps, { timeout: timeoutForRequest });
                 logger.info(`Successfully set set_fps for ${GOPRO_BASE_URL}`);

                //await new Promise(resolve => setTimeout(resolve, timeDelay));


            } catch (error) {
                // Log the error for this camera but do not throw, so other requests can continue
                 logger.error(`Error setting presets for ${GOPRO_BASE_URL}:`, error.response ? error.response.data : error.message);
            }
        }));

        // Optional: Delay after setting all presets
        //await new Promise(resolve => setTimeout(resolve, timeDelay));
    } catch (error) {
         logger.error("An unexpected error occurred:", error.message);
    }
}

async function cams_recordStop() {
     logger.info("=> cams_recordStartStop");
    try {

        // Stop recording on all cameras
        await Promise.all(GOPRO_BASE_URL_LIST.map(async (GOPRO_BASE_URL) => {

            const isConnected = await checkCameraConnection(GOPRO_BASE_URL);
            if (isConnected) {
            const recUrlStop = GOPRO_BASE_URL + "/gopro/camera/shutter/stop";
             logger.info("=>" + recUrlStop);
            //const responseStop = await axios.get(recUrlStop, { timeout: timeoutForRequest });
            const responseStop = await axios.get(recUrlStop);
             logger.info(`Stop recording on ${GOPRO_BASE_URL}:` + responseStop.data);
            }
        }));
    } catch (error) {
        logger.error("Error with stop recording:", error.message);
    }
}
async function cams_recordStart() {
     logger.info("=> cams_recordStartStop");
    try {
        // Start recording on all cameras
        await Promise.all(GOPRO_BASE_URL_LIST.map(async (GOPRO_BASE_URL) => {

            const isConnected = await checkCameraConnection(GOPRO_BASE_URL);
            if (isConnected) {
                const recUrlStart = GOPRO_BASE_URL + "/gopro/camera/shutter/start";
                 logger.info("=>" + recUrlStart);
                const responseStart = await axios.get(recUrlStart, { timeout: timeoutForRequest });
                 logger.info(`Start recording on ` + responseStart.data);
            }
        }));


    } catch (error) {
         logger.error("Error with start recording:", error.message);
    }
}

async function cams_record() {
     logger.info("=> cams_record");
    try {
        //await cams_resetUSB(); // reset USB connection via devcon
        //await cams_connectionTest();
        await cams_setPresets();
        await cams_recordStart(); // ok
        await new Promise(resolve => setTimeout(resolve, timeTotalRecording));
        await cams_recordStop(); // ok
        await cams_downloadFiles(); // ok?

        await cams_deleteFilesFromCams();
        //await cams_videoCompilationStart();
    } catch (error) {
         logger.error("Error with cams_record:", error.message);
    }
};

async function cams_connectionTest() {
     logger.info("=> cams_connectionTest");
    try {
        await Promise.all(GOPRO_BASE_URL_LIST.map(async (GOPRO_BASE_URL) => {
            // get state of camera           
            const getState = `${GOPRO_BASE_URL}/gopro/camera/state`;
            const responseGetState = await axios.get(getState, { timeout: timeoutForRequest });
             logger.info(GOPRO_BASE_URL + " / responseGetState:" + responseGetState);
        }));
    } catch (error) {
        logger.error("Error with cams_connectionTest:", error.message);
    }
};

async function cams_resetUSB() {
     logger.info("=> cams_resetUSB");
     logger.info("||| resetUSB_gopro");
     logger.info("[devcon] rays_goPro => resetUSB_gopro");
    // Define the hardware IDs of the USB hubs
    const hubIds = [
        //"@USB\\VIA_ROOT_HUB\\5&C5712EE&0",
        //"@USB\\VIA_ROOT_HUB\\5&2400E44E&0",
        //instance ID's, verkregen via USBDevie
        "USB\\VID_2672&PID_0056&MI_02\\8&1147f819&0&0002",
        "USB\\VID_2672&PID_0056&MI_02\\8&1182f362&0&0002",
        "USB\\VID_2672&PID_0056&MI_02\\8&16ef8df9&0&0002",
        "USB\\VID_2672&PID_0056&MI_02\\8&23f42150&0&0002",
        "USB\\VID_2672&PID_0056&MI_02\\8&244502cc&0&0002",
        "USB\\VID_2672&PID_0056&MI_02\\8&2dd076a0&0&0002",
        "USB\\VID_2672&PID_0056&MI_02\\8&3a497e68&0&0002",
        "USB\\VID_2672&PID_0056&MI_02\\8&c23fc64&0&0002"
    ]

    // Disable and then enable the USB hubs using execSync to run devcon commands
    try {
        hubIds.forEach(hubId => {
            execSync(`devcon disable ${hubId}`);
            execSync(`devcon enable ${hubId}`);
        });
         logger.info("[devcon] rays_goPro => USB hubs (should) have been reset.");
    } catch (error) {
        logger.error("[devcon] Error resetting USB hubs:", error);
    }
}

async function cams_deleteFilesFromCams() {
     logger.info("=> cams_downloadFiles");

    for (let camIndex = 0; camIndex < GOPRO_BASE_URL_LIST.length; camIndex++) {
        const GOPRO_BASE_URL = GOPRO_BASE_URL_LIST[camIndex];
        try {
            deleteAllFiles = GOPRO_BASE_URL + "/gp/gpControl/command/storage/delete/all"
            const deleteAllFilesResponse = await axios.get(deleteAllFiles, { timeout: timeoutGoPro });
        } catch (error) {
             logger.error(`Error cams_deleteFiles with CAM ${camIndex + 1}:`, error.message);
        }
    }
}


// Example of downloading files from cameras
async function cams_downloadFiles() {
     logger.info("=> cams_downloadFiles");

    for (let camIndex = 0; camIndex < GOPRO_BASE_URL_LIST.length; camIndex++) {
        const GOPRO_BASE_URL = GOPRO_BASE_URL_LIST[camIndex];
        try {
            // Example of a request to get media list and download files
            const mediaListUrl = `${GOPRO_BASE_URL}/gopro/media/list`;
            const mediaListResponse = await axios.get(mediaListUrl, { timeout: timeoutForRequest });
            const filesMp4 = mediaListResponse.data.media[0].fs.map(file => file.n);
             logger.info(`CAM ${camIndex + 1} media files:`, filesMp4);

            // Example of downloading the first file for simplicity
            if (filesMp4.length > 0) {
                const firstFile = filesMp4[0];
                const downloadFileUrl = `${GOPRO_BASE_URL}/videos/DCIM/100GOPRO/${firstFile}`;
                const fileResponse = await axios.get(downloadFileUrl, { responseType: 'arraybuffer' });
                const relativeOutPath = `raceVideo/CAM${camIndex + 1}.MP4`;
                const directory = path.dirname(relativeOutPath);
                if (!fs.existsSync(directory)) {
                    fs.mkdirSync(directory, { recursive: true });
                }
                fs.writeFileSync(relativeOutPath, fileResponse.data);
                 logger.info(`Downloaded ${firstFile} to ${relativeOutPath}`);
            }
        } catch (error) {
            logger.error(`Error cams_downloadFiles with CAM ${camIndex + 1}:`, error.message);
        }
    }
}

// This is a simplified example. For full functionality, you would need to implement
// the rest of the functionalities like set_camSettings, startRecord, and others,
// following a similar approach.

// Note: Node.js does not have a built-in equivalent to Python's `requests` library.
// `axios` is used here for HTTP requests. Similarly, `child_process` is used for running
// commands, and `fs` (with `path`) for file system operations.
