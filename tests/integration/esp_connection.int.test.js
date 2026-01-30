const mockSockets = [];
const servers = [];

jest.mock('net', () => {
  const { EventEmitter } = require('events');

  class MockSocket extends EventEmitter {
    constructor() {
      super();
      this.write = jest.fn();
      this.setTimeout = jest.fn();
      this.destroy = jest.fn();
    }
  }

  return {
    __servers: servers,
    createServer: jest.fn((connectionHandler) => {
      const server = new EventEmitter();
      server.listen = jest.fn((port, host, cb) => {
        if (typeof host === 'function') {
          cb = host;
          host = undefined;
        }
        server.port = port;
        server.host = host;
        if (cb) cb();
      });
      server.close = jest.fn();
      server.simulateConnection = () => {
        const socket = new MockSocket();
        mockSockets.push(socket);
        connectionHandler(socket);
        server.emit('connection', socket);
        return socket;
      };
      servers.push(server);
      return server;
    })
  };
});

const espModule = require('../../src/server/controllers/HW_ESP_TCP');

describe('ESP TCP server', () => {
  beforeEach(() => {
    mockSockets.length = 0;
    servers.length = 0;
  });

  test('tracks sockets and broadcasts commands to connected ESP clients', () => {
    const GLOBALS = { ESP_SOCKETS: new Set() };

    const api = espModule.ESP_INIT(GLOBALS);

    const net = require('net');
    const server = net.__servers[0];
    expect(server).toBeDefined();
    expect(server.listen).toHaveBeenCalledWith(3002, expect.any(Function));

    const socket = server.simulateConnection();
    expect(GLOBALS.ESP_SOCKETS.has(socket)).toBe(true);
    expect(api.getConnectedCount()).toBe(1);

    api.broadcastToAllESP32('PING');
    expect(socket.write).toHaveBeenCalledWith('PING\n');

    socket.emit('close');
    expect(GLOBALS.ESP_SOCKETS.size).toBe(0);
  });
});
