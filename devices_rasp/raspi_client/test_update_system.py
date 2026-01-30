#!/usr/bin/env python3

"""
Test Suite for Safe Update System
Tests validation, deployment, and rollback capabilities
"""

import sys
import os
import time

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.updater import ProtectedUpdater
from core.validator import CodeValidator


class UpdateSystemTester:
    """Test the safe update system"""
    
    def __init__(self):
        self.base_path = os.path.dirname(os.path.abspath(__file__))
        self.updater = ProtectedUpdater(self.base_path)
        self.validator = CodeValidator()
        self.tests_passed = 0
        self.tests_failed = 0
    
    def run_all_tests(self):
        """Run all update system tests"""
        print("🧪 Safe Update System Test Suite")
        print("="*60)
        
        # Test 1: Validation - Good Code
        self.test_good_code_validation()
        
        # Test 2: Validation - Syntax Error
        self.test_syntax_error_detection()
        
        # Test 3: Validation - Dangerous Pattern
        self.test_dangerous_pattern_detection()
        
        # Test 4: Validation - Protected Import
        self.test_protected_import_blocking()
        
        # Test 5: Permission - Block Core Update
        self.test_block_core_update()
        
        # Test 6: Permission - Block Main Files
        self.test_block_main_file_update()
        
        # Test 7: Permission - Allow Handler Update
        self.test_allow_handler_update()
        
        # Test 8: Actual Update - Good Code
        self.test_deploy_good_code()
        
        # Test 9: Actual Update - Bad Code (should rollback)
        self.test_deploy_bad_code_rollback()
        
        # Test 10: Rollback - Manual Rollback
        self.test_manual_rollback()
        
        # Summary
        print("\n" + "="*60)
        print("📊 Test Results:")
        print(f"   ✅ Passed: {self.tests_passed}")
        print(f"   ❌ Failed: {self.tests_failed}")
        print(f"   📈 Success Rate: {self.tests_passed / (self.tests_passed + self.tests_failed) * 100:.1f}%")
        print("="*60)
        
        return self.tests_failed == 0
    
    def assert_test(self, condition, test_name, message=""):
        """Helper to assert test results"""
        if condition:
            print(f"✅ PASS: {test_name}")
            self.tests_passed += 1
            return True
        else:
            print(f"❌ FAIL: {test_name}")
            if message:
                print(f"   {message}")
            self.tests_failed += 1
            return False
    
    # ===== VALIDATION TESTS =====
    
    def test_good_code_validation(self):
        """Test that valid code passes validation"""
        print("\n📝 Test 1: Good Code Validation")
        
        good_code = '''
import time

def handle_test(data):
    """Test handler"""
    return {
        'success': True,
        'message': 'Test successful',
        'timestamp': time.time()
    }

COMMAND_HANDLERS = {
    'test': handle_test
}
'''
        
        result = self.validator.validate_code(good_code, "test_handler.py")
        self.assert_test(
            result['valid'],
            "Valid code should pass validation",
            f"Errors: {result.get('errors', [])}"
        )
    
    def test_syntax_error_detection(self):
        """Test that syntax errors are caught"""
        print("\n📝 Test 2: Syntax Error Detection")
        
        bad_syntax = '''
def handle_test(data):  # Missing colon
    print("test"
    return {'success': True}  # Unclosed parenthesis
'''
        
        result = self.validator.validate_code(bad_syntax, "bad_syntax.py")
        self.assert_test(
            not result['valid'],
            "Syntax errors should be detected",
            f"Result: {result}"
        )
    
    def test_dangerous_pattern_detection(self):
        """Test that dangerous code patterns are blocked"""
        print("\n📝 Test 3: Dangerous Pattern Detection")
        
        dangerous_code = '''
import os

def handle_dangerous(data):
    # This is dangerous!
    os.system('rm -rf /')
    return {'success': True}
'''
        
        result = self.validator.validate_code(dangerous_code, "dangerous.py")
        self.assert_test(
            not result['valid'],
            "Dangerous patterns should be blocked",
            f"Should detect: rm -rf"
        )
    
    def test_protected_import_blocking(self):
        """Test that handlers can't import core updater"""
        print("\n📝 Test 4: Protected Import Blocking")
        
        malicious_code = '''
import time
from core.updater import ProtectedUpdater

def handle_evil(data):
    # Try to mess with the updater!
    updater = ProtectedUpdater('/')
    return {'success': True}
'''
        
        result = self.validator.validate_code(malicious_code, "evil_handler.py")
        self.assert_test(
            not result['valid'],
            "Handlers should not be able to import core.updater",
            f"Should block: from core.updater"
        )
    
    # ===== PERMISSION TESTS =====
    
    def test_block_core_update(self):
        """Test that core files cannot be updated"""
        print("\n📝 Test 5: Block Core File Update")
        
        can_update, reason = self.updater.can_update_file('core/updater.py')
        self.assert_test(
            not can_update,
            "Core files should not be updatable remotely",
            f"Reason: {reason}"
        )
    
    def test_block_main_file_update(self):
        """Test that main client files cannot be updated"""
        print("\n📝 Test 6: Block Main File Update")
        
        can_update, reason = self.updater.can_update_file('client.py')
        self.assert_test(
            not can_update,
            "Main client file should not be updatable remotely",
            f"Reason: {reason}"
        )
    
    def test_allow_handler_update(self):
        """Test that handler files can be updated"""
        print("\n📝 Test 7: Allow Handler Update")
        
        can_update, reason = self.updater.can_update_file('handlers/test_handler.py')
        self.assert_test(
            can_update,
            "Handler files should be updatable",
            f"Reason: {reason}"
        )
    
    # ===== DEPLOYMENT TESTS =====
    
    def test_deploy_good_code(self):
        """Test deploying valid code"""
        print("\n📝 Test 8: Deploy Good Code")
        
        good_handler = '''#!/usr/bin/env python3
"""Test handler for update system testing"""

import time

def handle_test_command(data):
    """Test command handler"""
    return {
        'success': True,
        'message': 'Test handler working!',
        'version': 'v1.0',
        'timestamp': time.time()
    }

COMMAND_HANDLERS = {
    'test_command': handle_test_command
}
'''
        
        result = self.updater.update_handler(
            'handlers/test_handler.py',
            good_handler
        )
        
        success = result['success']
        self.assert_test(
            success,
            "Good code should deploy successfully",
            f"Result: {result.get('message', result.get('error'))}"
        )
        
        # Verify file was created
        if success:
            test_file = os.path.join(
                self.base_path,
                'handlers',
                'test_handler.py'
            )
            exists = os.path.exists(test_file)
            self.assert_test(
                exists,
                "Deployed file should exist on disk"
            )
    
    def test_deploy_bad_code_rollback(self):
        """Test that bad code triggers automatic rollback"""
        print("\n📝 Test 9: Deploy Bad Code (Should Rollback)")
        
        # First deploy good code
        good_code = '''
import time

def handle_working(data):
    return {'success': True, 'version': 'good'}

COMMAND_HANDLERS = {'working': handle_working}
'''
        
        self.updater.update_handler('handlers/rollback_test.py', good_code)
        time.sleep(0.1)
        
        # Now try to deploy broken code
        broken_code = '''
import time
import nonexistent_module  # This will fail

def handle_broken(data):
    return undefined_variable  # This is broken

COMMAND_HANDLERS = {'broken': handle_broken}
'''
        
        result = self.updater.update_handler('handlers/rollback_test.py', broken_code)
        
        # Should fail due to validation
        self.assert_test(
            not result['success'],
            "Bad code deployment should fail",
            f"Result: {result.get('error', 'No error message')}"
        )
        
        # Original file should still be intact
        rollback_file = os.path.join(
            self.base_path,
            'handlers',
            'rollback_test.py'
        )
        
        if os.path.exists(rollback_file):
            with open(rollback_file, 'r') as f:
                content = f.read()
                still_good = 'handle_working' in content
                self.assert_test(
                    still_good,
                    "Original code should still be intact after failed update"
                )
    
    def test_manual_rollback(self):
        """Test manual rollback to last known good"""
        print("\n📝 Test 10: Manual Rollback")
        
        # Deploy version 1
        v1_code = '''
def handle_v1(data):
    return {'success': True, 'version': 1}

COMMAND_HANDLERS = {'version_test': handle_v1}
'''
        
        self.updater.update_handler('handlers/version_test.py', v1_code)
        time.sleep(0.1)
        
        # Deploy version 2 (will become "current")
        v2_code = '''
def handle_v2(data):
    return {'success': True, 'version': 2}

COMMAND_HANDLERS = {'version_test': handle_v2}
'''
        
        self.updater.update_handler('handlers/version_test.py', v2_code)
        time.sleep(0.1)
        
        # Now rollback to v1
        result = self.updater.rollback_to_last_known_good('handlers/version_test.py')
        
        self.assert_test(
            result['success'],
            "Manual rollback should succeed",
            f"Result: {result.get('message', result.get('error'))}"
        )
        
        # Verify rolled back content
        if result['success']:
            version_file = os.path.join(
                self.base_path,
                'handlers',
                'version_test.py'
            )
            
            if os.path.exists(version_file):
                with open(version_file, 'r') as f:
                    content = f.read()
                    is_v1 = 'handle_v1' in content
                    self.assert_test(
                        is_v1,
                        "Rolled back file should contain v1 code"
                    )
    
    def cleanup_test_files(self):
        """Clean up test handler files"""
        print("\n🧹 Cleaning up test files...")
        
        test_files = [
            'test_handler.py',
            'rollback_test.py',
            'version_test.py'
        ]
        
        for filename in test_files:
            file_path = os.path.join(self.base_path, 'handlers', filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"   Removed: {filename}")


def main():
    """Run the test suite"""
    tester = UpdateSystemTester()
    
    try:
        success = tester.run_all_tests()
        
        # Cleanup
        tester.cleanup_test_files()
        
        if success:
            print("\n🎉 All tests passed! Update system is working correctly.")
            return 0
        else:
            print("\n⚠️  Some tests failed. Check the output above.")
            return 1
    
    except Exception as e:
        print(f"\n💥 Test suite crashed: {e}")
        import traceback
        traceback.print_exc()
        return 2


if __name__ == "__main__":
    sys.exit(main())

