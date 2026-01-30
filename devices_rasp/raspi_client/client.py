#!/usr/bin/env python3

"""
Raspberry Pi TCP Client - SEMI-PROTECTED
Main TCP server that receives commands and delegates to handlers

This file should rarely need updates. Most functionality is in handlers.
"""

import socket
import json
import threading
import time
import os
import sys

from core.updater import ProtectedUpdater
from core.safe_loader import SafeHandlerLoader
from handlers import update_handlers


class RaspberryPiClient:
    """
    Main TCP client for Raspberry Pi
    
    Responsibilities:
    - Accept TCP connections
    - Parse JSON commands
    - Delegate to appropriate handlers
    - Send JSON responses
    """
    
    VERSION = "2.0_modular"
    
    def __init__(self, host='0.0.0.0', port=3000):
        """
        Initialize the client
        
        Args:
            host: IP address to bind to
            port: TCP port to listen on
        """
        self.host = host
        self.port = port
        self.server_socket = None
        self.start_time = time.time()
        self.client_count = 0
        
        # Get base path
        self.base_path = os.path.dirname(os.path.abspath(__file__))
        
        # Initialize protected updater
        self.updater = ProtectedUpdater(self.base_path)
        
        # Initialize safe handler loader
        handlers_path = os.path.join(self.base_path, 'handlers')
        self.loader = SafeHandlerLoader(handlers_path, self.updater)
        
        # Inject updater reference into update_handlers
        update_handlers.set_updater_reference(self.updater, self.loader)
        
        # Load all handlers
        print("\n" + "="*50)
        print("🍓 HotWheels Raspberry Pi Client")
        print(f"📌 Version: {self.VERSION}")
        print(f"🌐 Address: {host}:{port}")
        print("="*50 + "\n")
        
        print("📦 Loading handlers...")
        load_results = self.loader.load_all_handlers()
        
        print("\n" + "="*50)
        print(f"✅ Client ready with {load_results['total_commands']} commands")
        print("="*50 + "\n")
    
    def start_server(self):
        """Start the TCP server"""
        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(5)
            
            print(f"🚀 Server listening on {self.host}:{self.port}")
            print("🔗 Waiting for connections...\n")
            
            while True:
                try:
                    client_socket, client_address = self.server_socket.accept()
                    self.client_count += 1
                    
                    print(f"🔗 Connection #{self.client_count} from {client_address[0]}:{client_address[1]}")
                    
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
        """
        Handle individual client connection
        
        Args:
            client_socket: Connected socket
            client_address: Client address tuple (ip, port)
        """
        buffer = ""
        client_start_time = time.time()
        commands_processed = 0
        
        try:
            while True:
                # Set timeout to detect dead connections
                client_socket.settimeout(30.0)
                
                try:
                    data = client_socket.recv(1024)
                    if not data:
                        break  # Connection closed
                    
                    # Append to buffer
                    buffer += data.decode('utf-8')
                    
                    # Process complete messages (newline-delimited JSON)
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        
                        if line.strip():
                            commands_processed += 1
                            self.process_command(line.strip(), client_socket)
                
                except socket.timeout:
                    print(f"⏰ Client {client_address[0]} timeout (no data for 30s)")
                    break
                
                except Exception as e:
                    print(f"❌ Client handling error: {e}")
                    break
        
        finally:
            client_socket.close()
            duration = time.time() - client_start_time
            print(f"🔌 Client {client_address[0]} disconnected "
                  f"(duration: {duration:.1f}s, commands: {commands_processed})")
    
    def process_command(self, json_str, client_socket):
        """
        Process incoming JSON command
        
        Args:
            json_str: JSON string from client
            client_socket: Socket to send response to
        """
        try:
            # Parse JSON
            try:
                command_data = json.loads(json_str)
            except json.JSONDecodeError as e:
                error_response = {
                    'success': False,
                    'error': f'Invalid JSON: {str(e)}',
                    'timestamp': time.time()
                }
                self.send_response(client_socket, error_response)
                print(f"❌ JSON parse error: {str(e)}")
                return
            
            # Extract command
            command = command_data.get('command', '').lower()
            
            if not command:
                error_response = {
                    'success': False,
                    'error': 'Missing "command" field',
                    'timestamp': time.time()
                }
                self.send_response(client_socket, error_response)
                return
            
            print(f"📥 Command: {command}")
            
            # Execute command via handler loader
            response = self.loader.execute_command(command, command_data)
            
            # Send response
            self.send_response(client_socket, response)
            
            # Log response (abbreviated)
            if response.get('success'):
                print(f"📤 Response: Success ({response.get('type', 'unknown')})")
            else:
                print(f"📤 Response: Error - {response.get('error', 'unknown')}")
        
        except Exception as e:
            error_response = {
                'success': False,
                'error': f'Command processing error: {str(e)}',
                'timestamp': time.time()
            }
            self.send_response(client_socket, error_response)
            print(f"❌ Processing error: {e}")
    
    def send_response(self, client_socket, response):
        """
        Send JSON response to client
        
        Args:
            client_socket: Socket to send to
            response: Response dictionary
        """
        try:
            response_str = json.dumps(response) + '\n'
            client_socket.send(response_str.encode('utf-8'))
        except Exception as e:
            print(f"❌ Failed to send response: {e}")
    
    def cleanup(self):
        """Clean up resources"""
        print("\n🛑 Shutting down client...")
        
        # Clean up GPIO if available
        try:
            import RPi.GPIO as GPIO
            GPIO.cleanup()
            print("🧹 GPIO cleaned up")
        except:
            pass
        
        # Close server socket
        if self.server_socket:
            self.server_socket.close()
            print("🔌 Server socket closed")
        
        print("👋 Goodbye!")

