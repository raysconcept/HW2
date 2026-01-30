#!/usr/bin/env python3

"""
Patch the running service to add debug logging
This will monkey-patch the camera_handlers module in the running service
"""

import sys
sys.path.append('/home/pi/raspi_client/handlers')

# Original functions
import camera_handlers

# Store original functions
original_identify_camera = camera_handlers.identify_camera
original_list_usb_cameras = camera_handlers.list_usb_cameras

def debug_identify_camera(camera_name):
    """Debug wrapper for identify_camera"""
    print(f"\n🔍 [SERVICE DEBUG] identify_camera called")
    print(f"    Input: '{camera_name}'")
    print(f"    Type: {type(camera_name)}")
    print(f"    Length: {len(camera_name)}")
    print(f"    Repr: {repr(camera_name)}")
    
    # Call original function
    result = original_identify_camera(camera_name)
    
    print(f"    Result: '{result}'")
    
    # If it's unknown, debug why
    if result == 'unknown':
        name_lower = camera_name.lower()
        print(f"    ❌ UNKNOWN RESULT - Debugging:")
        print(f"       Lowercase: '{name_lower}'")
        print(f"       'hd usb camera:' in name: {'hd usb camera:' in name_lower}")
        print(f"       'hd usb camera' in name: {'hd usb camera' in name_lower}")
        print(f"       Characters: {[ord(c) for c in camera_name[:20]]}")
    
    return result

def debug_list_usb_cameras():
    """Debug wrapper for list_usb_cameras"""
    print(f"\n📹 [SERVICE DEBUG] list_usb_cameras called")
    
    # Call original function
    result = original_list_usb_cameras()
    
    print(f"    Found {len(result)} cameras:")
    for i, cam in enumerate(result):
        print(f"      {i+1}. {cam}")
    
    return result

# Monkey patch the functions
camera_handlers.identify_camera = debug_identify_camera
camera_handlers.list_usb_cameras = debug_list_usb_cameras

print("🔧 DEBUG PATCH APPLIED")
print("The camera_handlers module now has debug logging")
print("Any calls to identify_camera or list_usb_cameras will be logged")
print("\nTo test:")
print("1. Run this script: python3 patch_service_debug.py")
print("2. In another terminal, trigger the server test")
print("3. Watch this terminal for debug output")

# Keep the script running to maintain the patch
try:
    print("\n📡 Monitoring camera handler calls...")
    print("Press Ctrl+C to exit")
    
    # Import and call the handler to test
    result = camera_handlers.handle_list_cameras({})
    print(f"\n🎯 Test result: {result}")
    
    # Keep running
    import time
    while True:
        time.sleep(1)

except KeyboardInterrupt:
    print("\n👋 Debug patch removed")
    # Restore original functions
    camera_handlers.identify_camera = original_identify_camera
    camera_handlers.list_usb_cameras = original_list_usb_cameras

