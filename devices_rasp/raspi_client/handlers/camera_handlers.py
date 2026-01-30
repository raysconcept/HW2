#!/usr/bin/env python3

"""
Camera Handlers - Minimal USB Camera Detection
Supports: ELP IMX577 (12MP, 120fps) and Daheng IMX273 (1.6MP, 227fps)
"""

import time
import subprocess
import os
import re
import threading
import numpy as np
import requests
from datetime import datetime
from pathlib import Path

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    import gxipy as gx
    GX_AVAILABLE = True
    # Initialize gxipy library with correct function
    gx.gx_init_lib()
    print("✅ gxipy library loaded and initialized")
except ImportError:
    GX_AVAILABLE = False
    print("❌ gxipy library not available")
except Exception as e:
    print(f"⚠️ gxipy init warning: {e}")
    GX_AVAILABLE = True

# Camera state
camera_state = {
    'recording': False,
    'camera_index': 0,
    'camera_model': None,
    'recording_path': os.path.expanduser('~/recordings'),
    
    # Daheng IMX273 state
    'daheng_cam': None,
    'daheng_frame_buffer': None,
    'daheng_ts_buffer': None,
    'daheng_id_buffer': None,
    'daheng_head': 0,
    'daheng_frame_count': 0,
    'daheng_capture_thread': None,
    'daheng_stop_flag': False,
    
    # ELP IMX577 state
    'elp_ffmpeg_process': None,
    'elp_raw_file': None,
    'elp_encoded_file': None
}


def list_usb_cameras():
    """List all USB cameras with basic info, including Daheng cameras"""
    cameras = []
    
    # Step 1: Get V4L2 video devices
    try:
        result = subprocess.run(
            ['v4l2-ctl', '--list-devices'],
            capture_output=True,
            text=True,
            timeout=3
        )
        
        if result.returncode == 0:
            lines = result.stdout.split('\n')
            current_name = None
            
            for line in lines:
                line = line.strip()
                
                if line and not line.startswith('/dev/'):
                    current_name = line.split('(')[0].strip()
                    
                elif line.startswith('/dev/video') and current_name:
                    device_index = int(re.search(r'/dev/video(\d+)', line).group(1))
                    cameras.append({
                        'index': device_index,
                        'device': line,
                        'name': current_name,
                        'interface': 'v4l2'
                    })
                    current_name = None
    
    except (FileNotFoundError, subprocess.TimeoutExpired):
        # Fallback to OpenCV probing
        if CV2_AVAILABLE:
            for i in range(5):
                try:
                    cap = cv2.VideoCapture(i)
                    if cap.isOpened():
                        cameras.append({
                            'index': i,
                            'device': f'/dev/video{i}',
                            'name': f'USB Camera {i}',
                            'interface': 'v4l2'
                        })
                        cap.release()
                except:
                    pass
    
    # Step 2: Check for Daheng cameras via USB (they don't appear in V4L2)
    try:
        result = subprocess.run(
            ['lsusb'],
            capture_output=True,
            text=True,
            timeout=3
        )
        
        if result.returncode == 0:
            daheng_count = 0
            for line in result.stdout.split('\n'):
                # Look for Daheng cameras: ID 2ba2:4d55 Daheng Imaging MER2-160-227U3C
                if '2ba2:4d55' in line or 'Daheng Imaging' in line:
                    daheng_count += 1
                    # Daheng cameras use gxipy, not V4L2 - assign virtual index
                    virtual_index = 100 + daheng_count  # Use 101, 102, etc. to avoid conflicts
                    
                    # Extract camera model from USB description
                    if 'MER2-160-227U3C' in line:
                        camera_name = 'Daheng MER2-160-227U3C (USB3.0)'
                    else:
                        camera_name = 'Daheng Imaging Camera (USB)'
                    
                    cameras.append({
                        'index': virtual_index,
                        'device': f'daheng:{daheng_count-1}',  # daheng:0, daheng:1, etc.
                        'name': camera_name,
                        'interface': 'gxipy',
                        'usb_id': '2ba2:4d55'
                    })
                    print(f"🎯 Detected Daheng camera: {camera_name} (virtual index {virtual_index})")
    
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    
    return cameras


def get_camera_controls(camera_index):
    """
    List all available V4L2 controls for a camera device
    Useful for debugging and discovering what controls are supported
    """
    device = f'/dev/video{camera_index}'
    try:
        result = subprocess.run(
            ['v4l2-ctl', '-d', device, '--list-ctrls'],
            capture_output=True, text=True, check=True
        )
        print(f"📋 Available controls for {device}:")
        print(result.stdout)
        return {
            'success': True,
            'device': device,
            'controls': result.stdout,
            'timestamp': time.time()
        }
    except subprocess.CalledProcessError as e:
        return {
            'success': False,
            'device': device,
            'error': f'Failed to get controls: {e.stderr}',
            'timestamp': time.time()
        }
    except Exception as e:
        return {
            'success': False,
            'device': device,
            'error': str(e),
            'timestamp': time.time()
        }


def identify_camera(camera_name, usb_id=None):
    """
    Identify camera model from name and USB ID
    
    Args:
        camera_name: Name of the camera device
        usb_id: USB vendor:product ID (e.g., '2ba2:4d55')
    
    Returns:
        'elp_imx577': ELP 12MP IMX577 (120fps @ 1080p)
        'daheng_imx273': Daheng 1.6MP IMX273 (227fps @ 1440x1080)
        'unknown': Unknown camera
    """
    name = camera_name.lower()
    
    # Daheng IMX273 - Check USB ID first (most reliable)
    if (usb_id == '2ba2:4d55' or 
        'daheng' in name or 
        'mercury' in name or 
        'mer2' in name or
        'mer2-160-227u3c' in name or
        'imx273' in name):
        print(f"🎯 Identified Daheng camera: {camera_name}")
        return 'daheng_imx273'
    
    # ELP IMX577 - Look for various patterns
    if ('elp' in name or 
        'imx577' in name or 
        'hd usb camera' in name or  # Common generic name for ELP cameras
        ('usb camera' in name and 'hd' in name) or
        (usb_id and '32e4:0577' in usb_id) or  # Specific USB vendor:product ID for ELP IMX577
        ('hd usb camera:' in name)):  # Handle "HD USB Camera: HD USB Camera" pattern
        print(f"🎯 Identified ELP camera: {camera_name}")
        return 'elp_imx577'
    
    return 'unknown'


