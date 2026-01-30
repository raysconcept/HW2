const { createModuleLogger } = require('../config/logger');
const logger = createModuleLogger('URSC');
logger.debug("LOADED HW_ROBOT_SCRIPTS ");

logger.debug("require configMain");
const config = require('../config/configMain');
const mainConfigFileName = config.robotConfig.machineConfigFileName;

    

// Check if machine name is set and not empty
if (!mainConfigFileName || mainConfigFileName.trim() === '') {
  logger.error('machineConfigFileName is not set or empty.');
  process.exit(1);
}

// Load machine-specific configuration
let machineConfig;
try {
  logger.info("mainConfigFileName:" + mainConfigFileName);
  machineConfig = require(`${mainConfigFileName}`);
} catch (error) {
  logger.error(`Failed to load robot configuration. Error: ${error.message}`);
  process.exit(1);
}
logger.debug("robot config name: " + machineConfig);

// Verify machine configuration was loaded correctly 
//if (!machineConfig || !machineConfig.drop1To) {
if (!machineConfig || !machineConfig.dropOffs) {
  logger.error(`Invalid machine configuration`);
  process.exit(1);
}

logger.debug("robot config name: " + machineConfig);


// read machine info was done in HW_DB_MACHINE() => GLOBALS.machine.gripperType (.etc)
//logger.info(GLOBALS.machine);
logger.info("Using gripper:" + machineConfig.gripperType);

//////////////////////////////////////////////////////////////////////////////////////

// low level robot commands, constants
const robot_a = machineConfig.robot_a; // acc
const robot_v = machineConfig.robot_v; // speed
const robot_t = machineConfig.robot_t; // time
const robot_r = machineConfig.robot_r; // blend radius

const robot_avtr = "a=" + robot_a + ",v=" + robot_v + ",t=" + robot_t + ",r=" + robot_r;
const robot_avr = "a=" + robot_a + ",v=" + robot_v + ",r=" + robot_r;
const robot_avr_slow = "a=" + robot_a * 0.1 + ",v=0.05,r=0";

const sleeptime = machineConfig.sleeptime;
const sleeptimedrop = machineConfig.sleeptimedrop;
const cassettesZ = machineConfig.cassettesZ;
const safetyZOffset = machineConfig.safetyZOffset;

let POS_MID = machineConfig.POS_MID; // array
let POS_LEFT = machineConfig.POS_LEFT;// array
let POS_RIGHT = machineConfig.POS_RIGHT;// array

let homePresentCar;
let homeMid;
let homeLeft;
let homeRight;



////////////////////////////////////////////// SAFETY TRANSITION
let ROBOT_MOVE_PRESENT_CAR;
let CALL_ROBOT_MOVE_PRESENT_CAR;
let ROBOT_MOVE_SAFE_MID;
let CALL_ROBOT_MOVE_SAFE_MID;
let ROBOT_MOVE_SAFE_LEFT
let CALL_ROBOT_MOVE_SAFE_LEFT;
let ROBOT_MOVE_SAFE_RIGHT;
let CALL_ROBOT_MOVE_SAFE_RIGHT;

////////////////////////////////////////////// TANGO
let ROBOT_TANGO_TO_DROP;
let CALL_ROBOT_TANGO_TO_DROP;
let ROBOT_TANGO_TO_MID;
let CALL_ROBOT_TANGO_TO_MID;

////////////////////////////////////////////// HOME & CALLIBRATION
let deltaX = machineConfig.deltaX;
let deltaY = machineConfig.deltaY;

let homeX = machineConfig.homeX;
let homeY = machineConfig.homeY;

let calibrationAngleDEG = machineConfig.calibrationAngleDEG;
let calibrationAngleRAD = machineConfig.calibrationAngleDEG * Math.PI / 180;

////////////////////////////////////////////// PICKING
let PickHeightOffset = machineConfig.PickHeightOffset;

const PICK_HOVER_Z = machineConfig.PICK_HOVER_Z;
let PICK_MOVE_IN_DISTANCE = machineConfig.PICK_MOVE_IN_DISTANCE;
let PICK_MOVE_UP_DISTANCE = machineConfig.PICK_MOVE_UP_DISTANCE;
let PICK_MOVE_OUT_DISTANCE = machineConfig.PICK_MOVE_OUT_DISTANCE;

const PICK_ANGLEDEG = machineConfig.PICK_ANGLEDEG;
const PICK_ANGLERAD = PICK_ANGLEDEG * Math.PI / 180;

let ROBOTFUNCTIONS = "";

///////////////////////////////////////////////////////////// ROBOT PREDEFINED FUNCTIONS

const SLEEP = `
  def sleep_robot():
    sleep(${sleeptime})
  end`;
const CALL_SLEEP = "\n  sleep_robot()";

// TODO: make this dynamic so that the IP, port and message can be changed
const SENDREPLY = `
  def socketsending():
    socket_open("192.168.56.3",30002,"RobotSocket")
    socket_send_string("hallo from robot.", "RobotSocket")
    socket_send_byte(10, "RobotSocket")
    socket_close("RobotSocket")
  end`;

////////////////////////////////////////////////////////////////////////////////////////
const WAITFORCOMPLETION = `
  def wait_for_completion():
     while(get_tool_digital_in(0) == False and get_tool_digital_in(1) == False):
        sleep(0.01)
     end
  end`;
