#!/usr/bin/env python3
"""
Daheng Camera Server Functions Test Script

This script tests the exact same Daheng camera functions used by the raspi_server
to debug the gxipy initialization issue locally on the Pi.

Usage: python3 test_daheng_server_functions.py
"""

import sys
import os
import time
import json
import subprocess
from datetime import datetime

# Add the handler path so we can import the camera functions
sys.path.insert(0, '/home/user/Desktop/HOTWHEELS-main/devices_rasp/raspi_client/handlers')
sys.path.insert(0, '/home/user/Desktop/listener/devices_rasp/raspi_client/handlers')

print("🎬====================================================================🎬")
print("                 DAHENG CAMERA SERVER FUNCTIONS TEST")
print("🎬====================================================================🎬")
print(f"📅 Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

# Test imports
print("📦 Testing imports...")
try:
    import gxipy as gx
    print("✅ gxipy imported successfully")
    GX_AVAILABLE = True
except ImportError as e:
    print(f"❌ gxipy import failed: {e}")
    GX_AVAILABLE = False

try:
    import cv2
    print("✅ cv2 imported successfully")  
    CV2_AVAILABLE = True
except ImportError as e:
    print(f"❌ cv2 import failed: {e}")
    CV2_AVAILABLE = False

try:
    import numpy as np
    print("✅ numpy imported successfully")
except ImportError as e:
    print(f"❌ numpy import failed: {e}")
    sys.exit(1)

print()

# Import camera handlers
print("🔧 Importing camera handler functions...")
try:
    from camera_handlers import (
        list_usb_cameras,
        identify_camera, 
        start_recording_daheng_imx273,
        stop_recording_daheng_imx273,
        camera_state
    )
    print("✅ Camera handler functions imported successfully")
except ImportError as e:
    print(f"❌ Camera handler import failed: {e}")
    print("💡 Make sure you're running this script on the Pi with the updated handlers")
    sys.exit(1)

print()

def test_gxipy_initialization():
    """Test basic gxipy initialization"""
    print("🔬 Step 1: Testing gxipy library initialization...")
    
    if not GX_AVAILABLE:
        print("❌ gxipy not available, skipping")
        return False
    
    try:
        # Print gxipy version info
        print(f"📊 gxipy module: {gx.__file__}")
        if hasattr(gx, '__version__'):
            print(f"📊 gxipy version: {gx.__version__}")
        
        # Check for initialization functions
        print("🔍 Checking available gxipy functions...")
        gx_functions = [name for name in dir(gx) if not name.startswith('_')]
        init_functions = [f for f in gx_functions if 'init' in f.lower()]
        print(f"📊 Available functions with 'init': {init_functions}")
        
        # Test basic gxipy initialization
        device_manager = gx.DeviceManager()
        print("✅ DeviceManager created successfully")
        
        # Update device list
        dev_num, dev_info_list = device_manager.update_all_device_list()
        print(f"📊 Found {dev_num} Daheng device(s)")
        
        if dev_num == 0:
            print("❌ No Daheng cameras detected")
            return False
        
        # List device info
        for i, dev_info in enumerate(dev_info_list):
            print(f"   Device {i+1}: {dev_info}")
        
        return True
        
    except Exception as e:
        print(f"❌ gxipy initialization failed: {e}")
        return False

def test_camera_detection():
    """Test camera detection using server functions"""
    print("🔍 Step 2: Testing camera detection...")
    
    try:
        cameras = list_usb_cameras()
        print(f"📊 Found {len(cameras)} total cameras")
        
        daheng_cameras = []
        for cam in cameras:
            usb_id = cam.get('usb_id', None)
            model = identify_camera(cam['name'], usb_id)
            print(f"   📷 {cam['name']} → {model} ({cam['device']})")
            
            if model == 'daheng_imx273':
                daheng_cameras.append(cam)
        
        if daheng_cameras:
            print(f"✅ Found {len(daheng_cameras)} Daheng camera(s)")
            return daheng_cameras[0]  # Return first Daheng camera
        else:
            print("❌ No Daheng cameras detected in server functions")
            return None
            
    except Exception as e:
        print(f"❌ Camera detection failed: {e}")
        return None

def test_daheng_camera_opening():
    """Test opening Daheng camera directly with gxipy"""
    print("📹 Step 3: Testing Daheng camera opening...")
    
    if not GX_AVAILABLE:
        print("❌ gxipy not available, skipping")
        return None
    
    try:
        device_manager = gx.DeviceManager()
        dev_num, dev_info_list = device_manager.update_all_device_list()
        
        if dev_num == 0:
            print("❌ No Daheng cameras found")
            return None
        
        print(f"📱 Opening first Daheng camera...")
        cam = device_manager.open_device_by_index(1)  # gxipy uses 1-based indexing
        print("✅ Camera opened successfully")
        
        # Test basic camera properties
        print("📊 Testing camera properties...")
        
        if cam.TriggerMode.is_implemented():
            current_trigger = cam.TriggerMode.get()
            print(f"   🔧 TriggerMode: {current_trigger} (implemented: ✅)")
        else:
            print(f"   🔧 TriggerMode: Not implemented")
        
        if cam.ExposureTime.is_implemented():
            current_exposure = cam.ExposureTime.get()
            print(f"   📊 ExposureTime: {current_exposure}μs (writable: {'✅' if cam.ExposureTime.is_writable() else '❌'})")
        else:
            print(f"   📊 ExposureTime: Not implemented")
        
        if cam.Gain.is_implemented():
            current_gain = cam.Gain.get()
            print(f"   📊 Gain: {current_gain}dB (writable: {'✅' if cam.Gain.is_writable() else '❌'})")
        else:
            print(f"   📊 Gain: Not implemented")
        
        return cam
        
    except Exception as e:
        print(f"❌ Camera opening failed: {e}")
        return None

def test_data_stream_initialization(cam):
    """Test data stream initialization"""
    print("📡 Step 4: Testing data stream initialization...")
    
    if cam is None:
        print("❌ No camera available, skipping")
        return False
    
    print("🔍 Testing EXACT sequence from working test_camera_imx273.py...")
    
    try:
        # Close and reopen camera (clean slate)
        print("🔄 Closing and reopening camera for clean state...")
        try:
            cam.close_device()
        except:
            pass
        
        # Reopen camera exactly like working test
        device_manager = gx.DeviceManager()
        dev_num, dev_info_list = device_manager.update_all_device_list()
        if dev_num == 0:
            print("❌ No cameras after reopen")
            return False
        
        cam = device_manager.open_device_by_index(1)
        print("✅ Camera reopened successfully")
        
        # Configure exactly like test_camera_imx273.py
        if cam.TriggerMode.is_implemented() and cam.TriggerMode.is_writable():
            cam.TriggerMode.set(gx.GxSwitchEntry.OFF)
            print("✅ TriggerMode set to OFF")
        
        if cam.ExposureTime.is_implemented() and cam.ExposureTime.is_writable():
            cam.ExposureTime.set(1500.0)
            print("✅ ExposureTime set to 1500.0")
        
        if cam.Gain.is_implemented() and cam.Gain.is_writable():
            cam.Gain.set(24.0)
            print("✅ Gain set to 24.0")
        
        # FPS exactly like test_camera_imx273.py
        if hasattr(cam, "AcquisitionFrameRate") and cam.AcquisitionFrameRate.is_implemented():
            if cam.AcquisitionFrameRate.is_writable():
                try:
                    if hasattr(cam, "AcquisitionFrameRateMode"):
                        cam.AcquisitionFrameRateMode.set(gx.GxSwitchEntry.ON)
                except Exception:
                    pass
                cam.AcquisitionFrameRate.set(60.0)
                print("✅ FPS set to 60")
        
        # Now try stream_on exactly like working test
        print("🚀 Starting stream exactly like test_camera_imx273.py...")
        cam.stream_on()
        print("✅ Stream started successfully!")
        
        # Get first image exactly like working test
        print("📸 Getting first image...")
        raw_image = cam.data_stream[0].get_image()
        if raw_image is None:
            print("❌ Failed to get initial image")
            return False
        
        print("✅ Got initial image!")
        
        first_numpy = raw_image.get_numpy_array()
        if first_numpy is None:
            print("❌ Failed to get initial numpy image")
            return False
        
        print(f"✅ Got numpy array: {first_numpy.shape} {first_numpy.dtype}")
        
        if first_numpy.ndim != 2:
            print(f"⚠️ Expected 2D Bayer/mono, got shape: {first_numpy.shape}")
        else:
            print("✅ Image format correct (2D Bayer/mono)")
        
        return True
        
    except Exception as e:
        print(f"❌ Data stream initialization failed: {e}")
        return False
    finally:
        try:
            cam.stream_off()
            cam.close_device()
            print("🛑 Stream stopped and camera closed")
        except Exception as close_error:
            print(f"⚠️ Error closing camera: {close_error}")

def test_server_recording_functions(camera_info):
    """Test the server's recording functions"""
    print("🎥 Step 5: Testing server recording functions...")
    
    if camera_info is None:
        print("❌ No Daheng camera info available, skipping")
        return False
    
    try:
        # Prepare test data similar to what server sends
        test_data = {
            'duration': 3,      # Short test recording
            'fps': 220,         # HIGH FPS like working test_camera_imx273.py
            'width': 1440,      # FULL RESOLUTION like working test
            'height': 1080,
            'exposure': 1500.0,
            'gain': 24.0
        }
        
        print(f"📋 Test recording parameters: {json.dumps(test_data, indent=2)}")
        
        # Test start recording
        print("🎬 Testing start_recording_daheng_imx273...")
        result = start_recording_daheng_imx273(camera_info['index'], test_data)
        
        if result.get('success', False):
            print("✅ Recording started successfully")
            print(f"📊 Result: {json.dumps(result, indent=2)}")
            
            # Wait for recording to complete
            print(f"⏳ Waiting {test_data['duration']} seconds for recording...")
            time.sleep(test_data['duration'] + 1)
            
            # Test stop recording
            print("🛑 Testing stop_recording_daheng_imx273...")
            stop_result = stop_recording_daheng_imx273(camera_info['index'], {})
            
            if stop_result.get('success', False):
                print("✅ Recording stopped successfully")
                print(f"📊 Stop result: {json.dumps(stop_result, indent=2)}")
                return True
            else:
                print(f"❌ Recording stop failed: {stop_result}")
                return False
        else:
            print(f"❌ Recording start failed: {result}")
            return False
            
    except Exception as e:
        print(f"❌ Server recording functions test failed: {e}")
        return False

def test_working_script_comparison():
    """Test if we can run the known working test_camera_imx273.py script"""
    print("🧪 Step 0: Testing working test_camera_imx273.py for comparison...")
    
    try:
        import subprocess
        
        # Check if the working test script exists and can run
        script_path = '/home/user/Desktop/listener/devices_rasp/test_camera_imx273.py'
        
        print(f"📁 Checking if {script_path} exists...")
        if not os.path.exists(script_path):
            print(f"❌ Working test script not found at {script_path}")
            return False
        
        print(f"✅ Working test script found")
        print(f"🚀 Running working test for 2 seconds to verify camera works...")
        
        # Run the working test for a short time
        process = subprocess.Popen(
            ['python3', script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd='/home/user/Desktop/listener/devices_rasp'
        )
        
        # Let it run for 2 seconds then terminate
        try:
            stdout, stderr = process.communicate(timeout=2)
            print(f"✅ Working test completed successfully")
            if stdout:
                print(f"📊 Working test output: {stdout[:200]}...")
            return True
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                stdout, stderr = process.communicate(timeout=1)
                if "Capturing... Ctrl+C to stop" in stdout:
                    print(f"✅ Working test reached capture phase - camera is functional")
                    return True
                else:
                    print(f"⚠️ Working test output: {stdout[-200:]}...")
            except:
                pass
            
            if "stream_on" in stdout or "Capturing" in stdout:
                print(f"✅ Working test seems to work (reached capture phase)")
                return True
            else:
                print(f"❌ Working test did not reach expected phase")
                if stderr:
                    print(f"🚨 Working test stderr: {stderr}")
                return False
                
    except Exception as e:
        print(f"❌ Failed to test working script: {e}")
        return False

def main():
    """Main test function"""
    
    # Test 0: Check if working test script works
    print("=" * 70)
    working_test_ok = test_working_script_comparison()
    if not working_test_ok:
        print("⚠️ WARNING: The known working test script is not working!")
        print("   This suggests a system-level issue, not our code.")
    else:
        print("✅ Working test script functions properly")
    
    print()
    
    # Test 1: Basic gxipy initialization
    if not test_gxipy_initialization():
        print("\n❌ FAILED: Basic gxipy initialization")
        return
    
    print()
    
    # Test 2: Camera detection  
    daheng_camera = test_camera_detection()
    if daheng_camera is None:
        print("\n❌ FAILED: Camera detection")
        return
    
    print()
    
    # Test 3: Direct camera opening
    cam = test_daheng_camera_opening()
    if cam is None:
        print("\n❌ FAILED: Camera opening")
        return
    
    print()
    
    # Test 4: Data stream initialization
    if not test_data_stream_initialization(cam):
        print("\n❌ FAILED: Data stream initialization")
        cam.close_device()
        return
    
    # Camera already closed in step 4
    
    print()
    
    # Test 5: Server recording functions
    if test_server_recording_functions(daheng_camera):
        print("\n✅ ALL TESTS PASSED!")
        print("🎉 Daheng camera is working with server functions")
    else:
        print("\n❌ FAILED: Server recording functions")
        print("💡 The camera works directly but fails with server functions")
    
    print()
    print("🎯 Test Summary:")
    print("   1. If direct camera access works but server functions fail,")
    print("      the issue is in the camera handler implementation")
    print("   2. If direct camera access fails, it's a gxipy/hardware issue") 
    print("   3. Check the detailed error messages above for specific fixes")
    
    print(f"\n📅 Test Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
