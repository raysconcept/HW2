jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: jest.fn(),
      writeFile: jest.fn()
    }
  };
});

const CONFIG_STUB = `module.exports = {\n  dropOffs: {\n    drop1Joints: [0, 0, 0, 0, 0, 0],\n    drop2Joints: [0, 0, 0, 0, 0, 0]\n  }\n};`;

const waitForAsync = () => new Promise((resolve) => setImmediate(resolve));

describe('drop-off calibration hot reload', () => {
  let robotModule;
  let mockFs;

  beforeEach(() => {
    jest.resetModules();
    mockFs = require('fs');
    mockFs.promises.readFile.mockReset().mockResolvedValue(CONFIG_STUB);
    mockFs.promises.writeFile.mockReset().mockResolvedValue();
    jest.isolateModules(() => {
      robotModule = require('../../src/server/controllers/HW_ROBOT_MODULE.js');
    });
  });

  test('saving drop1 joints rewrites config and reloads scripts', async () => {
    const reloadSpy = jest.fn();
    robotModule.__TEST__.overrideReloadRobotScripts(reloadSpy);

    robotModule.robotStatus.joints = [1, 2, 3, 4, 5, 6];

    robotModule.__TEST__.HW_ROBOT_CALIBRATION_DROP1_SAVE({});
    await waitForAsync();

    expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(1);
    const updatedContent = mockFs.promises.writeFile.mock.calls[0][1];
    expect(updatedContent).toContain('drop1Joints: [0.017, 0.035, 0.052');
    expect(reloadSpy).toHaveBeenCalled();
  });

  test('saving drop2 joints rewrites config and reloads scripts', async () => {
    const reloadSpy = jest.fn();
    robotModule.__TEST__.overrideReloadRobotScripts(reloadSpy);

    robotModule.robotStatus.joints = [10, 20, 30, 40, 50, 60];

    robotModule.__TEST__.HW_ROBOT_CALIBRATION_DROP2_SAVE({});
    await waitForAsync();

    expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(1);
    const updatedContent = mockFs.promises.writeFile.mock.calls[0][1];
    expect(updatedContent).toContain('drop2Joints: [0.175, 0.349, 0.524');
    expect(reloadSpy).toHaveBeenCalled();
  });
});
