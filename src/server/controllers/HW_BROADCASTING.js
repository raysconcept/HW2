// const mysql = require('mysql');
const mysql = require('mysql2');

const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('BROA');

logger.info("LOADED HW_BROADCASTING");

//////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////// VARS

//////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////// SERVER METHODS

/**
 * @function S_initializeBroadcast
 * @description Initializes the broadcast system
 * @param {Object} config - The configuration object
 */
function HW_BROADCAST_INIT(GLOBALS, config) {
    logger.info("HW_BROADCAST_INIT start repeaters");
    setInterval(() => HW_BROADCAST_L_REPEAT(GLOBALS), config.vendingConfig.timeUpdateCueLine);
}

/////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////// LOGIC METHODS

/**
 * @function HW_BROADCAST_L_REPEAT
 * @description Broadcasts both order cue and leaderboard updates
 */
async function HW_BROADCAST_L_REPEAT(GLOBALS) {
    await HW_BROADCAST_L_CUELINE(GLOBALS);
    await HW_BROADCAST_L_LEADERBOARD(GLOBALS);
    await HW_BROADCAST_SYSTEMMODE(GLOBALS);
    await HW_BROADCAST_PICKING(GLOBALS);
}

async function HW_BROADCAST_SYSTEMMODE(GLOBALS) {
    logger.info("sending system mode" + GLOBALS.SYSTEMMODE);
    //GLOBALS.SIO.emit('"' + GLOBALS.SYSTEMMODE + '"');

    if (GLOBALS.SYSTEMMODE == "SYSTEM_RETAILMODE") { GLOBALS.SIO.emit("SYSTEM_RETAILMODE"); }
    if (GLOBALS.SYSTEMMODE == "SYSTEM_DEVMODE") { GLOBALS.SIO.emit("SYSTEM_DEVMODE"); }
    if (GLOBALS.ROBOT_HALTED == true) { GLOBALS.SIO.emit("ROBOT_HALTED"); }
    if (GLOBALS.ROBOT_HALTED == false) { GLOBALS.SIO.emit("ROBOT_UNHALTED"); }


    logger.info(GLOBALS.SYSTEMMODE);
    GLOBALS.SIO.emit(GLOBALS.SYSTEMMODE);
}

/**
 * @function HW_BROADCAST_L_CUELINE
 * @description Broadcasts the current order queue to connected clients
 * @param {Object} GLOBALS - The application context containing the socket connection
 */
async function HW_BROADCAST_L_CUELINE(GLOBALS) {
    try {
        let resultsCue = [];
        try {
            resultsCue = await GLOBALS.DB_QS.Query(
                `SELECT * FROM hwv00_orders WHERE orderStatus = 'inCue' ORDER BY orderTimeQrScanned ASC `
            );
        } catch (err) {
            if (err.code === 'ER_BAD_FIELD_ERROR') {
                logger.warn("Column 'orderTimeQrScanned' missing; fallback ordering by orderQr");
                resultsCue = await GLOBALS.DB_QS.Query(
                    `SELECT * FROM hwv00_orders WHERE orderStatus = 'inCue' ORDER BY orderQr ASC `
                );
            } else {
                throw err;
            }
        }

        let MSG = "";
        // ORDERCUE
        MSG += "<table width=100%>";
        MSG += "<tr class=cueline_header><td colspan=4 class=cueline_cell>NEXT UP!</td></tr>";
        MSG += "<tr class=cueline_header>";
        MSG += "<td class=cueline_cell >status</td>";
        MSG += "<td class=cueline_cell >driver</td>";
        MSG += "<td class=cueline_cell >cars</td>";
        MSG += "</tr>";

        let indexRank = 0;
        let rank = "cueline_row_less";
        let waiting = "preparing";

        resultsCue.forEach(row => {
            if (indexRank == 0) {
                rank = "cueline_row_first";
                waiting = "up next!"
            } else {
                rank = "cueline_row_less";
                waiting = "preparing";
            }

            MSG += "<tr class=" + rank + ">";
            MSG += "<td class=cueline_cell>" + waiting + "</td>";
            MSG += "<td class=cueline_cell>" + row.orderUserName + "</td>";
            MSG += "<td class=cueline_cell>" + row.orderCars + "</td>";
            MSG += "</tr>";
            indexRank++;
        });
        MSG += "</table>";

        // BROADCAST ORDERCUE
        const FROM = "S1HWCOM";
        const ACTION = "SIO_LIST_CUELINE";
        GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);
    } catch (err) {
        logger.error("Error executing cue line query:", err);
    }
}


/**
 * @function HW_BROADCAST_PICKING
 * @description Broadcasts the SINGLE nextup order queue to connected clients
 * @param {Object} GLOBALS - The application context containing the socket connection
 */
