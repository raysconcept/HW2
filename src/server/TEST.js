// tcp-server-esp32.js
const net = require('net');

const TCP_PORT = 3002;  // Different port for raw TCP
const HOST = '0.0.0.0';

console.log(`Starting RAW TCP Server for ESP32 on port ${TCP_PORT}`);

const ESPserver = net.createServer((socket) => {
  const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`✅ ESP32 connected: ${clientInfo}`);
  
  socket.on('data', (data) => {
    const message = data.toString().trim();
    console.log(`📨 TEST From ESP32: ${message}`);
    
    if (message === 'ESP32_CONNECTED') {
      console.log('🤝 ESP32 handshake received');
      // Send test commands
      setTimeout(() => socket.write('get_status\n'), 1000);
      setTimeout(() => socket.write('led_on\n'), 3000);
      setTimeout(() => socket.write('led_off\n'), 5000);
    }
  });
  
  socket.on('close', () => {
    console.log(`❌ ESP32 disconnected: ${clientInfo}`);
  });
  
  socket.on('error', (err) => {
    console.log(`⚠️ TCP Error: ${err.message}`);
  });
  
  socket.write('TCP_SERVER_READY\n');
});

ESPserver.listen(TCP_PORT, HOST, () => {
  console.log(`✅ Raw TCP server listening on ${TCP_PORT}`);
  console.log('Waiting for ESP32 connection...');
});