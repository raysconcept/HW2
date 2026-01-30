#!/usr/bin/env python3

"""
Debug the recording handler to see exactly what's happening
"""

import sys
sys.path.append('/home/pi/raspi_client/handlers')
from camera_handlers import list_usb_cameras, identify_camera, handle_start_recording

print("🔍 DEBUGGING RECORDING HANDLER")
print("=" * 50)

# Simulate the exact same call that the workflow test makes
test_data = {
    'camera_model': 'elp_imx577',
    'duration': 5,
    'width': 1280,
    'height': 720,
    'fps': 30
}

print("📋 Test data:")
for key, value in test_data.items():
    print(f"   {key}: {value}")
print()

print("📹 Step 1: List all cameras")
cameras = list_usb_cameras()
print(f"Found {len(cameras)} cameras:")
for i, cam in enumerate(cameras):
    model = identify_camera(cam['name'])
    print(f"  {i+1}. Index {cam['index']}: '{cam['name']}' → '{model}'")
print()

print("📹 Step 2: Find camera by model 'elp_imx577'")
camera_model = test_data['camera_model']
found = False
found_camera = None

for cam in cameras:
    detected_model = identify_camera(cam['name'])
    print(f"   Checking: '{cam['name']}' → '{detected_model}' == '{camera_model}' ? {detected_model == camera_model}")
    if detected_model == camera_model:
        found_camera = cam
        found = True
        print(f"   ✅ MATCH FOUND: Camera {cam['index']} ({cam['name']})")
        break

if not found:
    print(f"   ❌ NO MATCH: Camera model '{camera_model}' not found")
else:
    print(f"   Selected camera index: {found_camera['index']}")
print()

print("📹 Step 3: Get camera info by index")
if found:
    camera_index = found_camera['index']
    camera_info = next((c for c in cameras if c['index'] == camera_index), None)
    
    if camera_info:
        print(f"   Camera info: {camera_info}")
        final_model = identify_camera(camera_info['name'])
        print(f"   Final model check: '{camera_info['name']}' → '{final_model}'")
        
        if final_model == 'elp_imx577':
            print("   ✅ Would call start_recording_elp_imx577()")
        elif final_model == 'daheng_imx273':
            print("   ✅ Would call start_recording_daheng_imx273()")
        else:
            print(f"   ❌ ERROR: Unknown camera model: {final_model}")
    else:
        print(f"   ❌ Camera info not found for index {camera_index}")
print()

print("📹 Step 4: Run actual handler")
try:
    result = handle_start_recording(test_data)
    print(f"Handler result: {result}")
except Exception as e:
    print(f"Handler error: {e}")
    import traceback
    traceback.print_exc()