const CALL_WAITFORCOMPLETION = "\n  wait_for_completion():";

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////// GRIPPER
//63352 
//was global driver_gripper_client = rpc_factory("xmlrpc","http://localhost:63353")
// global driver_gripper_client = rpc_factory("xmlrpc","http://localhost:63352")
// in script van gripper itself (downloaded with USB stick from teachpanel): rpc_factory("xmlrpc","http://127.0.0.1:63353")
// global driver_gripper_client = rpc_factory("xmlrpc","http://127.0.0.1:40474")
// global driver_gripper_client = rpc_factory("xmlrpc","http://localhost:63353")
const G_SET_SETTINGS = `  
  global driver_gripper_client = rpc_factory("xmlrpc","http://localhost:63353")
  global RQ_UNIT_PERCENT = 0
  global RQ_UNIT_MM = 1
  global RQ_UNIT_INCH = 2
  global all_gripper_limits = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]`;

  //driver_gripper_client.activate()
let G_ACTIVATE = null;
if (machineConfig.gripperType == "ModBus") {
  G_ACTIVATE = `
  def G_ACTIVATE():    
    driver_gripper_client.activate()
  end`;
} else if (machineConfig.gripperType == "IO") {
  G_ACTIVATE = `
  def G_ACTIVATE():
    set_tool_digital_out(0, True)
    set_tool_digital_out(1, True)
  end`;
}
const CALL_G_ACTIVATE = "\n  G_ACTIVATE()";

let G_CLOSE_LOW = null;
if (machineConfig.gripperType == "ModBus") {
  // ModBus Gripper
  //driver_gripper_client.move([9], 98, RQ_UNIT_PERCENT, all_gripper_limits)
  G_CLOSE_LOW = `
  def G_CLOSE_LOW():
   driver_gripper_client.move([9], 98, RQ_UNIT_PERCENT, all_gripper_limits)
   sleep(${sleeptime})
  end`;
} else if (machineConfig.gripperType == "IO") {
  // IO Gripper  
  G_CLOSE_LOW = `
  def G_CLOSE_LOW():
    set_tool_digital_out(0, True)
    set_tool_digital_out(1, False)
    sleep(${sleeptime})
  end`;
}
const CALL_G_CLOSE_LOW = "\n  G_CLOSE_LOW()";

////////////////////////////////////////////////// 80
let G_CLOSE_MID = null;
if (machineConfig.gripperType == "ModBus") {
  G_CLOSE_MID = `
  def G_CLOSE_MID():
   driver_gripper_client.move([9], 80, RQ_UNIT_PERCENT, all_gripper_limits)
   sleep(${sleeptime})
  end`;
} else if (machineConfig.gripperType == "IO") {
  // IO Gripper  
  G_CLOSE_MID = `
  def G_CLOSE_MID():
    set_tool_digital_out(0, False)
    set_tool_digital_out(1, True)
    sleep(${sleeptime})
  end`;
}
const CALL_G_CLOSE_MID = "\n  G_CLOSE_MID()";

//////////////////////////////////////////////////
// this closing distance needs to fit inside a cassette, 50 is the calibrated value
let G_CLOSE_CASSETTE = null;
if (machineConfig.gripperType == "ModBus") {
  // ModBus Gripper
  //driver_gripper_client.move([9], 98, RQ_UNIT_PERCENT, all_gripper_limits)
  G_CLOSE_CASSETTE = `
  def G_CLOSE_CASSETTE():
   driver_gripper_client.move([9], 50, RQ_UNIT_PERCENT, all_gripper_limits)
   sleep(${sleeptime})
  end`;
} else if (machineConfig.gripperType == "IO") {
  // IO Gripper  
  G_CLOSE_CASSETTE = `
  def G_CLOSE_CASSETTE():
    set_tool_digital_out(0, False)
    set_tool_digital_out(1, True)
    sleep(${sleeptime})
  end`;
}
const CALL_G_CLOSE_CASSETTE = "\n  G_CLOSE_CASSETTE()";

//////////////////////////////////////////////////

let G_CLOSE_HIGH = null;
if (machineConfig.gripperType == "ModBus") {
  // ModBus Gripper
  //driver_gripper_client.move([9], 98, RQ_UNIT_PERCENT, all_gripper_limits)
  G_CLOSE_HIGH = `
  def G_CLOSE_HIGH():
   driver_gripper_client.move([9], 10, RQ_UNIT_PERCENT, all_gripper_limits)
   sleep(${sleeptime})
  end`;
} else if (machineConfig.gripperType == "IO") {
  // IO Gripper  
  G_CLOSE_HIGH = `
  def G_CLOSE_HIGH():
set_tool_digital_out(0, False)
    set_tool_digital_out(1, False)
    sleep(${sleeptime})
  end`;
}
const CALL_G_CLOSE_HIGH = "\n  G_CLOSE_HIGH()";

//////////////////////////////////////////////////

let G_OPEN_FULL = null;
if (machineConfig.gripperType == "ModBus") {
  // ModBus Gripper
  //driver_gripper_client.move([9], 98, RQ_UNIT_PERCENT, all_gripper_limits)
  G_OPEN_FULL = `
  def G_OPEN_FULL():
   driver_gripper_client.move([9], 10, RQ_UNIT_PERCENT, all_gripper_limits)
   sleep(${sleeptime})
  end`;
} else if (machineConfig.gripperType == "IO") {
  // IO Gripper  
  G_OPEN_FULL = `
  def G_OPEN_FULL():
set_tool_digital_out(0, True)
    set_tool_digital_out(1, True)
    sleep(${sleeptime})
  end`;
}
const CALL_G_OPEN_FULL = "\n  G_OPEN_FULL()";

////////////////////////////////////////////////////////////////  MOVE IN OUT
const G_LOOK_LEFT = `
  def G_LOOK_LEFT():
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,0,1.5,0,0]),${robot_avr_slow})
    sleep(0.5)
  end`;
const CALL_G_LOOK_LEFT = "\n G_LOOK_LEFT()";

