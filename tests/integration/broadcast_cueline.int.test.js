const broadcasting = require('../../src/server/controllers/HW_BROADCASTING.js');

describe('HW_BROADCAST_L_CUELINE', () => {
  test('builds cue line HTML and emits via Socket.IO', async () => {
    const orders = [
      { orderUserName: 'Alice', orderCars: '["CAR123"]' },
      { orderUserName: 'Bob', orderCars: '["CAR999"]' }
    ];

    const GLOBALS = {
      DB_QS: {
        Query: jest.fn().mockResolvedValueOnce(orders)
      },
      SIO: {
        emit: jest.fn()
      }
    };

    await broadcasting.HW_BROADCAST_L_CUELINE(GLOBALS);

    expect(GLOBALS.DB_QS.Query).toHaveBeenCalledWith(
      expect.stringContaining(`ORDER BY orderTimeQrScanned ASC `)
    );
    expect(GLOBALS.SIO.emit).toHaveBeenCalledWith(
      'MFS',
      expect.stringContaining('SIO_LIST_CUELINE')
    );

    const [, , html] = GLOBALS.SIO.emit.mock.calls[0][1].split('___');
    expect(html).toContain('up next!');
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
  });

  test('falls back when orderTimeQrScanned column is missing', async () => {
    const fallbackOrders = [
      { orderUserName: 'Fallback', orderCars: '["CAR777"]' }
    ];

    const GLOBALS = {
      DB_QS: {
        Query: jest
          .fn()
          .mockRejectedValueOnce(Object.assign(new Error('bad field'), { code: 'ER_BAD_FIELD_ERROR' }))
          .mockResolvedValueOnce(fallbackOrders)
      },
      SIO: { emit: jest.fn() }
    };

    await broadcasting.HW_BROADCAST_L_CUELINE(GLOBALS);

    expect(GLOBALS.DB_QS.Query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`ORDER BY orderQr ASC `)
    );
    expect(GLOBALS.SIO.emit).toHaveBeenCalled();
  });
});
