const robotModule = require('../../src/server/controllers/HW_ROBOT_MODULE');

describe('updateRobotStateDisplay', () => {
  test('emits Socket.IO update with latest robot status', () => {
    const emit = jest.fn();
    const GLOBALS = { SIO: { emit } };

    robotModule.robotStatus.isConnected = true;
    robotModule.robotStatus.isRobotOn = true;
    robotModule.robotStatus.isProgramRunning = false;
    robotModule.robotStatus.isProtectiveStop = false;
    robotModule.robotStatus.isAvailable = true;
    robotModule.robotStatus.joints = [10, 20, 30, 40, 50, 60];
    robotModule.robotStatus.tcpM = [0.1, 0.2, 0.3];
    robotModule.robotStatus.tcpR = [0.4, 0.5, 0.6];

    robotModule.__TEST__.updateRobotStateDisplay(GLOBALS);

    expect(emit).toHaveBeenCalledWith(
      'MFS',
      expect.stringMatching(/ROBOT_STATUS_UPDATE/)
    );
    const payload = emit.mock.calls[0][1];
    const [, , message] = payload.split('___');
    const parsed = JSON.parse(message);
    expect(parsed).toMatchObject({
      isConnected: true,
      isProgramRunning: false,
      joints: [10, 20, 30, 40, 50, 60]
    });
  });
});