/////////////////////////////////////////////////
const G_LOOK_RIGHT = `
  def G_LOOK_RIGHT():
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,0,-1.5,0,0]),${robot_avr_slow})
    sleep(0.5)
  end`;
const CALL_G_LOOK_RIGHT = "\n G_LOOK_RIGHT()";

//////////////////////////////////////////////////
const G_PICKANGLE = `
  def G_PICK_ANGLE():
    # rotation around tcp, not the gripper
    movel(pose_trans(get_actual_tcp_pose(),p[${PickHeightOffset},0,0,0,${PICK_ANGLERAD},0]),${robot_avr_slow})
    sleep(0.5)
  end`;
const CALL_G_PICKANGLE = "\n  G_PICK_ANGLE()";

//////////////////////////////////////////////////
const G_HORIZONTAL = `
  def G_HORIZONTAL():
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,0,0,0,0]),${robot_avr_slow})
    sleep(0.5)
  end`;
const CALL_G_HORIZONTAL = "\n G_HORIZONTAL()";

//////////////////////////////////////////////////
const MOVE_IN = `
  def MOVE_IN():
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,0.01,0,0,0]),${robot_avr_slow})
    sleep(0.5)
  end`;
const CALL_ROBOT_MOVE_IN = "\n  MOVE_IN()";

//////////////////////////////////////////////////
const MOVE_OUT = `
  def MOVE_OUT():
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,-0.05,0,0,0]),${robot_avr_slow})
    sleep(0.5)
  end`;
const CALL_ROBOT_MOVE_OUT = "\n  MOVE_OUT()";

//////////////////////////////////////////////////
const MOVE_DOWN = `
  def MOVE_DOWN():
    movel(pose_trans(get_actual_tcp_pose(),p[-0.01,0,0,0,0,0]),${robot_avr})
    sleep(0.5)
  end`;
const CALL_MOVE_DOWN = "\n  MOVE_DOWN()";

//////////////////////////////////////////////////
const MOVE_UP = `
  def MOVE_UP():
    movel(pose_trans(get_actual_tcp_pose(),p[0.01,0,0,0,0,0]),${robot_avr})
    sleep(0.5)
  end`;
const CALL_MOVE_UP = "\n  MOVE_UP()";

//////////////////////////////////////////////////
const MOVE_LEFT = `
  def MOVE_LEFT():
    movel(pose_trans(get_actual_tcp_pose(),p[0,-0.002,0,0,0,0]),${robot_avr})
    sleep(0.5)
  end`;
const CALL_MOVE_LEFT = "\n  MOVE_LEFT()";

//////////////////////////////////////////////////
const MOVE_RIGHT = `
  def MOVE_RIGHT():
    movel(pose_trans(get_actual_tcp_pose(),p[0,0.002,0,0,0,0]),${robot_avr})
    sleep(0.5)
  end`;
const CALL_MOVE_RIGHT = "\n  MOVE_RIGHT()";

//////////////////////////////////////////////////
const MOVE_DIAG = `
  def MOVE_DIAG():
    movel(pose_trans(get_actual_tcp_pose(),p[0.02, 0,0,0,0,0]),${robot_avr_slow})
    sleep(0.5)
  end`;
const CALL_MOVE_DIAG = "\n  MOVE_DIAG()";

//////////////////////////////////////////////////
const PICK_MOVE_IN = `
  def PICK_MOVEIN():
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,${PICK_MOVE_IN_DISTANCE},0,0,0]),${robot_avr_slow})
    sleep(0.5)
  end`;
const CALL_G_PICK_MOVE_IN = "\n  PICK_MOVEIN()";

//////////////////////////////////////////////////
const PICK_MOVE_OUT = `
  def PICK_MOVE_OUT():
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,${PICK_MOVE_OUT_DISTANCE},0,0,0]),${robot_avr_slow})
    sleep(0.5)
  end`;
const CALL_PICK_MOVE_OUT = "\n  PICK_MOVE_OUT()";

//////////////////////////////////////////////////
const PICK_MOVE_UP = `
  def PICK_MOVE_UP():
    movel(pose_trans(get_actual_tcp_pose(),p[${PICK_MOVE_UP_DISTANCE},0,0,0,0,0]),${robot_avr_slow})
    sleep(1)
  end`;
const CALL_G_PICK_MOVE_UP = "\n  PICK_MOVE_UP()";

//////////////////////////////////////////////////
const G_POINTIN = `
  def G_POINTIN():
    movep(pose_trans(get_actual_tcp_pose(),p[0,0,0.5,0,-1.5,0]),${robot_avr_slow})
    sleep(0.5)
  end`;
const CALL_G_POINTIN = "\n  G_POINTIN()";

//////////////////////////////////////////////////
const G_POINTOUT = `
  def G_POINTOUT():
    movep(pose_trans(get_actual_tcp_pose(),p[0,0,0.5,0,1.5,0]),${robot_avr_slow})
    sleep(0.5)
  end`;
const CALL_G_POINTOUT = "\n  G_POINTOUT()";

//////////////////////////////////////////////////

const CALL_PICKOUT_CAR_SMALL = `
  ${CALL_G_CLOSE_CASSETTE}
  ${CALL_G_PICKANGLE}
  ${CALL_G_PICK_MOVE_IN}
  ${CALL_G_CLOSE_LOW}
  ${CALL_G_PICK_MOVE_UP}
  ${CALL_PICK_MOVE_OUT}`;


/////////////////////DROP CONSTANTS ///////////////////

const drop_z_safety = 0.005;
const dropmoveIn = 0.045;
const dropmoveOut = -1*dropmoveIn-0.02;

