#!/usr/bin/env python3

"""
Test Script for New Modular Raspberry Pi Client
Sends commands to test the client functionality
"""

import socket
import json
import time


class ClientTester:
    """Test the Raspberry Pi client"""
    
    def __init__(self, host='localhost', port=3000):
        self.host = host
        self.port = port
        self.socket = None
    
    def connect(self):
        """Connect to the client"""
        print(f"🔗 Connecting to {self.host}:{self.port}...")
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((self.host, self.port))
            print("✅ Connected!")
            return True
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False
    
    def send_command(self, command, **kwargs):
        """Send a command and get response"""
        try:
            # Build command
            cmd_data = {'command': command}
            cmd_data.update(kwargs)
            
            # Send
            cmd_json = json.dumps(cmd_data) + '\n'
            print(f"\n📤 Sending: {command}")
            self.socket.send(cmd_json.encode('utf-8'))
            
            # Receive response
            response = self.socket.recv(4096).decode('utf-8').strip()
            response_data = json.loads(response)
            
            print(f"📥 Response: {json.dumps(response_data, indent=2)}")
            
            return response_data
        
        except Exception as e:
            print(f"❌ Error: {e}")
            return None
    
    def run_tests(self):
        """Run a series of test commands"""
        print("\n" + "="*60)
        print("🧪 Testing Modular Raspberry Pi Client")
        print("="*60)
        
        if not self.connect():
            return False
        
        try:
            # Test 1: Ping
            print("\n--- Test 1: Ping ---")
            self.send_command('ping', message='Hello from test!')
            time.sleep(0.5)
            
            # Test 2: Get Status
            print("\n--- Test 2: Get Status ---")
            self.send_command('get_status')
            time.sleep(0.5)
            
            # Test 3: System Info
            print("\n--- Test 3: System Info ---")
            self.send_command('system_info')
            time.sleep(0.5)
            
            # Test 4: GPIO - LED On
            print("\n--- Test 4: LED On ---")
            self.send_command('led_on', pin=18)
            time.sleep(0.5)
            
            # Test 5: GPIO - LED Off
            print("\n--- Test 5: LED Off ---")
            self.send_command('led_off', pin=18)
            time.sleep(0.5)
            
            # Test 6: GPIO Status
            print("\n--- Test 6: GPIO Status ---")
            self.send_command('gpio_status')
            time.sleep(0.5)
            
            # Test 7: Handler Stats
            print("\n--- Test 7: Handler Stats ---")
            self.send_command('handler_stats')
            time.sleep(0.5)
            
            # Test 8: Update Log
            print("\n--- Test 8: Update Log ---")
            self.send_command('update_log', limit=5)
            time.sleep(0.5)
            
            # Test 9: List Backups
            print("\n--- Test 9: List Backups ---")
            self.send_command('list_backups')
            time.sleep(0.5)
            
            # Test 10: Unknown Command (should error gracefully)
            print("\n--- Test 10: Unknown Command ---")
            self.send_command('unknown_command')
            
            print("\n" + "="*60)
            print("✅ All tests completed!")
            print("="*60)
            
            return True
        
        except Exception as e:
            print(f"\n❌ Test failed: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        finally:
            if self.socket:
                self.socket.close()
                print("\n🔌 Disconnected")


def main():
    """Main entry point"""
    import sys
    
    host = 'localhost'
    port = 3000
    
    if len(sys.argv) > 1:
        host = sys.argv[1]
    
    if len(sys.argv) > 2:
        port = int(sys.argv[2])
    
    tester = ClientTester(host, port)
    success = tester.run_tests()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

