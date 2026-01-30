const orderProcessor = require('../../src/server/controllers/HW_ORDER_PROCESSOR');

const { countDuplicates } = orderProcessor.__TEST__;

describe('countDuplicates helper', () => {
  test('returns empty object when no duplicates exist', () => {
    expect(countDuplicates(['CAR_A', 'CAR_B', 'CAR_C'])).toEqual({});
  });

  test('counts repeated assets with required quantities', () => {
    const duplicates = countDuplicates(['CAR_A', 'CAR_B', 'CAR_A', 'CAR_A', 'CAR_B']);

    expect(duplicates).toEqual({
      CAR_A: 3,
      CAR_B: 2
    });
  });
});
