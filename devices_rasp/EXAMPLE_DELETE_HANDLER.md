# Example: Delete Handler Files Remotely

## Overview

The system now supports safe deletion of handler files with automatic backup and permission checking.

## Safety Features

✅ **Only handlers/ can be deleted** - Core files are protected  
✅ **Automatic backup** before deletion (can be disabled)  
✅ **Permission checks** - Can't delete core system files  
✅ **Unloads from memory** - Handler is removed from active handlers  
✅ **Logged operations** - All deletions are tracked in update log  

## Usage from Node.js Server

### Delete a Handler with Backup (Recommended)

```javascript
// Delete camera handler (creates backup first)
const deleteCommand = {
    command: 'delete_handler',
    filename: 'camera_handlers.py',  // Will delete handlers/camera_handlers.py
    backup: true                      // Default: create backup before deletion
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi('raspi_main', deleteCommand);
```

**Response:**
```json
{
    "success": true,
    "message": "Handler handlers/camera_handlers.py deleted successfully",
    "filename": "handlers/camera_handlers.py",
    "backup_created": ".backups/handlers_camera_handlers.py.deleted_20231129_143022.backup",
    "unloaded": true,
    "timestamp": 1701234567.89
}
```

### Delete Without Backup (Dangerous!)

```javascript
// Delete without backup - USE WITH CAUTION
const deleteCommand = {
    command: 'delete_handler',
    filename: 'camera_handlers.py',
    backup: false  // Skip backup creation
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi('raspi_main', deleteCommand);
```

## What Happens When You Delete

1. **Permission Check** - Ensures file is in handlers/ directory
2. **Existence Check** - Verifies file exists
3. **Backup Creation** - Saves copy to `.backups/` (if enabled)
4. **File Deletion** - Removes the handler file
5. **Memory Unload** - Removes handler from active handlers
6. **Operation Logging** - Records deletion in update log

## Protected Files (Cannot Delete)

❌ `core/updater.py` - Protected  
❌ `core/validator.py` - Protected  
❌ `core/safe_loader.py` - Protected  
❌ `client.py` - Protected  
❌ `main.py` - Protected  

✅ `handlers/camera_handlers.py` - Can delete  
✅ `handlers/gpio_handlers.py` - Can delete  
✅ `handlers/custom_handlers.py` - Can delete  

## Restore Deleted Handler

If you delete a handler and want it back:

### Option 1: Restore from Backup

```javascript
// List backups to find the deleted file
const listCommand = {
    command: 'list_backups'
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi('raspi_main', listCommand);

// Response shows:
// {
//     "backups": [
//         {
//             "filename": "handlers_camera_handlers.py.deleted_20231129_143022.backup",
//             "path": ".backups/handlers_camera_handlers.py.deleted_20231129_143022.backup",
//             "size_bytes": 5432,
//             "created": "2023-11-29T14:30:22"
//         }
//     ]
// }

// Manually restore (requires file system access or new restore command)
```

### Option 2: Redeploy from Source

```javascript
// Just deploy it again as if it's new
const fs = require('fs');
const handlerCode = fs.readFileSync('./handlers/camera_handlers.py', 'utf-8');

const updateCommand = {
    command: 'update_handler',
    filename: 'camera_handlers.py',
    code: handlerCode
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi('raspi_main', updateCommand);
```

## Error Scenarios

### Try to Delete Protected File

```javascript
const deleteCommand = {
    command: 'delete_handler',
    filename: 'core/updater.py'  // ❌ Protected!
};

// Response:
{
    "success": false,
    "error": "FORBIDDEN: Core update engine cannot be modified remotely",
    "stage": "permission_check"
}
```

### Try to Delete Non-Existent File

```javascript
const deleteCommand = {
    command: 'delete_handler',
    filename: 'nonexistent_handler.py'
};

// Response:
{
    "success": false,
    "error": "File does not exist: handlers/nonexistent_handler.py",
    "stage": "existence_check"
}
```

### Backup Creation Fails

```javascript
// If backup fails (disk full, permissions, etc.)
{
    "success": false,
    "error": "Backup creation failed before deletion",
    "details": { ... },
    "stage": "backup"
}
// File is NOT deleted - safety first!
```

## Complete Example: Cleanup Old Handlers

```javascript
// Express route to cleanup handlers
app.post('/api/cleanup-handlers/:raspiId', async (req, res) => {
    const { raspiId } = req.params;
    const { handlers } = req.body;  // Array of handler filenames
    
    const results = [];
    
    for (const handler of handlers) {
        const deleteCommand = {
            command: 'delete_handler',
            filename: handler,
            backup: true  // Always backup!
        };
        
        const sent = GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi(
            raspiId,
            deleteCommand
        );
        
        results.push({
            handler,
            sent,
            note: 'Pi will respond asynchronously'
        });
    }
    
    res.json({
        success: true,
        message: `Sent ${results.length} deletion commands to ${raspiId}`,
        results
    });
});

// Usage:
// POST /api/cleanup-handlers/raspi_main
// Body: {
//   "handlers": [
//     "old_camera_handlers.py",
//     "deprecated_test_handlers.py"
//   ]
// }
```

## View Deletion History

```javascript
// Check update log to see deletions
const logCommand = {
    command: 'update_log',
    limit: 20
};

GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi('raspi_main', logCommand);

// Response includes deletions:
{
    "log": [
        {
            "timestamp": 1701234567.89,
            "datetime": "2023-11-29T14:30:22",
            "filename": "handlers/camera_handlers.py",
            "success": true,
            "deletion": true,  // ← Indicates deletion
            "backup": ".backups/handlers_camera_handlers.py.deleted_..."
        }
    ]
}
```

## Best Practices

### ✅ DO:
- Always create backups when deleting (`backup: true`)
- Check handler stats before deletion to see if it's being used
- Keep deletion logs for audit trail
- Test handler deletion in development first

### ❌ DON'T:
- Delete handlers without backup unless absolutely sure
- Try to delete core system files (it will fail anyway)
- Delete handlers that are actively being called
- Delete all handlers at once (keep at least basic ones)

## Deployment Lifecycle Management

```javascript
// Complete handler lifecycle from deploy to cleanup

// 1. Deploy new handler
GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi('raspi_main', {
    command: 'update_handler',
    filename: 'new_feature.py',
    code: newCode
});

// 2. Test the handler
GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi('raspi_main', {
    command: 'test_feature'  // Your new command
});

// 3. If needed, rollback
GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi('raspi_main', {
    command: 'rollback_handler',
    filename: 'new_feature.py'
});

// 4. When feature is deprecated, delete
GLOBALS.HW_RASPI_MULTI.sendCommandToRaspberryPi('raspi_main', {
    command: 'delete_handler',
    filename: 'new_feature.py',
    backup: true
});
```

## Summary

**Delete Handler Command:**
```json
{
    "command": "delete_handler",
    "filename": "handler_to_delete.py",
    "backup": true
}
```

**Safety Guarantees:**
- ✅ Core files cannot be deleted
- ✅ Automatic backup before deletion
- ✅ Handler unloaded from memory
- ✅ All operations logged
- ✅ Can be restored from backup

**The deletion is immediate and safe!** 🗑️✨

