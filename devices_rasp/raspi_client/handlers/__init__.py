"""
Handlers Module - UPDATABLE
This directory contains all command handlers that can be safely updated remotely.

Handler files should follow this pattern:
1. Define handler functions with 'handle_' prefix
2. Or provide a COMMAND_HANDLERS dictionary
3. Each handler receives a data dict and returns a result dict

Example:
    def handle_my_command(data):
        return {
            'success': True,
            'message': 'Command executed',
            'data': some_result
        }
"""

__version__ = "1.0.0"
__updatable__ = True  # This directory can be updated remotely


