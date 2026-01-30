# Camera Handler - Multi-Camera Support

This handler provides automatic detection and recording support for different camera types on Raspberry Pi:
- **Raspberry Pi Camera Module** (using libcamera-vid or raspivid)
- **USB Cameras** (like the 1080p@120fps USB camera, using OpenCV)

## Features

- ✅ **Automatic Camera Detection** - Detects which type of camera is connected
- ✅ **Multi-Camera Support** - Works with both PiCamera modules and USB cameras
- ✅ **High FPS Support** - USB cameras support up to 120fps at 1080p
- ✅ **Modern & Legacy** - Uses libcamera-vid (modern) or falls back to raspivid (legacy)
- ✅ **OpenCV Integration** - Full USB camera support via OpenCV
- ✅ **Flexible Configuration** - Customize resolution, FPS, duration, etc.

## Installation

### For Raspberry Pi Camera Module
```bash
# Modern Raspberry Pi OS (Bullseye+)
sudo apt install libcamera-apps

# OR legacy (older OS versions)
sudo raspi-config
# Navigate to: Interface Options > Camera > Enable
```

### For USB Camera
```bash
# Install OpenCV for USB camera support
pip3 install opencv-python

# Install v4l-utils for camera detection
sudo apt install v4l-utils

# List available USB cameras
v4l2-ctl --list-devices
```

## Usage

### 1. Deploy the Handler

From your Node.js server:

```javascript
const fs = require('fs');

const updateCommand = {
    command: 'update_handler',
    filename: 'camera_handlers.py',
    code: fs.readFileSync('./devices_rasp/raspi_client/handlers/camera_handlers.py', 'utf-8')
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, updateCommand);
```

### 2. Detect Camera

Before recording, detect which camera is connected:

```javascript
const detectCommand = {
    command: 'detect_camera'
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, detectCommand);
```

**Response:**
```json
{
    "success": true,
    "type": "camera_detection",
    "camera_type": "usb",
    "camera_detected": true,
    "cv2_available": true,
    "capabilities": {
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "backend": "V4L2"
    }
}
```

### 3. Start Recording

#### Basic Recording (Auto-detect camera)
```javascript
const recordCommand = {
    command: 'start_recording',
    duration: 10,  // seconds
    width: 1920,
    height: 1080,
    fps: 30
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, recordCommand);
```

#### High-FPS USB Camera Recording
```javascript
const recordCommand = {
    command: 'start_recording',
    duration: 5,
    width: 1920,
    height: 1080,
    fps: 120,  // High FPS for USB camera
    force_type: 'usb'  // Force USB camera
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, recordCommand);
```

#### Force Specific Camera Type
```javascript
const recordCommand = {
    command: 'start_recording',
    duration: 10,
    force_type: 'picamera',  // or 'usb'
    width: 1920,
    height: 1080,
    fps: 30
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, recordCommand);
```

**Response (PiCamera):**
```json
{
    "success": true,
    "type": "recording_started",
    "message": "Recording started with libcamera: recording_1701234567.h264",
    "camera_type": "picamera",
    "method": "libcamera-vid",
    "duration": 10,
    "path": "/home/pi/recordings/recording_1701234567.h264",
    "resolution": "1920x1080",
    "fps": 30
}
```

**Response (USB Camera):**
```json
{
    "success": true,
    "type": "recording_started",
    "message": "Recording started with USB camera: recording_1701234567.avi",
    "camera_type": "usb",
    "method": "opencv",
    "duration": 10,
    "path": "/home/pi/recordings/recording_1701234567.avi",
    "resolution": "1920x1080",
    "fps": 30,
    "camera_index": 0
}
```

### 4. USB Camera Frame Capture (Optional)

For USB cameras, frames need to be captured periodically. You can either:

**Option A: Auto-capture (recommended)**
The handler automatically captures frames for the specified duration.

**Option B: Manual frame capture**
```javascript
// Call this periodically (e.g., every 33ms for 30fps)
const frameCommand = {
    command: 'camera_frame'
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, frameCommand);
```

### 5. Stop Recording

```javascript
const stopCommand = {
    command: 'stop_recording'
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, stopCommand);
```

**Response:**
```json
{
    "success": true,
    "type": "recording_stopped",
    "message": "Recording stopped",
    "camera_type": "usb",
    "last_file": "/home/pi/recordings/recording_1701234567.avi"
}
```

### 6. Check Camera Status

```javascript
const statusCommand = {
    command: 'camera_status'
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, statusCommand);
```

**Response:**
```json
{
    "success": true,
    "type": "camera_status",
    "recording": true,
    "camera_type": "usb",
    "camera_detected": true,
    "last_recording": "/home/pi/recordings/recording_1701234567.avi",
    "recording_path": "/home/pi/recordings",
    "cv2_available": true,
    "frames_recorded": 150,
    "elapsed": 5.2
}
```

### 7. List Recordings

