#!/usr/bin/env python3

"""
Simple Safe Update Test Runner

Quick test to verify the Pi's new safe update system is working.
This tests the protection against bad code that would crash the Pi.
"""

import sys
import os

# Add the parent directory to path so we can import our test module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from test_safe_update_system import SafeUpdateTester

def main():
    print("🛡️  Safe Update System Test")
    print("=" * 40)
    
    # Use the configured Pi IP
    tester = SafeUpdateTester('192.168.0.128', 3000)
    
    # Run the safe update tests
    if tester.run_safe_update_tests():
        print("\n✅ Safe update system is working!")
        print("🛡️  Your Pi is protected against bad code updates")
    else:
        print("\n❌ Safe update system needs attention!")
        print("⚠️  Check the Pi's safety mechanisms")

if __name__ == "__main__":
    main()