def handle_list_cameras(data):
    """List all connected USB cameras"""
    cameras = list_usb_cameras()
    
    cameras_info = []
    unknown_usb_cameras = []
    
    for cam in cameras:
        # Pass USB ID if available (for Daheng cameras)
        usb_id = cam.get('usb_id', None)
        model = identify_camera(cam['name'], usb_id)
        camera_info = {
            'index': cam['index'],
            'device': cam['device'],
            'name': cam['name'],
            'model': model
        }
        cameras_info.append(camera_info)
        
        # Track unknown USB cameras for troubleshooting
        if model == 'unknown' and ('usb' in cam['name'].lower() or 'camera' in cam['name'].lower()):
            unknown_usb_cameras.append(camera_info)
    
    # Print troubleshooting info for unknown cameras
    if unknown_usb_cameras:
        print("⚠️ Found unknown USB cameras - generating troubleshooting info...")
        for cam in unknown_usb_cameras:
            print(f"📷 Unknown Camera: {cam['name']} ({cam['device']})")
            print("🔧 Run these commands on the Pi to identify the camera:")
            print(f"   v4l2-ctl -d {cam['device']} --list-ctrls")
            print(f"   v4l2-ctl -d {cam['device']} --all") 
            print(f"   lsusb | grep -i camera")
            print(f"   udevadm info -a -n {cam['device']} | grep -E 'idVendor|idProduct|manufacturer'")
            print("💡 To add camera support:")
            print("   1. Note the camera name and USB vendor/product ID")
            print("   2. Add detection rules to identify_camera() function in camera_handlers.py")
            print("   3. Test recording with: ffmpeg -f v4l2 -i /dev/video0 -t 3 test.mp4")
            print("")
    
    return {
        'success': True,
        'type': 'cameras_list',
        'cameras': cameras_info,
        'count': len(cameras_info),
        'unknown_usb_count': len(unknown_usb_cameras),
        'timestamp': time.time()
    }


