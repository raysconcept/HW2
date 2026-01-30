#!/usr/bin/env python3

"""
Raspberry Pi Client Entry Point
Main entry point for the modular Raspberry Pi client

Usage:
    python3 main.py [host] [port]
    
Examples:
    python3 main.py                    # Default: 0.0.0.0:3000
    python3 main.py 192.168.1.100      # Custom host, default port
    python3 main.py 192.168.1.100 8080 # Custom host and port
"""

import sys
import os

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from client import RaspberryPiClient


def main():
    """Main entry point"""
    
    # Parse command line arguments
    host = '0.0.0.0'
    port = 3000
    
    if len(sys.argv) > 1:
        host = sys.argv[1]
    
    if len(sys.argv) > 2:
        try:
            port = int(sys.argv[2])
        except ValueError:
            print(f"❌ Invalid port: {sys.argv[2]}")
            sys.exit(1)
    
    # Create and start client
    client = RaspberryPiClient(host, port)
    
    try:
        client.start_server()
    
    except KeyboardInterrupt:
        print("\n⏹️  Received Ctrl+C")
    
    except Exception as e:
        print(f"❌ Server error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.cleanup()


if __name__ == "__main__":
    main()