```javascript
const listCommand = {
    command: 'list_recordings'
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, listCommand);
```

**Response:**
```json
{
    "success": true,
    "type": "recordings_list",
    "recordings": [
        {
            "filename": "recording_1701234567.avi",
            "path": "/home/pi/recordings/recording_1701234567.avi",
            "size_mb": 45.8,
            "created": 1701234567.0,
            "modified": 1701234577.0
        }
    ],
    "count": 1,
    "total_size_mb": 45.8
}
```

## Command Parameters

### start_recording

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `duration` | int | 10 | Recording duration in seconds |
| `filename` | str | auto | Custom filename (optional) |
| `width` | int | 1920 | Video width in pixels |
| `height` | int | 1080 | Video height in pixels |
| `fps` | int | 30 | Frames per second (USB: up to 120fps) |
| `camera_index` | int | 0 | USB camera device index |
| `force_type` | str | None | Force camera type: 'picamera' or 'usb' |

## Camera Type Differences

### Raspberry Pi Camera Module
- **Format:** H.264 (.h264)
- **Recording:** Hardware-accelerated
- **Method:** libcamera-vid (modern) or raspivid (legacy)
- **Performance:** Better efficiency, lower CPU usage
- **FPS:** Typically 30fps (some modules support 60fps)

### USB Camera
- **Format:** AVI with MJPEG codec (.avi)
- **Recording:** Software (OpenCV)
- **Method:** cv2.VideoWriter
- **Performance:** Higher CPU usage
- **FPS:** Depends on camera (up to 120fps at 1080p)

## Troubleshooting

### No Camera Detected

**Check Raspberry Pi Camera Module:**
```bash
# Test camera
libcamera-hello --list-cameras

# OR legacy
raspistill -o test.jpg
```

**Check USB Camera:**
```bash
# List USB video devices
v4l2-ctl --list-devices

# Test with ffplay
ffplay /dev/video0
```

### OpenCV Not Available

```bash
# Install OpenCV
pip3 install opencv-python

# For headless systems (smaller package)
pip3 install opencv-python-headless
```

### Permission Denied

```bash
# Add user to video group
sudo usermod -a -G video $USER

# Restart or re-login
```

### Low FPS on USB Camera

```bash
# Check supported formats and FPS
v4l2-ctl --list-formats-ext -d /dev/video0

# Some cameras require lower resolution for higher FPS:
# 1920x1080 @ 30fps
# 1280x720 @ 60fps
# 640x480 @ 120fps
```

## Performance Tips

### For High FPS USB Recording (120fps)

1. **Use lower resolution:** 720p or 480p for 120fps
2. **Optimize encoding:** MJPEG codec is fastest
3. **Reduce duration:** Shorter clips = less CPU strain
4. **Monitor CPU:** `htop` to check CPU usage

Example for 720p@120fps:
```javascript
{
    command: 'start_recording',
    width: 1280,
    height: 720,
    fps: 120,
    duration: 5
}
```

### For PiCamera

1. **Use H.264:** Hardware-accelerated
2. **Enable camera:** Must be enabled in raspi-config
3. **Modern OS:** Use libcamera for best performance

## Remote Deployment

This handler integrates with the remote update system. To deploy:

```bash
# From your development machine
node deploy_camera_handler.js
```

Or use the update system:
```javascript
// From Node.js server
const handler_code = fs.readFileSync(
    './devices_rasp/raspi_client/handlers/camera_handlers.py',
    'utf-8'
);

const update = {
    command: 'update_handler',
    filename: 'camera_handlers.py',
    code: handler_code
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, update);
```

## Example: Auto-Recording System

```javascript
// Server-side code to automatically record when motion detected
class CameraRecorder {
    constructor(raspiId) {
        this.raspiId = raspiId;
        this.recording = false;
    }
    
    async startRecording(duration = 10) {
        if (this.recording) return;
        
        const command = {
            command: 'start_recording',
            duration: duration,
            width: 1920,
            height: 1080,
            fps: 30
        };
        
        const response = await GLOBALS.HW_RASPI_MULTI
            .sendCommandToRaspberryPi(this.raspiId, command);
        
        if (response.success) {
            this.recording = true;
            console.log(`Recording started: ${response.path}`);
            
            // Auto-stop after duration
            setTimeout(() => {
                this.stopRecording();
            }, duration * 1000);
        }
    }
    
    async stopRecording() {
        const command = { command: 'stop_recording' };
        
        const response = await GLOBALS.HW_RASPI_MULTI
            .sendCommandToRaspberryPi(this.raspiId, command);
        
        if (response.success) {
            this.recording = false;
            console.log(`Recording stopped: ${response.last_file}`);
        }
    }
}
```

## See Also

- [System Overview](raspi_client/SYSTEM_OVERVIEW.md)
- [Remote Update System](EXAMPLE_REMOTE_UPDATE.md)
- [Handler Deletion](EXAMPLE_DELETE_HANDLER.md)


