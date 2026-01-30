const {
    __TEST__: { HW_VENDING_L_CLIENT_QR_CHECK_VALIDITY },
} = require('../../src/server/controllers/HW_ORDER_VENDING');

const buildRes = () => {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
};

const SELECT_QR_SQL =
    'SELECT * FROM hwv00_orders WHERE orderQr = ? AND orderStatus = ?';

describe('HW_VENDING_L_CLIENT_QR_CHECK_VALIDITY', () => {
    it('marks QR as valid when a printed order is found', async () => {
        const GLOBALS = {
            DB_QS: {
                Query: jest.fn().mockResolvedValue([{ orderQr: 'QR123' }]),
            },
        };
        const req = { body: { userQR: 'QR123' } };
        const res = buildRes();

        await HW_VENDING_L_CLIENT_QR_CHECK_VALIDITY(GLOBALS, req, res);

        expect(GLOBALS.DB_QS.Query).toHaveBeenCalledWith(SELECT_QR_SQL, [
            'QR123',
            'printed',
        ]);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ valid: true });
    });

    it('marks QR as invalid when no printed order exists', async () => {
        const GLOBALS = {
            DB_QS: {
                Query: jest.fn().mockResolvedValue([]),
            },
        };
        const req = { body: { userQR: 'QR999' } };
        const res = buildRes();

        await HW_VENDING_L_CLIENT_QR_CHECK_VALIDITY(GLOBALS, req, res);

        expect(GLOBALS.DB_QS.Query).toHaveBeenCalledWith(SELECT_QR_SQL, [
            'QR999',
            'printed',
        ]);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ valid: false });
    });

    it('returns 400 when the request is missing the QR payload', async () => {
        const GLOBALS = { DB_QS: { Query: jest.fn() } };
        const req = { body: {} };
        const res = buildRes();

        await HW_VENDING_L_CLIENT_QR_CHECK_VALIDITY(GLOBALS, req, res);

        expect(GLOBALS.DB_QS.Query).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ valid: false, error: 'Missing QR code' });
    });

    it('returns 500 when the database query throws', async () => {
        const GLOBALS = {
            DB_QS: {
                Query: jest.fn().mockRejectedValue(new Error('db down')),
            },
        };
        const req = { body: { userQR: 'QRERR' } };
        const res = buildRes();

        await HW_VENDING_L_CLIENT_QR_CHECK_VALIDITY(GLOBALS, req, res);

        expect(GLOBALS.DB_QS.Query).toHaveBeenCalledWith(SELECT_QR_SQL, [
            'QRERR',
            'printed',
        ]);
        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ valid: false, error: 'Database error' });
    });
});
