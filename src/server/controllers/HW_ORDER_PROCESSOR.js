/**
 * @module HW_ORDER_PROCESSOR
 * @description Handles the processing of Hot Wheels orders through the robot system.
 * This module manages the order lifecycle from queue to completion, including:
 * - Processing new orders from the queue
 * - Managing order status transitions (inCue -> picking -> picked)
 * - Coordinating with the robot system for order fulfillment
 * - Handling order state inconsistencies and recovery
 */

const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('PICK');
const config = require('../config/configMain');

logger.debug("LOADED HW_ORDERPROCESSING / PICKING");

//////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////// VARS

/**
 * @type {string|null} currentOrderId
 * @description Tracks the QR code of the order currently being processed.
 * If there is an order in 'picking' status, this will be the orderQr.
 * Null when no order is being processed.
 */
let currentOrderId = null;

/**
 * @type {boolean} showMessage
 * @description Flag to control message display frequency.
 * Used to prevent log spam for repeated conditions.
 */
let showMessage = true;
let missingOrderTimeColumnLogged = false;

//////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////// SERVER METHODS

async function ORDER_PROCESSOR_INIT(GLOBALS, config) {
  try {
    // only at system start do this    
    logger.debug("ORDER_PROCESSOR_INIT Resetting interrupted orders...");
    await ORDER_PROCESSOR_L_PICKING_TO_INTERRUPTED(GLOBALS);


    // Only start the interval after the reset is done
    logger.debug("ORDER_PROCESSOR_INIT Starting order processor interval...");
    setInterval(() => ORDER_PROCESSOR_L_REPEAT(GLOBALS), config.vendingConfig.timeUpdateOrderProcessor);

  } catch (error) {
    logger.error("ORDER_PROCESSOR_INIT Failed:", error);
    // Consider re-throwing or handling the error appropriately
    throw error;
  }


}

async function ORDER_PROCESSOR_HTTP(GLOBALS) {
  logger.debug("ORDER_PROCESSOR_HTTP");

  GLOBALS.Express.post("/INTERUPTED_ONE_TO_INCUE", function (req, res) {
    const orderQr = req.body.orderQr;
    if (!orderQr) {
      logger.error("No orderQr provided in request body");
      return res.status(400).json({ error: "orderQr is required" });
    }

    try {
      ORDER_PROCESSOR_L_INTERUPTED_ONE_TO_INCUE(GLOBALS, orderQr);
      res.status(200).json({ message: "Order successfully moved to inCue" });
    } catch (error) {
      logger.error("Error processing order:", error);
      res.status(500).json({ error: "Failed to process order" });
    }
  });
}

/**
 * Sets up SocketIO event handlers for order processing
 * @param {Object} GLOBALS - The application context object
 */
function ORDER_PROCESSOR_SIO(GLOBALS) {
  GLOBALS.SIO.sockets.on('connection', function (S2) {
    S2.on("MFO", function (e) {

      let terminal = e.split("___")[0];
      let action = e.split("___")[1];
      let message = e.split("___")[2];
      let macAddress = e.split("___")[3];

      logger.debug(`Order Processor SIO MFO action: ${action}`);
      handleMFOAction(S2, GLOBALS, action, message);
    });
  });
}

/**
 * Handles different MFO actions for order processing
 * @param {Object} socket - The SocketIO socket object
 * @param {Object} GLOBALS - The application context object
 * @param {string} action - The action to perform
 * @param {string} message - The message data
 */
