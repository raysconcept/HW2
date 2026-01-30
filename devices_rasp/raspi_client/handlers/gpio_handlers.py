#!/usr/bin/env python3

"""
GPIO Handlers - Updatable Module
Handles GPIO operations for Raspberry Pi hardware control
"""

import time

# Try to import RPi.GPIO, fall back gracefully if not available
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
    
    # Initialize GPIO
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
except ImportError:
    GPIO_AVAILABLE = False
    print("⚠️  RPi.GPIO not available - GPIO handlers in simulation mode")


# GPIO state tracking
gpio_state = {
    'initialized': GPIO_AVAILABLE,
    'pins': {}
}


def handle_led_on(data):
    """Turn LED on"""
    pin = data.get('pin', 18)  # Default to GPIO 18
    
    if GPIO_AVAILABLE:
        try:
            GPIO.setup(pin, GPIO.OUT)
            GPIO.output(pin, GPIO.HIGH)
            gpio_state['pins'][pin] = 'HIGH'
            
            return {
                'success': True,
                'type': 'led_status',
                'message': f'LED on GPIO {pin} turned ON',
                'pin': pin,
                'state': 'on',
                'timestamp': time.time()
            }
        except Exception as e:
            return {
                'success': False,
                'type': 'gpio_error',
                'error': f'GPIO error: {str(e)}',
                'pin': pin,
                'timestamp': time.time()
            }
    else:
        gpio_state['pins'][pin] = 'HIGH (simulated)'
        return {
            'success': True,
            'type': 'led_status',
            'message': f'LED on GPIO {pin} turned ON (simulated)',
            'pin': pin,
            'state': 'on',
            'simulated': True,
            'timestamp': time.time()
        }


def handle_led_off(data):
    """Turn LED off"""
    pin = data.get('pin', 18)
    
    if GPIO_AVAILABLE:
        try:
            GPIO.setup(pin, GPIO.OUT)
            GPIO.output(pin, GPIO.LOW)
            gpio_state['pins'][pin] = 'LOW'
            
            return {
                'success': True,
                'type': 'led_status',
                'message': f'LED on GPIO {pin} turned OFF',
                'pin': pin,
                'state': 'off',
                'timestamp': time.time()
            }
        except Exception as e:
            return {
                'success': False,
                'type': 'gpio_error',
                'error': f'GPIO error: {str(e)}',
                'pin': pin,
                'timestamp': time.time()
            }
    else:
        gpio_state['pins'][pin] = 'LOW (simulated)'
        return {
            'success': True,
            'type': 'led_status',
            'message': f'LED on GPIO {pin} turned OFF (simulated)',
            'pin': pin,
            'state': 'off',
            'simulated': True,
            'timestamp': time.time()
        }


def handle_gpio_test(data):
    """Test GPIO pin control"""
    pin = data.get('pin', 18)
    state = data.get('state', 'low').lower()
    
    if GPIO_AVAILABLE:
        try:
            GPIO.setup(pin, GPIO.OUT)
            gpio_value = GPIO.HIGH if state == 'high' else GPIO.LOW
            GPIO.output(pin, gpio_value)
            gpio_state['pins'][pin] = state.upper()
            
            return {
                'success': True,
                'type': 'gpio_status',
                'message': f'GPIO {pin} set to {state.upper()}',
                'pin': pin,
                'state': state,
                'timestamp': time.time()
            }
        except Exception as e:
            return {
                'success': False,
                'type': 'gpio_error',
                'error': f'GPIO error: {str(e)}',
                'pin': pin,
                'timestamp': time.time()
            }
    else:
        gpio_state['pins'][pin] = f'{state.upper()} (simulated)'
        return {
            'success': True,
            'type': 'gpio_status',
            'message': f'GPIO {pin} set to {state.upper()} (simulated)',
            'pin': pin,
            'state': state,
            'simulated': True,
            'timestamp': time.time()
        }


def handle_gpio_status(data):
    """Get current GPIO status"""
    return {
        'success': True,
        'type': 'gpio_status',
        'gpio_available': GPIO_AVAILABLE,
        'pins': gpio_state['pins'],
        'message': 'GPIO status retrieved',
        'timestamp': time.time()
    }


# Export command handlers
COMMAND_HANDLERS = {
    'led_on': handle_led_on,
    'led_off': handle_led_off,
    'gpio_test': handle_gpio_test,
    'gpio_status': handle_gpio_status
}


