const fs = require('fs');
const os = require('os');
const path = require('path');

const config = require('../../src/server/config/configMain.js');
const qrModule = require('../../src/server/controllers/HW_ORDER_QR.js');

describe('Operator QR tag generation', () => {
  const originalOperatorPath = config.vendingConfig.qrCodePathOperator;
  let tempDir;
  const createGlobalsStub = () => ({
    DB_QS: {
      Query: jest.fn().mockResolvedValue([])
    }
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-operator-'));
    config.vendingConfig.qrCodePathOperator = tempDir + path.sep;
  });

  afterEach(() => {
    config.vendingConfig.qrCodePathOperator = originalOperatorPath;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('creates operator tag QR file', async () => {
    const resultPath = await qrModule.__TEST__.HW_DB_OPERATOR_QRCREATE_TAG(createGlobalsStub());
    expect(fs.existsSync(resultPath)).toBe(true);
  });

  test('creates testpass QR file', async () => {
    const resultPath = await qrModule.__TEST__.HW_DB_OPERATOR_QRCREATE_TAG_TESTPASS(createGlobalsStub());
    expect(fs.existsSync(resultPath)).toBe(true);
  });

  test('creates freepass QR file', async () => {
    const resultPath = await qrModule.__TEST__.HW_DB_OPERATOR_QRCREATE_TAG_FREEPASS(createGlobalsStub());
    expect(fs.existsSync(resultPath)).toBe(true);
  });
});