def start_recording_elp_imx577(camera_index, data):
    """
    Start recording with ELP IMX577 camera using ffmpeg
    
    Process:
    1. Set camera controls via v4l2-ctl
    2. Capture MJPEG to raw file using ffmpeg
    3. Re-encode to H.264 MP4 after recording stops
    
    Specs:
    - 12MP sensor
    - 4K @ 30fps: 3840x3040
    - 1080p @ 120fps: 1920x1080
    """
    duration = data.get('duration', 10)
    width = data.get('width', 1920)
    height = data.get('height', 1080)
    fps = data.get('fps', 120)
    
    device = f'/dev/video{camera_index}'
    os.makedirs(camera_state['recording_path'], exist_ok=True)
    
    # Generate filenames with camera name prefix
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    raw_file = os.path.join(camera_state['recording_path'], f'elp_imx577_capture_{ts}_{width}x{height}_{fps}fps.mkv')
    encoded_file = os.path.join(camera_state['recording_path'], f'elp_imx577_capture_{ts}_{width}x{height}_{fps}fps.mp4')
    
    # Simple camera setup (no control modifications)
    
    # Start ffmpeg capture
    capture_cmd = [
        'ffmpeg', '-y',
        '-f', 'v4l2',
        '-input_format', 'mjpeg',
        '-video_size', f'{width}x{height}',
        '-framerate', str(fps),
        '-thread_queue_size', '512',
        '-i', device,
        '-c:v', 'copy',
        '-t', str(duration),
        raw_file
    ]
    
    try:
        print(f"🎥 Starting ffmpeg command: {' '.join(capture_cmd)}")
        
        process = subprocess.Popen(
            capture_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        print(f"🔄 ffmpeg process started, PID: {process.pid}")
        
        camera_state['elp_ffmpeg_process'] = process
        camera_state['elp_raw_file'] = raw_file
        camera_state['elp_encoded_file'] = encoded_file
        
        # Start monitoring thread to auto-complete recording after duration
        def monitor_recording():
            """Monitor ffmpeg process and complete recording when done"""
            try:
                print(f"🔄 ELP Monitor: Waiting for ffmpeg process to complete (no timeout)")
                
                # Wait indefinitely for process completion
                stdout, stderr = process.communicate()
                
                print(f"🎬 ELP Monitor: ffmpeg process completed with return code: {process.returncode}")
                print(f"📄 ffmpeg stdout: {stdout.decode() if stdout else 'None'}")
                print(f"📄 ffmpeg stderr: {stderr.decode() if stderr else 'None'}")
                
                # Check if the raw file actually exists
                if os.path.exists(raw_file):
                    file_size = os.path.getsize(raw_file)
                    print(f"✅ Raw file created: {raw_file} ({file_size} bytes)")
                else:
                    print(f"❌ Raw file NOT created: {raw_file}")
                    camera_state['recording'] = False
                    return
                
                print(f"🔄 ELP Monitor: Calling stop_recording...")
                
                # Automatically call stop_recording to complete the workflow
                if camera_state['recording'] and camera_state['camera_model'] == 'elp_imx577':
                    stop_result = stop_recording_elp_imx577()
                    print(f"🔍 ELP Monitor: stop_recording result: {stop_result}")
                    
                    if stop_result.get('success'):
                        camera_state['recording'] = False
                        camera_state['last_recording'] = stop_result.get('encoded_file')
                        print(f"✅ ELP recording completed: {camera_state['last_recording']}")
                    else:
                        print(f"❌ ELP recording completion failed: {stop_result.get('error')}")
                        camera_state['recording'] = False
                else:
                    print(f"⚠️ ELP Monitor: Skipping stop - recording: {camera_state['recording']}, model: {camera_state['camera_model']}")
                    camera_state['recording'] = False
                        
            # No timeout handling needed - wait indefinitely
            except Exception as e:
                print(f"❌ ELP recording monitor error: {e}")
                import traceback
                traceback.print_exc()
                camera_state['recording'] = False
        
        # Start monitoring in background thread
        monitor_thread = threading.Thread(target=monitor_recording, daemon=True)
        monitor_thread.start()
        
        return {
            'success': True,
            'type': 'recording_started',
            'camera_model': 'elp_imx577',
            'camera_index': camera_index,
            'device': device,
            'duration': duration,
            'resolution': f'{width}x{height}',
            'fps': fps,
            'raw_file': raw_file,
            'encoded_file': encoded_file,
            'message': 'Recording started with ffmpeg',
            'timestamp': time.time()
        }
        
    except Exception as e:
        return {
            'success': False,
            'type': 'recording_error',
            'error': str(e),
            'timestamp': time.time()
        }


def daheng_capture_thread_func(cam, buffer_frames, target_fps):
    """Thread function for capturing Daheng frames to RAM"""
    print(f"🎬 Daheng capture thread starting...")
    
    # Initialize gxipy in this thread context
    try:
        gx.gx_init_lib()
        print(f"✅ gxipy initialized in capture thread")
    except Exception as e:
        print(f"⚠️ gxipy thread init warning: {e}")
    
    # Wait for first frame with retry logic
    raw_image = None
    max_retries = 10
    for attempt in range(max_retries):
        try:
            raw_image = cam.data_stream[0].get_image(timeout=1000)
            if raw_image is not None:
                break
        except Exception as e:
            print(f"   Attempt {attempt + 1}/{max_retries}: Waiting for data stream... ({e})")
            time.sleep(0.1)
    
    if raw_image is None:
        print(f"❌ Daheng: Failed to get first frame after {max_retries} attempts")
        return
    
    first_numpy = raw_image.get_numpy_array()
    if first_numpy is None or first_numpy.ndim != 2:
        print(f"❌ Daheng: Invalid first frame data")
        return
    
    height, width = first_numpy.shape
    
    # Allocate ring buffers in RAM
    camera_state['daheng_frame_buffer'] = np.empty((buffer_frames, height, width), dtype=np.uint8)
    camera_state['daheng_ts_buffer'] = np.empty(buffer_frames, dtype=np.float64)
    camera_state['daheng_id_buffer'] = np.empty(buffer_frames, dtype=np.int64)
    camera_state['daheng_head'] = 0
    camera_state['daheng_frame_count'] = 0
    
    # Store first frame
    camera_state['daheng_frame_buffer'][0, :, :] = first_numpy
    camera_state['daheng_ts_buffer'][0] = time.time()
    camera_state['daheng_id_buffer'][0] = raw_image.get_frame_id()
    camera_state['daheng_head'] = 1
    camera_state['daheng_frame_count'] = 1
    
    print(f"✅ Daheng: Starting capture loop (target: {target_fps} fps)")
    
    # Capture loop
    while not camera_state['daheng_stop_flag']:
        try:
            raw_image = cam.data_stream[0].get_image(timeout=1000)
            if raw_image is None:
                continue
            
            numpy_image = raw_image.get_numpy_array()
            if numpy_image is None:
                continue
        except Exception as e:
            print(f"⚠️ Daheng capture error: {e}")
            time.sleep(0.01)  # Brief pause before retry
            continue
        
        head = camera_state['daheng_head']
        camera_state['daheng_frame_buffer'][head, :, :] = numpy_image
        camera_state['daheng_ts_buffer'][head] = time.time()
        camera_state['daheng_id_buffer'][head] = raw_image.get_frame_id()
        
        camera_state['daheng_head'] = (head + 1) % buffer_frames
        camera_state['daheng_frame_count'] += 1


def start_recording_daheng_imx273(camera_index, data):
    """
    Start recording with Daheng IMX273 camera using gxipy SDK
    
    Process:
    1. Open camera with Daheng SDK
    2. Configure camera settings (exposure, gain, gamma, etc.)
    3. Capture Bayer frames to RAM ring buffer
    4. After stop, demosaic and encode to MP4
    
    Specs:
    - 1.6MP sensor
    - Max resolution: 1440x1080 @ 227fps
    - Global shutter
    - USB3 Vision interface
    """
    if not GX_AVAILABLE:
        return {
            'success': False,
            'type': 'recording_error',
            'error': 'Daheng gxipy library not installed',
            'timestamp': time.time()
        }
    
    duration = data.get('duration', 10)
    fps = data.get('fps', 220)
    exposure = data.get('exposure', 1500.0)  # microseconds
    gain = data.get('gain', 24.0)  # dB
    gamma = data.get('gamma', 0.4)
    contrast = data.get('contrast', -50)
    
    buffer_frames = int(fps * duration)
    
    try:
        # Ensure any existing Daheng camera is properly closed
        if camera_state['daheng_cam'] is not None:
            print("🔄 Closing existing Daheng camera connection...")
            try:
                camera_state['daheng_cam'].stream_off()
                camera_state['daheng_cam'].close_device()
            except Exception as e:
                print(f"⚠️ Warning closing existing camera: {e}")
            camera_state['daheng_cam'] = None
        
        # Open Daheng camera
        device_manager = gx.DeviceManager()
        dev_num, dev_info_list = device_manager.update_all_device_list()
        
        if dev_num == 0:
            return {
                'success': False,
                'type': 'recording_error',
                'error': 'No Daheng cameras found',
                'timestamp': time.time()
            }
        
        # For Daheng cameras, use device index 1 (first Daheng camera)
        # camera_index is virtual (101+), but gxipy uses 1-based indexing
        daheng_device_index = 1  # First (and likely only) Daheng camera
        print(f"📹 Opening Daheng camera at gxipy index {daheng_device_index}")
        cam = device_manager.open_device_by_index(daheng_device_index)
        
        # Configure camera
        print(f"📊 Configuring Daheng camera settings...")
        if cam.TriggerMode.is_implemented() and cam.TriggerMode.is_writable():
            cam.TriggerMode.set(gx.GxSwitchEntry.OFF)
            print(f"✅ Set TriggerMode to OFF")
        
        if cam.ExposureTime.is_implemented() and cam.ExposureTime.is_writable():
            cam.ExposureTime.set(exposure)
            print(f"📊 Set Exposure to {exposure}μs")
        
        if cam.Gain.is_implemented() and cam.Gain.is_writable():
            cam.Gain.set(gain)
            print(f"📊 Set Gain to {gain}dB")
        
        # Set gamma (check if writable)
        if hasattr(cam, 'GammaEnable') and cam.GammaEnable.is_implemented() and cam.GammaEnable.is_writable():
            cam.GammaEnable.set(True)
        if hasattr(cam, 'Gamma') and cam.Gamma.is_implemented() and cam.Gamma.is_writable():
            cam.Gamma.set(gamma)
            print(f"📊 Set Gamma to {gamma}")
        else:
            print(f"⚠️ Gamma control not writable, using camera defaults")
        
        # Set contrast (check if writable)
        if hasattr(cam, 'ContrastParam') and cam.ContrastParam.is_implemented() and cam.ContrastParam.is_writable():
            cam.ContrastParam.set(contrast)
            print(f"📊 Set Contrast to {contrast}")
        else:
            print(f"⚠️ Contrast control not writable, using camera defaults")
        
        # Set FPS (exactly like working test_camera_imx273.py)
        if hasattr(cam, 'AcquisitionFrameRate') and cam.AcquisitionFrameRate.is_implemented():
            if cam.AcquisitionFrameRate.is_writable():
                try:
                    if hasattr(cam, 'AcquisitionFrameRateMode'):
                        cam.AcquisitionFrameRateMode.set(gx.GxSwitchEntry.ON)
                except Exception:
                    pass
                cam.AcquisitionFrameRate.set(float(fps))
                print(f"📊 Set FPS to {fps}")
        
        print(f"🔧 Camera configuration complete, starting streaming...")
        
        # Start streaming (exactly like working test_camera_imx273.py)
        try:
            cam.stream_on()
            print(f"✅ Daheng camera streaming started!")
        except Exception as stream_error:
            print(f"❌ Failed to start camera stream: {stream_error}")
            try:
                cam.close_device()
            except:
                pass
            return {
                'success': False,
                'type': 'recording_error', 
                'error': f'Failed to start camera stream: {stream_error}',
                'timestamp': time.time()
            }
        
        # Initialize capture buffers immediately (like working test_camera_imx273.py)
        print(f"📸 Getting first image to initialize buffers...")
        try:
            # Get first frame to determine resolution (exactly like working test)
            raw_image = cam.data_stream[0].get_image()
            if raw_image is None:
                print(f"❌ Failed to get initial image")
                cam.stream_off()
                cam.close_device()
                return {
                    'success': False,
                    'type': 'recording_error',
                    'error': 'Failed to get initial image from data stream',
                    'timestamp': time.time()
                }
            
            first_numpy = raw_image.get_numpy_array()
            if first_numpy is None or first_numpy.ndim != 2:
                print(f"❌ Invalid initial frame data")
                cam.stream_off()
                cam.close_device()
                return {
                    'success': False,
                    'type': 'recording_error',
                    'error': 'Invalid initial frame data',
                    'timestamp': time.time()
                }
            
            height, width = first_numpy.shape
            print(f"✅ Image resolution: {width} x {height}")
            
            # Allocate ring buffers in RAM (like working test)
            camera_state['daheng_frame_buffer'] = np.empty((buffer_frames, height, width), dtype=np.uint8)
            camera_state['daheng_ts_buffer'] = np.empty(buffer_frames, dtype=np.float64)
            camera_state['daheng_id_buffer'] = np.empty(buffer_frames, dtype=np.int64)
            camera_state['daheng_head'] = 0
            camera_state['daheng_frame_count'] = 0
            
            # Store first frame
            camera_state['daheng_frame_buffer'][0, :, :] = first_numpy
            camera_state['daheng_ts_buffer'][0] = time.time()
            camera_state['daheng_id_buffer'][0] = raw_image.get_frame_id()
            camera_state['daheng_head'] = 1
            camera_state['daheng_frame_count'] = 1
            
            print(f"✅ Ring buffer allocated: {buffer_frames} frames")
            
        except Exception as init_error:
            print(f"❌ Buffer initialization failed: {init_error}")
            try:
                cam.stream_off()
                cam.close_device()
            except:
                pass
            return {
                'success': False,
                'type': 'recording_error',
                'error': f'Buffer initialization failed: {init_error}',
                'timestamp': time.time()
            }
        
        # Store camera state for main-thread capture (no threading)
        camera_state['daheng_cam'] = cam
        camera_state['daheng_stop_flag'] = False
        camera_state['daheng_capture_thread'] = None  # No thread needed
        camera_state['recording'] = True
        
        # Start a simple capture process in main thread (like working test)
        print(f"🎬 Starting {duration}s capture in main thread...")
        
        # Capture for the specified duration
        start_time = time.time()
        target_end_time = start_time + duration
        
        frame_count = camera_state['daheng_frame_count']  # Start from 1 (first frame already captured)
        
        # Optimize for maximum performance
        last_report_time = start_time
        report_interval = 500  # Report every 500 frames for high-speed capture
        
        while time.time() < target_end_time and not camera_state['daheng_stop_flag']:
            try:
                # Use same timeout as working test_camera_imx273.py
                raw_image = cam.data_stream[0].get_image(timeout=1000)
                if raw_image is None:
                    continue
                
                numpy_image = raw_image.get_numpy_array()
                if numpy_image is None:
                    continue
                
                # Store in ring buffer (optimized)
                head = frame_count % buffer_frames
                camera_state['daheng_frame_buffer'][head, :, :] = numpy_image
                camera_state['daheng_ts_buffer'][head] = time.time()
                camera_state['daheng_id_buffer'][head] = raw_image.get_frame_id()
                
                frame_count += 1
                camera_state['daheng_frame_count'] = frame_count  # ✅ UPDATE GLOBAL STATE!
                
                # Less frequent progress reports for high-speed capture
                if frame_count % report_interval == 0:
                    current_time = time.time()
                    elapsed_since_report = current_time - last_report_time
                    if elapsed_since_report > 0:
                        current_fps = report_interval / elapsed_since_report
                        total_elapsed = current_time - start_time
                        avg_fps = frame_count / total_elapsed if total_elapsed > 0 else 0
                        print(f"📊 {frame_count} frames, current: {current_fps:.1f} fps, avg: {avg_fps:.1f} fps")
                        last_report_time = current_time
                
            except Exception as e:
                print(f"⚠️ Capture error: {e}")
                continue  # Remove sleep for maximum speed
        
        # Update final frame count and head position
        camera_state['daheng_frame_count'] = frame_count  # ✅ ENSURE FINAL COUNT IS SAVED!
        camera_state['daheng_head'] = frame_count % buffer_frames
        
        elapsed = time.time() - start_time
        final_fps = frame_count / elapsed if elapsed > 0 else 0
        
        print(f"✅ Capture completed: {frame_count} frames in {elapsed:.2f}s ({final_fps:.1f} fps)")
        
        # ✅ MATCH ELP BEHAVIOR: Just return 'recording_started' and wait for stop_recording
        camera_state['recording'] = True
        camera_state['camera_model'] = 'daheng_imx273'
        camera_state['camera_index'] = camera_index
        camera_state['daheng_cam'] = cam  # Keep camera reference for stop_recording
        camera_state['last_recording'] = {
            'camera_model': 'daheng_imx273',
            'camera_index': camera_index,
            'duration': duration,
            'fps': fps,
            'actual_fps': final_fps,
            'frames_captured': frame_count,
            'timestamp': time.time()
        }
        
        return {
            'success': True,
            'type': 'recording_started',  # ✅ SAME AS ELP: recording_started!
            'camera_model': 'daheng_imx273',
            'camera_index': camera_index,
            'duration': duration,
            'fps': fps,
            'actual_fps': final_fps,
            'buffer_frames': buffer_frames,
            'frames_captured': frame_count,
            'exposure': exposure,
            'gain': gain,
            'message': 'Recording completed to RAM buffer',
            'timestamp': time.time()
        }
        
    except Exception as e:
        return {
            'success': False,
            'type': 'recording_error',
            'error': str(e),
            'timestamp': time.time()
        }


def handle_start_recording(data):
    """
    Start recording from USB camera
    
    Params:
        camera_index: int (optional, defaults to 0)
        camera_model: str (optional, 'elp_imx577' or 'daheng_imx273')
        duration: int (seconds, default 10)
        width: int (resolution width)
        height: int (resolution height)
        fps: int (frames per second)
    """
    if camera_state['recording']:
        return {
            'success': False,
            'type': 'error',
            'error': 'Already recording',
            'timestamp': time.time()
        }
    
    # Get camera selection
    camera_index = data.get('camera_index', 0)
    camera_model = data.get('camera_model')
    
    # Find camera by model if specified
    if camera_model:
        cameras = list_usb_cameras()
        found = False
        for cam in cameras:
            usb_id = cam.get('usb_id', None)
            if identify_camera(cam['name'], usb_id) == camera_model:
                camera_index = cam['index']
                found = True
                break
        
        if not found:
            return {
                'success': False,
                'type': 'error',
                'error': f'Camera model {camera_model} not found',
                'timestamp': time.time()
            }
    
    # Get camera info
    cameras = list_usb_cameras()
    camera_info = next((c for c in cameras if c['index'] == camera_index), None)
    
    if not camera_info:
        return {
            'success': False,
            'type': 'error',
            'error': f'Camera at index {camera_index} not found',
            'timestamp': time.time()
        }
    
    usb_id = camera_info.get('usb_id', None)
    model = identify_camera(camera_info['name'], usb_id)
    
    # Route to camera-specific recording function
    if model == 'elp_imx577':
        result = start_recording_elp_imx577(camera_index, data)
    elif model == 'daheng_imx273':
        result = start_recording_daheng_imx273(camera_index, data)
    else:
        return {
            'success': False,
            'type': 'error',
            'error': f'Unknown camera model: {model}',
            'timestamp': time.time()
        }
    
    # Update state
    camera_state['recording'] = True
    camera_state['camera_index'] = camera_index
    camera_state['camera_model'] = model
    
    # Add camera name to result
    result['camera_name'] = camera_info['name']
    
    return result


def stop_recording_elp_imx577():
    """
    Stop ELP IMX577 recording and re-encode to H.264
    
    Process:
    1. Wait for ffmpeg capture to finish
    2. Re-encode MJPEG to H.264 MP4
    """
    process = camera_state['elp_ffmpeg_process']
    raw_file = camera_state['elp_raw_file']
    encoded_file = camera_state['elp_encoded_file']
    
    if not process:
        return {
            'success': False,
            'type': 'recording_error',
            'error': 'No active recording',
            'timestamp': time.time()
        }
    
    try:
        # Wait for ffmpeg to finish (no timeout - wait indefinitely)
        process.wait()
        
        # Re-encode to H.264 MP4 (fast preset for testing)
        encode_cmd = [
            'ffmpeg', '-y',
            '-i', raw_file,
            '-c:v', 'libx264',
            '-preset', 'fast',  # Much faster encoding
            '-crf', '23',       # Slightly lower quality but much faster
            '-pix_fmt', 'yuv420p',
            encoded_file
        ]
        
        encode_process = subprocess.run(
            encode_cmd,
            capture_output=True
            # No timeout - wait indefinitely for encoding
        )
        
        if encode_process.returncode == 0:
            # Optionally delete raw file
            # os.remove(raw_file)
            
            # Update last recording path for optional upload
            camera_state['last_recording'] = encoded_file
            
            return {
                'success': True,
                'type': 'recording_stopped',
                'camera_model': 'elp_imx577',
                'raw_file': raw_file,
                'encoded_file': encoded_file,
                'message': 'Recording stopped and encoded',
                'timestamp': time.time()
            }
        else:
            return {
                'success': False,
                'type': 'recording_error',
                'error': f'Encoding failed: {encode_process.stderr.decode()}',
                'raw_file': raw_file,
                'timestamp': time.time()
            }
    
    # No timeout handling - wait indefinitely for completion
    
    except Exception as e:
        return {
            'success': False,
            'type': 'recording_error',
            'error': str(e),
            'timestamp': time.time()
        }
    
    finally:
        camera_state['elp_ffmpeg_process'] = None
        camera_state['elp_raw_file'] = None
        camera_state['elp_encoded_file'] = None
        # Update last recording path
        if 'encoded_file' in locals() and encoded_file and os.path.exists(encoded_file):
            camera_state['last_recording'] = encoded_file


def save_daheng_buffer_to_mp4(target_fps=220):
    """
    Demosaic Bayer frames from RAM buffer and encode to MP4
    
    Returns path to saved MP4 file
    """
    frame_buffer = camera_state['daheng_frame_buffer']
    ts_buffer = camera_state['daheng_ts_buffer']
    id_buffer = camera_state['daheng_id_buffer']
    head = camera_state['daheng_head']
    frame_count = camera_state['daheng_frame_count']
    
    if frame_buffer is None or frame_count == 0:
        return None
    
    os.makedirs(camera_state['recording_path'], exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = os.path.join(camera_state['recording_path'], f'capture_{ts}_color.mp4')
    
    buffer_size = frame_buffer.shape[0]
    total_frames = min(frame_count, buffer_size)
    
    if total_frames < 2:
        return None
    
    # Determine chronological order
    if frame_count <= buffer_size:
        start = 0
    else:
        start = head
    
    ordered_indices = [(start + i) % buffer_size for i in range(total_frames)]
    
    # Compute FPS from timestamps
    first_ts = ts_buffer[ordered_indices[0]]
    last_ts = ts_buffer[ordered_indices[-1]]
    duration = last_ts - first_ts
    
    if duration > 0:
        fps = (total_frames - 1) / duration
    else:
        fps = float(target_fps)
    
    if fps <= 0 or fps > 1000:
        fps = float(target_fps)
    
    fps = round(fps)
    
    # Get frame dimensions
    sample_frame = frame_buffer[ordered_indices[0]]
    if sample_frame.ndim != 2:
        return None
    
    height, width = sample_frame.shape
    
    # Create video writer - use H.264 codec for browser compatibility
    fourcc_avc1 = cv2.VideoWriter_fourcc(*'avc1')  # H.264 codec
    writer = cv2.VideoWriter(out_path, fourcc_avc1, fps, (width, height), True)
    
    if not writer.isOpened():
        print("⚠️ avc1 (H.264) codec failed, trying mp4v fallback")
        fourcc_mp4v = cv2.VideoWriter_fourcc(*'mp4v')  # MPEG-4 fallback
        writer = cv2.VideoWriter(out_path, fourcc_mp4v, fps, (width, height), True)
        print("📹 Using mp4v codec (may have browser compatibility issues)")
    else:
        print("✅ Using avc1 (H.264) codec for browser compatibility")
    
    if not writer.isOpened():
        return None
    
    # Demosaic and write frames
    bayer_code = cv2.COLOR_BAYER_BG2BGR
    
    for idx in ordered_indices:
        raw_bayer = frame_buffer[idx]
        frame_bgr = cv2.cvtColor(raw_bayer, bayer_code)
        writer.write(frame_bgr)
    
    writer.release()
    
    return out_path


def save_daheng_buffer_to_mp4():
    """
    Save Daheng ring buffer to MP4 video file
    Uses the exact same approach as working test_camera_imx273.py
    """
    frame_buffer = camera_state['daheng_frame_buffer']
    ts_buffer = camera_state['daheng_ts_buffer'] 
    id_buffer = camera_state['daheng_id_buffer']
    head = camera_state['daheng_head']
    frame_count = camera_state['daheng_frame_count']
    
    if frame_buffer is None or frame_count == 0:
        print("No frames to save.")
        return None

    buffer_size = frame_buffer.shape[0]
    total_frames = min(frame_count, buffer_size)

    if total_frames < 2:
        print("Not enough frames to make a video.")
        return None

    # Create output path with camera name prefix
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = os.path.join(camera_state['recording_path'], f'daheng_imx273_capture_{timestamp}.mp4')
    os.makedirs(camera_state['recording_path'], exist_ok=True)

    print(f"🎬 Encoding {total_frames} frames to MP4...")

    # Determine chronological order: oldest -> newest (exactly like working test)
    if frame_count <= buffer_size:
        # Never wrapped. Valid frames are [0 .. total_frames-1]
        start = 0
    else:
        # Wrapped at least once. Oldest frame is at 'head'
        start = head

    ordered_indices = [(start + i) % buffer_size for i in range(total_frames)]

    # Compute effective FPS from timestamps (exactly like working test)
    first_ts = ts_buffer[ordered_indices[0]]
    last_ts = ts_buffer[ordered_indices[-1]]
    duration = last_ts - first_ts

    if duration > 0:
        fps = (total_frames - 1) / duration
        print(f"📊 Measured capture FPS: {fps:.2f}")
    else:
        fps = 220.0  # Default
        print("Timestamps too close; using default FPS for encoding.")

    if fps <= 0 or fps > 1000:
        fps = 220.0

    fps = round(fps)

    # Get frame dimensions
    sample_frame = frame_buffer[ordered_indices[0]]
    if sample_frame.ndim != 2:
        print(f"Expected 2D Bayer frames, got shape: {sample_frame.shape}")
        return None

    height, width = sample_frame.shape
    print(f"📊 Video dimensions: {width}x{height} @ {fps} fps")

    # Create MP4 writer - use H.264 codec for browser compatibility
    fourcc_avc1 = cv2.VideoWriter_fourcc(*"avc1")  # H.264 codec
    writer = cv2.VideoWriter(out_path, fourcc_avc1, fps, (width, height), True)
    
    if not writer.isOpened():
        print("⚠️ avc1 (H.264) codec failed, trying mp4v fallback")
        fourcc_mp4v = cv2.VideoWriter_fourcc(*"mp4v")  # MPEG-4 fallback
        writer = cv2.VideoWriter(out_path, fourcc_mp4v, fps, (width, height), True)
        print("📹 Using mp4v codec (may have browser compatibility issues)")
    else:
        print("✅ Using avc1 (H.264) codec for browser compatibility")
    
    if not writer.isOpened():
        print("❌ Failed to open VideoWriter")
        return None

    print(f"🎬 Encoding to color MP4...")

    # Demosaic Bayer to color (exactly like working test)
    bayer_code = cv2.COLOR_BAYER_BG2BGR  # Same as working test

    for i, idx in enumerate(ordered_indices):
        raw_bayer = frame_buffer[idx]  # (H, W), uint8
        
        # Demosaic to BGR color (exactly like working test)
        frame_bgr = cv2.cvtColor(raw_bayer, bayer_code)
        writer.write(frame_bgr)

        # Progress report
        if (i + 1) % 200 == 0 or i == total_frames - 1:
            print(f"  📹 Encoded {i + 1}/{total_frames} frames")

    writer.release()
    
    # Verify file was created and has reasonable size
    if os.path.exists(out_path):
        file_size = os.path.getsize(out_path)
        file_size_mb = file_size / (1024 * 1024)
        print(f"✅ Video saved: {out_path}")
        print(f"📊 File size: {file_size_mb:.2f} MB")
        print(f"📊 Final video: {width}x{height} @ {fps}fps, {total_frames} frames")
        return out_path
    else:
        print(f"❌ Failed to create video file")
        return None


def stop_recording_daheng_imx273(camera_index=None, data=None):
    """
    Stop Daheng IMX273 recording and encode to MP4
    
    Args:
        camera_index: Camera index (optional, for compatibility)
        data: Additional data (optional, for compatibility)
    
    Process:
    1. Stop camera streaming
    2. Demosaic Bayer frames from RAM 
    3. Encode to MP4
    """
    cam = camera_state['daheng_cam']
    
    if not cam:
        return {
            'success': False,
            'type': 'recording_error',
            'error': 'No active recording',
            'timestamp': time.time()
        }
    
    try:
        # Signal recording to stop
        camera_state['daheng_stop_flag'] = True
        
        # Re-initialize gxipy before cleanup (fix context issue)
        try:
            gx.gx_init_lib()
            print("🔧 Re-initialized gxipy for cleanup")
        except Exception as e:
            print(f"⚠️ gxipy re-init warning: {e}")
        
        # Stop camera streaming
        try:
            cam.stream_off()
            print("🛑 Daheng camera streaming stopped")
        except Exception as e:
            print(f"⚠️ Warning stopping stream: {e}")
            # Don't fail the function, just log it
        
        try:
            cam.close_device()
            print("🔒 Daheng camera closed")
        except Exception as e:
            print(f"⚠️ Warning closing camera: {e}")
            # Don't fail the function, just log it
        
        # Save frame count before cleanup
        final_frame_count = camera_state['daheng_frame_count']
        
        # Encode captured frames to MP4 video (real video file!)
        print(f"🎬 Processing {final_frame_count} captured frames...")
        out_path = save_daheng_buffer_to_mp4()
        
        if not out_path:
            print(f"❌ Failed to encode video - no file created")
            # Still return success for the recording part, but note encoding failure
            out_path = "encoding_failed"
        
        # Clean up camera state
        camera_state['daheng_cam'] = None
        camera_state['daheng_frame_buffer'] = None
        camera_state['daheng_ts_buffer'] = None
        camera_state['daheng_id_buffer'] = None
        camera_state['daheng_head'] = 0
        camera_state['daheng_frame_count'] = 0
        camera_state['daheng_capture_thread'] = None
        camera_state['daheng_stop_flag'] = False
        camera_state['recording'] = False
        
        if out_path and out_path != "encoding_failed":
            # Update last recording path for optional upload
            camera_state['last_recording'] = out_path
            
            return {
                'success': True,
                'type': 'recording_stopped',
                'camera_model': 'daheng_imx273',
                'encoded_file': out_path,
                'frame_count': final_frame_count,
                'message': 'Recording stopped and MP4 encoded',
                'timestamp': time.time()
            }
        else:
            return {
                'success': False,
                'type': 'recording_error',
                'error': 'Failed to encode MP4',
                'timestamp': time.time()
            }
    
    except Exception as e:
        return {
            'success': False,
            'type': 'recording_error',
            'error': str(e),
            'timestamp': time.time()
        }
    
    finally:
        # Clean up state
        camera_state['daheng_cam'] = None
        camera_state['daheng_capture_thread'] = None
        camera_state['daheng_frame_buffer'] = None
        camera_state['daheng_ts_buffer'] = None
        camera_state['daheng_id_buffer'] = None
        camera_state['daheng_head'] = 0
        camera_state['daheng_frame_count'] = 0
        camera_state['daheng_stop_flag'] = False
        # Update last recording path
        if out_path and os.path.exists(out_path):
            camera_state['last_recording'] = out_path


def handle_stop_recording(data):
    """Stop recording"""
    if not camera_state['recording']:
        return {
            'success': False,
            'type': 'error',
            'error': 'Not recording',
            'timestamp': time.time()
        }
    
    # Route to camera-specific stop function
    model = camera_state['camera_model']
    
    if model == 'elp_imx577':
        result = stop_recording_elp_imx577()
    elif model == 'daheng_imx273':
        result = stop_recording_daheng_imx273()
    else:
        result = {
            'success': True,
            'type': 'recording_stopped',
            'message': 'Unknown camera model',
            'timestamp': time.time()
        }
    
    camera_state['recording'] = False
    
    return result


def upload_video_to_server(video_path, server_ip='192.168.1.2', raspi_id=None, camera_model=None):
    """
    Upload video file to server via raw HTTP binary transfer
    
    Args:
        video_path: Path to video file
        server_ip: Server IP address
        raspi_id: Raspberry Pi identifier
        camera_model: Camera model name (for server identification)
    
    Returns:
        dict with upload result
    """
    if not os.path.exists(video_path):
        return {
            'success': False,
            'error': 'Video file not found',
            'path': video_path
        }
    
    try:
        # Auto-detect raspi_id if not provided
        if not raspi_id:
            import socket
            hostname = socket.gethostname().lower()
            if 'sensor' in hostname:
                raspi_id = 'raspi_sensor'
            elif 'main' in hostname:
                raspi_id = 'raspi_main'
            else:
                raspi_id = 'raspi_unknown'
            print(f"⚠️ No raspi_id provided, using hostname-based: {raspi_id}")
        
        url = f'http://{server_ip}:3001/api/upload-video'
        headers = {
            'X-Raspi-ID': raspi_id,
            'X-Camera-Model': camera_model or 'unknown',
            'Content-Type': 'video/mp4'
        }
        
        file_size = os.path.getsize(video_path)
        print(f"📦 Upload details:")
        print(f"   📁 File: {video_path}")
        print(f"   📊 Size: {file_size / (1024*1024):.2f} MB")
        print(f"   🌐 URL: {url}")
        print(f"   📋 Headers: {headers}")
        
        with open(video_path, 'rb') as video_file:
            response = requests.post(
                url,
                data=video_file,
                headers=headers,
                # No timeout - wait indefinitely for upload
                stream=True   # Enable streaming for large files
            )
        
        if response.status_code == 200:
            result = response.json()
            return {
                'success': True,
                'message': result.get('message', 'Upload successful'),
                'queue_position': result.get('queuePosition', 0),
                'file_size': result.get('fileSize', file_size)
            }
        elif response.status_code == 413:
            return {
                'success': False,
                'error': 'File too large (max 500MB)',
                'file_size': file_size
            }
        else:
            return {
                'success': False,
                'error': f'Upload failed with status {response.status_code}',
                'response': response.text
            }
    
    
    except requests.exceptions.ConnectionError:
        return {
            'success': False,
            'error': f'Cannot connect to server at {server_ip}:3001'
        }
    
    except Exception as e:
        return {
            'success': False,
            'error': f'Upload failed: {str(e)}'
        }


def handle_upload_video(data):
    """
    Upload recorded video to server
    
    Params:
        video_path: str (path to video file, optional - uses last recording)
        server_ip: str (default: 192.168.1.2)
        raspi_id: str (default: raspi_main)
    """
    try:
        print(f"📤 Starting video upload...")
        print(f"🔧 Upload data: {data}")
        
        video_path = data.get('video_path', camera_state.get('last_recording'))
        server_ip = data.get('server_ip', '192.168.1.2')
        raspi_id = data.get('raspi_id')
        if not raspi_id:
            # Try to detect raspi_id from hostname
            import socket
            hostname = socket.gethostname().lower()
            if 'sensor' in hostname:
                raspi_id = 'raspi_sensor'
            elif 'main' in hostname:
                raspi_id = 'raspi_main'
            else:
                raspi_id = 'raspi_unknown'
            print(f"⚠️ No raspi_id provided, using hostname-based: {raspi_id}")
        
        print(f"📁 Video path: {video_path}")
        print(f"🌐 Server IP: {server_ip}")
        print(f"🔖 Raspi ID: {raspi_id}")
        print(f"📦 Camera state last_recording: {camera_state.get('last_recording')}")
        
        # Get camera model from last recording info or current camera state
        camera_model = None
        if camera_state.get('last_recording') and isinstance(camera_state['last_recording'], dict):
            camera_model = camera_state['last_recording'].get('camera_model')
        if not camera_model:
            camera_model = camera_state.get('camera_model')
        
        print(f"📹 Camera model: {camera_model}")
        
        if not video_path:
            print(f"❌ No video path found!")
            return {
                'success': False,
                'type': 'upload_error',
                'error': 'No video file specified or recorded',
                'timestamp': time.time()
            }
        
        print(f"📤 Starting upload: {video_path} to {server_ip}")
        result = upload_video_to_server(video_path, server_ip, raspi_id, camera_model)
        print(f"📤 Upload result: {result}")
        
        result['type'] = 'video_upload'
        result['timestamp'] = time.time()
        result['video_path'] = video_path
        
        print(f"📤 Final upload response: {result}")
        return result
        
    except Exception as e:
        print(f"❌ Upload handler crashed: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'type': 'upload_error',
            'error': f'Upload handler crashed: {str(e)}',
            'timestamp': time.time()
        }


def handle_camera_status(data):
    """Get current camera status"""
    status = {
        'success': True,
        'type': 'camera_status',
        'recording': camera_state['recording'],
        'camera_index': camera_state['camera_index'],
        'camera_model': camera_state['camera_model'],
        'last_recording': camera_state.get('last_recording'),
        'cv2_available': CV2_AVAILABLE,
        'gx_available': GX_AVAILABLE,
        'timestamp': time.time()
    }
    
    return status


def handle_get_camera_controls(data):
    """
    Get available V4L2 controls for a camera device
    Useful for debugging camera issues and discovering supported controls
    
    Params:
        camera_index: int (camera device index, default 0)
    """
    camera_index = data.get('camera_index', 0)
    result = get_camera_controls(camera_index)
    result['type'] = 'camera_controls'
    return result


def reset_camera_controls(camera_index):
    """
    Reset camera to working default values
    Note: Only works for V4L2 cameras, skips Daheng cameras
    """
    # Skip camera control reset for virtual indices (Daheng cameras)
    if camera_index >= 100:
        print(f"🔄 Skipping camera controls reset for Daheng camera (index {camera_index})")
        print("   💡 Daheng cameras use gxipy, not V4L2 controls")
        return {
            'success': True,
            'type': 'camera_reset', 
            'device': f'daheng:{camera_index-100}',
            'message': 'Daheng camera controls not applicable (uses gxipy)',
            'timestamp': time.time()
        }
    
    device = f'/dev/video{camera_index}'
    print(f"🔄 Resetting camera controls for {device}")
    
    # Reset to good working values
    reset_commands = [
        ('backlight_compensation', '50', 'Better indoor lighting'),
        ('gain', '110', 'Default gain'),  
        ('brightness', '32', 'Good brightness'),
        ('contrast', '60', 'Good contrast'),
        ('auto_exposure', '3', 'Auto exposure mode'),
    ]
    
    for control, value, desc in reset_commands:
        try:
            result = subprocess.run(
                ['v4l2-ctl', '-d', device, f'--set-ctrl={control}={value}'],
                check=False, capture_output=True, text=True
            )
            if result.returncode == 0:
                print(f"  ✅ Reset {control}={value} ({desc})")
            else:
                print(f"  ⚠️ Failed to reset {control}: {result.stderr.strip()}")
        except Exception as e:
            print(f"  ❌ Error resetting {control}: {e}")
    
    return {
        'success': True,
        'type': 'camera_reset', 
        'device': device,
        'message': 'Camera controls reset to working defaults',
        'timestamp': time.time()
    }


def handle_reset_camera_controls(data):
    """
    Reset camera controls to working default values
    
    Params:
        camera_index: int (camera device index, default 0)
    """
    camera_index = data.get('camera_index', 0)
    return reset_camera_controls(camera_index)


def diagnose_unknown_camera(camera_index):
    """
    Generate diagnostic information for unknown cameras
    """
    device = f'/dev/video{camera_index}'
    print(f"🔍 Diagnosing unknown camera: {device}")
    
    diagnostics = {
        'device': device,
        'timestamp': time.time(),
        'commands_run': [],
        'results': {}
    }
    
    # Command 1: List controls
    try:
        result = subprocess.run(
            ['v4l2-ctl', '-d', device, '--list-ctrls'],
            capture_output=True, text=True, check=True, timeout=10
        )
        diagnostics['results']['controls'] = result.stdout
        diagnostics['commands_run'].append('v4l2-ctl --list-ctrls')
        print("✅ Camera controls retrieved")
    except Exception as e:
        diagnostics['results']['controls'] = f"Error: {e}"
        print(f"❌ Failed to get controls: {e}")
    
    # Command 2: Get all camera info
    try:
        result = subprocess.run(
            ['v4l2-ctl', '-d', device, '--all'],
            capture_output=True, text=True, check=True, timeout=10
        )
        diagnostics['results']['info'] = result.stdout
        diagnostics['commands_run'].append('v4l2-ctl --all')
        print("✅ Camera info retrieved")
    except Exception as e:
        diagnostics['results']['info'] = f"Error: {e}"
        print(f"❌ Failed to get camera info: {e}")
    
    # Command 3: USB device info
    try:
        result = subprocess.run(
            ['lsusb'], capture_output=True, text=True, check=True, timeout=10
        )
        diagnostics['results']['usb_devices'] = result.stdout
        diagnostics['commands_run'].append('lsusb')
        print("✅ USB devices listed")
    except Exception as e:
        diagnostics['results']['usb_devices'] = f"Error: {e}"
        print(f"❌ Failed to list USB devices: {e}")
    
    # Command 4: Device attributes
    try:
        result = subprocess.run(
            ['udevadm', 'info', '-a', '-n', device],
            capture_output=True, text=True, check=True, timeout=10
        )
        diagnostics['results']['udev_info'] = result.stdout
        diagnostics['commands_run'].append('udevadm info')
        print("✅ Device attributes retrieved")
    except Exception as e:
        diagnostics['results']['udev_info'] = f"Error: {e}"
        print(f"❌ Failed to get device info: {e}")
    
    print("\n💡 Diagnostic Summary:")
    print("   Check the results above to identify:")
    print("   - Camera manufacturer and model")
    print("   - USB vendor ID and product ID (format: 1234:5678)")
    print("   - Supported resolutions and frame rates")
    print("   - Available camera controls")
    print("\n🔧 Next Steps:")
    print("   1. Copy the diagnostic results")
    print("   2. Update identify_camera() function with new detection rules")
    print("   3. Add camera-specific recording logic if needed")
    print("   4. Test recording with new settings")
    
    return diagnostics


def handle_diagnose_unknown_camera(data):
    """
    Diagnose unknown camera and provide helpful information
    
    Params:
        camera_index: int (camera device index, default 0)
    """
    camera_index = data.get('camera_index', 0)
    diagnostics = diagnose_unknown_camera(camera_index)
    
    return {
        'success': True,
        'type': 'camera_diagnostics',
        'device': diagnostics['device'],
        'commands_run': diagnostics['commands_run'],
        'results': diagnostics['results'],
        'timestamp': diagnostics['timestamp']
    }


# Export command handlers
COMMAND_HANDLERS = {
    'list_cameras': handle_list_cameras,
    'start_recording': handle_start_recording,
    'stop_recording': handle_stop_recording,
    'camera_status': handle_camera_status,
    'upload_video': handle_upload_video,
    'get_camera_controls': handle_get_camera_controls,
    'reset_camera_controls': handle_reset_camera_controls,
    'diagnose_unknown_camera': handle_diagnose_unknown_camera
}
