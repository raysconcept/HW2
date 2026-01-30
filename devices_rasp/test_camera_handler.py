#!/usr/bin/env python3

"""
Test Camera Handler

Demonstrates using the camera handler with automatic camera detection
and recording for both PiCamera and USB cameras.
"""

import time
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the camera handlers
from raspi_client.handlers import camera_handlers


def print_result(result, title="Result"):
    """Pretty print command result"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    print(f"Success: {result.get('success')}")
    print(f"Type: {result.get('type')}")
    
    if result.get('message'):
        print(f"Message: {result['message']}")
    
    if result.get('error'):
        print(f"❌ Error: {result['error']}")
    
    # Print additional fields
    for key, value in result.items():
        if key not in ['success', 'type', 'message', 'error', 'timestamp']:
            print(f"{key}: {value}")
    
    print(f"{'='*60}\n")


def test_camera_detection():
    """Test 1: Detect camera type"""
    print("\n🔍 TEST 1: Camera Detection")
    print("-" * 60)
    
    result = camera_handlers.handle_detect_camera({})
    print_result(result, "Camera Detection")
    
    # Print USB cameras if found
    if result.get('usb_cameras'):
        print("\n📹 USB Cameras Found:")
        for cam in result['usb_cameras']:
            print(f"\n  Camera {cam['index']}:")
            print(f"    Name: {cam['name']}")
            print(f"    Device: {cam['device']}")
            print(f"    Model Type: {cam['model_type']}")
            if 'vendor_id' in cam:
                print(f"    Vendor ID: {cam['vendor_id']}")
            if 'product_id' in cam:
                print(f"    Product ID: {cam['product_id']}")
    
    return result.get('camera_type')


def test_list_cameras():
    """Test: List all cameras"""
    print("\n📹 TEST: List All Cameras")
    print("-" * 60)
    
    result = camera_handlers.handle_list_cameras({})
    print_result(result, "All Cameras")
    
    if result.get('cameras'):
        print(f"\nFound {result['total_count']} camera(s):")
        for i, cam in enumerate(result['cameras'], 1):
            print(f"\n  [{i}] {cam.get('name', 'Unknown')}")
            print(f"      Type: {cam['type']}")
            if cam['type'] == 'usb':
                print(f"      Index: {cam['index']}")
                print(f"      Device: {cam['device']}")
                print(f"      Model: {cam['model_type']}")
                if 'capabilities' in cam:
                    caps = cam['capabilities']
                    print(f"      Resolution: {caps.get('width')}x{caps.get('height')}")
                    print(f"      FPS: {caps.get('fps')}")
    
    return result.get('cameras', [])


def test_camera_status():
    """Test 2: Get camera status"""
    print("\n📊 TEST 2: Camera Status")
    print("-" * 60)
    
    result = camera_handlers.handle_camera_status({})
    print_result(result, "Camera Status")
    
    return result


def test_start_recording(duration=5, fps=30, width=1920, height=1080):
    """Test 3: Start recording"""
    print(f"\n🎥 TEST 3: Start Recording ({duration}s @ {fps}fps)")
    print("-" * 60)
    
    result = camera_handlers.handle_start_recording({
        'duration': duration,
        'width': width,
        'height': height,
        'fps': fps
    })
    
    print_result(result, "Recording Started")
    
    return result.get('success')


def test_recording_status_during():
    """Test 4: Check status during recording"""
    print("\n📊 TEST 4: Status During Recording")
    print("-" * 60)
    
    result = camera_handlers.handle_camera_status({})
    print_result(result, "Recording Status")
    
    return result


def test_stop_recording():
    """Test 5: Stop recording"""
    print("\n⏹️  TEST 5: Stop Recording")
    print("-" * 60)
    
    result = camera_handlers.handle_stop_recording({})
    print_result(result, "Recording Stopped")
    
    return result.get('success')


def test_list_recordings():
    """Test 6: List all recordings"""
    print("\n📁 TEST 6: List Recordings")
    print("-" * 60)
    
    result = camera_handlers.handle_list_recordings({})
    print_result(result, "Recordings List")
    
    if result.get('success') and result.get('recordings'):
        print("\nRecordings found:")
        for rec in result['recordings']:
            print(f"  • {rec['filename']}")
            print(f"    Size: {rec['size_mb']} MB")
            print(f"    Path: {rec['path']}")
            print()


def test_high_fps_recording():
    """Test 7: High FPS recording (USB camera)"""
    print("\n🚀 TEST 7: High FPS Recording (60fps)")
    print("-" * 60)
    
    # This will only work with USB cameras
    result = camera_handlers.handle_start_recording({
        'duration': 3,
        'width': 1280,
        'height': 720,
        'fps': 60,
        'force_type': 'usb'
    })
    
    print_result(result, "High FPS Recording")
    
    if result.get('success'):
        print("⏳ Recording for 3 seconds...")
        time.sleep(3.5)
        
        stop_result = camera_handlers.handle_stop_recording({})
        print_result(stop_result, "High FPS Recording Stopped")


def test_record_with_specific_camera(camera_index=None, camera_model=None, camera_name=None):
    """Test: Record with specific camera selection"""
    selection_method = "default"
    if camera_index is not None:
        selection_method = f"index {camera_index}"
    elif camera_model:
        selection_method = f"model '{camera_model}'"
    elif camera_name:
        selection_method = f"name '{camera_name}'"
    
    print(f"\n🎥 TEST: Record with Camera ({selection_method})")
    print("-" * 60)
    
    command = {
        'duration': 3,
        'width': 1920,
        'height': 1080,
        'fps': 30
    }
    
    if camera_index is not None:
        command['camera_index'] = camera_index
    if camera_model:
        command['camera_model'] = camera_model
    if camera_name:
        command['camera_name'] = camera_name
    
    result = camera_handlers.handle_start_recording(command)
    print_result(result, f"Recording Started ({selection_method})")
    
    if result.get('success'):
        print("⏳ Recording for 3 seconds...")
        time.sleep(3.5)
        
        stop_result = camera_handlers.handle_stop_recording({})
        print_result(stop_result, "Recording Stopped")
        
        return True
    
    return False


def test_multi_camera_workflow():
    """Test: Complete multi-camera workflow"""
    print("\n" + "="*60)
    print("  MULTI-CAMERA WORKFLOW TEST")
    print("="*60)
    
    # 1. List all cameras
    print("\n📋 Step 1: List all cameras")
    cameras = test_list_cameras()
    
    if not cameras:
        print("\n❌ No cameras found! Exiting...")
        return False
    
    usb_cameras = [c for c in cameras if c['type'] == 'usb']
    
    if len(usb_cameras) < 2:
        print(f"\n⚠️  Only {len(usb_cameras)} USB camera(s) found.")
        print("Multi-camera test requires at least 2 cameras.")
        
        if len(usb_cameras) == 1:
            print("\nTesting with single camera...")
            test_record_with_specific_camera(camera_index=usb_cameras[0]['index'])
        
        return False
    
    print(f"\n✅ Found {len(usb_cameras)} USB cameras!")
    
    # 2. Test recording with first camera (by index)
    print("\n📹 Step 2: Record with first camera (by index)")
    cam1_index = usb_cameras[0]['index']
    test_record_with_specific_camera(camera_index=cam1_index)
    
    time.sleep(1)
    
    # 3. Test recording with second camera (by index)
    print("\n📹 Step 3: Record with second camera (by index)")
    cam2_index = usb_cameras[1]['index']
    test_record_with_specific_camera(camera_index=cam2_index)
    
    time.sleep(1)
    
    # 4. Test recording by model type
    print("\n📹 Step 4: Record by model type")
    
    # Find cameras by model type
    daheng_cameras = [c for c in usb_cameras if c['model_type'] == 'daheng']
    highfps_cameras = [c for c in usb_cameras if c['model_type'] == 'high_fps_usb']
    
    if daheng_cameras:
        print("\n  Testing Daheng camera...")
        test_record_with_specific_camera(camera_model='daheng')
        time.sleep(1)
    
    if highfps_cameras:
        print("\n  Testing High FPS camera...")
        test_record_with_specific_camera(camera_model='high_fps_usb')
        time.sleep(1)
    
    # 5. List recordings
    print("\n📁 Step 5: List all recordings")
    test_list_recordings()
    
    print("\n✅ Multi-camera workflow test completed!")
    return True


def run_basic_test():
    """Run basic recording test"""
    print("\n" + "="*60)
    print("  BASIC CAMERA HANDLER TEST")
    print("="*60)
    
    # 1. Detect camera
    camera_type = test_camera_detection()
    
    if not camera_type:
        print("\n❌ No camera detected! Exiting...")
        print("\nTroubleshooting:")
        print("  • For PiCamera: Run 'libcamera-hello --list-cameras'")
        print("  • For USB Camera: Run 'v4l2-ctl --list-devices'")
        return False
    
    # 2. Check initial status
    test_camera_status()
    
    # 3. Start recording
    duration = 5
    print(f"\n⏳ Recording for {duration} seconds...")
    
    success = test_start_recording(duration=duration)
    
    if not success:
        print("\n❌ Failed to start recording! Exiting...")
        return False
    
    # 4. Wait a bit and check status
    time.sleep(2)
    test_recording_status_during()
    
    # 5. Wait for recording to finish
    time.sleep(duration - 1.5)
    
    # 6. Check final status
    test_camera_status()
    
    # 7. List recordings
    test_list_recordings()
    
    print("\n✅ Basic test completed!")
    return True


def run_advanced_test():
    """Run advanced tests with different settings"""
    print("\n" + "="*60)
    print("  ADVANCED CAMERA HANDLER TEST")
    print("="*60)
    
    # 1. Detect camera
    camera_type = test_camera_detection()
    
    if not camera_type:
        print("\n❌ No camera detected! Exiting...")
        return False
    
    # 2. Test different resolutions
    resolutions = [
        (1920, 1080, 30),  # Full HD @ 30fps
        (1280, 720, 30),   # HD @ 30fps
    ]
    
    for width, height, fps in resolutions:
        print(f"\n📹 Testing {width}x{height} @ {fps}fps")
        print("-" * 60)
        
        result = camera_handlers.handle_start_recording({
            'duration': 3,
            'width': width,
            'height': height,
            'fps': fps
        })
        
        if result.get('success'):
            print(f"✅ Recording started: {width}x{height} @ {fps}fps")
            time.sleep(3.5)
            
            stop_result = camera_handlers.handle_stop_recording({})
            if stop_result.get('success'):
                print(f"✅ Recording stopped successfully")
        else:
            print(f"❌ Failed: {result.get('error')}")
    
    # 3. List all recordings
    test_list_recordings()
    
    # 4. Test high FPS if USB camera
    if camera_type == 'usb':
        test_high_fps_recording()
    
    print("\n✅ Advanced test completed!")
    return True


def run_interactive_test():
    """Interactive test mode"""
    print("\n" + "="*60)
    print("  INTERACTIVE CAMERA HANDLER TEST")
    print("="*60)
    
    while True:
        print("\n" + "-"*60)
        print("Choose a test:")
        print("\n  Detection & Info:")
        print("    1. Detect Camera")
        print("    2. List All Cameras (NEW)")
        print("    3. Camera Status")
        print("\n  Recording:")
        print("    4. Start Recording (5s)")
        print("    5. Start Recording (Custom)")
        print("    6. Stop Recording")
        print("    7. List Recordings")
        print("\n  Advanced:")
        print("    8. High FPS Test (USB only)")
        print("    9. Record with Specific Camera (NEW)")
        print("   10. Multi-Camera Workflow Test (NEW)")
        print("\n    0. Exit")
        print("-"*60)
        
        choice = input("\nEnter choice: ").strip()
        
        if choice == '1':
            test_camera_detection()
        
        elif choice == '2':
            test_list_cameras()
        
        elif choice == '3':
            test_camera_status()
        
        elif choice == '4':
            test_start_recording(duration=5)
        
        elif choice == '5':
            try:
                duration = int(input("Duration (seconds): "))
                width = int(input("Width (default 1920): ") or "1920")
                height = int(input("Height (default 1080): ") or "1080")
                fps = int(input("FPS (default 30): ") or "30")
                
                test_start_recording(duration, fps, width, height)
            except ValueError:
                print("❌ Invalid input!")
        
        elif choice == '6':
            test_stop_recording()
        
        elif choice == '7':
            test_list_recordings()
        
        elif choice == '8':
            test_high_fps_recording()
        
        elif choice == '9':
            print("\n📹 Record with Specific Camera")
            print("-" * 60)
            print("Select camera by:")
            print("  1. Camera Index")
            print("  2. Camera Model (daheng/high_fps_usb)")
            print("  3. Camera Name")
            
            method = input("\nChoice: ").strip()
            
            if method == '1':
                try:
                    index = int(input("Camera index: "))
                    test_record_with_specific_camera(camera_index=index)
                except ValueError:
                    print("❌ Invalid index!")
            
            elif method == '2':
                model = input("Model type (daheng/high_fps_usb): ").strip()
                test_record_with_specific_camera(camera_model=model)
            
            elif method == '3':
                name = input("Camera name pattern: ").strip()
                test_record_with_specific_camera(camera_name=name)
            
            else:
                print("❌ Invalid choice!")
        
        elif choice == '10':
            test_multi_camera_workflow()
        
        elif choice == '0':
            print("\n👋 Exiting...")
            break
        
        else:
            print("❌ Invalid choice!")


def main():
    """Main test runner"""
    print("\n" + "="*60)
    print("  CAMERA HANDLER TEST SUITE")
    print("="*60)
    print("\nTest Modes:")
    print("  1. Basic Test (auto)")
    print("  2. Advanced Test (auto)")
    print("  3. Multi-Camera Test (auto) [NEW]")
    print("  4. Interactive Mode")
    print("  0. Exit")
    
    choice = input("\nSelect mode: ").strip()
    
    if choice == '1':
        run_basic_test()
    
    elif choice == '2':
        run_advanced_test()
    
    elif choice == '3':
        test_multi_camera_workflow()
    
    elif choice == '4':
        run_interactive_test()
    
    elif choice == '0':
        print("\n👋 Exiting...")
    
    else:
        print("\n❌ Invalid choice! Running basic test...")
        run_basic_test()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        print("Stopping any active recordings...")
        camera_handlers.handle_stop_recording({})
        print("✅ Cleanup complete")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