//////////////////DROP 1 SEQUENCE///////////////////////////////////////////////////
const drop1_gripper_horizontal_angle = machineConfig.dropOffs.drop1Joints[0];
// logger.debug("==DROPOFF DEBUG======= drop1_gripper_horizontal_angle RAD: " + drop1_gripper_horizontal_angle);

const drop1Rotate = -1 * (drop1_gripper_horizontal_angle - machineConfig.dropOffs.drop1Joints[5]);

// logger.debug("==DROPOFF DEBUG======= dropRotate RAD: " + drop1Rotate);


// need to move EE a bit to the right while it's rotating the car, otherwise it touches the upper track
const drop1MoveUp = 0.065;
const drop1MoveBackward = 0.020;
// maths for triginometry
const travel_angle_drop1 = Math.atan2(drop1MoveBackward, drop1MoveUp);
//  logger.debug("==DROPOFF DEBUG======= travel_angle_drop1 RAD: " +  travel_angle_drop1);
const travel_length = Math.sqrt(drop1MoveUp * drop1MoveUp + drop1MoveBackward * drop1MoveBackward);
//  logger.debug("==DROPOFF DEBUG======= travel_length m: " +  travel_length);
const drop1moveForward = -1 * travel_length * Math.sin(-drop1Rotate + travel_angle_drop1);
//  logger.debug("==DROPOFF DEBUG======= dropmoveForward m: " +  dropmoveForward);
const drop1moveDownward = -1 * travel_length * Math.cos(-drop1Rotate + travel_angle_drop1) + 0.011; // 011 - distance betweem calibration tool and gripper lower surfaces
//  logger.debug("==DROPOFF DEBUG======= dropmoveDownward m: " +  dropmoveDownward);  

const ROBOT_DROP1_RELEASE_SEQUENCE = ` 
  def ROBOT_DROP1_RELEASE_SEQUENCE():

    # step 1: move heigher than and back along the track
    movel(pose_trans(get_actual_tcp_pose(),p[${drop1MoveUp},${drop1MoveBackward},0,0,0,0]),${robot_avr_slow})
    sleep(${sleeptimedrop})
    # step 2: move tcp in (+z)
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,${dropmoveIn} - ${drop_z_safety},0,0,0]),${robot_avr_slow})
    sleep(${sleeptimedrop})
    # step 3: rotate tcp to align with track
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,0,0,0,${drop1Rotate}]),${robot_avr_slow})
    # movel(pose_trans(get_actual_tcp_pose(),p[0,0,0,0,0,0]),${robot_avr_slow})
    sleep(${sleeptimedrop})
    # step 4: move forward in trackdirection (-y)
    movel(pose_trans(get_actual_tcp_pose(),p[0,${drop1moveForward},0,0,0,0]),${robot_avr_slow})
    sleep(${sleeptimedrop})
    # step 5: move down (gripperfingers into track)
    sleep(${sleeptimedrop})
    movel(pose_trans(get_actual_tcp_pose(),p[${drop1moveDownward},0,0,0,0,0]),${robot_avr_slow})
    # step 6: open the gripper --- check how to decrease it's speed here
    # G_ACTIVATE()
    G_OPEN_FULL()
    #driver_gripper_client.move([9], 10, RQ_UNIT_PERCENT, all_gripper_limits)
    sleep(${sleeptimedrop})
    # step 7: move out
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,${dropmoveOut},0,0,0]),${robot_avr_slow})
    ROBOT_TANGO_TO_MID()
  end`;

//////////////DROP 2 SEQUENCE///////////////////////////////////////////////////
const drop2_gripper_horizontal_angle = machineConfig.dropOffs.drop2Joints[0];
const drop2Rotate = -1 * (drop2_gripper_horizontal_angle - machineConfig.dropOffs.drop2Joints[5]);

// logger.debug("==DROPOFF DEBUG======= drop2Rotate RAD: " + drop2Rotate);

// need to move EE a bit to the right while it's rotating the car, otherwise it touches the upper track
const drop2MoveUp = 0.015;
const drop2MoveBackward = 0.000;

// maths for triginometry
// const travel_angle_drop2 = Math.atan2(drop2MoveBackward, drop2MoveUp);
// logger.debug("==DROPOFF DEBUG======= travel_angle_drop2 RAD: " +  travel_angle_drop2);
// const travel_length_drop2 = Math.sqrt(drop2MoveUp * drop2MoveUp + drop2MoveBackward * drop2MoveBackward);
// logger.debug("==DROPOFF DEBUG======= travel_length_drop2 m: " +  travel_length);
// const drop2moveForward = -travel_length_drop2 * Math.sin(-drop2Rotate + travel_angle_drop2);
// logger.debug("==DROPOFF DEBUG======= drop2moveForward m: " +  drop2moveForward);

const drop2moveDownward = -drop2MoveUp + 0.002;
// const drop2moveDownward = -travel_length_drop2 * Math.cos(-drop2Rotate + travel_angle_drop2) + 0.011;
// logger.debug("==DROPOFF DEBUG======= drop2moveDownward m: " +  drop2moveDownward);

// const dropMoveInCorrected = dropmoveIn - drop_z_safety;
// const dropMoveOutCorrected = -1* dropMoveInCorrected;

