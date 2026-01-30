#!/usr/bin/env node

/**
 * Raspberry Pi TCP Test Client
 * Simple test to verify TCP communication with Raspberry Pi
 * Based on ESP32 test but adapted for RPi at 192.168.1.38
 * 
 * Usage: node test_raspi_tcp.js
 */

const net = require('net');

// Configuration - Raspberry Pi IP and port
const RASPI_IP = '192.168.1.38';
const RASPI_PORT = 3000;

console.log('Raspberry Pi TCP Test Client');
console.log('============================');
console.log(`Connecting to ${RASPI_IP}:${RASPI_PORT}...`);

const client = new net.Socket();

client.connect(RASPI_PORT, RASPI_IP, () => {
  console.log('✅ Connected to Raspberry Pi!');
  
  // Send test commands (similar to ESP32 but RPi-specific)
  const commands = [
    { command: 'get_status' },
    { command: 'led_on' },
    { command: 'led_off' },
    { command: 'gpio_test', pin: 18, state: 'high' },
    { command: 'gpio_test', pin: 18, state: 'low' },
    { command: 'system_info' },
    { command: 'ping', message: 'Hello from HotWheels server!' },
    { command: 'custom_action', data: 'test_data_123' }
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
        console.log('📥 Received JSON:', JSON.stringify(jsonData, null, 2));
      } catch (error) {
        console.log('📥 Raw response:', message);
      }
    }
  });
});

client.on('close', () => {
  console.log('🔌 Connection closed');
});

client.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.log('💡 Make sure the Raspberry Pi server is running on 192.168.1.38:3000');
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  client.destroy();
  process.exit(0);
});

