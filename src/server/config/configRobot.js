// MACHINE 
const { createModuleLogger } = require('./logger');
const logger = createModuleLogger('-CF-');
logger.info("----------------------------------------------------- LOADED CONFIG MACHINE");

module.exports = {
    ////////////////////////////////////////////////////////////
    // Robot Movements /////////////////////////////////////////
    //machine_id: 'cityNameHere',
   //robot_SerialNr: '0000000',
   // gripper_serialNr:'1111111',
    // gripperType:'ModBus', //IO=old, ModBus=new
    gripperType:'IO', //IO=old, ModBus=new
    robot_halted_at_startup: 'true',//save in GLOBALS.ROBOT_HALTED
    
    robot_a: 1.02, // acceleration
    robot_v: 0.4,  // speed
    robot_t: 0,    // time
    robot_r: 0,    // blend radius

    sleeptime: 1,  // Sleep time between robot actions, in seconds
    sleeptimedrop: 1,  // waiting at drop to release the car after gripper opened
    ////////////////////////////////////////////////////////////
    // Cassette Pick up ////////////////////////////////////////

    deltaX: 100,   // X-axis movement increment in millimeters
    deltaY: 55,    // Y-axis movement increment in millimeters
    homeX: -705,   // Home X position in millimeters (relative to left top)
    homeY: 725,    // Home Y position in millimeters (relative to left top)

    calibrationAngleDEG: 0.219591, // Front view calibration angle [degrees]

    safetyZOffset: 0.050,   // Safety margin for pointing and picking from cassettes, [m] (0.05 for safe testing)

    PICK_HOVER_Z: 180 / 1000,           // base depth calibration for all cassettes, how far to hover in front of cassette
    PICK_MOVE_IN_DISTANCE: 45 / 1000,   // Distance in meters to move in from hover position [m]
    PICK_MOVE_UP_DISTANCE: 15 / 1000, // Distance in meters to move up after picking
    PICK_MOVE_OUT_DISTANCE: -200 / 1000, // Distance in meters to retract fully
    PICK_ANGLEDEG: 16,               // Angle in degrees to pick at
    PickHeightOffset: -0.035,         // how much the tcp is lowered, to match PICK_ANGLEDEG

    ////////////////////////////////////////////////////////////
    // Home/Safe Positions /////////////////////////////////////
    POS_MID: [
        90 * Math.PI / 180,
        -90 * Math.PI / 180,
        -120 * Math.PI / 180,
        120 * Math.PI / 180,
        -90 * Math.PI / 180,
        90 * Math.PI / 180
    ],
    POS_LEFT: [
        180 * Math.PI / 180,
        -90 * Math.PI / 180,
        -90 * Math.PI / 180,
        90 * Math.PI / 180,
        -90 * Math.PI / 180,
        180 * Math.PI / 180

    ],
    POS_RIGHT:[
        60 * Math.PI / 180,
        -90 * Math.PI / 180,
        -90 * Math.PI / 180,
        90 * Math.PI / 180,
        -90 * Math.PI / 180,
        60 * Math.PI / 180
    ],

    POS_PRESENT_CAR: [
        90 * Math.PI / 180,
        -90 * Math.PI / 180,
        -120 * Math.PI / 180,
        120 * Math.PI / 180,
        -90 * Math.PI / 180,
        90 * Math.PI / 180
    ],
    ////////////////////////////////////////////////////////////
    // Track Drop Positions ////////////////////////////////////

    dropOffs: {
        // initially empty values, needs calibration before they can be used by the machine
        // create a popup for the operator if empty, saying the machine needs calibration of dropoffs
        drop1Joints: [-1.062, -0.676, 0.834, -1.681, -1.533, -1.602], // BASIC: HW00,HW11 //shall be radians
        drop2Joints: [-0.993, -0.413, 0.314, -1.39, -1.474, -1.524], // BASIC: HW00,HW11
        drop3Joints: [], // EXTENDED: HW10USA
        drop4Joints: []  // EXTENDED: HW10USA
    },

    ////////////////////////////////////////////////////////////
    // Cassettes Z Calibration /////////////////////////////////

    cassettesZ: {
        1: 0
    }
}; 