async function handleMFOAction(socket, GLOBALS, action, message) {
  switch (action) {
    case "OPERATOR_GETORDERS_INTERRUPTED":
      logger.info("OPERATOR_GETORDERS_INTERRUPTED");
      try {
        const RES_ORDERS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_orders WHERE orderStatus = "interrupted"');
        logger.debug(`SIO/ OPERATOR_GETORDERS_INTERRUPTED  _ sending order list all (${RES_ORDERS.length}) orders`);
        socket.emit("MFS_JSON", {
          terminal: "",
          action: "SIO_LIST_ORDERS_INTERRUPTED",
          message: RES_ORDERS
        });
      } catch (err) {
        logger.error("Failed to fetch interrupted orders:", err);
        socket.emit("MFS_JSON", {
          terminal: "",
          action: "SIO_ERROR",
          message: "Failed to fetch interrupted orders"
        });
      }
      break;

    case "OPERATOR_GETORDERS_ALL":
      logger.info("OPERATOR_GETORDERS_ALL");
      try {
        const RES_ORDERS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_orders');
        logger.debug(`SIO/ HW_ORDERS  _ sending order list all (${RES_ORDERS.length}) orders`);
        socket.emit("MFS_JSON", {
          terminal: "",
          action: "SIO_LIST_ORDERS",
          message: RES_ORDERS
        });
      } catch (err) {
        logger.error('SIO / HW_OPERATOR_GETORDERS_ALL Error showing orders: ' + err.stack);
      }
      break;

    case "OPERATOR_GETORDERS_INCUE":
      logger.info("OPERATOR_GETORDERS_INCUE");
      try {
        const RES_ORDERS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_orders WHERE orderStatus = "inCue"');
        logger.debug(`SIO/ OPERATOR_GETORDERS_INCUE  _ sending order list all (${RES_ORDERS.length}) orders`);
        socket.emit("MFS_JSON", {
          terminal: "",
          action: "SIO_LIST_ORDERS",
          message: RES_ORDERS
        });
      } catch (err) {
        logger.error('SIO / OPERATOR_GETORDERS_INCUE Error showing orders: ' + err.stack);
      }
      break;

    case "OPERATOR_GETORDERS_PICKED":
      logger.info("OPERATOR_GETORDERS_PICKED");
      try {
        const RES_ORDERS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_orders WHERE orderStatus = "picked" ORDER BY orderTimeCarsPicked DESC');
        logger.debug(`SIO/ OPERATOR_GETORDERS_PICKED  _ sending order list all (${RES_ORDERS.length}) orders`);
        socket.emit("MFS_JSON", {
          terminal: "",
          action: "SIO_LIST_ORDERS",
          message: RES_ORDERS
        });
      } catch (err) {
        logger.error('SIO / OPERATOR_GETORDERS_PICKED Error showing orders: ' + err.stack);
      }
      break;

    case "OPERATOR_GETORDERS_POPULAR":
      logger.info("OPERATOR_GETORDERS_POPULAR");
      try {
        const RES_CARS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_cars');
        const carPopularList = [];
        let index = 0;
        async function processNextCar() {
          if (index >= RES_CARS.length) {
            carPopularList.sort((a, b) => b.carAmount - a.carAmount);
            socket.emit("MFS_JSON", {
              terminal: "",
              action: "SIO_LIST_POPULAR_CARS",
              message: carPopularList
            });
            return;
          }

          const car = RES_CARS[index];
          carPopularList[index] = {
            carAssets: car.carAssets,
            carAmount: 0,
            carAmountLastDay: 0,
            carAmountLastWeek: 0,
            carAmountMonth1: 0,
            carAmountMonth2: 0,
            carAmountMonth3: 0
          };

          try {
            const RES_ORDERS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_orders WHERE orderStatus = "picked"');
            RES_ORDERS.forEach(order => {
              if (order.orderCars) {
                const orderDate = new Date(order.orderTimeQrScanned);
                const now = new Date();
                const diffTime = now.getTime() - orderDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const carsInOrder = order.orderCars
                  ? order.orderCars.match(/[^[\]]+(?=])/g)?.[0].split(',') || []
                  : [];
                logger.info(order.orderCars + "=" + carsInOrder.length);
                carsInOrder.forEach(carAs => {
                  if (carAs == car.carAssets) {
                    carPopularList[index].carAmount += 1;
                    if (diffDays < 2) { carPopularList[index].carAmountLastDay += 1; }
                    if (diffDays < 7) { carPopularList[index].carAmountLastWeek += 1; }
                    if (diffDays > 1 && diffDays < 30) { carPopularList[index].carAmountMonth1 += 1; }
                    if (diffDays > 30 && diffDays < 60) { carPopularList[index].carAmountMonth2 += 1; }
                    if (diffDays > 60 && diffDays < 90) { carPopularList[index].carAmountMonth3 += 1; }
                    logger.info("FOUND " + carAs + " => carPopularList[index].carAmount " + carPopularList[index].carAmount);
                  }
                })
              }
            });
          } catch (err) {
            logger.error(`Error processing car ${car.carAssets}: ${err.stack}`);
          }
          index++;
          processNextCar();
        }
        processNextCar();
      } catch (err) {
        logger.error('OPERATOR_GETORDERS_POPULAR Error fetching cars: ' + err.stack);
      }
      break;
  }
}

