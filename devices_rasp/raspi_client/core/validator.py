#!/usr/bin/env python3

"""
Code Validator - Protected Core Component
Validates Python code before deployment to prevent crashes
"""

import ast
import sys
import importlib.util
import tempfile
import os
from typing import Dict, Any


class CodeValidator:
    """Validates Python code for syntax, imports, and basic runtime safety"""
    
    # Patterns that are flagged as potentially dangerous
    DANGEROUS_PATTERNS = [
        'os.system(',
        'subprocess.call(',
        'exec(',
        'eval(',
        '__import__(',
        'rm -rf',
        'shutil.rmtree(',
    ]
    
    # Patterns that should NOT appear in handler code (protecting core)
    FORBIDDEN_IN_HANDLERS = [
        'updater.py',
        'validator.py',
        'safe_loader.py',
        'core.__init__',
        'import core.updater',
        'from core.updater',
    ]
    
    def __init__(self):
        self.validation_results = []
    
    def validate_code(self, code: str, filename: str = "unknown") -> Dict[str, Any]:
        """
        Comprehensive code validation
        
        Args:
            code: Python code as string
            filename: Name of the file being validated
            
        Returns:
            Dictionary with validation results
        """
        results = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'filename': filename
        }
        
        # Step 1: Syntax validation
        syntax_check = self._check_syntax(code, filename)
        if not syntax_check['valid']:
            results['valid'] = False
            results['errors'].append(syntax_check['error'])
            return results  # Stop here if syntax is broken
        
        # Step 2: Security check (dangerous patterns)
        security_check = self._check_security(code)
        if not security_check['valid']:
            results['valid'] = False
            results['errors'].extend(security_check['errors'])
        results['warnings'].extend(security_check.get('warnings', []))
        
        # Step 3: Protected module check
        protection_check = self._check_protected_imports(code)
        if not protection_check['valid']:
            results['valid'] = False
            results['errors'].extend(protection_check['errors'])
        
        # Step 4: Import validation
        import_check = self._check_imports(code, filename)
        if not import_check['valid']:
            results['warnings'].extend(import_check['warnings'])
        
        return results
    
    def _check_syntax(self, code: str, filename: str) -> Dict[str, Any]:
        """Check Python syntax using AST compilation"""
        try:
            ast.parse(code, filename=filename)
            return {'valid': True}
        except SyntaxError as e:
            return {
                'valid': False,
                'error': f"Syntax Error at line {e.lineno}: {e.msg}"
            }
        except Exception as e:
            return {
                'valid': False,
                'error': f"Parse Error: {str(e)}"
            }
    
    def _check_security(self, code: str) -> Dict[str, Any]:
        """Check for dangerous code patterns"""
        errors = []
        warnings = []
        
        for pattern in self.DANGEROUS_PATTERNS:
            if pattern in code:
                errors.append(f"Dangerous pattern detected: {pattern}")
        
        # Check for potential issues
        if 'while True:' in code and 'sleep(' not in code:
            warnings.append("Infinite loop without sleep detected - may cause high CPU")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _check_protected_imports(self, code: str) -> Dict[str, Any]:
        """Ensure handlers don't try to modify core update functionality"""
        errors = []
        
        for pattern in self.FORBIDDEN_IN_HANDLERS:
            if pattern in code:
                errors.append(
                    f"FORBIDDEN: Handler code cannot import/modify core updater: {pattern}"
                )
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
    
    def _check_imports(self, code: str, filename: str) -> Dict[str, Any]:
        """Validate that all imports are available"""
        warnings = []
        
        try:
            # Parse the code to find imports
            tree = ast.parse(code, filename=filename)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if not self._can_import(alias.name):
                            warnings.append(f"Module '{alias.name}' may not be available")
                
                elif isinstance(node, ast.ImportFrom):
                    if node.module and not self._can_import(node.module):
                        warnings.append(f"Module '{node.module}' may not be available")
        
        except Exception as e:
            warnings.append(f"Could not fully validate imports: {str(e)}")
        
        return {
            'valid': True,  # Warnings only, don't block on imports
            'warnings': warnings
        }
    
    def _can_import(self, module_name: str) -> bool:
        """Check if a module can be imported"""
        # Allow standard library and common modules
        if module_name.startswith('raspi_client.'):
            return True  # Our own modules
        
        try:
            spec = importlib.util.find_spec(module_name.split('.')[0])
            return spec is not None
        except (ImportError, ModuleNotFoundError, ValueError):
            return False
    
    def test_import(self, code: str, filename: str) -> Dict[str, Any]:
        """
        Actually try to import the code in a safe way
        This is the final validation step before deployment
        """
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(
                mode='w', 
                suffix='.py', 
                delete=False
            ) as tmp:
                tmp.write(code)
                tmp_path = tmp.name
            
            try:
                # Try to load as module
                spec = importlib.util.spec_from_file_location("test_module", tmp_path)
                if spec and spec.loader:
                    test_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(test_module)
                    
                    return {
                        'valid': True,
                        'message': 'Code successfully imported and executed'
                    }
                else:
                    return {
                        'valid': False,
                        'error': 'Could not create module spec'
                    }
            
            finally:
                # Clean up temp file
                try:
                    os.unlink(tmp_path)
                except:
                    pass
        
        except Exception as e:
            return {
                'valid': False,
                'error': f"Import test failed: {str(e)}"
            }


def validate_handler_code(code: str, filename: str = "handler.py") -> Dict[str, Any]:
    """
    Convenience function to validate handler code
    
    Args:
        code: Python code to validate
        filename: Name of the handler file
        
    Returns:
        Validation results dictionary
    """
    validator = CodeValidator()
    return validator.validate_code(code, filename)


