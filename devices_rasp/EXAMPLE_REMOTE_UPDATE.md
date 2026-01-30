# Example: Remotely Deploy Camera Recording Command

## Scenario
You want to add a new `start_recording` command to a Raspberry Pi that starts camera recording.

## Step 1: Create the New Handler Code

First, write the new handler code that you want to deploy:

```python
#!/usr/bin/env python3
"""
Camera Handlers - Recording Control
Handles camera recording operations
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
    """Start camera recording"""
    duration = data.get('duration', 10)  # Default 10 seconds
    filename = data.get('filename', f'recording_{int(time.time())}.h264')
    
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
            '-w', '1920',
            '-h', '1080',
            '-fps', '30'
        ]
        
        # Start recording in background
        process = subprocess.Popen(cmd)
        
        camera_state['recording'] = True
        camera_state['last_recording'] = full_path
        
        return {
            'success': True,
            'type': 'recording_started',
            'message': f'Recording started: {filename}',
            'duration': duration,
            'path': full_path,
            'timestamp': time.time()
        }
    
    except FileNotFoundError:
        # raspivid not available (not on Pi or camera not enabled)
        return {
            'success': False,
            'type': 'recording_error',
            'error': 'Camera not available (raspivid not found)',
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
    """Stop camera recording"""
    try:
        # Kill raspivid processes
        subprocess.run(['pkill', '-SIGINT', 'raspivid'])
        
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
    """Get camera recording status"""
    return {
        'success': True,
        'type': 'camera_status',
        'recording': camera_state['recording'],
        'last_recording': camera_state['last_recording'],
        'recording_path': camera_state['recording_path'],
        'timestamp': time.time()
    }


# Export command handlers
COMMAND_HANDLERS = {
    'start_recording': handle_start_recording,
    'stop_recording': handle_stop_recording,
    'camera_status': handle_camera_status
}
```

## Step 2: Send Update Command from Main Server

From your Node.js server (`src/server/`), send this JSON command to the Raspberry Pi:

### Option A: Using the HW_RASPI_MULTI Controller

