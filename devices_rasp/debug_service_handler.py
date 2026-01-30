#!/usr/bin/env python3

"""
Debug what happens when the service receives list_cameras command
This will patch the camera_handlers to add logging
"""

import sys
import os
import time

# Add paths
sys.path.append('/home/pi/raspi_client/handlers')

# Import the original functions
from camera_handlers import list_usb_cameras, identify_camera, handle_list_cameras

# Create debug versions
def debug_identify_camera(camera_name):
    """Debug version of identify_camera with logging"""
    print(f"[DEBUG] identify_camera called with: '{camera_name}'")
    
    name = camera_name.lower()
    print(f"[DEBUG] Lowercase name: '{name}'")
    
    # Test each condition
    elp_check = 'elp' in name
    imx577_check = 'imx577' in name  
    hd_usb_check = 'hd usb camera' in name
    usb_hd_check = ('usb camera' in name and 'hd' in name)
    vendor_check = '32e4:0577' in name
    hd_usb_colon_check = 'hd usb camera:' in name
    
    print(f"[DEBUG] Pattern checks:")
    print(f"  'elp' in name: {elp_check}")
    print(f"  'imx577' in name: {imx577_check}")
    print(f"  'hd usb camera' in name: {hd_usb_check}")
    print(f"  'usb camera' and 'hd' in name: {usb_hd_check}")
    print(f"  '32e4:0577' in name: {vendor_check}")
    print(f"  'hd usb camera:' in name: {hd_usb_colon_check}")
    
    # ELP IMX577 - Look for various patterns
    if (elp_check or imx577_check or hd_usb_check or usb_hd_check or vendor_check or hd_usb_colon_check):
        result = 'elp_imx577'
    # Daheng IMX273
    elif ('daheng' in name or 'mercury' in name or 'mer2' in name or 'imx273' in name):
        result = 'daheng_imx273'
    else:
        result = 'unknown'
    
    print(f"[DEBUG] identify_camera result: '{camera_name}' → '{result}'")
    return result

def debug_list_usb_cameras():
    """Debug version of list_usb_cameras with logging"""
    print(f"[DEBUG] list_usb_cameras called")
    
    cameras = list_usb_cameras()
    
    print(f"[DEBUG] list_usb_cameras found {len(cameras)} cameras:")
    for i, cam in enumerate(cameras):
        print(f"[DEBUG]   Camera {i+1}: {cam}")
    
    return cameras

def debug_handle_list_cameras(data):
    """Debug version of handle_list_cameras with logging"""
    print(f"[DEBUG] handle_list_cameras called with data: {data}")
    
    # Get cameras
    cameras = debug_list_usb_cameras()
    
    cameras_info = []
    for cam in cameras:
        print(f"[DEBUG] Processing camera: {cam}")
        model = debug_identify_camera(cam['name'])
        
        camera_info = {
            'index': cam['index'],
            'device': cam['device'],
            'name': cam['name'],
            'model': model
        }
        cameras_info.append(camera_info)
        print(f"[DEBUG] Camera info created: {camera_info}")
    
    result = {
        'success': True,
        'type': 'cameras_list',
        'cameras': cameras_info,
        'count': len(cameras_info),
        'timestamp': time.time()
    }
    
    print(f"[DEBUG] Final result: {result}")
    return result

# Test the debug version
if __name__ == '__main__':
    print("🔍 DEBUGGING SERVICE HANDLER")
    print("=" * 60)
    
    # Simulate exactly what the service does when it gets list_cameras command
    print("📋 Simulating service call to handle_list_cameras...")
    
    # This is what the service calls when it receives {"command": "list_cameras"}
    result = debug_handle_list_cameras({})
    
    print("\n" + "=" * 60)
    print("🎯 SUMMARY:")
    print("=" * 60)
    
    if result['success']:
        print(f"✅ Success: {result['count']} cameras found")
        for cam in result['cameras']:
            status = "✅" if cam['model'] != 'unknown' else "❌"
            print(f"  {status} '{cam['name']}' → '{cam['model']}'")
    else:
        print("❌ Failed to get cameras")
    
    print("\nIf any camera shows 'unknown', check the debug output above to see which pattern check is failing.")