/////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////// LOGIC METHODS


/**
 * Resets interupted orders from 'picking' to 'interupted'
 * an operator can then investigate and release these orders to inCue again
 * @param {Object} GLOBALS - The application context object containing database connection
 * @returns {Promise<void>} - A promise that resolves when the operation is complete
 * @throws {Error} - If the database query fails
 */
async function ORDER_PROCESSOR_L_PICKING_TO_INTERRUPTED(GLOBALS) {
  if (!GLOBALS?.DB_QS?.Query) {
    throw new Error('Invalid database connection object');
  }
  try {
    const res = await GLOBALS.DB_QS.Query(`SELECT * FROM hwv00_orders WHERE orderStatus = 'picking'`);
    if (res.length > 0) {
      logger.warn("setting (" + res.length + ") orders to interupted");
      const updateQuery = `UPDATE hwv00_orders SET orderStatus = 'interrupted' WHERE orderStatus = 'picking'`;
      await GLOBALS.DB_QS.Query(updateQuery);
    }
  } catch (err) {
    logger.error('ORDER_PROCESSOR_L_PICKING_TO_INTERRUPTED Error: ' + err.stack);
    throw err;
  }
}


/**
 * Resets interrupted orders from 'picking' to 'interrupted'
 * an operator can then investigate and release these orders to inCue again
 * @param {Object} GLOBALS - The application context object containing database connection
 * @returns {Promise<void>} - A promise that resolves when the operation is complete
 * @throws {Error} - If the database query fails
 */
async function ORDER_PROCESSOR_L_INTERUPTED_ONE_TO_INCUE(GLOBALS, orderQr) {
  logger.info("setting orderStatus of one QR to inCue because it was interupted");
  const updateQuery = `UPDATE hwv00_orders SET orderStatus = 'inCue' WHERE orderQr = ?`;
  try {
    await GLOBALS.DB_QS.Query(updateQuery, [orderQr]);
  } catch (err) {
    logger.error('ORDER_PROCESSOR_L_INTERUPTED_ONE_TO_INCUE Error: ' + err.stack);
    throw err;
  }
}

/**
 * Resets ALL interrupted orders from 'interrupted' to 'inCue'
 * an operator can then investigate and release these orders to inCue again
 * @param {Object} GLOBALS - The application context object containing database connection
 * @returns {Promise<void>} - A promise that resolves when the operation is complete
 * @throws {Error} - If the database query fails
 */
async function ORDER_PROCESSOR_L_INTERUPTED_ALL_TO_INCUE(GLOBALS) {
  logger.info("setting orderStatus of ALL QR that have status interupted to inCue");
  const updateQuery = `UPDATE hwv00_orders SET orderStatus = 'inCue' WHERE orderStatus = 'interrupted'`;
  try {
    await GLOBALS.DB_QS.Query(updateQuery);
  } catch (err) {
    logger.error('ORDER_PROCESSOR_L_INTERUPTED_ALL_TO_INCUE Error: ' + err.stack);
    throw err;
  }
}


/**
 * @function handleCompletedOrders
 * @description Handles the completion of orders when the robot becomes available.
 * If there is a current order in 'picking' status, it will be marked as 'picked'.
 * This function is called first in the order processing cycle.
 * 
 * @param {Object} GLOBALS - The application context object containing database and robot connections
 */