const ROBOT_DROP2_RELEASE_SEQUENCE = ` 
  def ROBOT_DROP2_RELEASE_SEQUENCE():

    # step 1: rotate to align with track (match the track direction)
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,0,0,0,${drop2Rotate}]),${robot_avr_slow})

    # step 2: move up along the track perpendicular
    movel(pose_trans(get_actual_tcp_pose(),p[${drop2MoveUp},0,0,0,0,0]),${robot_avr_slow})

    # step 3: move in
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,${dropmoveIn} - ${drop_z_safety},0,0,0]),${robot_avr_slow})

    # step 4: move down along the track perpendicular
    movel(pose_trans(get_actual_tcp_pose(),p[${drop2moveDownward},0,0,0,0,0]),${robot_avr_slow})

    # step 5: open gripper
    G_OPEN_FULL()
    # driver_gripper_client.move([9], 10, RQ_UNIT_PERCENT, all_gripper_limits)

    # step 6: move out
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,${dropmoveOut},0,0,0]),${robot_avr_slow})

    # step 7: move away
    ROBOT_TANGO_TO_MID()

    

    
  end`;


const ROBOT_DROP_RELEASE_SEQUENCE = ` 
  def ROBOT_DROP_RELEASE_SEQUENCE():
    # move tcp in (+z)
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,${dropmoveIn} - ${drop_z_safety},0,0,0]),${robot_avr_slow})
    # rotate tcp to align with track
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,0,0,0,${drop1Rotate}]),${robot_avr_slow})
    # move forward in trackdirection (-y)
    movel(pose_trans(get_actual_tcp_pose(),p[0,${drop1moveForward},0,0,0,0]),${robot_avr_slow})
    # move down (gripperfingers into track)
    movel(pose_trans(get_actual_tcp_pose(),p[${drop1moveDownward},0,0,0,0,0]),${robot_avr_slow})
    # open the gripper
    driver_gripper_client.move([9], 10, RQ_UNIT_PERCENT, all_gripper_limits)
    sleep(${sleeptimedrop})
    # move out
    movel(pose_trans(get_actual_tcp_pose(),p[0,0,${dropmoveOut},0,0,0]),${robot_avr_slow})
    ROBOT_TANGO_TO_MID()
  end`;


const ROBOT_MOVE_DROP1_SEQUENCE = `
  def ROBOT_MOVE_DROP1_SEQUENCE():
    ROBOT_TANGO_TO_DROP()
    # move to drop 1
    movel([${machineConfig.dropOffs.drop1Joints[0]},${machineConfig.dropOffs.drop1Joints[1]},${machineConfig.dropOffs.drop1Joints[2]},${machineConfig.dropOffs.drop1Joints[3]},${machineConfig.dropOffs.drop1Joints[4]},1*(${machineConfig.dropOffs.drop1Joints[0]})], ${robot_avr})
    ROBOT_DROP1_RELEASE_SEQUENCE()    
  end`;
const CALL_ROBOT_MOVE_DROP1_SEQUENCE = "\n  ROBOT_MOVE_DROP1_SEQUENCE()";

const ROBOT_MOVE_DROP2_SEQUENCE = `
  def ROBOT_MOVE_DROP2_SEQUENCE():
    ROBOT_TANGO_TO_DROP()   
    movel([${machineConfig.dropOffs.drop2Joints[0]},${machineConfig.dropOffs.drop2Joints[1]},${machineConfig.dropOffs.drop2Joints[2]},${machineConfig.dropOffs.drop2Joints[3]},${machineConfig.dropOffs.drop2Joints[4]},1*(${machineConfig.dropOffs.drop2Joints[0]})], ${robot_avr})
    sleep(${sleeptimedrop})
    ROBOT_DROP2_RELEASE_SEQUENCE()   
  end`;
const CALL_ROBOT_MOVE_DROP2_SEQUENCE = "\n  ROBOT_MOVE_DROP2_SEQUENCE()";

let POS_MID_CALIBRATED = [];
let POS_LEFT_CALIBRATED = [];
let POS_RIGHT_CALIBRATED = [];
let POS_PRESENT_CAR_CALIBRATED = []; // present a car to the crowd

