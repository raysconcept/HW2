const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('qrcode', () => ({
  toFile: (filePath, data, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(null);
    return Promise.resolve();
  }
}));

const config = require('../../src/server/config/configMain.js');
const qrModule = require('../../src/server/controllers/HW_ORDER_QR.js');
const { HW_DB_ORDER_QRCREATE } = qrModule.__TEST__;

describe('QR code creation – fallback insert', () => {
  const originalConfig = { ...config.vendingConfig };

  afterEach(() => {
    Object.assign(config.vendingConfig, originalConfig);
  });

  test('falls back to schema-aware insert when columns missing', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-test-'));
    const qrPath = path.join(tmpDir, 'qr');
    const qrOperatorPath = path.join(tmpDir, 'qrOperator');

    Object.assign(config.vendingConfig, {
      qrCodePath: `${qrPath}/`,
      qrCodePathOperator: `${qrOperatorPath}/`,
      qrCodeCreateNum: 1
    });

    let callIndex = 0;
    const GLOBALS = {
      DB_QS: {
        Query: jest.fn(async (sql) => {
          if (sql.startsWith('INSERT INTO hwv00_orders SET')) {
            if (callIndex === 0) {
              callIndex++;
              const error = new Error('bad field');
              error.code = 'ER_BAD_FIELD_ERROR';
              throw error;
            }
          }
          if (sql.startsWith('SHOW COLUMNS FROM hwv00_orders')) {
            return [
              { Field: 'orderQr' },
              { Field: 'orderStatus' },
              { Field: 'orderCars' }
            ];
          }
          if (sql.startsWith('SELECT * FROM hwv00_orders')) {
            return [];
          }
          return [];
        })
      }
    };

    await HW_DB_ORDER_QRCREATE(GLOBALS);

    const showColumnsCall = GLOBALS.DB_QS.Query.mock.calls.find(call => call[0].includes('SHOW COLUMNS FROM hwv00_orders'));
    expect(showColumnsCall).toBeDefined();

    const insertCalls = GLOBALS.DB_QS.Query.mock.calls.filter(call => call[0].includes('INSERT INTO hwv00_orders SET'));
    expect(insertCalls.length).toBeGreaterThan(1);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
