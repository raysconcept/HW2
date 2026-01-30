#!/usr/bin/env python3

"""
Enhanced Raspberry Pi TCP Server with Remote Code Update Capabilities
Extended version of the original raspi_tcp_server.py with update commands
"""

import socket
import json
import threading
import time
import sys
import os
import subprocess
import shutil
import signal
from datetime import datetime

# Try to import RPi.GPIO, fall back to mock if not available
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
    print("🔌 RPi.GPIO imported successfully")
except ImportError:
    print("⚠️  RPi.GPIO not available - running in simulation mode")
    GPIO_AVAILABLE = False

class HotWheelsRaspberryPiWithUpdates:
    def __init__(self, host='0.0.0.0', port=3000):
        self.host = host
        self.port = port
        self.server_socket = None
        self.led_pin = 18
        self.led_state = False
        self.start_time = time.time()
        self.repo_path = os.path.dirname(os.path.abspath(__file__))
        
        # Initialize GPIO if available
        if GPIO_AVAILABLE:
            self.setup_gpio()
        
        print(f"🍓 HotWheels Raspberry Pi Server v2.0 (With Safe Updates)")
        print(f"📍 IP: {host}:{port}")
        print(f"⚡ GPIO Available: {GPIO_AVAILABLE}")
        print(f"📁 Repo Path: {self.repo_path}")
        
        # Check for startup recovery after code updates
        recovery_status = self.check_startup_recovery()
        if recovery_status:
            print(f"🔄 Recovery Status: {recovery_status['recovery_status']}")
        
        print("=" * 50)
    
    def setup_gpio(self):
        """Initialize GPIO pins"""
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.led_pin, GPIO.OUT)
            GPIO.output(self.led_pin, GPIO.LOW)
            print(f"💡 GPIO {self.led_pin} configured as output")
        except Exception as e:
            print(f"❌ GPIO setup error: {e}")
    
    def start_server(self):
        """Start the TCP server"""
        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(5)
            
            print(f"🚀 Server listening on {self.host}:{self.port}")
            print("🔗 Waiting for HotWheels server connection...")
            
            while True:
                try:
                    client_socket, client_address = self.server_socket.accept()
                    print(f"🔗 New connection from {client_address[0]}:{client_address[1]}")
                    
                    client_thread = threading.Thread(
                        target=self.handle_client,
                        args=(client_socket, client_address)
                    )
                    client_thread.daemon = True
                    client_thread.start()
                    
                except Exception as e:
                    print(f"❌ Accept error: {e}")
                    
        except Exception as e:
            print(f"❌ Server start error: {e}")
            sys.exit(1)
    
    def handle_client(self, client_socket, client_address):
        """Handle individual client connection"""
        buffer = ""
        client_start_time = time.time()
        
        try:
            while True:
                client_socket.settimeout(30.0)
                
                try:
                    data = client_socket.recv(1024)
                    if not data:
                        break
                    
                    buffer += data.decode('utf-8')
                    
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        if line.strip():
                            self.process_command(line.strip(), client_socket)
                            
                except socket.timeout:
                    print(f"⏰ Client {client_address[0]} timeout")
                    break
                except Exception as e:
                    print(f"❌ Client handling error: {e}")
                    break
                    
        finally:
            client_socket.close()
            connection_duration = time.time() - client_start_time
            print(f"🔌 Client {client_address[0]} disconnected (duration: {connection_duration:.1f}s)")
    
    def process_command(self, json_str, client_socket):
        """Process incoming JSON command"""
        try:
            command_data = json.loads(json_str)
            command = command_data.get('command', '').lower()
            
            print(f"📥 Command: {json_str}")
            
            response = self.execute_command(command_data)
            
            response_str = json.dumps(response) + '\n'
            client_socket.send(response_str.encode('utf-8'))
            
            print(f"📤 Response: {json.dumps(response)}")
            
        except json.JSONDecodeError as e:
            error_response = {
                "type": "error",
                "message": f"Invalid JSON: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
            client_socket.send((json.dumps(error_response) + '\n').encode('utf-8'))
            print(f"❌ JSON Error: {e}")
            
        except Exception as e:
            error_response = {
                "type": "error", 
                "message": f"Command processing error: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
            client_socket.send((json.dumps(error_response) + '\n').encode('utf-8'))
            print(f"❌ Processing Error: {e}")
    
    def execute_command(self, command_data):
        """Execute specific commands including update commands"""
        command = command_data.get('command', '').lower()
        
        # Original commands
        if command == 'get_status':
            return self.get_status()
        elif command == 'led_on':
            return self.set_led(True)
        elif command == 'led_off':
            return self.set_led(False)
        elif command == 'gpio_test':
            pin = command_data.get('pin', self.led_pin)
            state = command_data.get('state', 'low')
            return self.gpio_control(pin, state)
        elif command == 'system_info':
            return self.get_system_info()
        elif command == 'ping':
            message = command_data.get('message', 'pong')
            return {
                "type": "ping_response",
                "message": f"Received: {message}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
        
        # NEW UPDATE COMMANDS
        elif command == 'git_update':
            result = self.git_update()
            # Auto-restart if update successful
            if result.get('type') == 'git_update_success':
                threading.Timer(2.0, lambda: self.restart_service()).start()
            return result
        elif command == 'file_update':
            result = self.file_update(command_data)
            # Auto-restart if this file was updated
            if result.get('restart_recommended'):
                threading.Timer(2.0, lambda: self.restart_service()).start()
            return result
        elif command == 'download_update':
            result = self.download_update(command_data)
            # Auto-restart if main file was updated
            if result.get('restart_recommended'):
                threading.Timer(2.0, lambda: self.restart_service()).start()
            return result
        elif command == 'restart_service':
            return self.restart_service()
        elif command == 'backup_code':
            return self.backup_current_code()
        elif command == 'list_backups':
            return self.list_backups()
        elif command == 'restore_backup':
            result = self.restore_backup(command_data)
            # Auto-restart after restore
            if result.get('type') == 'restore_success':
                threading.Timer(2.0, lambda: self.restart_service()).start()
            return result
        elif command == 'safe_update_test':
            # Test the safe update system with invalid code
            return self.test_safe_update_system()
        elif command == 'get_rollback_log':
            return self.get_rollback_log()
        
        else:
            return {
                "type": "error",
                "message": f"Unknown command: {command}",
                "available_commands": [
                    "get_status", "led_on", "led_off", "gpio_test", "system_info", "ping",
                    "git_update", "file_update", "download_update", "restart_service",
                    "backup_code", "list_backups", "restore_backup", "safe_update_test", "get_rollback_log"
                ],
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    # ==============================================
    # UPDATE METHODS
    # ==============================================
    
    def validate_python_code(self, content, filename):
        """Validate Python code for syntax and basic import issues"""
        try:
            # Basic syntax check
            try:
                compile(content, filename, 'exec')
            except SyntaxError as e:
                return {
                    'valid': False,
                    'error': f"Syntax Error: {str(e)}",
                    'line': getattr(e, 'lineno', None),
                    'type': 'syntax_error'
                }
            except Exception as e:
                return {
                    'valid': False,
                    'error': f"Compilation Error: {str(e)}",
                    'type': 'compilation_error'
                }
            
            # Check for dangerous imports or patterns
            dangerous_patterns = [
                'os.system(',
                'subprocess.call(',
                'exec(',
                'eval(',
                '__import__(',
                'rm -rf',
                'del /'
            ]
            
            for pattern in dangerous_patterns:
                if pattern in content:
                    return {
                        'valid': False,
                        'error': f"Potentially dangerous code detected: {pattern}",
                        'type': 'security_warning'
                    }
            
            # Try basic import test for required modules
            required_imports = ['socket', 'json', 'threading', 'time', 'sys', 'os']
            for module in required_imports:
                if f"import {module}" in content or f"from {module}" in content:
                    try:
                        __import__(module)
                    except ImportError as e:
                        return {
                            'valid': False,
                            'error': f"Required module '{module}' not available: {str(e)}",
                            'type': 'import_error'
                        }
            
            return {
                'valid': True,
                'message': 'Code validation passed all checks',
                'checks_performed': ['syntax', 'security', 'imports']
            }
            
        except Exception as e:
            return {
                'valid': False,
                'error': f"Validation system error: {str(e)}",
                'type': 'validation_error'
            }
    
    def check_startup_recovery(self):
        """Check if we need to recover from a failed update"""
        try:
            status_file = os.path.join(self.repo_path, '.update_status')
            if not os.path.exists(status_file):
                return None  # No pending updates
                
            with open(status_file, 'r') as f:
                update_info = json.load(f)
            
            # Check if this is a fresh restart after an update
            if update_info.get('status') == 'pending_restart':
                # Update the status to mark that we started successfully
                update_info['status'] = 'startup_success'
                update_info['startup_time'] = time.time()
                
                with open(status_file, 'w') as f:
                    json.dump(update_info, f)
                
                print("✅ Startup successful after code update")
                return {
                    'recovery_status': 'startup_success',
                    'update_info': update_info
                }
            
            return None
            
        except Exception as e:
            print(f"⚠️  Startup recovery check failed: {e}")
            return None
    
    def emergency_rollback(self, reason="Unknown error"):
        """Emergency rollback to last known good version"""
        try:
            current_file = __file__
            backup_file = f"{current_file}.last_known_good"
            
            if os.path.exists(backup_file):
                print(f"🚨 EMERGENCY ROLLBACK: {reason}")
                shutil.copy2(backup_file, current_file)
                
                # Log the rollback
                rollback_log = {
                    'timestamp': time.time(),
                    'reason': reason,
                    'rolled_back_from': current_file,
                    'restored_from': backup_file
                }
                
                log_file = os.path.join(self.repo_path, '.rollback_log.json')
                with open(log_file, 'w') as f:
                    json.dump(rollback_log, f)
                
                print("🔄 Rollback complete - restarting...")
                # Restart with the good version
                os.execv(sys.executable, [sys.executable] + sys.argv)
            else:
                print(f"❌ No backup available for emergency rollback: {backup_file}")
                
        except Exception as e:
            print(f"💥 CRITICAL: Emergency rollback failed: {e}")
            # Last resort - try to keep running with current code
    
    def test_safe_update_system(self):
        """Test the safe update system with intentionally broken code"""
        try:
            broken_code = '''# This is intentionally broken code for testing
import socket
import json

def broken_function(:  # Syntax error: missing parameter name
    print("This will not compile")
    return undefined_variable  # NameError

class BrokenClass
    # Missing colon after class definition
    pass
'''
            
            # Test the validation system
            validation_result = self.validate_python_code(broken_code, "test_broken.py")
            
            return {
                "type": "safe_update_test_result",
                "message": "Safe update system test completed",
                "validation_result": validation_result,
                "test_passed": not validation_result['valid'],  # Should fail validation
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
            
        except Exception as e:
            return {
                "type": "safe_update_test_error",
                "message": f"Test error: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    def get_rollback_log(self):
        """Get the rollback log if it exists"""
        try:
            log_file = os.path.join(self.repo_path, '.rollback_log.json')
            
            if not os.path.exists(log_file):
                return {
                    "type": "rollback_log",
                    "message": "No rollback log found",
                    "log_exists": False,
                    "timestamp": time.time(),
                    "device": "RaspberryPi"
                }
            
            with open(log_file, 'r') as f:
                rollback_data = json.load(f)
            
            return {
                "type": "rollback_log",
                "message": "Rollback log retrieved successfully",
                "log_exists": True,
                "rollback_data": rollback_data,
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
            
        except Exception as e:
            return {
                "type": "rollback_log_error",
                "message": f"Error reading rollback log: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    def git_update(self):
        """Pull latest code from Git repository"""
        try:
            os.chdir(self.repo_path)
            
            # Check git status
            result = subprocess.run(['git', 'status', '--porcelain'], 
                                  capture_output=True, text=True)
            
            if result.stdout.strip():
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                subprocess.run(['git', 'stash', 'push', '-m', f'auto_backup_{timestamp}'])
            
            # Pull latest changes
            pull_result = subprocess.run(['git', 'pull', 'origin', 'main'], 
                                       capture_output=True, text=True)
            
            if pull_result.returncode == 0:
                return {
                    "type": "git_update_success",
                    "message": "Code updated from Git successfully",
                    "output": pull_result.stdout,
                    "restart_recommended": True,
                    "timestamp": time.time(),
                    "device": "RaspberryPi"
                }
            else:
                return {
                    "type": "git_update_error",
                    "message": "Git pull failed",
                    "error": pull_result.stderr,
                    "timestamp": time.time(),
                    "device": "RaspberryPi"
                }
                
        except Exception as e:
            return {
                "type": "git_update_error",
                "message": f"Git update error: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    def file_update(self, command_data):
        """Safe update a specific file with validation and rollback"""
        try:
            filename = command_data.get('filename', '')
            content = command_data.get('content', '')
            create_backup = command_data.get('backup', True)
            safe_mode = command_data.get('safe_mode', True)  # New: enable safety checks
            
            if not filename or not content:
                return {
                    "type": "file_update_error",
                    "message": "Filename and content are required",
                    "timestamp": time.time(),
                    "device": "RaspberryPi"
                }
            
            target_path = os.path.join(self.repo_path, filename)
            
            # === SAFETY CHECKS ===
            if safe_mode and filename.endswith('.py'):
                validation_result = self.validate_python_code(content, filename)
                if not validation_result['valid']:
                    return {
                        "type": "file_update_error",
                        "message": f"Code validation failed: {validation_result['error']}",
                        "validation_details": validation_result,
                        "timestamp": time.time(),
                        "device": "RaspberryPi"
                    }
            
            # === BACKUP SYSTEM ===
            backup_name = None
            if create_backup and os.path.exists(target_path):
                backup_name = f"{target_path}.backup_{int(time.time())}"
                shutil.copy2(target_path, backup_name)
                
                # Also create a "last_known_good" backup for emergency rollback
                good_backup = f"{target_path}.last_known_good"
                if os.path.exists(target_path):
                    shutil.copy2(target_path, good_backup)
            
            # === WRITE NEW CODE ===
            with open(target_path, 'w') as f:
                f.write(content)
            
            # Make executable if Python file
            if filename.endswith('.py'):
                os.chmod(target_path, 0o755)
            
            # === ADDITIONAL VALIDATION ===
            if safe_mode and filename.endswith('.py'):
                # Try to compile the file as a final check
                try:
                    with open(target_path, 'r') as f:
                        compile(f.read(), target_path, 'exec')
                except Exception as e:
                    # Rollback immediately if compilation fails
                    if backup_name and os.path.exists(backup_name):
                        shutil.copy2(backup_name, target_path)
                    return {
                        "type": "file_update_error", 
                        "message": f"Code compilation failed: {str(e)}",
                        "rolled_back": True,
                        "timestamp": time.time(),
                        "device": "RaspberryPi"
                    }
            
            restart_needed = filename == os.path.basename(__file__)
            
            # === CREATE UPDATE STATUS FILE ===
            # This helps detect startup failures after restart
            if restart_needed:
                status_file = os.path.join(self.repo_path, '.update_status')
                update_info = {
                    'update_time': time.time(),
                    'filename': filename,
                    'backup_file': backup_name,
                    'status': 'pending_restart'
                }
                with open(status_file, 'w') as f:
                    json.dump(update_info, f)
            
            return {
                "type": "file_update_success",
                "message": f"File {filename} updated successfully with safety checks",
                "path": target_path,
                "backup_created": backup_name,
                "validation_passed": safe_mode,
                "restart_recommended": restart_needed,
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
            
        except Exception as e:
            return {
                "type": "file_update_error",
                "message": f"File update error: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    def download_update(self, command_data):
        """Download file from URL"""
        try:
            import urllib.request
            
            url = command_data.get('url', '')
            filename = command_data.get('filename', '')
            
            if not url or not filename:
                return {
                    "type": "download_error",
                    "message": "URL and filename are required",
                    "timestamp": time.time(),
                    "device": "RaspberryPi"
                }
            
            target_path = os.path.join(self.repo_path, filename)
            
            # Backup existing file
            if os.path.exists(target_path):
                backup_path = f"{target_path}.backup_{int(time.time())}"
                shutil.copy2(target_path, backup_path)
            
            # Download
            urllib.request.urlretrieve(url, target_path)
            
            if filename.endswith('.py'):
                os.chmod(target_path, 0o755)
            
            return {
                "type": "download_success",
                "message": f"Downloaded {filename} from {url}",
                "path": target_path,
                "restart_recommended": filename == os.path.basename(__file__),
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
            
        except Exception as e:
            return {
                "type": "download_error",
                "message": f"Download error: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    def backup_current_code(self):
        """Create backup of current code"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_dir = f"{self.repo_path}_backup_{timestamp}"
            
            shutil.copytree(self.repo_path, backup_dir, 
                          ignore=shutil.ignore_patterns('*.pyc', '__pycache__', '.git'))
            
            return {
                "type": "backup_success",
                "message": f"Backup created successfully",
                "backup_path": backup_dir,
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
            
        except Exception as e:
            return {
                "type": "backup_error",
                "message": f"Backup error: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    def list_backups(self):
        """List available backups"""
        try:
            parent_dir = os.path.dirname(self.repo_path)
            backup_pattern = os.path.basename(self.repo_path) + "_backup_"
            
            backups = []
            for item in os.listdir(parent_dir):
                if item.startswith(backup_pattern):
                    backup_path = os.path.join(parent_dir, item)
                    if os.path.isdir(backup_path):
                        stat = os.stat(backup_path)
                        backups.append({
                            "name": item,
                            "path": backup_path,
                            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                            "size_mb": round(sum(os.path.getsize(os.path.join(root, f)) 
                                               for root, dirs, files in os.walk(backup_path) 
                                               for f in files) / 1024 / 1024, 2)
                        })
            
            backups.sort(key=lambda x: x['created'], reverse=True)
            
            return {
                "type": "backup_list",
                "backups": backups,
                "count": len(backups),
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
            
        except Exception as e:
            return {
                "type": "backup_list_error",
                "message": f"List backups error: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    def restore_backup(self, command_data):
        """Restore from backup"""
        try:
            backup_name = command_data.get('backup_name', '')
            
            if not backup_name:
                return {
                    "type": "restore_error",
                    "message": "backup_name is required",
                    "timestamp": time.time(),
                    "device": "RaspberryPi"
                }
            
            parent_dir = os.path.dirname(self.repo_path)
            backup_path = os.path.join(parent_dir, backup_name)
            
            if not os.path.exists(backup_path):
                return {
                    "type": "restore_error",
                    "message": f"Backup {backup_name} not found",
                    "timestamp": time.time(),
                    "device": "RaspberryPi"
                }
            
            # Create current backup before restore
            current_backup = f"{self.repo_path}_pre_restore_{int(time.time())}"
            shutil.copytree(self.repo_path, current_backup)
            
            # Remove current code
            shutil.rmtree(self.repo_path)
            
            # Restore backup
            shutil.copytree(backup_path, self.repo_path)
            
            return {
                "type": "restore_success",
                "message": f"Restored from backup {backup_name}",
                "current_backup": current_backup,
                "restart_required": True,
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
            
        except Exception as e:
            return {
                "type": "restore_error",
                "message": f"Restore error: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    def restart_service(self):
        """Restart the Python service"""
        try:
            print("🔄 Restarting service...")
            
            # Write PID file for external monitoring
            pid_file = "/tmp/hotwheels_raspi.pid"
            with open(pid_file, 'w') as f:
                f.write(str(os.getpid()))
            
            # Schedule restart in separate thread
            def delayed_restart():
                time.sleep(1)  # Give time to send response
                
                # Try different restart methods
                try:
                    # Method 1: Signal watchdog if running
                    try:
                        with open("/tmp/hotwheels_watchdog.pid", 'r') as f:
                            watchdog_pid = int(f.read().strip())
                        os.kill(watchdog_pid, signal.SIGUSR1)
                        print("📨 Sent restart signal to watchdog")
                        return
                    except:
                        pass
                    
                    # Method 2: Systemd restart
                    try:
                        result = subprocess.run(['systemctl', 'is-active', 'hotwheels-raspi'], 
                                              capture_output=True, text=True)
                        if result.returncode == 0:
                            subprocess.run(['systemctl', 'restart', 'hotwheels-raspi'])
                            print("🔄 Restarted via systemd")
                            return
                    except:
                        pass
                    
                    # Method 3: Direct restart (fallback)
                    print("🔄 Direct restart...")
                    os.execv(sys.executable, [sys.executable] + sys.argv)
                    
                except Exception as e:
                    print(f"❌ Restart failed: {e}")
            
            threading.Thread(target=delayed_restart, daemon=True).start()
            
            return {
                "type": "restart_initiated",
                "message": "Service restart initiated - will restart in 1 second",
                "restart_methods": ["watchdog_signal", "systemd", "direct_exec"],
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
            
        except Exception as e:
            return {
                "type": "restart_error",
                "message": f"Restart error: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    # ==============================================
    # ORIGINAL METHODS (unchanged)
    # ==============================================
    
    def set_led(self, state):
        """Control LED on/off"""
        self.led_state = state
        
        if GPIO_AVAILABLE:
            try:
                GPIO.output(self.led_pin, GPIO.HIGH if state else GPIO.LOW)
                status = "LED turned ON" if state else "LED turned OFF"
                print(f"💡 {status} (GPIO {self.led_pin})")
            except Exception as e:
                print(f"❌ GPIO error: {e}")
                return {
                    "type": "error",
                    "message": f"GPIO error: {str(e)}",
                    "timestamp": time.time(),
                    "device": "RaspberryPi"
                }
        else:
            status = "LED simulated ON" if state else "LED simulated OFF"
            print(f"🔄 {status} (simulation mode)")
        
        return {
            "type": "led_status",
            "value": "on" if state else "off",
            "pin": self.led_pin,
            "timestamp": time.time(),
            "device": "RaspberryPi"
        }
    
    def gpio_control(self, pin, state):
        """Generic GPIO control"""
        try:
            if GPIO_AVAILABLE:
                GPIO.setup(pin, GPIO.OUT)
                GPIO.output(pin, GPIO.HIGH if state.lower() == 'high' else GPIO.LOW)
                print(f"🔧 GPIO {pin} set to {state.upper()}")
            else:
                print(f"🔧 GPIO {pin} simulated {state.upper()}")
            
            return {
                "type": "gpio_status",
                "pin": pin,
                "state": state,
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
        except Exception as e:
            return {
                "type": "error",
                "message": f"GPIO control error: {str(e)}",
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    def get_status(self):
        """Get current device status"""
        uptime = time.time() - self.start_time
        
        return {
            "type": "status",
            "led_status": "on" if self.led_state else "off",
            "led_pin": self.led_pin,
            "device": "RaspberryPi",
            "version": "2.0_with_updates",
            "uptime_seconds": round(uptime, 1),
            "gpio_available": GPIO_AVAILABLE,
            "repo_path": self.repo_path,
            "update_features": ["git_update", "file_update", "download_update", "backup/restore"],
            "timestamp": time.time(),
            "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    
    def get_system_info(self):
        """Get system information"""
        try:
            import platform
            
            # Try to get more detailed info
            cpu_temp = "N/A"
            memory_info = "N/A"
            
            try:
                with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                    cpu_temp = f"{int(f.read()) / 1000:.1f}°C"
            except:
                pass
            
            try:
                import psutil
                memory_info = f"{psutil.virtual_memory().percent}%"
            except:
                pass
            
            return {
                "type": "system_info",
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "cpu_temperature": cpu_temp,
                "memory_usage": memory_info,
                "uptime_seconds": round(time.time() - self.start_time, 1),
                "repo_path": self.repo_path,
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
            
        except Exception as e:
            return {
                "type": "system_info",
                "platform": "RaspberryPi (limited info)",
                "error": str(e),
                "uptime_seconds": round(time.time() - self.start_time, 1),
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
    def cleanup(self):
        """Clean up GPIO and close server"""
        print("\n🛑 Shutting down server...")
        
        if GPIO_AVAILABLE:
            try:
                GPIO.cleanup()
                print("🧹 GPIO cleaned up")
            except:
                pass
        
        if self.server_socket:
            self.server_socket.close()
            print("🔌 Server socket closed")

def main():
    server = HotWheelsRaspberryPiWithUpdates()
    
    try:
        server.start_server()
    except KeyboardInterrupt:
        print("\n⏹️  Received Ctrl+C")
    except Exception as e:
        print(f"❌ Server error: {e}")
    finally:
        server.cleanup()
        print("👋 Goodbye!")

if __name__ == "__main__":
    main()