function calculateCalibration() {
  logger.debug("Calculating calibration commands. Calibration DEG: " + calibrationAngleDEG + ", RAD: " + calibrationAngleRAD);

  // Home positions LEFT / MID / RIGHT
  POS_MID_CALIBRATED[0] = machineConfig.POS_MID[0] + calibrationAngleRAD;
  POS_MID_CALIBRATED[1] = machineConfig.POS_MID[1];
  POS_MID_CALIBRATED[2] = machineConfig.POS_MID[2];
  POS_MID_CALIBRATED[3] = machineConfig.POS_MID[3];
  POS_MID_CALIBRATED[4] = machineConfig.POS_MID[4];
  POS_MID_CALIBRATED[5] = machineConfig.POS_MID[5];

  POS_LEFT_CALIBRATED[0] = machineConfig.POS_LEFT[0] + calibrationAngleRAD;
  POS_LEFT_CALIBRATED[1] = machineConfig.POS_LEFT[1];
  POS_LEFT_CALIBRATED[2] = machineConfig.POS_LEFT[2];
  POS_LEFT_CALIBRATED[3] = machineConfig.POS_LEFT[3];
  POS_LEFT_CALIBRATED[4] = machineConfig.POS_LEFT[4];
  POS_LEFT_CALIBRATED[5] = machineConfig.POS_LEFT[5];

  POS_RIGHT_CALIBRATED[0] = machineConfig.POS_RIGHT[0] + calibrationAngleRAD;
  POS_RIGHT_CALIBRATED[1] = machineConfig.POS_RIGHT[1];
  POS_RIGHT_CALIBRATED[2] = machineConfig.POS_RIGHT[2];
  POS_RIGHT_CALIBRATED[3] = machineConfig.POS_RIGHT[3];
  POS_RIGHT_CALIBRATED[4] = machineConfig.POS_RIGHT[4];
  POS_RIGHT_CALIBRATED[5] = machineConfig.POS_RIGHT[5];

  POS_PRESENT_CAR_CALIBRATED[0] = machineConfig.POS_PRESENT_CAR[0] + calibrationAngleRAD;
  POS_PRESENT_CAR_CALIBRATED[1] = machineConfig.POS_PRESENT_CAR[1];
  POS_PRESENT_CAR_CALIBRATED[2] = machineConfig.POS_PRESENT_CAR[2];
  POS_PRESENT_CAR_CALIBRATED[3] = machineConfig.POS_PRESENT_CAR[3];
  POS_PRESENT_CAR_CALIBRATED[4] = machineConfig.POS_PRESENT_CAR[4];
  POS_PRESENT_CAR_CALIBRATED[5] = machineConfig.POS_PRESENT_CAR[5];

  // assemble positions
  homeMid = `[${POS_MID_CALIBRATED[0]},${POS_MID_CALIBRATED[1]},${POS_MID_CALIBRATED[2]},${POS_MID_CALIBRATED[3]},${POS_MID_CALIBRATED[4]},${POS_MID_CALIBRATED[5]}]`;
  homeLeft = `[${POS_LEFT_CALIBRATED[0]},${POS_LEFT_CALIBRATED[1]},${POS_LEFT_CALIBRATED[2]},${POS_LEFT_CALIBRATED[3]},${POS_LEFT_CALIBRATED[4]},${POS_LEFT_CALIBRATED[5]}]`;
  homeRight = `[${POS_RIGHT_CALIBRATED[0]},${POS_RIGHT_CALIBRATED[1]},${POS_RIGHT_CALIBRATED[2]},${POS_RIGHT_CALIBRATED[3]},${POS_RIGHT_CALIBRATED[4]},${POS_RIGHT_CALIBRATED[5]}]`;

  /*
  homeFront = `[${robotNeutralJointsBaseFront},${robotNeutralJointsShoulderFront},${robotNeutralJointsElbowFront},${robotNeutralJointsWrist1Front},${robotNeutralJointsWrist2Front},${robotNeutralJointsWrist3Front}]`;
  homeCrowd = `[${robotNeutralJointsBaseCrowd},${robotNeutralJointsShoulderCrowd},${robotNeutralJointsElbowCrowd},${robotNeutralJointsWrist1Crowd},${robotNeutralJointsWrist2Crowd},${robotNeutralJointsWrist3Crowd}]`;
*/
  homePresentCar = `[${POS_PRESENT_CAR_CALIBRATED[0]},${POS_PRESENT_CAR_CALIBRATED[1]},${POS_PRESENT_CAR_CALIBRATED[2]},${POS_PRESENT_CAR_CALIBRATED[3]},${POS_PRESENT_CAR_CALIBRATED[4]},${POS_PRESENT_CAR_CALIBRATED[5]}]`;

  /////////////////////////////////////////////////////////////

  ROBOT_MOVE_PRESENT_CAR = `
  def ROBOT_MOVE_PRESENT_CAR():
    movej(${homePresentCar},${robot_avtr})
  end`;
  CALL_ROBOT_MOVE_PRESENT_CAR = "\n  ROBOT_MOVE_PRESENT_CAR()";

  ROBOT_MOVE_SAFE_MID = `
  def ROBOT_MOVE_SAFE_MID():
    movej(${homeMid},${robot_avtr})
  end`;
  CALL_ROBOT_MOVE_SAFE_MID = "\n  ROBOT_MOVE_SAFE_MID()";

  ROBOT_MOVE_SAFE_LEFT = `
  def ROBOT_MOVE_SAFE_LEFT():
    movej(${homeLeft},${robot_avtr})
  end`;
  CALL_ROBOT_MOVE_SAFE_LEFT = "\n  ROBOT_MOVE_SAFE_LEFT()";

  ROBOT_MOVE_SAFE_RIGHT = `
  def ROBOT_MOVE_SAFE_RIGHT():
    movej(${homeRight},${robot_avtr})
  end`;
  CALL_ROBOT_MOVE_SAFE_RIGHT = "\n  ROBOT_MOVE_SAFE_RIGHT()";

  //////////////////////////////////////////////
  /*
  ROBOT_TANGO_TO_DROP = `
  def ROBOT_TANGO_TO_DROP():
    ROBOT_MOVE_SAFE_MID() # START AT SAFE HOME

    current = get_actual_joint_positions()
    new_pos = current
    # b =0 / s =1 / e =2 / w1 =3 / w2 =4 / w3=5

    #A G VIEW IN
    # new_pos[0] = 180 * 3.14/180 # -----------
    new_pos[0] = 0 * 3.14/180 # -----------
    new_pos[1] = -90* 3.14/180 
    new_pos[2] = -120* 3.14/180
    new_pos[3] = 120* 3.14/180
    new_pos[4] = -90* 3.14/180
    new_pos[5] = 180 * 3.14/180 # gripper
    movej(new_pos, a=1.0, v=2)
    
    #B
    # new_pos[0] = 180 * 3.14/180 # -----------
    new_pos[0] = 0 * 3.14/180 # -----------
    new_pos[1] = -90* 3.14/180
    new_pos[2] = -120 * 3.14/180 
    new_pos[3] = 300 * 3.14/180  # -----------
    new_pos[4] = -90* 3.14/180
    new_pos[5] = 180 * 3.14/180 
    movej(new_pos, a=1.0, v=2)    
    
    #C G VIEW OUT
    #new_pos[0] = 90 * 3.14/180   # ----------- BASE
    new_pos[0] = -90 * 3.14/180   # ----------- BASE
    new_pos[1] = -90* 3.14/180
    new_pos[2] = -120 * 3.14/180 
    new_pos[3] = 300 * 3.14/180 
    new_pos[4] = -90* 3.14/180    
    new_pos[5] = 270 * 3.14/180  # ----------- GRIPPER
    movej(new_pos, a=1.0, v=2)  
    
    #D
    #new_pos[0] = 90 * 3.14/180   # ----------- BASE
    new_pos[0] = -90 * 3.14/180   # ----------- BASE
    new_pos[1] = -90* 3.14/180
    new_pos[2] = -120 * 3.14/180 # e
    new_pos[3] = 300 * 3.14/180 # w1
    new_pos[4] = 90 * 3.14/180   # ---------- w2
    new_pos[5] = 270 * 3.14/180  # gripper 90 
    movej(new_pos, a=1.0, v=2) 

    #E    
    new_pos[0] = -60 * 3.14/180   # ----------- BASE
    new_pos[1] = -50* 3.14/180
    new_pos[2] = 60 * 3.14/180 # e
    new_pos[3] = 270 * 3.14/180 # w1
    new_pos[4] = -70 * 3.14/180   # ---------- w2
    new_pos[5] = 270 * 3.14/180  # gripper 90 
    movej(new_pos, a=1.0, v=2) 

      
  end`;
  */
  ROBOT_TANGO_TO_DROP = `
  def ROBOT_TANGO_TO_DROP():
    ROBOT_MOVE_SAFE_MID() # START AT SAFE HOME

    current = get_actual_joint_positions()
    new_pos = current
    # b =0 / s =1 / e =2 / w1 =3 / w2 =4 / w3=5

    #A LOW   
    new_pos[0] = -90 * 3.14/180   # rotate base
    new_pos[1] = -60 * 3.14/180 
    new_pos[2] = -120 * 3.14/180
    new_pos[3] = 90 * 3.14/180
    new_pos[4] = -90* 3.14/180
    new_pos[5] = -90 * 3.14/180   # rotate base
    movej(new_pos, a=1.0, v=2)
    
    #B    
    new_pos[0] = -90 * 3.14/180 
    new_pos[1] = -60 * 3.14/180 
    new_pos[2] = -120 * 3.14/180
    new_pos[3] = 90 * 3.14/180 
    new_pos[4] = 90* 3.14/180     # gripper to front
    new_pos[5] = -90 * 3.14/180 
    movej(new_pos, a=1.0, v=2)   
    
    #C retract for safety spacing   
    new_pos[0] = -90 * 3.14/180 
    new_pos[1] = -20 * 3.14/180   # retract
    new_pos[2] = -135 * 3.14/180  # retract
    new_pos[3] = 70 * 3.14/180    # retract
    new_pos[4] = 0 * 3.14/180
    new_pos[5] = -90 * 3.14/180 
    movej(new_pos, a=1.0, v=2)  
    
    #C zwaai up 
    new_pos[0] = -90 * 3.14/180 
    new_pos[1] = -45 * 3.14/180 
    new_pos[2] = 45 * 3.14/180
    new_pos[3] = -90 * 3.14/180
    new_pos[4] = -90* 3.14/180
    new_pos[5] = -90 * 3.14/180 # gripper
    movej(new_pos, a=1.0, v=0.5)  
    
    #D   
    #new_pos[0] = -90 * 3.14/180   
    #new_pos[1] = -45* 3.14/180
    #new_pos[2] = 45 * 3.14/180 
    #new_pos[3] = -90 * 3.14/180 #
    #new_pos[4] = -90 * 3.14/180   
    #new_pos[5] = -90 * 3.14/180   
    #movej(new_pos, a=1.0, v=2)
    
    #E  
    #new_pos[0] = -60 * 3.14/180   #
    #new_pos[1] = -45* 3.14/180
    #new_pos[2] = 45 * 3.14/180 
    #new_pos[3] = -90 * 3.14/180 
    #new_pos[4] = -90 * 3.14/180   
    #new_pos[5] = -60 * 3.14/180   
    #movej(new_pos, a=1.0, v=2) #

      
  end`;
  CALL_ROBOT_TANGO_TO_DROP = "\n  ROBOT_TANGO_TO_DROP()";

  ROBOT_TANGO_TO_MID = `
  def ROBOT_TANGO_TO_MID():

    current = get_actual_joint_positions()
    new_pos = current

    #A
    new_pos[0] = -45 * 3.14/180 
    new_pos[1] = -30* 3.14/180
    new_pos[2] = -120 * 3.14/180
    new_pos[3] = 90 * 3.14/180
    new_pos[4] = -90 * 3.14/180
    new_pos[5] = 0 * 3.14/180 
    movej(new_pos, a=0.5, v=2) 

    ROBOT_MOVE_SAFE_MID() # START AT SAFE HOME

       
  end`;
  CALL_ROBOT_TANGO_TO_MID = "\n  ROBOT_TANGO_TO_MID()";

  // // // // // // // // // // // // // // // // // // 
  // // // // // // // // // // // // // // // // // // 
  // // // // // // // // // // // // // // // // // // 

  ROBOTFUNCTIONS = `
# ______________________________________________ 
#                            UR ROBOT FUNCTIONS 
#                                COPYRIGHT@RAYS 
# ______________________________________________ 
#                          START OF DEFINITIONS 
# _____________________________________________ 
#                                     UTILITIES 
${SLEEP}
# _____________________________________________ 
#                               MOVES TRANSPOSE 
${MOVE_IN}
${MOVE_OUT}
${MOVE_UP}
${MOVE_DOWN}
${MOVE_LEFT}
${MOVE_RIGHT}
${MOVE_DIAG}
# _____________________________________________ 
#                       MOVES TO DROP POSITIONS 
#                         FULL RELEASE SEQUENCE
${ROBOT_DROP1_RELEASE_SEQUENCE}
${ROBOT_DROP2_RELEASE_SEQUENCE}
${ROBOT_DROP_RELEASE_SEQUENCE}
${ROBOT_MOVE_DROP1_SEQUENCE}
${ROBOT_MOVE_DROP2_SEQUENCE}
# _____________________________________________ 
#                       MOVES TO SAFE POSITIONS
${ROBOT_MOVE_SAFE_MID}
${ROBOT_MOVE_SAFE_LEFT}
${ROBOT_MOVE_SAFE_RIGHT}
${ROBOT_MOVE_PRESENT_CAR}
# _____________________________________________ 
#                                         TANGO
${ROBOT_TANGO_TO_DROP}
${ROBOT_TANGO_TO_MID}
# _____________________________________________ 
#                                    PICK MOVES 
${PICK_MOVE_IN}
${PICK_MOVE_OUT}
${PICK_MOVE_UP}
# _____________________________________________ 
#                                       GRIPPER 
${G_SET_SETTINGS}
${G_ACTIVATE}
${G_CLOSE_LOW}
${G_CLOSE_MID}
${G_CLOSE_HIGH}
${G_CLOSE_CASSETTE}
${G_OPEN_FULL}
# _____________________________________________ 
#                             GRIPPER ROTATIONS
${G_POINTIN}
${G_POINTOUT}
${G_PICKANGLE}
${G_HORIZONTAL}
${G_LOOK_LEFT}
${G_LOOK_RIGHT}
# _____________________________________________ 
#                                 COMMUNICATION 
${SENDREPLY}
${WAITFORCOMPLETION}
# _____________________________________________ 
#                          CALIBRATION SETTINGS 
# calibrationAngleDEG: ${calibrationAngleDEG}[deg]
# calibrationAngleRAD: ${calibrationAngleRAD}[rad]
# homeX: ${homeX}[mm]
# homeY: ${homeY}[mm]
# PICK_HOVER_Z: ${PICK_HOVER_Z}[m]
# PICK_MOVE_IN_DISTANCE: ${PICK_MOVE_IN_DISTANCE}[m]
# PICK_MOVE_UP_DISTANCE: ${PICK_MOVE_UP_DISTANCE}[m]
# PICK_MOVE_OUT_DISTANCE: ${PICK_MOVE_OUT_DISTANCE}[m]
# PICK_ANGLEDEG: ${PICK_ANGLEDEG}[deg]
# _____________________________________________ 
#                                 CALL COMMANDS 
# _____________________________________________ 
`;
}
// // // // // // // // // // // // // // // // // // 
// // // // // // // // // // // // // // // // // // 
// // // // // // // // // // // // // // // // // // 

