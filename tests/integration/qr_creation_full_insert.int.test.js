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

describe('QR code creation – full insert', () => {
  const originalConfig = { ...config.vendingConfig };

  afterEach(() => {
    Object.assign(config.vendingConfig, originalConfig);
  });

  test('creates QR files and inserts full record when schema matches', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-test-'));
    const qrPath = path.join(tmpDir, 'qr');
    const qrOperatorPath = path.join(tmpDir, 'qrOperator');

    Object.assign(config.vendingConfig, {
      qrCodePath: `${qrPath}/`,
      qrCodePathOperator: `${qrOperatorPath}/`,
      qrCodeCreateNum: 1
    });

    const queries = [];
    const GLOBALS = {
      DB_QS: {
        Query: jest.fn(async (sql, params) => {
          queries.push({ sql, params });
          if (sql.startsWith('SELECT * FROM hwv00_orders')) {
            return [{ orderQr: 'existing', orderStatus: 'open' }];
          }
          return [];
        })
      }
    };

    await HW_DB_ORDER_QRCREATE(GLOBALS);

    expect(fs.existsSync(qrPath)).toBe(true);
    expect(fs.existsSync(qrOperatorPath)).toBe(true);

    const insertCall = queries.find(call => call.sql.includes('INSERT INTO hwv00_orders SET'));
    expect(insertCall).toBeDefined();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
