#!/usr/bin/env python3
"""
Daheng High-Speed Performance Test

Tests the server functions at maximum speed to verify 200+ fps performance.
"""

import sys
import os
import time
import json

# Add handler path
sys.path.insert(0, '/home/user/Desktop/HOTWHEELS-main/devices_rasp/raspi_client/handlers')
sys.path.insert(0, '/home/user/Desktop/listener/devices_rasp/raspi_client/handlers')

print("🚀 DAHENG HIGH-SPEED PERFORMANCE TEST")
print("====================================")

try:
    from camera_handlers import (
        list_usb_cameras,
        identify_camera,
        start_recording_daheng_imx273,
        stop_recording_daheng_imx273
    )
    print("✅ Camera handlers imported")
except Exception as e:
    print(f"❌ Import failed: {e}")
    sys.exit(1)

def test_high_speed_recording():
    """Test Daheng recording at maximum speed"""
    
    # Find Daheng camera
    cameras = list_usb_cameras()
    daheng_camera = None
    
    for cam in cameras:
        usb_id = cam.get('usb_id', None)
        model = identify_camera(cam['name'], usb_id)
        if model == 'daheng_imx273':
            daheng_camera = cam
            break
    
    if not daheng_camera:
        print("❌ No Daheng camera found")
        return False
    
    print(f"🎯 Testing with: {daheng_camera['name']} (index {daheng_camera['index']})")
    
    # Test different speeds
    test_configs = [
        {"fps": 220, "duration": 2, "name": "Maximum Speed (220fps)"},
        {"fps": 180, "duration": 3, "name": "High Speed (180fps)"},  
        {"fps": 120, "duration": 5, "name": "Standard Speed (120fps)"}
    ]
    
    results = []
    
    for config in test_configs:
        print(f"\n🎬 Testing: {config['name']}")
        print(f"   📊 Target: {config['fps']} fps for {config['duration']}s")
        
        test_data = {
            'duration': config['duration'],
            'fps': config['fps'],
            'width': 1440,      # Full resolution
            'height': 1080,
            'exposure': 1500.0,
            'gain': 24.0
        }
        
        # Start recording
        start_result = start_recording_daheng_imx273(daheng_camera['index'], test_data)
        
        if start_result.get('success'):
            actual_fps = start_result.get('actual_fps', 0)
            frames_captured = start_result.get('frames_captured', 0)
            
            print(f"   ✅ Result: {actual_fps:.1f} fps ({frames_captured} frames)")
            
            # Check performance
            performance_ratio = actual_fps / config['fps']
            if performance_ratio >= 0.9:
                status = "✅ EXCELLENT"
            elif performance_ratio >= 0.7:
                status = "⚠️ GOOD"
            elif performance_ratio >= 0.5:
                status = "❌ POOR"
            else:
                status = "💥 TERRIBLE"
            
            print(f"   📊 Performance: {performance_ratio*100:.1f}% {status}")
            
            results.append({
                'config': config,
                'actual_fps': actual_fps,
                'frames': frames_captured,
                'performance': performance_ratio,
                'success': True
            })
            
            # Stop recording and encode to MP4
            print("   🛑 Stopping recording and encoding to MP4...")
            stop_result = stop_recording_daheng_imx273(daheng_camera['index'], {})
            
            if stop_result.get('success'):
                encoded_file = stop_result.get('encoded_file', '')
                if encoded_file and encoded_file.endswith('.mp4'):
                    print(f"   ✅ Video saved: {os.path.basename(encoded_file)}")
                    
                    # Check if file actually exists and has reasonable size
                    if os.path.exists(encoded_file):
                        file_size = os.path.getsize(encoded_file) / (1024 * 1024)  # MB
                        print(f"   📊 File size: {file_size:.2f} MB")
                        
                        if file_size > 1.0:  # Expect at least 1MB for high-speed video
                            print(f"   ✅ File size looks good for high-speed video")
                        else:
                            print(f"   ⚠️ File size seems small for {config['fps']} fps video")
                    else:
                        print(f"   ❌ Video file not found on disk")
                else:
                    print(f"   ❌ No valid MP4 file created: {encoded_file}")
                    
            else:
                print(f"   ❌ Stop recording failed: {stop_result.get('error', 'Unknown error')}")
            
            # Check for resource warnings
            if 'Warning stopping stream' in str(stop_result) or 'Warning closing camera' in str(stop_result):
                print("   ⚠️ Resource cleanup warnings detected")
            else:
                print("   ✅ Clean shutdown - no resource warnings")
            
        else:
            print(f"   ❌ Failed: {start_result.get('error', 'Unknown error')}")
            results.append({
                'config': config,
                'success': False,
                'error': start_result.get('error')
            })
        
        # Brief pause between tests
        time.sleep(0.5)
    
    # Summary
    print(f"\n🎯 HIGH-SPEED PERFORMANCE SUMMARY")
    print(f"==================================")
    
    successful_tests = [r for r in results if r['success']]
    if successful_tests:
        max_fps = max(r['actual_fps'] for r in successful_tests)
        avg_performance = sum(r['performance'] for r in successful_tests) / len(successful_tests)
        
        print(f"🚀 Maximum FPS achieved: {max_fps:.1f}")
        print(f"📊 Average performance: {avg_performance*100:.1f}%")
        
        if max_fps >= 180:
            print("✅ HIGH-SPEED CAPABLE: Camera achieving expected performance")
        elif max_fps >= 120:
            print("⚠️ MODERATE SPEED: Camera working but not at full potential")  
        else:
            print("❌ LOW SPEED: Camera significantly underperforming")
            
        print(f"\n💡 For 200+ fps in dual Pi recording:")
        print(f"   - Use fps: {int(max_fps)}")
        print(f"   - Duration should be short (2-5s) for high-speed")
        print(f"   - Monitor resource warnings during cleanup")
            
    else:
        print("❌ No successful recordings - check camera configuration")
    
    return len(successful_tests) > 0

if __name__ == "__main__":
    success = test_high_speed_recording()
    if success:
        print(f"\n🎉 High-speed testing complete!")
        print(f"📋 Ready for dual Pi recording with optimal settings")
    else:
        print(f"\n💥 High-speed testing failed!")
        print(f"🔧 Fix camera configuration before dual Pi recording")
    
    sys.exit(0 if success else 1)