async function HW_BROADCAST_PICKING(GLOBALS) {
    try {
        let resultsCue = [];
        try {
            resultsCue = await GLOBALS.DB_QS.Query(
                `SELECT * FROM hwv00_orders WHERE orderStatus = 'picking' ORDER BY orderTimeQrScanned ASC `
            );
        } catch (err) {
            if (err.code === 'ER_BAD_FIELD_ERROR') {
                logger.warn("Column 'orderTimeQrScanned' missing; fallback ordering by orderQr");
                resultsCue = await GLOBALS.DB_QS.Query(
                    `SELECT * FROM hwv00_orders WHERE orderStatus = 'picking' ORDER BY orderQr ASC `
                );
            } else {
                throw err;
            }
        }

        let MSG = "";
        // ORDERCUE
        MSG += "<table width=100%>";
        // MSG += "<tr class=cueline_header><td colspan=4 class=cueline_cell>NEXT</td></tr>";
        //  MSG += "<tr class=cueline_header>";
        // MSG += "<td class=cueline_cell >status</td>";
        // MSG += "<td class=cueline_cell >driver</td>";
        // MSG += "<td class=cueline_cell >cars</td>";
        // MSG += "</tr>";

        let indexRank = 0;
        let rank = "cueline_row_less";
        let waiting = "preparing";

        resultsCue.forEach(row => {
            if (indexRank == 0) {
                rank = "cueline_row_first";
                waiting = "next up:";
                MSG += "<tr class=" + rank + ">";
                MSG += "<td class=cueline_cell>" + waiting + row.orderUserName + ", track:"+row.terminal_id+ "</td>";
                //MSG += "<td class=cueline_cell>" + row.terminal_id + "</td>";
                //  MSG += "<td class=cueline_cell>" + row.orderCars +"@"+ row.terminal_id+ "</td>";
                MSG += "</tr>";
            } else {
                rank = "cueline_row_less";
                waiting = "";
               // MSG += "<tr class=" + rank + ">";
               // MSG += "<td class=cueline_cell>" + waiting + row.orderUserName + "</td>";
               // MSG += "<td class=cueline_cell>" + row.terminal_id + "</td>";
            }


            //  MSG += "<td class=cueline_cell>" + row.orderCars +"@"+ row.terminal_id+ "</td>";
            MSG += "</tr>";
            indexRank++;
        });
        MSG += "</table>";

        // BROADCAST ORDERCUE
        const FROM = "S1HWCOM";
        const ACTION = "SIO_CUELINE_PICKING";
        GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);
    } catch (err) {
        logger.error("Error executing cue line query:", err);
    }
}
/**
 * @function HW_BROADCAST_L_LEADERBOARD
 * @description Broadcasts the current leaderboard to connected clients
 */
async function HW_BROADCAST_L_LEADERBOARD(GLOBALS) {
    let MSG = "";
    let laptimes = [];
    let qrArray = [];

    try {
        // First check if there are any raced orders
        const racedOrders = await GLOBALS.DB_QS.Query(
            `SELECT * FROM hwv00_orders WHERE orderStatus = 'raced' `
        );

        if (racedOrders.length === 0) {
            // logger.warn("NO RACES available yet");
            return; // Exit early if no races
        }

        // Get fastest times for each lane
        let timeColumnsAvailable = true;
        for (let i = 1; i <= 5; i++) {
            if (!timeColumnsAvailable) break;
            try {
                const results = await GLOBALS.DB_QS.Query(
                    `SELECT * FROM hwv00_orders WHERE orderStatus = 'raced' ORDER BY time_${i} ASC LIMIT 1`
                );
                if (results.length > 0) {
                    const fastestTime = results[0][`time_${i}`];
                    laptimes.push(fastestTime);
                    qrArray.push(results[0]['orderQr']);
                }
            } catch (err) {
                if (err.code === 'ER_BAD_FIELD_ERROR') {
                    logger.warn(`Column time_${i} missing; skipping leaderboard timing logic`);
                    timeColumnsAvailable = false;
                } else {
                    logger.error(`Error executing query for time_${i}:`, err);
                }
            }
        }

        if (!timeColumnsAvailable) {
            logger.warn("Leaderboard timing columns unavailable; broadcasting empty leaderboard");
            return;
        }

        // Combine laptimes with QR codes and sort
        let combinedArray = laptimes.map((laptime, index) => ({ laptime, qr: qrArray[index] }));
        combinedArray.sort((a, b) => a.laptime - b.laptime);

        // Get all orders to match with fastest times
        const orders = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_orders');
        let LEADERS = [];

        // Process top 3 positions
        for (let position = 0; position < 3; position++) {
            if (!combinedArray[position]) continue;

            const order = orders.find(o => o.orderQr === combinedArray[position].qr);
            if (!order) continue;

            // Find fastest time for this order
            let fastestTime = Math.min(
                order.time_1,
                order.time_2,
                order.time_3,
                order.time_4,
                order.time_5
            );

            // Create HTML row
            LEADERS[position] = "<tr class=cueline_row_first>";
            LEADERS[position] += "<td class=cueline_cell>" + combinedArray[position].laptime + "</td>";
            LEADERS[position] += "<td class=cueline_cell>" + order.orderUserName + "</td>";
            LEADERS[position] += "<td class=cueline_cell>" + order.orderCars + "</td>";
            LEADERS[position] += "</tr>";
        }

        // Construct final leaderboard HTML
        MSG = "<table width=100%>";
        MSG += "<tr class=cueline_header><td colspan=4 class=cueline_cell>LEADERBOARD</td></tr>";
        MSG += "<tr class=cueline_header>";
        MSG += "<td class=cueline_cell >laptime</td>";
        MSG += "<td class=cueline_cell >driver</td>";
        MSG += "<td class=cueline_cell >car</td>";
        MSG += "</tr>";

        // Add top 3 positions
        if (LEADERS[0]) MSG += LEADERS[0];
        if (LEADERS[1]) MSG += LEADERS[1];
        if (LEADERS[2]) MSG += LEADERS[2];
        MSG += "</table>";

        // Broadcast leaderboard
        const FROM = "S1HWCOM";
        const ACTION = "SIO_LIST_LEADERBOARD";
        GLOBALS.SIO.emit("MFS", FROM + "___" + ACTION + "___" + MSG);

    } catch (err) {
        logger.error("Error in processing leaderboard:", err);
    }
}

/**
* @exports {Object} HW_BROADCASTING
* @description Exports the main broadcasting functions
*/
module.exports = {
    HW_BROADCAST_INIT,
    HW_BROADCAST_L_CUELINE,
    HW_BROADCAST_L_REPEAT,
    HW_BROADCAST_L_LEADERBOARD,
    HW_BROADCAST_SYSTEMMODE
}
