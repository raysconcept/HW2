// Provide a stable network interface mock so configMain can resolve an IP
jest.mock('os', () => {
  const actualOs = jest.requireActual('os');
  return {
    ...actualOs,
    networkInterfaces: jest.fn(() => ({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      eth0: [{ address: '192.168.0.10', family: 'IPv4', internal: false }]
    }))
  };
});
