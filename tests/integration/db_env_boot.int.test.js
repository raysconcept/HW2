const path = require('path');

describe('HW_DB_INIT environment bootstrap', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  test('uses dotenv-provided environment variables when creating the connection', async () => {
    jest.resetModules();

    process.env.HW_DB_HOST = 'env-host';
    process.env.HW_DB_USER = 'env-user';
    process.env.HW_DB_PASSWORD = 'env-pass';
    process.env.HW_DB_NAME = 'env_db';
    process.env.HW_DB_NAME_DEV = 'env_db_dev';

    const queryMock = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') {
        cb = params;
        params = [];
      }
      if (sql === 'SHOW TABLES') {
        cb(null, [{ [`Tables_in_${process.env.HW_DB_NAME}`]: 'hwv00_orders' }]);
      } else if (sql === 'SELECT * FROM hwv00_machine') {
        cb(null, [{
          maxAmountCarsInCassette: 8,
          maxCarsPerOrder: 2,
          nr_drops: 2,
          nr_consoles: 1,
          robotSerialNr: 'RS-001',
          gripperType: 'ModBus',
          gripperSerialNr: 'GR-42',
          calibrationAngle: 0
        }]);
      } else {
        cb(null, []);
      }
    });

    const connectionStub = {
      connect: (cb) => cb(null),
      on: jest.fn(),
      query: queryMock,
      state: 'connected',
      threadId: 123
    };

    const createConnection = jest.fn(() => connectionStub);

    jest.doMock('mysql2', () => ({ createConnection }));

    const dbModule = require('../../src/server/controllers/HW_DB');

    const GLOBALS = {
      SIO: { emit: jest.fn() }
    };

    await dbModule.HW_DB_INIT(GLOBALS, false);

    expect(createConnection).toHaveBeenCalledWith({
      host: 'env-host',
      user: 'env-user',
      password: 'env-pass',
      database: 'env_db'
    });

    expect(GLOBALS.maxCarsPerOrder).toBe(2);
    expect(GLOBALS.SIO.emit).toHaveBeenCalledWith(
      'MFS',
      expect.stringContaining('DATABASECONFIRMCONNECT')
    );
  });
});
