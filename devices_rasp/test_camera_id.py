#!/usr/bin/env python3

"""
Simple camera identification test for Raspberry Pi

This script directly tests the identify_camera function with your specific camera name.
Run on Raspberry Pi: python3 test_camera_id.py
"""

import sys
import os

# Add paths for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

def identify_camera(camera_name):
    """
    Identify camera model from name - copied from camera_handlers.py
    """
    name = camera_name.lower()
    
    # ELP IMX577 - Look for various patterns
    if ('elp' in name or 
        'imx577' in name or 
        'hd usb camera' in name or  # Common generic name for ELP cameras
        ('usb camera' in name and 'hd' in name) or
        ('32e4:0577' in name) or  # Specific USB vendor:product ID for ELP IMX577
        ('hd usb camera:' in name)):  # Handle "HD USB Camera: HD USB Camera" pattern
        return 'elp_imx577'
    
    # Daheng IMX273
    if ('daheng' in name or 
        'mercury' in name or 
        'mer2' in name or
        'imx273' in name):
        return 'daheng_imx273'
    
    return 'unknown'

def main():
    print("🔍 CAMERA IDENTIFICATION TEST")
    print("=" * 50)
    
    # Your actual camera name from the debug output
    camera_name = "HD USB Camera: HD USB Camera (usb-xhci-hcd.1-1)"
    
    print(f"📹 Testing camera: '{camera_name}'")
    print(f"📄 Lowercase: '{camera_name.lower()}'")
    print()
    
    # Test each pattern individually
    name_lower = camera_name.lower()
    
    print("🧪 Testing identification patterns:")
    print(f"   'elp' in name: {'elp' in name_lower}")
    print(f"   'imx577' in name: {'imx577' in name_lower}")
    print(f"   'hd usb camera' in name: {'hd usb camera' in name_lower}")
    print(f"   'usb camera' and 'hd' in name: {'usb camera' in name_lower and 'hd' in name_lower}")
    print(f"   '32e4:0577' in name: {'32e4:0577' in name_lower}")
    print(f"   'hd usb camera:' in name: {'hd usb camera:' in name_lower}")
    print()
    
    # Final identification
    result = identify_camera(camera_name)
    
    print(f"🎯 RESULT: '{camera_name}' → '{result}'")
    
    if result == 'elp_imx577':
        print("✅ SUCCESS: Camera correctly identified as ELP IMX577!")
    else:
        print("❌ FAILED: Camera not properly identified")
        print("   Expected: 'elp_imx577'")
        print(f"   Got: '{result}'")
        
        print("\n💡 Debugging:")
        print("   The camera should match 'hd usb camera:' pattern")
        print(f"   Pattern check: 'hd usb camera:' in '{name_lower}' = {'hd usb camera:' in name_lower}")

if __name__ == '__main__':
    main()

