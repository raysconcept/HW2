#!/usr/bin/env python3

"""
Simple Raspberry Pi Update Test

Quick test script to verify Pi update functionality.
Usage: python test_raspi_simple.py
"""

import sys
import os

# Add the parent directory to path so we can import our test module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from test_raspi_update_system import RaspberryPiUpdateTester

def main():
    print("🍓 Simple Raspberry Pi Update Test")
    print("=" * 40)
    
    # Use your Pi's IP address
    tester = RaspberryPiUpdateTester('192.168.0.128', 3000)
    
    # Run the test
    if tester.run_test():
        print("\n✅ Test completed successfully!")
    else:
        print("\n❌ Test failed!")
        print("Check the Pi connection and try again.")

if __name__ == "__main__":
    main()
