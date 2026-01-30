#!/usr/bin/env python3
"""
Daheng gxipy SDK Configuration Diagnostics

This script checks the Raspberry Pi configuration and gxipy SDK setup
to identify configuration issues that could cause {Not init API} errors.
"""

import sys
import os
import subprocess
import time

print("🔍====================================================================🔍")
print("                 DAHENG GXIPY SDK CONFIGURATION DIAGNOSTICS")
print("🔍====================================================================🔍")

def run_command(cmd, description):
    """Run a command and return the output"""
    print(f"\n🔧 {description}")
    print(f"   Command: {cmd}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(f"   ✅ Success:")
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    print(f"      {line}")
        else:
            print(f"   ❌ Failed (return code {result.returncode}):")
            if result.stderr:
                for line in result.stderr.strip().split('\n'):
                    if line.strip():
                        print(f"      {line}")
        return result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        print(f"   ⏰ Command timed out")
        return "", "timeout"
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return "", str(e)

def check_kernel_config():
    """Check Raspberry Pi kernel configuration"""
    print("\n📋 STEP 1: Checking Raspberry Pi Kernel Configuration")
    
    # Check current kernel
    run_command("uname -a", "Current kernel version")
    
    # Check config.txt
    stdout, stderr = run_command("sudo cat /boot/firmware/config.txt | grep -E '(kernel=|arm_64bit=|dtoverlay=|gpu_mem=)'", 
                                 "Checking /boot/firmware/config.txt kernel settings")
    
    if "kernel=kernel8.img" in stdout:
        print("   ✅ kernel=kernel8.img is set")
    else:
        print("   ⚠️ kernel=kernel8.img NOT found in config.txt")
        print("   💡 This might be needed for Daheng SDK!")
    
    # Check if we're running 64-bit
    run_command("getconf LONG_BIT", "Architecture (32/64 bit)")

def check_gxipy_installation():
    """Check gxipy installation and paths"""
    print("\n📦 STEP 2: Checking gxipy Installation")
    
    # Check gxipy installation location
    try:
        import gxipy as gx
        print(f"   ✅ gxipy imported successfully")
        print(f"   📁 gxipy location: {gx.__file__}")
        if hasattr(gx, '__version__'):
            print(f"   📊 gxipy version: {gx.__version__}")
        
        # Check gxipy directory contents
        gx_dir = os.path.dirname(gx.__file__)
        print(f"   📁 gxipy directory contents:")
        for item in sorted(os.listdir(gx_dir)):
            print(f"      📄 {item}")
            
        # Look for native libraries
        print(f"   🔍 Looking for native libraries (.so files):")
        for root, dirs, files in os.walk(gx_dir):
            for file in files:
                if file.endswith('.so'):
                    full_path = os.path.join(root, file)
                    print(f"      📚 {full_path}")
                    
                    # Check if library can be loaded
                    try:
                        run_command(f"ldd {full_path} | head -5", f"Checking dependencies of {file}")
                    except:
                        pass
        
    except ImportError as e:
        print(f"   ❌ gxipy not available: {e}")
        return False
    
    return True

def check_usb_permissions():
    """Check USB permissions and access"""
    print("\n🔌 STEP 3: Checking USB Permissions")
    
    run_command("lsusb | grep -i daheng", "USB Daheng camera detection")
    run_command("groups", "Current user groups")
    run_command("ls -la /dev/bus/usb/", "USB device permissions")
    
    # Check if user is in dialout group (sometimes needed for USB access)
    stdout, _ = run_command("groups $USER", "User groups")
    if "dialout" in stdout:
        print("   ✅ User is in dialout group")
    else:
        print("   ⚠️ User not in dialout group (might need: sudo usermod -a -G dialout $USER)")

def test_gxipy_functions():
    """Test specific gxipy functions"""
    print("\n🧪 STEP 4: Testing gxipy Functions")
    
    try:
        import gxipy as gx
        
        # Test available init functions
        init_functions = [name for name in dir(gx) if 'init' in name.lower()]
        print(f"   📋 Available init functions: {init_functions}")
        
        # Test gx_init_lib
        print(f"   🔧 Testing gx.gx_init_lib()...")
        try:
            result = gx.gx_init_lib()
            print(f"      ✅ gx_init_lib() returned: {result}")
        except Exception as e:
            print(f"      ❌ gx_init_lib() failed: {e}")
            
        # Test DeviceManager
        print(f"   🔧 Testing DeviceManager...")
        try:
            dm = gx.DeviceManager()
            dev_num, dev_list = dm.update_all_device_list()
            print(f"      ✅ DeviceManager works, found {dev_num} devices")
        except Exception as e:
            print(f"      ❌ DeviceManager failed: {e}")
            
        # Test opening camera
        if dev_num > 0:
            print(f"   🔧 Testing camera open...")
            try:
                cam = dm.open_device_by_index(1)
                print(f"      ✅ Camera opened successfully")
                
                # Test stream_on in isolation
                print(f"   🔧 Testing stream_on...")
                try:
                    cam.stream_on()
                    print(f"      ✅ stream_on() succeeded")
                    
                    # Test get_image
                    print(f"   🔧 Testing get_image...")
                    try:
                        image = cam.data_stream[0].get_image(timeout=1000)
                        if image:
                            print(f"      ✅ get_image() succeeded")
                        else:
                            print(f"      ⚠️ get_image() returned None")
                    except Exception as e:
                        print(f"      ❌ get_image() failed: {e}")
                    
                    cam.stream_off()
                except Exception as e:
                    print(f"      ❌ stream_on() failed: {e}")
                    
                cam.close_device()
            except Exception as e:
                print(f"      ❌ Camera open failed: {e}")
        
    except Exception as e:
        print(f"   ❌ gxipy testing failed: {e}")

def check_environment():
    """Check environment variables and paths"""
    print("\n🌍 STEP 5: Checking Environment")
    
    # Check LD_LIBRARY_PATH
    ld_path = os.environ.get('LD_LIBRARY_PATH', '')
    if ld_path:
        print(f"   📚 LD_LIBRARY_PATH: {ld_path}")
    else:
        print(f"   ⚠️ LD_LIBRARY_PATH not set")
    
    # Check PYTHONPATH
    py_path = os.environ.get('PYTHONPATH', '')
    if py_path:
        print(f"   🐍 PYTHONPATH: {py_path}")
    else:
        print(f"   ℹ️ PYTHONPATH not set (usually OK)")
    
    # Check if running as root vs user
    run_command("whoami", "Current user")
    run_command("id", "User ID and groups")

def main():
    """Run all diagnostic checks"""
    
    check_kernel_config()
    if not check_gxipy_installation():
        return
    
    check_usb_permissions()
    test_gxipy_functions()
    check_environment()
    
    print(f"\n🎯====================================================================🎯")
    print(f"                          DIAGNOSTIC SUMMARY")
    print(f"🎯====================================================================🎯")
    print(f"")
    print(f"💡 RECOMMENDATIONS:")
    print(f"   1. If kernel=kernel8.img is missing, add it to /boot/firmware/config.txt")
    print(f"   2. If gx_init_lib() fails, check native library dependencies")
    print(f"   3. If USB permissions fail, add user to dialout group")
    print(f"   4. If stream_on works but get_image fails, it's a threading/context issue")
    print(f"   5. Compare working test vs server: run both as same user")
    print(f"")
    print(f"📅 Diagnostics completed")

if __name__ == "__main__":
    main()
