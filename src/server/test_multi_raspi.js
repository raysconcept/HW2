#!/usr/bin/env node

/**
 * Test Multiple Raspberry Pi Communication
 * Demonstrates how to set up and communicate with multiple Raspberry Pi boards
 * 
 * This script tests:
 * 1. Connecting to multiple Raspberry Pis
 * 2. Sending the same command to all Pis (broadcast)
 * 3. Sending different commands to specific Pis (targeted)
 * 4. Status monitoring and connection management
 * 
 * Usage: node test_multi_raspi.js
 */

const { 
  addRaspberryPi, 
  connectToRaspberryPi, 
  sendCommandToRaspberryPi, 
  sendCommandToAllRaspberryPis, 
  getConnectionStatus 
} = require('./controllers/HW_RASPI_MULTI');

// Mock GLOBALS for testing (simulates the real server environment)
const mockGLOBALS = {
  SIO: {
    emit: (event, data) => {
      console.log(`🔄 Socket.IO Event: ${event}`);
      console.log(`   From: ${data.from}`);
      console.log(`   Action: ${data.action}`);
      if (data.message) {
        console.log(`   Message: ${JSON.stringify(data.message, null, 4)}`);
      }
      console.log('');
    }
  }
};

console.log('🍓 Multiple Raspberry Pi Communication Test');
console.log('============================================');

async function testMultiRaspberryPi() {
  try {
    console.log('📋 Step 1: Adding Raspberry Pi configurations...\n');
    
    // Add multiple Raspberry Pi boards
    // Update these IP addresses to match your actual Raspberry Pis
    addRaspberryPi('raspi_main', {
      host: '192.168.1.38',  // Update with your first Pi's IP
      port: 3000,
      name: 'Main Control Pi'
    });
    
    addRaspberryPi('raspi_secondary', {
      host: '192.168.1.39',  // Update with your second Pi's IP
      port: 3000,
      name: 'Secondary Control Pi'
    });
    
    // addRaspberryPi('raspi_sensor', {
    //   host: '192.168.1.40',  // Update with your third Pi's IP (optional)
    //   port: 3000,
    //   name: 'Sensor Monitoring Pi'
    // });

    console.log('📊 Initial Status:');
    console.log(JSON.stringify(getConnectionStatus(), null, 2));
    console.log('');

    // ================================================================================
    console.log('🔌 Step 2: Attempting connections to all Raspberry Pis...\n');
    
    const connectionPromises = [];
    const raspiIds = ['raspi_main', 'raspi_secondary'];
    
    // Try to connect to all Pis simultaneously
    raspiIds.forEach(raspiId => {
      connectionPromises.push(
        connectToRaspberryPi(raspiId, mockGLOBALS)
          .then(() => {
            console.log(`✅ ${raspiId} connected successfully`);
            return { raspiId, success: true };
          })
          .catch(error => {
            console.log(`❌ ${raspiId} failed: ${error.message}`);
            return { raspiId, success: false, error: error.message };
          })
      );
    });
    
    const connectionResults = await Promise.all(connectionPromises);
    console.log('\n📊 Connection Results:');
    connectionResults.forEach(result => {
      const status = result.success ? '✅ Connected' : '❌ Failed';
      console.log(`   ${result.raspiId}: ${status}`);
    });
    
    // Wait a moment for initial status requests to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ================================================================================
    console.log('\n📡 Step 3: Testing BROADCAST commands (same command to all Pis)...\n');
    
    console.log('📤 Broadcasting "get_status" to all connected Raspberry Pis...');
    sendCommandToAllRaspberryPis({ command: 'get_status' });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📤 Broadcasting "system_info" to all connected Raspberry Pis...');
    sendCommandToAllRaspberryPis({ command: 'system_info' });
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ================================================================================
    console.log('\n🎯 Step 4: Testing TARGETED commands (different commands to each Pi)...\n');
    
    console.log('📤 Sending LED ON to Main Pi...');
    sendCommandToRaspberryPi('raspi_main', { command: 'led_on' });
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('📤 Sending LED OFF to Secondary Pi...');
    sendCommandToRaspberryPi('raspi_secondary', { command: 'led_off' });
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // console.log('📤 Sending GPIO test to Sensor Pi...');
    // sendCommandToRaspberryPi('raspi_sensor', { command: 'gpio_test', pin: 18, state: 'high' });
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    // ================================================================================
    console.log('\n🧪 Step 5: Testing individual Pi-specific commands...\n');
    
    const specificCommands = [
      { raspiId: 'raspi_main', command: { command: 'ping', message: 'Hello from Main Controller!' } },
      { raspiId: 'raspi_secondary', command: { command: 'ping', message: 'Hello from Secondary Controller!' } }
      // { raspiId: 'raspi_sensor', command: { command: 'ping', message: 'Hello from Sensor Monitor!' } }
    ];
    
    for (const { raspiId, command } of specificCommands) {
      console.log(`📤 Sending personalized ping to ${raspiId}...`);
      sendCommandToRaspberryPi(raspiId, command);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // ================================================================================
    console.log('\n🔄 Step 6: Testing sequential command patterns...\n');
    
    console.log('📤 Testing LED sequence pattern...');
    
    // Turn all LEDs on
    console.log('   📤 All LEDs ON...');
    sendCommandToAllRaspberryPis({ command: 'led_on' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Turn LEDs off one by one
    for (const raspiId of raspiIds) {
      console.log(`   📤 Turning OFF LED on ${raspiId}...`);
      sendCommandToRaspberryPi(raspiId, { command: 'led_off' });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // ================================================================================
    console.log('\n📊 Step 7: Final status check...\n');
    
    console.log('📤 Requesting final status from all Pis...');
    sendCommandToAllRaspberryPis({ command: 'get_status' });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📊 Final Connection Status:');
    console.log(JSON.stringify(getConnectionStatus(), null, 2));

    // ================================================================================
    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Multiple Raspberry Pi configuration');
    console.log('   ✅ Simultaneous connection attempts');
    console.log('   ✅ Broadcast commands (same to all)');
    console.log('   ✅ Targeted commands (specific to each)');
    console.log('   ✅ Sequential command patterns');
    console.log('   ✅ Real-time status monitoring');
    
    console.log('\n💡 Notes:');
    console.log('   - Update IP addresses in this script to match your Raspberry Pis');
    console.log('   - Make sure raspi_tcp_server.js is running on each Pi');
    console.log('   - Check network connectivity if connections fail');
    console.log('   - Monitor the Socket.IO events above for real-time responses');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// ================================================================================
// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test interrupted by user (Ctrl+C)');
  console.log('👋 Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Test terminated');
  console.log('👋 Goodbye!');
  process.exit(0);
});

// ================================================================================
// Run the test
console.log('🚀 Starting test in 2 seconds...\n');
setTimeout(() => {
  testMultiRaspberryPi();
}, 2000);
