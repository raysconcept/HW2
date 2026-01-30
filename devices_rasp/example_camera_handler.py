#!/usr/bin/env python3

"""
Example Camera Handler - Ready to Deploy

This is a complete, working handler that can be remotely deployed
to a Raspberry Pi to add camera recording commands.

To deploy from Node.js server:
    const updateCommand = {
        command: 'update_handler',
        filename: 'camera_handlers.py',
        code: fs.readFileSync('./example_camera_handler.py', 'utf-8')
    };
    GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, updateCommand);
"""

import time
import subprocess
import os

# Camera state tracking
camera_state = {
    'recording': False,
    'last_recording': None,
    'recording_path': '/home/pi/recordings'
}


def handle_start_recording(data):
    """
    Start camera recording
    
    Expected data:
        duration: int (seconds, default 10)
        filename: str (optional, auto-generated if not provided)
        width: int (default 1920)
        height: int (default 1080)
        fps: int (default 30)
    """
    duration = data.get('duration', 10)
    filename = data.get('filename', f'recording_{int(time.time())}.h264')
    width = data.get('width', 1920)
    height = data.get('height', 1080)
    fps = data.get('fps', 30)
    
    try:
        # Ensure recording directory exists
        os.makedirs(camera_state['recording_path'], exist_ok=True)
        
        # Full path to recording
        full_path = os.path.join(camera_state['recording_path'], filename)
        
        # Start recording using raspivid
        cmd = [
            'raspivid',
            '-o', full_path,
            '-t', str(duration * 1000),  # Convert to milliseconds
            '-w', str(width),
            '-h', str(height),
            '-fps', str(fps)
        ]
        
        # Start recording in background
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        camera_state['recording'] = True
        camera_state['last_recording'] = full_path
        
        return {
            'success': True,
            'type': 'recording_started',
            'message': f'Recording started: {filename}',
            'duration': duration,
            'path': full_path,
            'resolution': f'{width}x{height}',
            'fps': fps,
            'timestamp': time.time()
        }
    
    except FileNotFoundError:
        # raspivid not available (not on Pi or camera not enabled)
        return {
            'success': False,
            'type': 'recording_error',
            'error': 'Camera not available (raspivid not found)',
            'help': 'Enable camera: sudo raspi-config > Interface Options > Camera',
            'timestamp': time.time()
        }
    
    except Exception as e:
        return {
            'success': False,
            'type': 'recording_error',
            'error': f'Recording failed: {str(e)}',
            'timestamp': time.time()
        }


def handle_stop_recording(data):
    """
    Stop camera recording
    
    Sends SIGINT to raspivid process to cleanly stop recording
    """
    try:
        # Kill raspivid processes gracefully
        result = subprocess.run(
            ['pkill', '-SIGINT', 'raspivid'],
            capture_output=True,
            text=True
        )
        
        camera_state['recording'] = False
        
        return {
            'success': True,
            'type': 'recording_stopped',
            'message': 'Recording stopped',
            'last_file': camera_state['last_recording'],
            'timestamp': time.time()
        }
    
    except Exception as e:
        return {
            'success': False,
            'type': 'recording_error',
            'error': f'Stop failed: {str(e)}',
            'timestamp': time.time()
        }


def handle_camera_status(data):
    """
    Get camera recording status
    
    Returns current recording state and configuration
    """
    # Check if raspivid is running
    try:
        result = subprocess.run(
            ['pgrep', 'raspivid'],
            capture_output=True,
            text=True
        )
        is_recording = bool(result.stdout.strip())
    except:
        is_recording = False
    
    # Update state based on actual process
    camera_state['recording'] = is_recording
    
    return {
        'success': True,
        'type': 'camera_status',
        'recording': camera_state['recording'],
        'last_recording': camera_state['last_recording'],
        'recording_path': camera_state['recording_path'],
        'timestamp': time.time()
    }


def handle_list_recordings(data):
    """
    List all recordings in the recordings directory
    
    Returns list of recording files with metadata
    """
    try:
        if not os.path.exists(camera_state['recording_path']):
            return {
                'success': True,
                'type': 'recordings_list',
                'recordings': [],
                'message': 'No recordings directory found',
                'timestamp': time.time()
            }
        
        recordings = []
        for filename in os.listdir(camera_state['recording_path']):
            file_path = os.path.join(camera_state['recording_path'], filename)
            
            if os.path.isfile(file_path):
                stat = os.stat(file_path)
                recordings.append({
                    'filename': filename,
                    'path': file_path,
                    'size_mb': round(stat.st_size / 1024 / 1024, 2),
                    'created': stat.st_ctime,
                    'modified': stat.st_mtime
                })
        
        # Sort by modification time (newest first)
        recordings.sort(key=lambda x: x['modified'], reverse=True)
        
        return {
            'success': True,
            'type': 'recordings_list',
            'recordings': recordings,
            'count': len(recordings),
            'total_size_mb': round(sum(r['size_mb'] for r in recordings), 2),
            'timestamp': time.time()
        }
    
    except Exception as e:
        return {
            'success': False,
            'type': 'recordings_error',
            'error': f'Failed to list recordings: {str(e)}',
            'timestamp': time.time()
        }


# Export command handlers
COMMAND_HANDLERS = {
    'start_recording': handle_start_recording,
    'stop_recording': handle_stop_recording,
    'camera_status': handle_camera_status,
    'list_recordings': handle_list_recordings
}

