const HOME_X_MM = -705;
const HOME_Y_MM = 725;
const CALIBRATION_ANGLE_DEG = 0;
const DELTA_X_MM = 100;
const DELTA_Y_MM = 55;
const SAFETY_Z_OFFSET_M = 0;
const PICK_HOVER_Z_M = 0.18;
const CASSETTE_ID = 32;
const CASSETTE_ROW = 4;
const CASSETTE_COLUMN = 2;
const CASSETTE_INDEX = 0;
const EXPECTED_CASSETTE_X_M = -0.505;
const EXPECTED_CASSETTE_Y_M = 0.505;
const EXPECTED_CASSETTE_Z_M = 0.17836;

jest.mock('../../src/server/controllers/HW_ROBOT_UR_SCRIPTS.js', () => ({
  deltaX: DELTA_X_MM,
  deltaY: DELTA_Y_MM,
  homeX: HOME_X_MM,
  homeY: HOME_Y_MM,
  calibrationAngleDEG: CALIBRATION_ANGLE_DEG,
  calibrationAngleRAD: CALIBRATION_ANGLE_DEG * Math.PI / 180,
  safetyZOffset: SAFETY_Z_OFFSET_M,
  PICK_HOVER_Z: PICK_HOVER_Z_M,
  cassettesZ: {}
}));

const robotModule = require('../../src/server/controllers/HW_ROBOT_MODULE');

describe('HW_ROBOT_CALC_POSXY_FROM_CASNR', () => {
  test('computes cassette position and depth offsets with fixed robot constants', () => {
    const GLOBALS = {};
    const userOrder = {
      cassettesId: [],
      cassettesX: [],
      cassettesY: [],
      cassettesZ: []
    };

    robotModule.HW_ROBOT_CALC_POSXY_FROM_CASNR(
      GLOBALS,
      userOrder,
      CASSETTE_ID,
      CASSETTE_ROW,
      CASSETTE_COLUMN,
      CASSETTE_INDEX
    );

    expect(userOrder.cassettesId[CASSETTE_INDEX]).toBe(CASSETTE_ID);
    expect(userOrder.cassettesX[CASSETTE_INDEX]).toBeCloseTo(EXPECTED_CASSETTE_X_M, 3);
    expect(userOrder.cassettesY[CASSETTE_INDEX]).toBeCloseTo(EXPECTED_CASSETTE_Y_M, 3);
    expect(userOrder.cassettesZ[CASSETTE_INDEX]).toBeCloseTo(EXPECTED_CASSETTE_Z_M, 4);
  });
});
