const robotModule = require('../../src/server/controllers/HW_ROBOT_MODULE');
const config = require('../../src/server/config/configMain.js');

const createExpressStub = () => {
  const posts = {};
  const gets = {};
  return {
    post: jest.fn((path, handler) => {
      posts[path] = handler;
    }),
    get: jest.fn((path, handler) => {
      gets[path] = handler;
    }),
    use: jest.fn(),
    __posts: posts,
    __gets: gets
  };
};

const createResponseStub = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

describe('gripper commands via /HW_ROBOT_COMMAND', () => {
  let app;
  let GLOBALS;
  let writeSpy;
  let commandHandler;

  const originalHost = config.robotConfig.host;
  const originalPort = config.robotConfig.port;

  beforeEach(async () => {
    config.robotConfig.host = '127.0.0.1';
    config.robotConfig.port = 30002;

    app = createExpressStub();

    GLOBALS = {
      Express: app,
      SIO: {
        emit: jest.fn(),
        on: jest.fn()
      },
      ESP_FUNCTIONS: { broadcastToAllESP32: jest.fn() },
      ROBOT_HALTED: false
    };

    await robotModule.HW_ROBOT_HTTP(GLOBALS);

    writeSpy = jest.fn((script, callback) => callback && callback());
    robotModule.robotStatus.isConnected = true;
    robotModule.__TEST__.setRobotSocket({ write: writeSpy });

    commandHandler = app.__posts['/HW_ROBOT_COMMAND'];
    if (!commandHandler) {
      throw new Error('HW_ROBOT_COMMAND route not registered');
    }
  });

  test('GOPEN and GCLOSE_MEDIUM produce URScript', async () => {
    const res = createResponseStub();
    await commandHandler({ body: { cmnd: 'GCLOSE_MEDIUM' } }, res);
    await commandHandler({ body: { cmnd: 'GOPEN' } }, res);

    const scripts = writeSpy.mock.calls.map(call => call[0]);
    expect(scripts.join('\n')).toContain('ROBOT_G_OPEN');
    expect(scripts.join('\n')).toContain('ROBOT_G_CLOSE_MEDIUM');
  });

  afterEach(() => {
    config.robotConfig.host = originalHost;
    config.robotConfig.port = originalPort;
  });
});
