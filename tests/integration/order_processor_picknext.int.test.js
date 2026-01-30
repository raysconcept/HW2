const orderProcessor = require('../../src/server/controllers/HW_ORDER_PROCESSOR');

describe('ORDER_PROCESSOR_L_CUELINE_PICKNEXT', () => {
  afterEach(() => {
    orderProcessor.__TEST__.resetState();
  });

  test('processes an inCue order and sends robot pick script', async () => {
    const queryMock = jest.fn()
      // SELECT picking orders
      .mockResolvedValueOnce([])
      // SELECT inCue order
      .mockResolvedValueOnce([{
        orderQr: 'HWQR_TEST_001',
        orderCars: '[CAR123]',
        orderUserName: 'Alice',
        orderEmail: 'alice@example.com',
        terminal_id: '2'
      }])
      // UPDATE order to picking
      .mockResolvedValueOnce({ affectedRows: 1 })
      // SELECT car reserved
      .mockResolvedValueOnce([{ carReserved: 1 }])
      // UPDATE car reserved
      .mockResolvedValueOnce({ affectedRows: 1 })
      // SELECT cassette
      .mockResolvedValueOnce([{
        casNr: 32,
        casRow: 4,
        casColumn: 2,
        casCarAmount: 10
      }])
      // UPDATE cassette amount
      .mockResolvedValueOnce({ affectedRows: 1 });

    const calcSpy = jest.fn((GLOBALS, userOrder, casNr, casRow, casColumn, index) => {
      userOrder.cassettesId[index] = casNr;
      userOrder.cassettesX[index] = -0.5;
      userOrder.cassettesY[index] = 0.5;
      userOrder.cassettesZ[index] = 0.2;
    });
    const processOrderSpy = jest.fn();

    const GLOBALS = {
      DB_QS: { Query: queryMock },
      ROBOT_HALTED: false,
      ROBOT_MODULE: {
        robotStatus: { isConnected: true, isAvailable: true },
        HW_ROBOT_CALC_POSXY_FROM_CASNR: calcSpy,
        HW_ROBOT_PROCESS_ORDER: processOrderSpy
      }
    };

    await orderProcessor.__TEST__.ORDER_PROCESSOR_L_CUELINE_PICKNEXT(GLOBALS);

    expect(queryMock).toHaveBeenCalledTimes(7);
    expect(queryMock).toHaveBeenNthCalledWith(2,
      `SELECT * FROM hwv00_orders WHERE orderStatus = 'inCue' ORDER BY orderTimeQrScanned ASC LIMIT 1`
    );
    expect(calcSpy).toHaveBeenCalledWith(
      GLOBALS,
      expect.objectContaining({ userCars: ['CAR123'] }),
      32,
      4,
      2,
      0
    );
    expect(processOrderSpy).toHaveBeenCalledTimes(1);
    const [, processedOrder] = processOrderSpy.mock.calls[0];
    expect(processedOrder).toMatchObject({
      userCars: ['CAR123'],
      cassettesId: [32],
      cassettesX: [-0.5],
      cassettesY: [0.5],
      cassettesZ: [0.2],
      userName: 'Alice',
      userEmail: 'alice@example.com',
      userQR: 'HWQR_TEST_001',
      terminalId: '2'
    });
  });

  test('parses underscore separated car lists and still processes the order', async () => {
    const queryMock = jest.fn()
      // SELECT picking orders
      .mockResolvedValueOnce([])
      // SELECT inCue order
      .mockResolvedValueOnce([{
        orderQr: 'LEGACY_QR',
        orderCars: 'CAR1_CAR2',
        orderUserName: 'Legacy',
        orderEmail: 'legacy@example.com',
        terminal_id: '1'
      }])
      // UPDATE order to picking
      .mockResolvedValueOnce({ affectedRows: 1 })
      // Car A reservation select
      .mockResolvedValueOnce([{ carReserved: 1 }])
      // Car A reservation update
      .mockResolvedValueOnce({ affectedRows: 1 })
      // Car A cassette select
      .mockResolvedValueOnce([{
        casNr: 11,
        casRow: 1,
        casColumn: 1,
        casCarAmount: 5
      }])
      // Car A cassette update
      .mockResolvedValueOnce({ affectedRows: 1 })
      // Car B reservation select
      .mockResolvedValueOnce([{ carReserved: 2 }])
      // Car B reservation update
      .mockResolvedValueOnce({ affectedRows: 1 })
      // Car B cassette select
      .mockResolvedValueOnce([{
        casNr: 22,
        casRow: 2,
        casColumn: 3,
        casCarAmount: 8
      }])
      // Car B cassette update
      .mockResolvedValueOnce({ affectedRows: 1 });

    const calcSpy = jest.fn((GLOBALS, userOrder, casNr, casRow, casColumn, index) => {
      userOrder.cassettesId[index] = casNr;
      userOrder.cassettesX[index] = -0.4 + index;
      userOrder.cassettesY[index] = 0.4 - index;
      userOrder.cassettesZ[index] = 0.2;
    });
    const processOrderSpy = jest.fn();

    const GLOBALS = {
      DB_QS: { Query: queryMock },
      ROBOT_HALTED: false,
      ROBOT_MODULE: {
        robotStatus: { isConnected: true, isAvailable: true },
        HW_ROBOT_CALC_POSXY_FROM_CASNR: calcSpy,
        HW_ROBOT_PROCESS_ORDER: processOrderSpy
      }
    };

    await orderProcessor.__TEST__.ORDER_PROCESSOR_L_CUELINE_PICKNEXT(GLOBALS);

    expect(calcSpy).toHaveBeenCalledTimes(2);
    expect(calcSpy).toHaveBeenNthCalledWith(
      1,
      GLOBALS,
      expect.objectContaining({ userCars: ['CAR1', 'CAR2'] }),
      11,
      1,
      1,
      0
    );
    expect(calcSpy).toHaveBeenNthCalledWith(
      2,
      GLOBALS,
      expect.objectContaining({ userCars: ['CAR1', 'CAR2'] }),
      22,
      2,
      3,
      1
    );
    expect(processOrderSpy).toHaveBeenCalledTimes(1);
    const [, processedOrder] = processOrderSpy.mock.calls[0];
    expect(processedOrder).toMatchObject({
      userCars: ['CAR1', 'CAR2'],
      cassettesId: [11, 22],
      cassettesX: [-0.4, 0.6],
      cassettesY: [0.4, -0.6],
      cassettesZ: [0.2, 0.2],
      userName: 'Legacy',
      userEmail: 'legacy@example.com',
      userQR: 'LEGACY_QR',
      terminalId: '1'
    });
  });
});