async function L_handleCompletedOrders(GLOBALS) {
  if (GLOBALS.ROBOT_MODULE.robotStatus.isAvailable && isOrderInProcess()) {
    try {
      const results = await GLOBALS.DB_QS.Query(
        `SELECT orderStatus FROM hwv00_orders WHERE orderQr = ?`,
        [currentOrderId]
      );
      if (results.length === 0) {
        logger.warn(`Order ${currentOrderId} not found in database`);
        currentOrderId = null;
        return;
      }
      const orderStatus = results[0].orderStatus;
      if (orderStatus !== 'picking') {
        logger.warn(`Order ${currentOrderId} has unexpected status: ${orderStatus}. Expected 'picking'`);
        currentOrderId = null;
        return;
      }
      await GLOBALS.DB_QS.Query(
        `UPDATE hwv00_orders SET orderStatus = 'picked' WHERE orderQr = ?`,
        [currentOrderId]
      );
      logger.debug(`Order ${currentOrderId} marked as picked`);
      currentOrderId = null;
    } catch (err) {
      logger.error("Error handling completed order:", err);
    }
  }
}

/**
 * @function handleNewOrder
 * @description Processes new orders from the queue when the robot is available.
 * This function:
 * 1. Verifies robot availability
 * 2. Cleans up any inconsistent order states
 * 3. Picks the next order from the queue
 * 4. Processes the order's cars and sends to robot
 * 
 * @param {Object} GLOBALS - The application context object containing database and robot connections
 */
