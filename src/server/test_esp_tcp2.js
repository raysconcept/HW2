#!/usr/bin/env node

const net = require('net');

const SERVER_PORT = 3002;
const SERVER_HOST = '0.0.0.0'; // Listen on all interfaces

console.log('ESP32 TCP Test Server');
console.log('=====================');
console.log(`Waiting for ESP32 to connect on port ${SERVER_PORT}...`);

const server = net.createServer();

server.on('connection', (client) => {
  console.log('✅ ESP32 Connected!');
  
  client.on('data', (data) => {
    const messages = data.toString().trim().split('\n');
    messages.forEach(message => {
      if (message.trim()) {
        console.log('📥 Received:', message);
      }
    });
  });

  client.on('close', () => {
    console.log('🔌 ESP32 disconnected');
  });

  client.on('error', (error) => {
    console.error('❌ Client error:', error.message);
  });

  // Send test commands to ESP32
  const commands = [
    { "action": "getStatus", "message": "" },
    { "action": "new_led_effect", "message": "LED_WHEEL_GREEN" },
    { "action": "new_led_effect", "message": "LED_WHEEL_RED" }
  ];

  let commandIndex = 0;
  
  function sendNextCommand() {
    if (commandIndex < commands.length) {
      const jsonCommand = JSON.stringify(commands[commandIndex]) + '\n';
      console.log(`📤 Sending: ${jsonCommand.trim()}`);
      client.write(jsonCommand);
      commandIndex++;
      
      setTimeout(sendNextCommand, 2000);
    }
  }
  
  setTimeout(sendNextCommand, 1000);
});

server.listen(SERVER_PORT, SERVER_HOST, () => {
  console.log(`Server listening on ${SERVER_HOST}:${SERVER_PORT}`);
  console.log('Make sure your ESP32 is trying to connect to this computer\'s IP');
});

process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  server.close();
  process.exit(0);
});