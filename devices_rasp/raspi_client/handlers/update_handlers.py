#!/usr/bin/env python3

"""
Update Handlers - Updatable Module
Handles code update commands (delegates to protected core updater)

NOTE: This module can be updated, but it only provides the interface.
The actual update logic is in the protected core.updater module.
"""

import time


# Reference to updater and loader (injected at runtime)
_updater = None
_loader = None


def set_updater_reference(updater, loader):
    """Set reference to protected updater (called by client on startup)"""
    global _updater, _loader
    _updater = updater
    _loader = loader


def handle_update_handler(data):
    """
    Update a handler file with validation and rollback
    
    Expected data:
        - filename: Handler filename (e.g., 'gpio_handlers.py')
        - code: New code content
    """
    if not _updater:
        return {
            'success': False,
            'error': 'Updater not initialized',
            'timestamp': time.time()
        }
    
    filename = data.get('filename', '')
    code = data.get('code', '')
    
    if not filename or not code:
        return {
            'success': False,
            'error': 'filename and code are required',
            'timestamp': time.time()
        }
    
    # Ensure filename is in handlers directory
    if not filename.startswith('handlers/'):
        filename = f"handlers/{filename}"
    
    # Use protected updater
    result = _updater.update_handler(filename, code)
    
    # If successful, reload the handler
    if result['success'] and _loader:
        module_name = filename.replace('handlers/', '').replace('.py', '')
        reload_result = _loader.reload_handler(module_name)
        result['reload'] = reload_result
    
    result['timestamp'] = time.time()
    return result


def handle_rollback_handler(data):
    """Rollback a handler to last known good version"""
    if not _updater:
        return {
            'success': False,
            'error': 'Updater not initialized',
            'timestamp': time.time()
        }
    
    filename = data.get('filename', '')
    
    if not filename:
        return {
            'success': False,
            'error': 'filename is required',
            'timestamp': time.time()
        }
    
    if not filename.startswith('handlers/'):
        filename = f"handlers/{filename}"
    
    result = _updater.rollback_to_last_known_good(filename)
    
    # Reload the handler after rollback
    if result['success'] and _loader:
        module_name = filename.replace('handlers/', '').replace('.py', '')
        reload_result = _loader.reload_handler(module_name)
        result['reload'] = reload_result
    
    result['timestamp'] = time.time()
    return result


def handle_list_backups(data):
    """List all available backups"""
    if not _updater:
        return {
            'success': False,
            'error': 'Updater not initialized',
            'timestamp': time.time()
        }
    
    result = _updater.list_backups()
    result['timestamp'] = time.time()
    return result


def handle_update_log(data):
    """Get update history log"""
    if not _updater:
        return {
            'success': False,
            'error': 'Updater not initialized',
            'timestamp': time.time()
        }
    
    limit = data.get('limit', 20)
    result = _updater.get_update_log(limit)
    result['timestamp'] = time.time()
    return result


def handle_handler_stats(data):
    """Get handler loading and execution statistics"""
    if not _loader:
        return {
            'success': False,
            'error': 'Loader not initialized',
            'timestamp': time.time()
        }
    
    stats = _loader.get_handler_stats()
    stats['timestamp'] = time.time()
    stats['success'] = True
    return stats


def handle_reload_handler(data):
    """Reload a specific handler module"""
    if not _loader:
        return {
            'success': False,
            'error': 'Loader not initialized',
            'timestamp': time.time()
        }
    
    module_name = data.get('module', '')
    
    if not module_name:
        return {
            'success': False,
            'error': 'module name is required',
            'timestamp': time.time()
        }
    
    # Remove .py extension if present
    module_name = module_name.replace('.py', '')
    
    result = _loader.reload_handler(module_name)
    result['timestamp'] = time.time()
    return result


def handle_delete_handler(data):
    """
    Delete a handler file
    
    Expected data:
        - filename: Handler filename (e.g., 'camera_handlers.py')
        - backup: Whether to create backup before deletion (default True)
    """
    if not _updater:
        return {
            'success': False,
            'error': 'Updater not initialized',
            'timestamp': time.time()
        }
    
    filename = data.get('filename', '')
    create_backup = data.get('backup', True)
    
    if not filename:
        return {
            'success': False,
            'error': 'filename is required',
            'timestamp': time.time()
        }
    
    # Ensure filename is in handlers directory
    if not filename.startswith('handlers/'):
        filename = f"handlers/{filename}"
    
    # Delete via protected updater
    result = _updater.delete_handler(filename, create_backup)
    
    # If successful, unload the handler from loader
    if result['success'] and _loader:
        module_name = filename.replace('handlers/', '').replace('.py', '')
        # Remove from loaded handlers
        if module_name in _loader.loaded_handlers:
            del _loader.loaded_handlers[module_name]
            result['unloaded'] = True
    
    result['timestamp'] = time.time()
    return result


# Export command handlers
COMMAND_HANDLERS = {
    'update_handler': handle_update_handler,
    'rollback_handler': handle_rollback_handler,
    'list_backups': handle_list_backups,
    'update_log': handle_update_log,
    'handler_stats': handle_handler_stats,
    'reload_handler': handle_reload_handler,
    'delete_handler': handle_delete_handler
}

