const robotModule = require('../../src/server/controllers/HW_ROBOT_MODULE');

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
  res.statusCode = 200;
  res.payload = null;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.payload = body;
    return res;
  });
  res.send = jest.fn(() => res);
  return res;
};

describe('POST /HW_ROBOT_COMMAND', () => {
  test('forwards manual command to robot socket', async () => {
    const config = require('../../src/server/config/configMain.js');
    const originalHost = config.robotConfig.host;
    const originalPort = config.robotConfig.port;
    config.robotConfig.host = '127.0.0.1';
    config.robotConfig.port = 30002;

    const app = createExpressStub();

    const GLOBALS = {
      Express: app,
      SIO: {
        emit: jest.fn(),
        on: jest.fn()
      },
      ESP_FUNCTIONS: { broadcastToAllESP32: jest.fn() },
      ROBOT_HALTED: false
    };

    try {
      await robotModule.HW_ROBOT_HTTP(GLOBALS);

      const writeSpy = jest.fn((script, callback) => {
        if (callback) callback();
      });
      robotModule.robotStatus.isConnected = true;
      robotModule.__TEST__.setRobotSocket({ write: writeSpy });

      const handler = app.__posts['/HW_ROBOT_COMMAND'];
      if (!handler) throw new Error('HW_ROBOT_COMMAND route not registered');

      const res = createResponseStub();
      await handler({ body: { cmnd: 'ROBOT_STOP' } }, res);

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const [scriptSent] = writeSpy.mock.calls[0];
      expect(scriptSent).toContain('ROBOTSTOP_MANUALLY');
      expect(res.statusCode).toBe(200);
    } finally {
      config.robotConfig.host = originalHost;
      config.robotConfig.port = originalPort;
    }
  });
});
