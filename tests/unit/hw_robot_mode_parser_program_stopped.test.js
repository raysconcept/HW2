const robotModule = require('../../src/server/controllers/HW_ROBOT_MODULE');

const { handleRobotModeData } = robotModule.__TEST__;

const PAYLOAD_START = 5;
const OFFSETS = {
  connected: 8,
  powerOn: 10,
  protectiveStop: 12,
  programRunning: 13
};

function createBuffer(flags) {
  const buf = Buffer.alloc(PAYLOAD_START + 20, 0);
  if (flags.connected !== undefined) {
    buf.writeUInt8(flags.connected, PAYLOAD_START + OFFSETS.connected);
  }
  if (flags.powerOn !== undefined) {
    buf.writeUInt8(flags.powerOn, PAYLOAD_START + OFFSETS.powerOn);
  }
  if (flags.protectiveStop !== undefined) {
    buf.writeUInt8(flags.protectiveStop, PAYLOAD_START + OFFSETS.protectiveStop);
  }
  if (flags.programRunning !== undefined) {
    buf.writeUInt8(flags.programRunning, PAYLOAD_START + OFFSETS.programRunning);
  }
  return buf;
}

describe('handleRobotModeData – program stopped', () => {
  beforeEach(() => {
    robotModule.robotStatus.isConnected = false;
    robotModule.robotStatus.isRobotOn = false;
    robotModule.robotStatus.isProtectiveStop = false;
    robotModule.robotStatus.isProgramRunning = false;
    robotModule.robotStatus.isAvailable = true;
  });

  test('marks robot available again when program stops', () => {
    // First mark running
    handleRobotModeData(createBuffer({
      connected: 1,
      powerOn: 1,
      protectiveStop: 0,
      programRunning: 1
    }));
    expect(robotModule.robotStatus.isAvailable).toBe(false);

    // Then stop program
    handleRobotModeData(createBuffer({
      connected: 1,
      powerOn: 1,
      protectiveStop: 0,
      programRunning: 0
    }));

    expect(robotModule.robotStatus.isProgramRunning).toBe(false);
    expect(robotModule.robotStatus.isAvailable).toBe(true);
  });
});
