#!/usr/bin/env python3

"""
Raspberry Pi Update System Tester

This script tests the remote update functionality by:
1. Backing up the current Pi server code
2. Injecting a debug function with timestamp
3. Sending the updated code to Pi via file_update command
4. Testing that the debug function works
5. Restoring the original code

Usage: python test_raspi_update_system.py [pi_host] [pi_port]
"""

import socket
import json
import time
import shutil
import os
import sys
from datetime import datetime

class RaspberryPiUpdateTester:
    def __init__(self, pi_host='localhost', pi_port=3000):
        self.pi_host = pi_host
        self.pi_port = pi_port
        self.test_timestamp = int(time.time() * 1000)  # Millisecond precision
        self.original_file = 'devices_rasp/raspi_tcp_server_with_updates.py'
        self.backup_file = f'{self.original_file}.test_backup_{self.test_timestamp}'
        self.socket = None
        
        print(f"🧪 Raspberry Pi Update System Tester")
        print(f"📍 Target: {pi_host}:{pi_port}")
        print(f"⏰ Test Timestamp: {self.test_timestamp}")
        print("=" * 50)
    
    def connect_to_pi(self):
        """Establish TCP connection to Raspberry Pi"""
        try:
            print(f"🔗 Connecting to Pi at {self.pi_host}:{self.pi_port}...")
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(10.0)
            self.socket.connect((self.pi_host, self.pi_port))
            print("✅ Connected to Raspberry Pi!")
            return True
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False
    
    def send_command(self, command):
        """Send JSON command to Pi and get response"""
        try:
            command_str = json.dumps(command) + '\n'
            self.socket.send(command_str.encode('utf-8'))
            
            # Read response
            response_data = ""
            while '\n' not in response_data:
                chunk = self.socket.recv(1024).decode('utf-8')
                if not chunk:
                    break
                response_data += chunk
            
            response_line = response_data.split('\n')[0]
            return json.loads(response_line)
        except Exception as e:
            print(f"❌ Command failed: {e}")
            return None
    
    def backup_original_code(self):
        """Create backup of original Pi code"""
        try:
            if not os.path.exists(self.original_file):
                print(f"❌ Original file not found: {self.original_file}")
                return False
            
            shutil.copy2(self.original_file, self.backup_file)
            print(f"💾 Backed up original code to: {self.backup_file}")
            return True
        except Exception as e:
            print(f"❌ Backup failed: {e}")
            return False
    
    def inject_debug_function(self):
        """Inject debug function into Pi code and return modified content"""
        try:
            with open(self.original_file, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            # Create debug command as a single line to avoid indentation issues
            debug_command_code = f'        elif command == \'debug_test\': return {{"type": "debug_test_response", "test_timestamp": {self.test_timestamp}, "server_timestamp": time.time(), "message": "Debug function working correctly!", "injected_at": "{datetime.now().isoformat()}", "device": "RaspberryPi"}}'
            
            # Find a safer insertion point - look for the exact line before the else
            # Split content into lines to work with exact line positioning
            lines = original_content.split('\n')
            
            # Find the line with the final else statement
            else_line_index = -1
            for i, line in enumerate(lines):
                if line.strip() == 'else:' and 'return {' in lines[i+1] and '"type": "error"' in lines[i+2]:
                    else_line_index = i
                    break
            
            if else_line_index == -1:
                print("❌ Could not find final else statement")
                return None
            
            # Insert our debug command right before the else line
            lines.insert(else_line_index, debug_command_code)
            modified_content = '\n'.join(lines)
            
            # Also add debug_test to available_commands list
            modified_content = modified_content.replace(
                '"backup_code", "list_backups", "restore_backup", "safe_update_test", "get_rollback_log"',
                '"backup_code", "list_backups", "restore_backup", "safe_update_test", "get_rollback_log", "debug_test"'
            )
            
            # Verify the injection worked
            if 'debug_test' in modified_content:
                print(f"🔧 Injected debug function with timestamp {self.test_timestamp}")
                # Show the exact injected code for debugging
                new_lines = modified_content.split('\n')
                print(f"📝 Injected code preview:")
                print("=" * 40)
                # Show lines around the injection point
                start_line = max(0, else_line_index - 2)
                end_line = min(len(new_lines), else_line_index + 6)
                for i in range(start_line, end_line):
                    marker = ">>>" if i == else_line_index else "   "
                    print(f"{marker} {i+1:3}: '{new_lines[i]}'")
                print("=" * 40)
            else:
                print("❌ Debug function injection verification failed")
                return None
            
            return modified_content
            
        except Exception as e:
            print(f"❌ Code injection failed: {e}")
            return None
    
    def update_pi_code(self, new_content):
        """Send updated code to Pi via file_update command"""
        try:
            print("📤 Sending updated code to Raspberry Pi...")
            
            # Try to detect the actual running filename from the Pi's working directory
            # Common names: listener.py, raspi_tcp_server.py, raspi_tcp_server_with_updates.py
            possible_filenames = [
                "listener.py",  # Most likely based on your directory structure
                "raspi_tcp_server_with_updates.py",
                "raspi_tcp_server.py"
            ]
            
            # For now, let's use listener.py since that matches your directory structure
            target_filename = "listener.py"
            
            update_command = {
                "command": "file_update",
                "filename": target_filename,
                "content": new_content,
                "backup": True,
                "safe_mode": False  # Disable validation for test injection (original code has os.system calls)
            }
            
            response = self.send_command(update_command)
            
            if response and response.get('type') == 'file_update_success':
                print("✅ Code updated successfully on Pi!")
                print(f"   Path: {response.get('path')}")
                
                # Wait for automatic restart
                print("⏳ Waiting for Pi to restart...")
                time.sleep(3)
                
                # Reconnect after restart
                self.socket.close()
                time.sleep(2)
                return self.connect_to_pi()
            else:
                print(f"❌ Update failed: {response}")
                return False
                
        except Exception as e:
            print(f"❌ Update send failed: {e}")
            return False
    
    def test_debug_function(self):
        """Test that our injected debug function works"""
        try:
            print(f"🧪 Testing debug function with timestamp {self.test_timestamp}...")
            
            test_command = {"command": "debug_test"}
            response = self.send_command(test_command)
            
            if not response:
                print("❌ No response from debug test")
                return False
            
            print(f"📥 Response: {json.dumps(response, indent=2)}")
            
            # Verify the response contains our test timestamp
            if (response.get('type') == 'debug_test_response' and 
                response.get('test_timestamp') == self.test_timestamp):
                print("✅ Debug function test PASSED!")
                print(f"   ✓ Correct timestamp: {self.test_timestamp}")
                print(f"   ✓ Server time: {response.get('server_timestamp')}")
                print(f"   ✓ Message: {response.get('message')}")
                return True
            else:
                print("❌ Debug function test FAILED!")
                print(f"   Expected timestamp: {self.test_timestamp}")
                print(f"   Received timestamp: {response.get('test_timestamp')}")
                return False
                
        except Exception as e:
            print(f"❌ Debug test failed: {e}")
            return False
    
    def restore_original_code(self):
        """Restore original code from backup"""
        try:
            print("🔄 Restoring original code...")
            
            # Read the backup file
            with open(self.backup_file, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            # Send restore command (use same filename as update, disable safe_mode for restore)
            restore_command = {
                "command": "file_update",
                "filename": "listener.py",  # Must match the update filename
                "content": original_content,
                "backup": False,
                "safe_mode": False  # Disable validation for restore (original code is trusted)
            }
            
            response = self.send_command(restore_command)
            
            if response and response.get('type') == 'file_update_success':
                print("✅ Original code restored successfully!")
                
                # Wait for restart
                print("⏳ Waiting for final restart...")
                time.sleep(3)
                return True
            else:
                print(f"❌ Restore failed: {response}")
                return False
                
        except Exception as e:
            print(f"❌ Restore failed: {e}")
            return False
    
    def cleanup(self):
        """Clean up test files and connections"""
        if self.socket:
            self.socket.close()
        
        # Optionally remove backup file
        try:
            if os.path.exists(self.backup_file):
                os.remove(self.backup_file)
                print(f"🧹 Removed backup file: {self.backup_file}")
        except:
            pass
    
    def run_test(self):
        """Run the complete update system test"""
        success = False
        
        try:
            print("\n🚀 Starting Raspberry Pi Update System Test...")
            
            # Step 1: Backup original code
            if not self.backup_original_code():
                return False
            
            # Step 2: Connect to Pi
            if not self.connect_to_pi():
                return False
            
            # Step 3: Test initial connection
            print("🔍 Testing initial connection...")
            response = self.send_command({"command": "get_status"})
            if not response:
                print("❌ Initial connection test failed")
                return False
            print(f"✅ Pi Status: {response.get('device')} v{response.get('version')}")
            
            # Step 4: Inject debug function
            modified_code = self.inject_debug_function()
            if not modified_code:
                return False
            
            # Step 5: Update Pi code
            if not self.update_pi_code(modified_code):
                return False
            
            # Step 6: Test debug function
            if not self.test_debug_function():
                return False
            
            # Step 7: Restore original code
            if not self.restore_original_code():
                print("⚠️  Test passed but restore failed - manual intervention needed")
                return True  # Test itself was successful
            
            print("\n🎉 ALL TESTS PASSED! Update system is working correctly.")
            success = True
            return True
            
        except KeyboardInterrupt:
            print("\n⏹️  Test interrupted by user")
            return False
        except Exception as e:
            print(f"\n❌ Test failed with exception: {e}")
            return False
        finally:
            if not success:
                print("\n🔄 Attempting to restore original code...")
                try:
                    self.restore_original_code()
                except:
                    print("❌ Auto-restore failed - manual restore required")
                    print(f"   Backup available at: {self.backup_file}")
            
            self.cleanup()

def main():
    # Parse command line arguments
    pi_host = sys.argv[1] if len(sys.argv) > 1 else 'localhost'
    pi_port = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
    
    # Run the test
    tester = RaspberryPiUpdateTester(pi_host, pi_port)
    success = tester.run_test()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
