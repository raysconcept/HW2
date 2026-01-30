# Raspberry Pi Client - Modular Architecture

A **safe, modular, updatable** Raspberry Pi TCP client for HotWheels system.

## 🏗️ Architecture

```
raspi_client/
├── core/                      # 🔒 PROTECTED - Cannot be updated remotely
│   ├── updater.py            # Safe update engine with validation
│   ├── validator.py          # Code validation system
│   └── safe_loader.py        # Dynamic handler loading with rollback
│
├── handlers/                  # ✅ UPDATABLE - Can be safely updated
│   ├── gpio_handlers.py      # GPIO/LED control
│   ├── system_handlers.py    # System info and status
│   └── update_handlers.py    # Update management interface
│
├── client.py                 # 🔒 SEMI-PROTECTED - Main TCP server
└── main.py                   # Entry point
```

## 🛡️ Security Design

### Protected Core
The `core/` directory **CANNOT be updated remotely**. This ensures:
- Update engine itself is never corrupted
- Validation system always works
- Rollback capability is always available

### Updatable Handlers
The `handlers/` directory **CAN be updated safely**:
- All code is validated before deployment
- Automatic backup creation
- Import testing before activation
- Automatic rollback on failure
- Protected from modifying core functionality

## 🚀 Usage

### Start the Client

```bash
# Default (listen on all interfaces, port 3000)
python3 main.py

# Custom host
python3 main.py 192.168.1.100

# Custom host and port
python3 main.py 192.168.1.100 8080
```

### Available Commands

#### System Commands
- `ping` - Test connectivity
- `get_status` - Get device status
- `system_info` - Get detailed system information
- `echo` - Echo back data

#### GPIO Commands
- `led_on` - Turn LED on (default GPIO 18)
- `led_off` - Turn LED off
- `gpio_test` - Test specific GPIO pin
- `gpio_status` - Get GPIO status

#### Update Commands
- `update_handler` - Update a handler file
- `rollback_handler` - Rollback to last known good version
- `reload_handler` - Reload a handler module
- `list_backups` - List available backups
- `update_log` - View update history
- `handler_stats` - Get handler statistics

## 📡 Communication Protocol

### Request Format
JSON object with newline delimiter:
```json
{"command": "led_on", "pin": 18}\n
```

### Response Format
JSON object with newline delimiter:
```json
{"success": true, "type": "led_status", "state": "on", "timestamp": 1234567890}\n
```

## 🔄 Safe Update System

### How It Works

1. **Validation**: Code is checked for syntax, security, and imports
2. **Backup**: Current version is backed up automatically
3. **Deployment**: New code is written to file
4. **Testing**: Code is imported to verify it works
5. **Activation**: Handler is reloaded with new code
6. **Rollback**: If any step fails, previous version is restored

### Update Example

```json
{
  "command": "update_handler",
  "filename": "gpio_handlers.py",
  "code": "def handle_led_on(data):\n    return {'success': True}\n"
}
```

### Rollback Example

```json
{
  "command": "rollback_handler",
  "filename": "gpio_handlers.py"
}
```

## 🧪 Testing

The update system validates:
- ✅ Python syntax
- ✅ Security (no dangerous patterns)
- ✅ Protection (can't modify core)
- ✅ Imports (all modules available)
- ✅ Runtime (code actually works)

## 📝 Adding New Handlers

Create a new file in `handlers/` directory:

```python
# handlers/my_handlers.py

def handle_my_command(data):
    """Handle my custom command"""
    return {
        'success': True,
        'message': 'Command executed',
        'timestamp': time.time()
    }

# Export handlers
COMMAND_HANDLERS = {
    'my_command': handle_my_command
}
```

Handlers are automatically discovered and loaded on startup!

## 🔒 What Cannot Be Updated

For security, these components **require manual update**:
- `core/updater.py` - Update engine
- `core/validator.py` - Validation system
- `core/safe_loader.py` - Handler loader
- `client.py` - Main TCP server
- `main.py` - Entry point

## 📊 Monitoring

Check handler statistics:
```json
{"command": "handler_stats"}
```

View update log:
```json
{"command": "update_log", "limit": 20}
```

## 🐛 Troubleshooting

### Handler Not Loading
```json
{"command": "reload_handler", "module": "gpio_handlers"}
```

### Bad Update Deployed
```json
{"command": "rollback_handler", "filename": "gpio_handlers.py"}
```

### Check What Went Wrong
```json
{"command": "update_log"}
```

## 📦 Dependencies

```bash
# Optional (for full system info)
pip3 install psutil

# Required for GPIO (Raspberry Pi only)
pip3 install RPi.GPIO
```

## 🎯 Design Goals

✅ **Safety**: Code validated before deployment  
✅ **Resilience**: Automatic rollback on failure  
✅ **Modularity**: Easy to add new functionality  
✅ **Protection**: Core update engine cannot be corrupted  
✅ **Simplicity**: ~70% less code than monolithic version  

## 📄 License

Part of the HotWheels project.