```javascript
// In your Node.js server code
const raspiId = 'raspi_main';  // From configDevices.js

// The new handler code (as a string)
const newHandlerCode = `#!/usr/bin/env python3
"""
Camera Handlers - Recording Control
Handles camera recording operations
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
    """Start camera recording"""
    duration = data.get('duration', 10)
    filename = data.get('filename', f'recording_{int(time.time())}.h264')
    
    try:
        os.makedirs(camera_state['recording_path'], exist_ok=True)
        full_path = os.path.join(camera_state['recording_path'], filename)
        
        cmd = [
            'raspivid',
            '-o', full_path,
            '-t', str(duration * 1000),
            '-w', '1920',
            '-h', '1080',
            '-fps', '30'
        ]
        
        process = subprocess.Popen(cmd)
        camera_state['recording'] = True
        camera_state['last_recording'] = full_path
        
        return {
            'success': True,
            'type': 'recording_started',
            'message': f'Recording started: {filename}',
            'duration': duration,
            'path': full_path,
            'timestamp': time.time()
        }
    
    except FileNotFoundError:
        return {
            'success': False,
            'error': 'Camera not available',
            'timestamp': time.time()
        }

def handle_stop_recording(data):
    """Stop recording"""
    subprocess.run(['pkill', '-SIGINT', 'raspivid'])
    camera_state['recording'] = False
    return {
        'success': True,
        'message': 'Recording stopped',
        'timestamp': time.time()
    }

def handle_camera_status(data):
    """Get status"""
    return {
        'success': True,
        'type': 'camera_status',
        'recording': camera_state['recording'],
        'last_recording': camera_state['last_recording'],
        'timestamp': time.time()
    }

COMMAND_HANDLERS = {
    'start_recording': handle_start_recording,
    'stop_recording': handle_stop_recording,
    'camera_status': handle_camera_status
}
`;

// Send the update command
const updateCommand = {
    command: 'update_handler',
    filename: 'camera_handlers.py',  // Will be created in handlers/
    code: newHandlerCode
};

// Using the multi-raspi controller
GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, updateCommand);
```

### Option B: Direct TCP Connection

```javascript
// Direct TCP approach
const net = require('net');

const client = new net.Socket();
client.connect(3000, '192.168.1.100', () => {
    console.log('Connected to Raspberry Pi');
    
    const updateCommand = {
        command: 'update_handler',
        filename: 'camera_handlers.py',
        code: newHandlerCode  // The full code from above
    };
    
    // Send as newline-delimited JSON
    client.write(JSON.stringify(updateCommand) + '\n');
});

client.on('data', (data) => {
    const response = JSON.parse(data.toString());
    console.log('Update response:', response);
    
    if (response.success) {
        console.log('✅ Handler deployed successfully!');
        console.log('New commands available:', response.reload?.commands);
    } else {
        console.log('❌ Update failed:', response.error);
    }
    
    client.destroy();
});
```

## Step 3: What Happens on the Raspberry Pi

When the Pi receives the `update_handler` command:

1. **Validation** - The code is checked for:
   - ✅ Syntax errors
   - ✅ Dangerous patterns (`os.system`, `rm -rf`, etc.)
   - ✅ Protected imports (can't import `core.updater`)
   - ✅ Import availability

2. **Backup** - Current version (if exists) is backed up to:
   ```
   .backups/handlers_camera_handlers.py_20231129_143022.backup
   ```

3. **Deployment** - New code written to:
   ```
   handlers/camera_handlers.py
   ```

4. **Import Test** - Code is actually imported to verify it works

5. **Hot Reload** - Handler is loaded without restarting server

6. **Response** - Pi sends back:
   ```json
   {
       "success": true,
       "message": "Handler camera_handlers.py updated successfully with safety checks",
       "filename": "handlers/camera_handlers.py",
       "backup_created": ".backups/...",
       "validation_passed": true,
       "reload": {
           "success": true,
           "command_count": 3,
           "commands": ["start_recording", "stop_recording", "camera_status"]
       },
       "timestamp": 1701234567.89
   }
   ```

## Step 4: Use the New Commands Immediately!

The new commands are now available on the Pi:

```javascript
// Start recording
GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, {
    command: 'start_recording',
    duration: 30,  // 30 seconds
    filename: 'race_video.h264'
});

// Response:
// {
//     "success": true,
//     "type": "recording_started",
//     "message": "Recording started: race_video.h264",
//     "duration": 30,
//     "path": "/home/pi/recordings/race_video.h264"
// }

// Check status
GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, {
    command: 'camera_status'
});

// Stop recording
GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, {
    command: 'stop_recording'
});
```

## Step 5: If Something Goes Wrong...

If the deployed code has a bug that only shows up at runtime:

```javascript
// Rollback to last known good version
GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(raspiId, {
    command: 'rollback_handler',
    filename: 'camera_handlers.py'
});
```

## Full Update Flow Diagram

```
┌─────────────────────┐
│  Node.js Server     │
│  Sends update cmd   │
└──────────┬──────────┘
           │
           │ {"command": "update_handler",
           │  "filename": "camera_handlers.py",
           ▼  "code": "..."}
┌─────────────────────┐
│  Raspberry Pi       │
│  Port 3000          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Validator          │ ✅ Syntax check
│  6 Safety Checks    │ ✅ Security scan
└──────────┬──────────┘ ✅ Protected imports
           │            ✅ Dependencies
           ▼            ✅ Import test
┌─────────────────────┐ ✅ Runtime test
│  Updater            │
│  Deploy & Backup    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Safe Loader        │
│  Hot Reload Handler │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Response           │ {"success": true,
│  New Commands Live! │  "commands": [...]}
└─────────────────────┘
```

## Complete Example: Deploy from Node.js Route

```javascript
// In your Express routes
app.post('/api/deploy-camera-handler/:raspiId', async (req, res) => {
    const { raspiId } = req.params;
    
    // Read the handler code from a file or define it
    const fs = require('fs');
    const handlerCode = fs.readFileSync(
        './handlers/camera_handlers.py', 
        'utf-8'
    );
    
    // Send update command
    const updateCommand = {
        command: 'update_handler',
        filename: 'camera_handlers.py',
        code: handlerCode
    };
    
    // This returns immediately (async)
    const sent = GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(
        raspiId, 
        updateCommand
    );
    
    if (sent) {
        res.json({
            success: true,
            message: `Deploying camera handler to ${raspiId}`,
            note: 'Pi will validate and respond asynchronously'
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Pi not connected'
        });
    }
});
```

## Safety Features in Action

**Example 1: Bad Code Rejected**
```javascript
// Try to deploy dangerous code
const badCode = `
import os
def handle_evil(data):
    os.system('rm -rf /')  # 💀 DANGEROUS!
    return {'success': True}
`;

// Pi response:
{
    "success": false,
    "error": "Code validation failed: Dangerous pattern detected: os.system(",
    "validation_details": {
        "valid": false,
        "errors": ["Dangerous pattern detected: os.system("]
    }
}
```

**Example 2: Broken Code Auto-Rollback**
```javascript
// Deploy code with syntax error
const brokenCode = `
def handle_broken(data):  # Missing colon
    return {'success': True
`;

// Pi response:
{
    "success": false,
    "error": "Code validation failed: Syntax Error at line 2: invalid syntax"
}
// Original handler still works! Nothing broken.
```

## Summary

**To remotely add a new command:**

1. Write the handler code (Python function with `handle_` prefix)
2. Send `update_handler` command from Node.js with the code
3. Pi validates, deploys, and hot-reloads automatically
4. New command is immediately available
5. If it fails, nothing breaks - automatic rollback!

**The entire process takes ~1 second and requires zero manual Pi access!** 🚀