async function ORDER_PROCESSOR_L_CUELINE_PICKNEXT(GLOBALS) {

  // conditions:
  // 0. robot is NOT halted
  // 1. robot is available
  // 2. robot is not busy (dont interrupt current picking of robot)
  // 3. there are no interrupted orders (status = interrupted)
  // 4. at system startup, any orders with status==picking must be set to status=interupted
  // Then process new order

  // 0. robot is not halted
  if (GLOBALS.ROBOT_HALTED == false) {
    logger.warn("PICKING CAN CONTINUE (checked GLOBALS.ROBOT_HALTED):" + GLOBALS.ROBOT_HALTED);
    if (config.robotConfig.overrideRobotAvailabilityForTesting) {
      logger.warn("overriding robot availabity for testing! => configRobot to turn this off.");
      GLOBALS.ROBOT_MODULE.robotStatus.isConnected = true;
      GLOBALS.ROBOT_MODULE.robotStatus.isAvailable = true;
    }
    // 1. robot is available
    // 2. robot is not busy (dont interrupt current picking of robot)
    if (!GLOBALS.ROBOT_MODULE.robotStatus.isConnected || !GLOBALS.ROBOT_MODULE.robotStatus.isAvailable) {
      if (showMessage) {
        logger.info("Robot is not connected or is busy, skipping new orders processing");
        showMessage = false;
      }
      return;
    }
    showMessage = true;
    if (isOrderInProcess()) {
      logger.info(`Order ${currentOrderId} is in process, but robot is available. Order was completed.`);
    }
    try {
       // 3. there are no interrupted orders (status = interrupted)
      const pickingResults = await GLOBALS.DB_QS.Query(
        `SELECT orderQr FROM hwv00_orders WHERE orderStatus = 'picking'`
      );
      if (pickingResults.length > 0) {
        // there are orders with status = picking (dont interrupt current picking of robot)
        // reset inconsistent orders (which are flagged as picking) to inCue
        const ordersToReset = isOrderInProcess() ?
          pickingResults.filter(order => order.orderQr !== currentOrderId) :
          pickingResults;
        if (ordersToReset.length > 0) {
          logger.warn(`Found ${ordersToReset.length} orders with inconsiste 'picking' status. ${currentOrderId ? ` Current order ${currentOrderId} is preserved.` : ''}`);
          logger.info(`Orders being reset: ${ordersToReset.map(order => order.orderQr).join(', ')}`);
          await GLOBALS.DB_QS.Query(
            `UPDATE hwv00_orders SET orderStatus = 'inCue' WHERE orderQr IN (?)`,
            [ordersToReset.map(order => order.orderQr)]
          );
        }
      }
      let results;
      try {
        results = await GLOBALS.DB_QS.Query(
          `SELECT * FROM hwv00_orders WHERE orderStatus = 'inCue' ORDER BY orderTimeQrScanned ASC LIMIT 1`
        );
      } catch (err) {
        if (err?.code === 'ER_BAD_FIELD_ERROR') {
          if (!missingOrderTimeColumnLogged) {
            logger.warn("Column 'orderTimeQrScanned' missing; falling back to orderQr ordering");
            missingOrderTimeColumnLogged = true;
          }
          results = await GLOBALS.DB_QS.Query(
            `SELECT * FROM hwv00_orders WHERE orderStatus = 'inCue' ORDER BY orderQr ASC LIMIT 1`
          );
        } else {
          throw err;
        }
      }
      if (results.length === 0) {
        return;
      }

      // proceed with order - set order to picking
      const order = results[0];
      logger.info("Processing order: " + order.orderQr);

      await GLOBALS.DB_QS.Query(
        `UPDATE hwv00_orders SET orderStatus = 'picking' WHERE orderQr = ?`,
        [order.orderQr]
      );
      logger.debug("Order " + order.orderQr + " marked as picking");

      currentOrderId = order.orderQr;
      const carAssets = (order.orderCars || '')
        .replace(/[[\]]/g, '')
        .replace(/['"]/g, '')
        .split(/[, _]+/)
        .map(car => car.trim())
        .filter(Boolean);
      logger.debug("Parsed car assets: " + JSON.stringify(carAssets));
      if (!order.terminal_id) {
        logger.warn(`Order ${order.orderQr} has no terminal_id specified, defaulting to '1'`);
      }
      let userOrder = {
        userCars: carAssets,
        cassettesX: [],
        cassettesY: [],
        cassettesZ: [],
        cassettesId: [],
        userName: order.orderUserName,
        userEmail: order.orderEmail,
        userQR: order.orderQr,
        terminalId: order.terminal_id || '1'
      };
      let carIndex = 0;
      let carsProcessed = 0;
      for (const carAsset of userOrder.userCars) {
        let minimumAmount = 1;
        const duplicates = countDuplicates(userOrder.userCars);
        for (const key in duplicates) {
          if (duplicates.hasOwnProperty(key) && carAsset === key) {
            minimumAmount = duplicates[key];
          }
        }
        logger.info("====== car ready to pick, carAsset=" + carAsset);
        try {
          const selectResult = await GLOBALS.DB_QS.Query(
            'SELECT carReserved FROM hwv00_cars WHERE carAssets = ?',
            [carAsset]
          );
          if (selectResult.length === 0) {
            logger.warn(`No car found with asset: ${carAsset}`);
            continue;
          }
          const currentReserved = selectResult[0].carReserved;
          if (currentReserved > 0) {
            const updateResult = await GLOBALS.DB_QS.Query(
              'UPDATE hwv00_cars SET carReserved = carReserved - 1 WHERE carAssets = ? AND carReserved > 0',
              [carAsset]
            );
            if (updateResult.affectedRows === 0) {
              logger.warn(`Decrement failed for car: ${carAsset}`);
              continue;
            }
            logger.info(`Successfully decremented reservation for car: ${carAsset}`);
          } else {
            logger.warn(`Attempted to decrement reservation below 0 for car: ${carAsset}`);
          }
        } catch (err) {
          logger.error('Error checking or decrementing reservation:', err.stack);
          continue;
        }
        try {
          const cassetteResults = await GLOBALS.DB_QS.Query(
            `SELECT * FROM hwv00_cassettes WHERE casCarAssets = ? AND casCarAmount >= ? AND casValid != 0 ORDER BY casCarAmount DESC LIMIT 1`,
            [carAsset, minimumAmount]
          );
          if (cassetteResults.length === 0) {
            logger.warn(`No cassette found for car ${carAsset}.`);
            continue;
          }
          const cassette = cassetteResults[0];
          logger.info(`cars ${cassette.casCarAmount} in cas:${cassette.casNr}`);
          const updateResult = await GLOBALS.DB_QS.Query(
            'UPDATE hwv00_cassettes SET casCarAmount = casCarAmount - 1 WHERE casNr = ?',
            [cassette.casNr]
          );
          if (updateResult.affectedRows === 0) {
            logger.warn(`Decrement  cars in cassette failed for car: ${cassette.casNr}`);
            continue;
          }
          logger.info(`Successfully decremented cars in Cassette: ${cassette.casNr}`);
          GLOBALS.ROBOT_MODULE.HW_ROBOT_CALC_POSXY_FROM_CASNR(GLOBALS, userOrder, cassette.casNr, cassette.casRow, cassette.casColumn, carIndex);
          carIndex++;
          carsProcessed++;
          if (carsProcessed === userOrder.userCars.length) {
            logger.debug("All cars are processed, sending to robot: " + userOrder.userCars);

            GLOBALS.ROBOT_MODULE.HW_ROBOT_PROCESS_ORDER(GLOBALS, userOrder);

          }
        } catch (err) {
          logger.error('Error finding cassette or decrementing cars in cassette:', err.stack);
          continue;
        }
      }
    } catch (err) {
      logger.error('Error in ORDER_PROCESSOR_L_CUELINE_PICKNEXT:', err?.stack || err);
    }
  } else {
    logger.warn("PICKING HALTED - because ROBOT_HALTED:" + GLOBALS.ROBOT_HALTED);
  }
}

/**
 * @function ProcessOrders
 * @description Main entry point for order processing.
 * Orchestrates the order processing cycle by:
 * 1. Handling any completed orders
 * 2. Processing new orders if possible
 * 
 * @param {Object} GLOBALS - The application context object containing database and robot connections
 */
async function ORDER_PROCESSOR_L_REPEAT(GLOBALS) {
  // logger.info("ProcessOrders run");

  // First handle any completed orders
  await L_handleCompletedOrders(GLOBALS);

  // conditions:
  // 1. robot is available
  // 2. robot is not busy (dont interrupt current picking of robot)
  // 3. there are no interrupted orders (status = interrupted)
  // 4. at system startup, any orders with status==picking must be set to status=interupted
  // Then process new orders
  await ORDER_PROCESSOR_L_CUELINE_PICKNEXT(GLOBALS);
}

//////////////////////////////////////////////////////////////
// HELPER FUNCTIONS
//////////////////////////////////////////////////////////////

/**
 * @function isOrderInProcess
 * @description Checks if there is currently an order being processed by the robot.
 * Verifies that currentOrderId exists and is not empty.
 * 
 * @returns {boolean} True if an order is in process, false otherwise
 */
const isOrderInProcess = () => {
  // Check if currentOrderId is not empty
  if (!currentOrderId || currentOrderId.trim() === '') {
    return false;
  }
  // if the current order ID is not empty, then order is in process
  return true;
};

/**
 * @function countDuplicates
 * @description Counts the number of duplicate items in an array.
 * Used to determine how many of each car are needed in an order.
 * 
 * @param {Array} arr - The array to count duplicates in
 * @returns {Object} An object with the count of duplicates for each item
*/
function countDuplicates(arr) {
  const countMap = {};
  const duplicates = {};
  arr.forEach(item => {
    if (countMap[item] === undefined) {
      countMap[item] = 1;
    } else {
      if (countMap[item] === 1) {
        duplicates[item] = 2;
      } else {
        duplicates[item]++;
      }
      countMap[item]++;
    }
  });
  return duplicates;
}

async function ORDER_PROCESSOR_L_LIST_INTERRUPTED(GLOBALS) {
  try {
    const RES_ORDERS = await GLOBALS.DB_QS.Query('SELECT * FROM hwv00_orders WHERE orderStatus = "interrupted"');
    logger.debug(`SIO/ OPERATOR_GETORDERS_INTERRUPTED  _ sending order list all (${RES_ORDERS.length}) orders`);
    return RES_ORDERS;
  } catch (err) {
    logger.error('SIO / OPERATOR_GETORDERS_INTERRUPTED Error showing orders: ' + err.stack);
    throw err;
  }
}

/**
 * @exports {Object} ProcessOrders
 * @description Exports the main order processing function
 */
module.exports = {
  ORDER_PROCESSOR_INIT,
  ORDER_PROCESSOR_SIO,
  ORDER_PROCESSOR_HTTP,
  __TEST__: {
    ORDER_PROCESSOR_L_CUELINE_PICKNEXT,
    countDuplicates,
    resetState: () => { currentOrderId = null; showMessage = true; }
  }
};
