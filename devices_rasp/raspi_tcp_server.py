#!/usr/bin/env python3

"""
Raspberry Pi TCP Server for HotWheels Communication
Listens for JSON commands on port 3000 and responds accordingly
Compatible with HotWheels ESP32 communication protocol

Usage: python3 raspi_tcp_server.py

Requirements:
    sudo apt update
    sudo apt install python3-rpi.gpio python3-pip
    pip3 install RPi.GPIO
"""

import socket
import json
import threading
import time
import sys
import os
from datetime import datetime

# Try to import RPi.GPIO, fall back to mock if not available
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
    print("🔌 RPi.GPIO imported successfully")
except ImportError:
    print("⚠️  RPi.GPIO not available - running in simulation mode")
    GPIO_AVAILABLE = False

class HotWheelsRaspberryPi:
    def __init__(self, host='0.0.0.0', port=3000):
        self.host = host
        self.port = port
        self.server_socket = None
        self.led_pin = 18  # GPIO pin for LED control
        self.led_state = False
        self.start_time = time.time()
        
        # Initialize GPIO if available
        if GPIO_AVAILABLE:
            self.setup_gpio()
        
        print(f"🍓 HotWheels Raspberry Pi Server v1.0")
        print(f"📍 IP: {host}:{port}")
        print(f"⚡ GPIO Available: {GPIO_AVAILABLE}")
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
                    
                    # Handle client in separate thread
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
                # Set timeout to avoid hanging connections
                client_socket.settimeout(30.0)
                
                try:
                    data = client_socket.recv(1024)
                    if not data:
                        break
                    
                    buffer += data.decode('utf-8')
                    
                    # Process complete messages (ending with \n)
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
            command = command_data.get('command', '')
            
            print(f"📥 Command: {json_str}")
            
            # Execute command and get response
            response = self.execute_command(command_data)
            
            # Send JSON response
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
        """Execute specific commands"""
        command = command_data.get('command', '').lower()
        
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
            
        else:
            return {
                "type": "error",
                "message": f"Unknown command: {command}",
                "available_commands": ["get_status", "led_on", "led_off", "gpio_test", "system_info", "ping"],
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
    
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
            "uptime_seconds": round(uptime, 1),
            "gpio_available": GPIO_AVAILABLE,
            "timestamp": time.time(),
            "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    
    def get_system_info(self):
        """Get system information"""
        try:
            # Get system information
            import platform
            import psutil
            
            # Get CPU temperature (RPi specific)
            cpu_temp = "N/A"
            try:
                with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                    cpu_temp = f"{int(f.read()) / 1000:.1f}°C"
            except:
                pass
            
            return {
                "type": "system_info",
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "cpu_count": psutil.cpu_count(),
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": psutil.virtual_memory().percent,
                "cpu_temperature": cpu_temp,
                "uptime_seconds": round(time.time() - self.start_time, 1),
                "timestamp": time.time(),
                "device": "RaspberryPi"
            }
        except ImportError:
            return {
                "type": "system_info",
                "platform": "RaspberryPi (psutil not available)",
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
    # Create and start server
    server = HotWheelsRaspberryPi()
    
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