calculateCalibration();


function CALIBRATION_ANGLE_PLUS(delta) {
  calibrationAngleDEG = calibrationAngleDEG + delta;
  calibrationAngleRAD = calibrationAngleDEG * Math.PI / 180;
  logger.info("calibrationAngleDEG PLUS to:" + calibrationAngleDEG);
  //let calibrationAngleRADNEW = calibrationAngleDEG * Math.PI / 180;
  calculateCalibration();
}


function CALIBRATION_ANGLE_MINUS(delta) {
  calibrationAngleDEG = calibrationAngleDEG - delta;
  calibrationAngleRAD = calibrationAngleDEG * Math.PI / 180;
  logger.info("calibrationAngleDEG MINUS to:" + calibrationAngleDEG);
  //let calibrationAngleRADNEW = calibrationAngleDEG * Math.PI / 180;
  calculateCalibration();
}


module.exports = {
  // functions
  calculateCalibration,
  CALIBRATION_ANGLE_PLUS,
  CALIBRATION_ANGLE_MINUS,

  CALL_SLEEP,

  CALL_ROBOT_MOVE_SAFE_LEFT,
  CALL_ROBOT_MOVE_SAFE_RIGHT,
  CALL_ROBOT_MOVE_SAFE_MID,
  CALL_ROBOT_MOVE_PRESENT_CAR,
  CALL_ROBOT_TANGO_TO_DROP,
  CALL_ROBOT_TANGO_TO_MID,

  PICK_HOVER_Z,

  CALL_ROBOT_MOVE_DROP1_SEQUENCE,
  CALL_ROBOT_MOVE_DROP2_SEQUENCE,

  CALL_PICKOUT_CAR_SMALL,
  CALL_ROBOT_MOVE_OUT,
  CALL_ROBOT_MOVE_IN,

  CALL_G_ACTIVATE,
  CALL_G_CLOSE_LOW,
  CALL_G_CLOSE_MID,
  CALL_G_CLOSE_HIGH,
  CALL_G_CLOSE_CASSETTE,
  CALL_G_OPEN_FULL,
  CALL_G_LOOK_LEFT,
  CALL_G_LOOK_RIGHT,
  CALL_G_PICKANGLE,
  CALL_G_HORIZONTAL,

  CALL_WAITFORCOMPLETION,

  CALL_MOVE_LEFT,
  CALL_MOVE_RIGHT,
  CALL_MOVE_UP,
  CALL_MOVE_DOWN,
  CALL_MOVE_DIAG,

  // getters
  get ROBOTFUNCTIONS() { return ROBOTFUNCTIONS; },
  get deltaX() { return deltaX; },
  get deltaY() { return deltaY; },
  get homeX() { return homeX; },
  get homeY() { return homeY; },
  get calibrationAngleDEG() { return calibrationAngleDEG; },
  get calibrationAngleRAD() { return calibrationAngleRAD; },

  // constants
  cassettesZ,
  safetyZOffset,

  robot_avr,
  robot_avr_slow,

}
