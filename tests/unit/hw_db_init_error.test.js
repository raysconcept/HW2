jest.mock('mysql2', () => {
  const connect = jest.fn((callback) => {
    const error = new Error('Access denied for user');
    error.code = 'ER_ACCESS_DENIED_ERROR';
    callback(error);
  });

  return {
    createConnection: jest.fn(() => ({
      connect,
      on: jest.fn()
    }))
  };
});

const dbModule = require('../../src/server/controllers/HW_DB');

describe('HW_DB_INIT error handling', () => {
  test('rejects when MySQL connection fails', async () => {
    const GLOBALS = { SIO: { emit: jest.fn() } };

    await expect(dbModule.HW_DB_INIT(GLOBALS)).rejects.toThrow('Access denied');
    expect(GLOBALS.SIO.emit).not.toHaveBeenCalled();
  });
});
