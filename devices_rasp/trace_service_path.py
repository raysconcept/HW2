#!/usr/bin/env python3

"""
Trace the exact path the service takes when processing list_cameras
"""

import sys
import os
sys.path.append('/home/pi/raspi_client')

def main():
    print("🔍 TRACING SERVICE PATH FOR list_cameras")
    print("=" * 60)
    
    # 1. Check what the SafeHandlerLoader finds
    print("📋 Step 1: Check SafeHandlerLoader discovery")
    
    from core.safe_loader import SafeHandlerLoader
    from core.updater import ProtectedUpdater
    
    handlers_path = '/home/pi/raspi_client/handlers'
    updater = ProtectedUpdater(handlers_path)
    loader = SafeHandlerLoader(handlers_path, updater)
    
    # Load all handlers like the service does
    loader.load_all_handlers()
    
    # Check what commands are available
    print(f"Available commands: {list(loader.commands.keys())}")
    
    # Check if list_cameras is there
    if 'list_cameras' in loader.commands:
        print("✅ list_cameras command found")
        handler_func = loader.commands['list_cameras']
        print(f"Handler function: {handler_func}")
        print(f"Handler module: {handler_func.__module__}")
        print(f"Handler file: {handler_func.__code__.co_filename}")
    else:
        print("❌ list_cameras command NOT found")
        return
    
    print("\n📋 Step 2: Test execute_command")
    
    try:
        # Execute the command like the service does
        result = loader.execute_command('list_cameras', {})
        print(f"Command result: {result}")
        
        if result.get('success') and 'cameras' in result:
            print(f"\n📹 Found {len(result['cameras'])} cameras:")
            for cam in result['cameras']:
                model_status = "✅" if cam['model'] != 'unknown' else "❌"
                print(f"  {model_status} {cam['name']} → {cam['model']}")
        
    except Exception as e:
        print(f"❌ Command execution failed: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n📋 Step 3: Check module versions")
    
    # Import camera_handlers directly
    try:
        import handlers.camera_handlers as ch
        print(f"Direct import file: {ch.__file__}")
        
        # Test direct call
        direct_result = ch.handle_list_cameras({})
        print(f"Direct call result: {direct_result}")
        
        if direct_result.get('success') and 'cameras' in direct_result:
            print(f"\n📹 Direct call found {len(direct_result['cameras'])} cameras:")
            for cam in direct_result['cameras']:
                model_status = "✅" if cam['model'] != 'unknown' else "❌"
                print(f"  {model_status} {cam['name']} → {cam['model']}")
        
    except Exception as e:
        print(f"❌ Direct import failed: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n📋 Step 4: Check file timestamps")
    
    camera_handler_file = '/home/pi/raspi_client/handlers/camera_handlers.py'
    if os.path.exists(camera_handler_file):
        stat = os.stat(camera_handler_file)
        mod_time = stat.st_mtime
        import time
        readable_time = time.ctime(mod_time)
        print(f"camera_handlers.py modified: {readable_time}")
    
    print("\n" + "=" * 60)
    print("🎯 ANALYSIS:")
    print("=" * 60)
    
    print("If both calls show different results, there might be:")
    print("1. Multiple versions of camera_handlers.py")
    print("2. Module caching issues")
    print("3. Different Python paths")
    print("4. Import issues")

if __name__ == '__main__':
    main()

