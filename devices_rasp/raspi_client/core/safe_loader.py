#!/usr/bin/env python3

"""
Safe Module Loader - Protected Core Component
Loads handler modules with runtime monitoring and automatic rollback on failure
"""

import sys
import os
import importlib
import importlib.util
import time
import traceback
from typing import Dict, Any, Optional, Callable


class SafeHandlerLoader:
    """
    Loads handler modules safely with runtime monitoring
    
    Features:
    - Dynamic module loading/reloading
    - Runtime failure detection
    - Automatic rollback on crashes
    - Isolated handler execution
    """
    
    def __init__(self, handlers_path: str, updater=None):
        """
        Initialize the safe loader
        
        Args:
            handlers_path: Path to handlers directory
            updater: Reference to ProtectedUpdater for rollback capability
        """
        self.handlers_path = os.path.abspath(handlers_path)
        self.updater = updater
        self.loaded_handlers = {}
        self.handler_stats = {}
        
        # Ensure handlers path is in Python path
        if self.handlers_path not in sys.path:
            sys.path.insert(0, os.path.dirname(self.handlers_path))
        
        print(f"🔧 Safe Handler Loader initialized")
        print(f"📂 Handlers path: {self.handlers_path}")
    
    def load_all_handlers(self) -> Dict[str, Any]:
        """
        Load all handler modules from handlers directory
        
        Returns:
            Dictionary of loaded handlers with their commands
        """
        results = {
            'loaded': [],
            'failed': [],
            'total_commands': 0
        }
        
        if not os.path.exists(self.handlers_path):
            print(f"⚠️  Handlers directory not found: {self.handlers_path}")
            return results
        
        for filename in os.listdir(self.handlers_path):
            if filename.endswith('.py') and not filename.startswith('_'):
                module_name = filename[:-3]  # Remove .py
                load_result = self.load_handler(module_name)
                
                if load_result['success']:
                    results['loaded'].append(module_name)
                    results['total_commands'] += load_result.get('command_count', 0)
                else:
                    results['failed'].append({
                        'module': module_name,
                        'error': load_result.get('error')
                    })
        
        print(f"✅ Loaded {len(results['loaded'])} handler modules")
        print(f"📋 Total commands available: {results['total_commands']}")
        
        if results['failed']:
            print(f"⚠️  Failed to load {len(results['failed'])} modules:")
            for fail in results['failed']:
                print(f"   - {fail['module']}: {fail['error']}")
        
        return results
    
    def load_handler(self, module_name: str) -> Dict[str, Any]:
        """
        Safely load a single handler module
        
        Args:
            module_name: Name of the handler module (without .py)
            
        Returns:
            Load result dictionary
        """
        try:
            module_file = f"{module_name}.py"
            module_path = os.path.join(self.handlers_path, module_file)
            
            if not os.path.exists(module_path):
                return {
                    'success': False,
                    'error': f'Module file not found: {module_file}'
                }
            
            # Try to load the module
            full_module_name = f"handlers.{module_name}"
            
            try:
                # If already loaded, reload it
                if full_module_name in sys.modules:
                    module = importlib.reload(sys.modules[full_module_name])
                else:
                    spec = importlib.util.spec_from_file_location(
                        full_module_name,
                        module_path
                    )
                    if spec and spec.loader:
                        module = importlib.util.module_from_spec(spec)
                        sys.modules[full_module_name] = module
                        spec.loader.exec_module(module)
                    else:
                        return {
                            'success': False,
                            'error': 'Could not create module spec'
                        }
                
                # Extract handler functions
                commands = self._extract_commands(module)
                
                # Store loaded handler
                self.loaded_handlers[module_name] = {
                    'module': module,
                    'commands': commands,
                    'loaded_at': time.time()
                }
                
                # Initialize stats
                if module_name not in self.handler_stats:
                    self.handler_stats[module_name] = {
                        'load_count': 0,
                        'execution_count': 0,
                        'error_count': 0,
                        'last_error': None
                    }
                
                self.handler_stats[module_name]['load_count'] += 1
                
                print(f"✅ Loaded handler: {module_name} ({len(commands)} commands)")
                
                return {
                    'success': True,
                    'module_name': module_name,
                    'command_count': len(commands),
                    'commands': list(commands.keys())
                }
            
            except Exception as e:
                error_msg = f"Failed to import {module_name}: {str(e)}"
                print(f"❌ {error_msg}")
                
                # If updater is available, try to rollback
                if self.updater:
                    print(f"🔄 Attempting rollback for {module_file}...")
                    rollback_result = self.updater.rollback_to_last_known_good(
                        f"handlers/{module_file}"
                    )
                    if rollback_result['success']:
                        print(f"✅ Rollback successful, retrying load...")
                        # Retry loading after rollback
                        return self.load_handler(module_name)
                
                return {
                    'success': False,
                    'error': error_msg,
                    'traceback': traceback.format_exc()
                }
        
        except Exception as e:
            return {
                'success': False,
                'error': f'Unexpected error loading {module_name}: {str(e)}'
            }
    
    def _extract_commands(self, module) -> Dict[str, Callable]:
        """
        Extract command handler functions from a module
        
        Looks for:
        - Functions starting with 'handle_'
        - COMMAND_HANDLERS dictionary in module
        
        Args:
            module: Loaded Python module
            
        Returns:
            Dictionary mapping command names to handler functions
        """
        commands = {}
        
        # Method 1: Look for COMMAND_HANDLERS dictionary
        if hasattr(module, 'COMMAND_HANDLERS'):
            handlers_dict = getattr(module, 'COMMAND_HANDLERS')
            if isinstance(handlers_dict, dict):
                commands.update(handlers_dict)
        
        # Method 2: Auto-discover handle_* functions
        for attr_name in dir(module):
            if attr_name.startswith('handle_'):
                attr = getattr(module, attr_name)
                if callable(attr):
                    # Convert handle_led_on -> led_on
                    command_name = attr_name[7:]  # Remove 'handle_'
                    commands[command_name] = attr
        
        return commands
    
    def execute_command(self, command: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Safely execute a command from loaded handlers
        
        Args:
            command: Command name
            data: Command data/parameters
            
        Returns:
            Command execution result
        """
        try:
            # Find handler for this command
            handler_func = None
            handler_module = None
            
            for module_name, handler_info in self.loaded_handlers.items():
                if command in handler_info['commands']:
                    handler_func = handler_info['commands'][command]
                    handler_module = module_name
                    break
            
            if not handler_func:
                return {
                    'success': False,
                    'error': f'Unknown command: {command}',
                    'available_commands': self.get_available_commands()
                }
            
            # Execute the handler
            try:
                result = handler_func(data)
                
                # Track stats
                if handler_module in self.handler_stats:
                    self.handler_stats[handler_module]['execution_count'] += 1
                
                return result
            
            except Exception as e:
                error_msg = f"Handler execution error: {str(e)}"
                error_trace = traceback.format_exc()
                
                print(f"❌ {error_msg}")
                print(f"Traceback:\n{error_trace}")
                
                # Track error
                if handler_module in self.handler_stats:
                    stats = self.handler_stats[handler_module]
                    stats['error_count'] += 1
                    stats['last_error'] = {
                        'time': time.time(),
                        'command': command,
                        'error': error_msg
                    }
                    
                    # If too many errors, suggest rollback
                    if stats['error_count'] > 5:
                        print(f"⚠️  Handler {handler_module} has {stats['error_count']} errors!")
                        print(f"💡 Consider rolling back to last known good version")
                
                return {
                    'success': False,
                    'error': error_msg,
                    'traceback': error_trace,
                    'handler_module': handler_module
                }
        
        except Exception as e:
            return {
                'success': False,
                'error': f'Command execution system error: {str(e)}'
            }
    
    def get_available_commands(self) -> list:
        """Get list of all available commands"""
        commands = []
        for handler_info in self.loaded_handlers.values():
            commands.extend(handler_info['commands'].keys())
        return sorted(commands)
    
    def get_handler_stats(self) -> Dict[str, Any]:
        """Get statistics about loaded handlers"""
        return {
            'loaded_modules': len(self.loaded_handlers),
            'available_commands': len(self.get_available_commands()),
            'stats': self.handler_stats
        }
    
    def reload_handler(self, module_name: str) -> Dict[str, Any]:
        """
        Reload a specific handler module
        
        Args:
            module_name: Name of handler to reload
            
        Returns:
            Reload result
        """
        print(f"🔄 Reloading handler: {module_name}")
        
        # Remove from loaded handlers
        if module_name in self.loaded_handlers:
            del self.loaded_handlers[module_name]
        
        # Reload
        return self.load_handler(module_name)

