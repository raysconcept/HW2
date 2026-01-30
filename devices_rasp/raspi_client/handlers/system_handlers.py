#!/usr/bin/env python3

"""
System Handlers - Updatable Module
Handles system information and status commands
"""

import time
import platform
import os
import sys


# Track start time for uptime calculation
START_TIME = time.time()


def handle_ping(data):
    """Respond to ping request"""
    message = data.get('message', 'pong')
    
    return {
        'success': True,
        'type': 'ping_response',
        'message': f'Received: {message}',
        'echo': message,
        'timestamp': time.time()
    }


def handle_get_status(data):
    """Get current device status"""
    uptime = time.time() - START_TIME
    
    return {
        'success': True,
        'type': 'status',
        'device': 'RaspberryPi',
        'version': '2.0_modular',
        'uptime_seconds': round(uptime, 1),
        'platform': platform.system(),
        'python_version': platform.python_version(),
        'timestamp': time.time()
    }


def handle_system_info(data):
    """Get detailed system information"""
    try:
        # CPU temperature (Raspberry Pi specific)
        cpu_temp = "N/A"
        try:
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                cpu_temp = f"{int(f.read()) / 1000:.1f}°C"
        except:
            pass
        
        # Memory info (if psutil available)
        memory_info = "N/A"
        try:
            import psutil
            memory_info = f"{psutil.virtual_memory().percent}%"
        except:
            pass
        
        # Disk usage
        disk_usage = "N/A"
        try:
            import psutil
            disk = psutil.disk_usage('/')
            disk_usage = f"{disk.percent}%"
        except:
            pass
        
        return {
            'success': True,
            'type': 'system_info',
            'platform': platform.platform(),
            'python_version': platform.python_version(),
            'cpu_temperature': cpu_temp,
            'memory_usage': memory_info,
            'disk_usage': disk_usage,
            'uptime_seconds': round(time.time() - START_TIME, 1),
            'hostname': platform.node(),
            'timestamp': time.time()
        }
    
    except Exception as e:
        return {
            'success': False,
            'type': 'system_info_error',
            'error': str(e),
            'timestamp': time.time()
        }


def handle_echo(data):
    """Echo back the received data"""
    return {
        'success': True,
        'type': 'echo_response',
        'message': 'Echo successful',
        'received_data': data,
        'timestamp': time.time()
    }


# Export command handlers
COMMAND_HANDLERS = {
    'ping': handle_ping,
    'get_status': handle_get_status,
    'system_info': handle_system_info,
    'echo': handle_echo
}

