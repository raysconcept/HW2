#!/usr/bin/env node

/**
 * ESP32 TCP Test Client
 * Simple test to verify TCP communication with ESP32
 * Usage: node test_esp_tcp.js
 */

const net = require('net');

// Configuration - update with your ESP32-ETH's IP (check Serial Monitor)
const ESP32_IP = '192.168.1.50'; // UPDATE THIS with your ESP32-ETH's actual IP
const ESP32_PORT = 3002;

console.log('ESP32 TCP Test Client');
console.log('=====================');
console.log(`Connecting to ${ESP32_IP}:${ESP32_PORT}...`);

const client = new net.Socket();

client.connect(ESP32_PORT, ESP32_IP, () => {
  console.log('✅ Connected to ESP32!');
  
  // Send test commands
  const commands = [
    { command: 'get_status' },
    { command: 'rgb_red' },
    { command: 'rgb_green' },
    { command: 'rgb_blue' },
    { command: 'rgb_white' },
    { command: 'rgb_off' },
    { command: 'led_on' },
    { command: 'led_off' }
  ];
  
  let commandIndex = 0;
  
  function sendNextCommand() {
    if (commandIndex < commands.length) {
      const cmd = commands[commandIndex];
      const jsonCommand = JSON.stringify(cmd) + '\n';
      console.log(`📤 Sending: ${jsonCommand.trim()}`);
      client.write(jsonCommand);
      commandIndex++;
      
      // Send next command after 2 seconds
      setTimeout(sendNextCommand, 2000);
    } else {
      console.log('✅ All test commands sent!');
      setTimeout(() => {
        client.destroy();
      }, 2000);
    }
  }
  
  // Start sending commands after 1 second
  setTimeout(sendNextCommand, 1000);
});

client.on('data', (data) => {
  const messages = data.toString().trim().split('\n');
  
  messages.forEach(message => {
    if (message.trim()) {
      try {
        const jsonData = JSON.parse(message);
        console.log('📥 Received:', JSON.stringify(jsonData, null, 2));
      } catch (error) {
        console.log('📥 Raw data:', message);
      }
    }
  });
});

client.on('close', () => {
  console.log('🔌 Connection closed');
});

client.on('error', (error) => {
  console.error('❌❌ Connection error:', error.message);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  client.destroy();
  process.exit(0);
}); 