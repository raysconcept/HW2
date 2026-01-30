#!/usr/bin/env python3

"""
Camera Detection Debug Script for Raspberry Pi

This script will show you exactly how cameras are detected and identified
on your Raspberry Pi, helping debug camera identification issues.

Run on Raspberry Pi: python3 debug_camera_detection.py
"""

import os
import sys
import subprocess
import json
from pathlib import Path

# Add the current directory to Python path so we can import handlers
current_dir = os.path.dirname(os.path.abspath(__file__))
raspi_dir = os.path.join(current_dir, '..')
sys.path.insert(0, current_dir)
sys.path.insert(0, raspi_dir)

try:
    from raspi_client.handlers.camera_handlers import identify_camera, get_available_cameras
    HANDLERS_AVAILABLE = True
except ImportError as e:
    try:
        # Try alternative import path
        sys.path.insert(0, os.path.join(current_dir, '..', '..'))
        from devices_rasp.raspi_client.handlers.camera_handlers import identify_camera, get_available_cameras
        HANDLERS_AVAILABLE = True
    except ImportError as e2:
        print(f"❌ Cannot import camera handlers: {e}")
        print(f"❌ Alternative import also failed: {e2}")
        HANDLERS_AVAILABLE = False

def run_command(cmd):
    """Run a shell command and return output"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except Exception as e:
        return "", str(e), 1

def detect_v4l2_cameras():
    """Detect cameras using v4l2-ctl"""
    print("🔍 Detecting cameras with v4l2-ctl...")
    
    # List all video devices
    stdout, stderr, code = run_command("v4l2-ctl --list-devices")
    
    if code != 0:
        print(f"❌ v4l2-ctl not available or failed: {stderr}")
        return []
    
    print("📹 Raw v4l2-ctl output:")
    print("-" * 50)
    print(stdout)
    print("-" * 50)
    
    cameras = []
    current_camera = None
    
    for line in stdout.split('\n'):
        if line and not line.startswith('\t') and not line.startswith('        /dev') and ':' in line:
            # This is a camera name line
            current_camera = {
                'name': line.rstrip(':'),
                'devices': []
            }
            cameras.append(current_camera)
        elif (line.startswith('\t/dev/video') or line.startswith('        /dev/video')) and current_camera:
            # This is a device path (can be indented with tabs or spaces)
            device = line.strip()
            current_camera['devices'].append(device)
    
    return cameras

def get_camera_capabilities(device_path):
    """Get detailed camera capabilities"""
    print(f"\n🔧 Getting capabilities for {device_path}...")
    
    # Get basic info
    stdout, stderr, code = run_command(f"v4l2-ctl -d {device_path} --info")
    if code == 0:
        print("📊 Device Info:")
        print(stdout)
    
    # Get formats
    stdout, stderr, code = run_command(f"v4l2-ctl -d {device_path} --list-formats-ext")
    if code == 0:
        print("🎥 Supported Formats:")
        print(stdout)
    
    # Get controls
    stdout, stderr, code = run_command(f"v4l2-ctl -d {device_path} --list-ctrls")
    if code == 0:
        print("🎛️  Available Controls:")
        print(stdout[:500] + "..." if len(stdout) > 500 else stdout)

def check_usb_devices():
    """Check USB devices for camera information"""
    print("\n🔌 USB Device Information:")
    print("-" * 50)
    
    stdout, stderr, code = run_command("lsusb")
    if code == 0:
        print("📋 All USB Devices:")
        for line in stdout.split('\n'):
            if line.strip():
                print(f"  {line}")
                # Look for camera-related keywords
                if any(keyword in line.lower() for keyword in ['camera', 'webcam', 'video', 'imaging']):
                    print(f"    ⭐ Potential camera device!")
    
    print("\n🔍 Detailed USB device info (video/camera related):")
    stdout, stderr, code = run_command("lsusb -v 2>/dev/null | grep -A 10 -B 5 -i 'camera\\|webcam\\|video\\|imaging'")
    if code == 0 and stdout:
        print(stdout[:1000] + "..." if len(stdout) > 1000 else stdout)

def test_camera_identification():
    """Test the camera identification logic"""
    print("\n🧪 Testing Camera Identification Logic:")
    print("=" * 60)
    
    if not HANDLERS_AVAILABLE:
        print("❌ Camera handlers not available for testing")
        return
    
    # Test with various camera names
    test_names = [
        "HD USB Camera: HD USB Camera",
        "ELP USB Camera",
        "HD USB Camera",
        "USB Camera: HD USB Camera", 
        "pispbe",
        "rpi-hevc-dec",
        "Mercury Camera",
        "Daheng Camera",
        "IMX577 Camera",
        "IMX273 Camera",
    ]
    
    print("🔬 Testing identify_camera function with various names:")
    for name in test_names:
        result = identify_camera(name)
        status = "✅" if result != "unknown" else "❌"
        print(f"  {status} '{name}' → '{result}'")

def test_camera_listing():
    """Test the actual camera listing function"""
    print("\n📹 Testing get_available_cameras() function:")
    print("=" * 60)
    
    if not HANDLERS_AVAILABLE:
        print("❌ Camera handlers not available for testing")
        return
    
    try:
        cameras = get_available_cameras()
        print(f"📊 Found {len(cameras)} cameras:")
        
        for i, cam in enumerate(cameras):
            print(f"\n🎥 Camera {i+1}:")
            print(f"   Index: {cam.get('index', 'N/A')}")
            print(f"   Device: {cam.get('device', 'N/A')}")
            print(f"   Name: '{cam.get('name', 'N/A')}'")
            print(f"   Model: '{cam.get('model', 'N/A')}'")
            
            # Test identification on this specific camera
            if 'name' in cam:
                identified_model = identify_camera(cam['name'])
                match_status = "✅ MATCH" if identified_model == cam.get('model') else "❌ MISMATCH"
                print(f"   Identification Test: '{cam['name']}' → '{identified_model}' {match_status}")
        
        print(f"\n📋 Raw camera data:")
        print(json.dumps(cameras, indent=2))
        
    except Exception as e:
        print(f"❌ Error getting cameras: {e}")
        import traceback
        traceback.print_exc()

def main():
    print("🎬" + "=" * 68 + "🎬")
    print("          RASPBERRY PI CAMERA DETECTION DEBUG")
    print("🎬" + "=" * 68 + "🎬")
    
    print(f"\n🐍 Python Version: {sys.version}")
    print(f"📁 Script Path: {os.path.abspath(__file__)}")
    print(f"🔧 Handlers Available: {'Yes' if HANDLERS_AVAILABLE else 'No'}")
    
    # 1. Check USB devices
    check_usb_devices()
    
    # 2. Detect cameras with v4l2
    cameras = detect_v4l2_cameras()
    
    if cameras:
        print(f"\n📹 Found {len(cameras)} camera groups:")
        for i, cam in enumerate(cameras):
            print(f"\n🎥 Camera Group {i+1}:")
            print(f"   Name: '{cam['name']}'")
            print(f"   Devices: {cam['devices']}")
            
            # Test identification
            identified = identify_camera(cam['name']) if HANDLERS_AVAILABLE else 'N/A'
            print(f"   Identified as: '{identified}'")
            
            # Get capabilities for the first device
            if cam['devices']:
                first_device = cam['devices'][0]
                get_camera_capabilities(first_device)
    else:
        print("\n❌ No cameras detected with v4l2-ctl")
    
    # 3. Test identification logic
    test_camera_identification()
    
    # 4. Test actual camera listing function
    test_camera_listing()
    
    print("\n" + "=" * 70)
    print("🔍 DEBUG SUMMARY:")
    print("=" * 70)
    
    if cameras:
        print("✅ Cameras detected via v4l2-ctl")
        for cam in cameras:
            identified = identify_camera(cam['name']) if HANDLERS_AVAILABLE else 'N/A'
            status = "✅" if identified != "unknown" else "❌"
            print(f"   {status} '{cam['name']}' → '{identified}'")
    else:
        print("❌ No cameras detected")
    
    print(f"\n📝 Handlers: {'Available' if HANDLERS_AVAILABLE else 'Not Available'}")
    
    print("\n💡 If your camera shows as 'unknown':")
    print("   1. Note the exact camera name from the output above")
    print("   2. Update the identify_camera() function to recognize it")
    print("   3. Restart the main.py service on the Pi")
    
    print("\n🎯 Next steps:")
    print("   • Copy the exact camera name from above")
    print("   • Check if it matches the identification patterns")
    print("   • Update camera_handlers.py if needed")

if __name__ == '__main__':
    main()
