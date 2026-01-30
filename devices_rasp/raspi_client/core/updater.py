#!/usr/bin/env python3

"""
Protected Update Engine - CORE COMPONENT
This module handles safe code updates with validation and rollback.
DO NOT MODIFY THIS FILE THROUGH REMOTE UPDATES.
"""

import os
import shutil
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional
from .validator import CodeValidator


class ProtectedUpdater:
    """
    Immutable update engine that safely updates handler code
    
    Security Features:
    - Validates code before deployment
    - Creates automatic backups
    - Rolls back on failure
    - Protected from remote modification
    """
    
    VERSION = "1.0.0"
    PROTECTED = True  # This file cannot be updated remotely
    
    def __init__(self, base_path: str):
        """
        Initialize the updater
        
        Args:
            base_path: Base directory of the raspi_client
        """
        self.base_path = os.path.abspath(base_path)
        self.handlers_path = os.path.join(self.base_path, 'handlers')
        self.backups_path = os.path.join(self.base_path, '.backups')
        self.last_known_good_path = os.path.join(self.base_path, '.last_known_good')
        self.update_log_path = os.path.join(self.base_path, '.update_log.json')
        
        self.validator = CodeValidator()
        
        # Ensure required directories exist
        os.makedirs(self.backups_path, exist_ok=True)
        os.makedirs(self.last_known_good_path, exist_ok=True)
        
        print(f"🛡️  Protected Updater v{self.VERSION} initialized")
        print(f"📁 Handlers path: {self.handlers_path}")
        print(f"💾 Backups path: {self.backups_path}")
    
    def can_update_file(self, filename: str) -> tuple[bool, str]:
        """
        Check if a file is allowed to be updated remotely
        
        Args:
            filename: Path to the file (relative to base_path)
            
        Returns:
            (allowed, reason) tuple
        """
        # CRITICAL: Block any updates to core/ directory
        if filename.startswith('core/') or '/core/' in filename:
            return False, "FORBIDDEN: Core update engine cannot be modified remotely"
        
        # Block updates to main.py and client.py (semi-protected)
        if filename in ['main.py', 'client.py']:
            return False, "FORBIDDEN: Core client files require manual update"
        
        # Only allow updates to handlers/ directory
        if not filename.startswith('handlers/'):
            return False, f"Only files in 'handlers/' directory can be updated"
        
        # Ensure it's a Python file
        if not filename.endswith('.py'):
            return False, "Only Python (.py) files can be updated"
        
        return True, "File update allowed"
    
    def update_handler(self, filename: str, code: str, skip_validation: bool = False) -> Dict[str, Any]:
        """
        Safely update a handler file with validation and rollback
        
        Args:
            filename: Handler filename (relative to handlers/)
            code: New code content
            skip_validation: Skip validation (USE WITH EXTREME CAUTION)
            
        Returns:
            Update result dictionary
        """
        try:
            # Step 1: Permission check
            can_update, reason = self.can_update_file(filename)
            if not can_update:
                return {
                    'success': False,
                    'error': reason,
                    'stage': 'permission_check'
                }
            
            # Step 2: Validate code
            if not skip_validation:
                validation = self.validator.validate_code(code, filename)
                
                if not validation['valid']:
                    return {
                        'success': False,
                        'error': 'Code validation failed',
                        'validation_errors': validation['errors'],
                        'validation_warnings': validation.get('warnings', []),
                        'stage': 'validation'
                    }
                
                # Log warnings even if valid
                if validation.get('warnings'):
                    print(f"⚠️  Validation warnings for {filename}:")
                    for warning in validation['warnings']:
                        print(f"   - {warning}")
            
            # Step 3: Backup current version
            target_path = os.path.join(self.base_path, filename)
            backup_info = None
            
            if os.path.exists(target_path):
                backup_info = self._create_backup(target_path, filename)
                if not backup_info['success']:
                    return {
                        'success': False,
                        'error': 'Backup creation failed',
                        'details': backup_info,
                        'stage': 'backup'
                    }
            
            # Step 4: Write new code
            try:
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                with open(target_path, 'w') as f:
                    f.write(code)
                os.chmod(target_path, 0o755)
            except Exception as e:
                # Restore from backup if write failed
                if backup_info:
                    self._restore_from_backup(backup_info['backup_path'], target_path)
                return {
                    'success': False,
                    'error': f'Failed to write file: {str(e)}',
                    'stage': 'write'
                }
            
            # Step 5: Test import (final validation)
            if not skip_validation:
                import_test = self.validator.test_import(code, filename)
                
                if not import_test['valid']:
                    # ROLLBACK: Import failed
                    print(f"❌ Import test failed for {filename}, rolling back...")
                    if backup_info:
                        self._restore_from_backup(backup_info['backup_path'], target_path)
                    else:
                        os.remove(target_path)
                    
                    return {
                        'success': False,
                        'error': 'Import test failed - code rolled back',
                        'import_error': import_test.get('error'),
                        'rolled_back': True,
                        'stage': 'import_test'
                    }
            
            # Step 6: Save as "last known good"
            self._save_as_last_known_good(target_path, filename)
            
            # Step 7: Log the update
            self._log_update(filename, backup_info, success=True)
            
            return {
                'success': True,
                'message': f'Handler {filename} updated successfully',
                'filename': filename,
                'backup': backup_info.get('backup_path') if backup_info else None,
                'validation_passed': not skip_validation,
                'timestamp': time.time()
            }
        
        except Exception as e:
            self._log_update(filename, None, success=False, error=str(e))
            return {
                'success': False,
                'error': f'Unexpected error during update: {str(e)}',
                'stage': 'unknown'
            }
    
    def rollback_to_last_known_good(self, filename: str) -> Dict[str, Any]:
        """
        Emergency rollback to last known good version
        
        Args:
            filename: Handler filename to rollback
            
        Returns:
            Rollback result
        """
        try:
            lkg_path = os.path.join(self.last_known_good_path, filename)
            target_path = os.path.join(self.base_path, filename)
            
            if not os.path.exists(lkg_path):
                return {
                    'success': False,
                    'error': f'No last known good version found for {filename}'
                }
            
            # Create backup of current (broken) version
            backup_info = self._create_backup(target_path, f"{filename}.broken")
            
            # Restore last known good
            shutil.copy2(lkg_path, target_path)
            
            self._log_update(filename, backup_info, success=True, rollback=True)
            
            return {
                'success': True,
                'message': f'Rolled back {filename} to last known good version',
                'broken_version_backup': backup_info.get('backup_path'),
                'timestamp': time.time()
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': f'Rollback failed: {str(e)}'
            }
    
    def _create_backup(self, file_path: str, filename: str) -> Dict[str, Any]:
        """Create timestamped backup of a file"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"{filename.replace('/', '_')}_{timestamp}.backup"
            backup_path = os.path.join(self.backups_path, backup_filename)
            
            shutil.copy2(file_path, backup_path)
            
            return {
                'success': True,
                'backup_path': backup_path,
                'timestamp': timestamp
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _restore_from_backup(self, backup_path: str, target_path: str) -> bool:
        """Restore a file from backup"""
        try:
            shutil.copy2(backup_path, target_path)
            print(f"✅ Restored {target_path} from backup")
            return True
        except Exception as e:
            print(f"❌ Failed to restore from backup: {e}")
            return False
    
    def _save_as_last_known_good(self, file_path: str, filename: str):
        """Save a working version as 'last known good'"""
        try:
            lkg_path = os.path.join(self.last_known_good_path, filename)
            os.makedirs(os.path.dirname(lkg_path), exist_ok=True)
            shutil.copy2(file_path, lkg_path)
            print(f"💾 Saved {filename} as last known good")
        except Exception as e:
            print(f"⚠️  Could not save last known good: {e}")
    
    def _log_update(self, filename: str, backup_info: Optional[Dict], 
                    success: bool, error: str = None, rollback: bool = False, 
                    deletion: bool = False):
        """Log update operation"""
        try:
            log_entry = {
                'timestamp': time.time(),
                'datetime': datetime.now().isoformat(),
                'filename': filename,
                'success': success,
                'rollback': rollback,
                'deletion': deletion,
                'backup': backup_info.get('backup_path') if backup_info else None,
                'error': error
            }
            
            # Read existing log
            log = []
            if os.path.exists(self.update_log_path):
                with open(self.update_log_path, 'r') as f:
                    log = json.load(f)
            
            # Append new entry
            log.append(log_entry)
            
            # Keep only last 100 entries
            log = log[-100:]
            
            # Write updated log
            with open(self.update_log_path, 'w') as f:
                json.dump(log, f, indent=2)
        
        except Exception as e:
            print(f"⚠️  Could not write update log: {e}")
    
    def get_update_log(self, limit: int = 20) -> Dict[str, Any]:
        """Get recent update history"""
        try:
            if not os.path.exists(self.update_log_path):
                return {
                    'success': True,
                    'log': [],
                    'message': 'No update history found'
                }
            
            with open(self.update_log_path, 'r') as f:
                log = json.load(f)
            
            return {
                'success': True,
                'log': log[-limit:],
                'total_entries': len(log)
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': f'Could not read update log: {str(e)}'
            }
    
    def delete_handler(self, filename: str, create_backup: bool = True) -> Dict[str, Any]:
        """
        Safely delete a handler file
        
        Args:
            filename: Handler filename to delete (relative to handlers/)
            create_backup: Whether to backup before deletion (default True)
            
        Returns:
            Deletion result dictionary
        """
        try:
            # Step 1: Permission check
            can_update, reason = self.can_update_file(filename)
            if not can_update:
                return {
                    'success': False,
                    'error': reason,
                    'stage': 'permission_check'
                }
            
            # Ensure filename is in handlers directory
            if not filename.startswith('handlers/'):
                filename = f"handlers/{filename}"
            
            target_path = os.path.join(self.base_path, filename)
            
            # Check if file exists
            if not os.path.exists(target_path):
                return {
                    'success': False,
                    'error': f'File does not exist: {filename}',
                    'stage': 'existence_check'
                }
            
            # Step 2: Create backup before deletion
            backup_info = None
            if create_backup:
                backup_info = self._create_backup(target_path, f"{filename}.deleted")
                if not backup_info['success']:
                    return {
                        'success': False,
                        'error': 'Backup creation failed before deletion',
                        'details': backup_info,
                        'stage': 'backup'
                    }
            
            # Step 3: Delete the file
            try:
                os.remove(target_path)
            except Exception as e:
                return {
                    'success': False,
                    'error': f'Failed to delete file: {str(e)}',
                    'stage': 'deletion'
                }
            
            # Step 4: Log the deletion
            self._log_update(filename, backup_info, success=True, deletion=True)
            
            return {
                'success': True,
                'message': f'Handler {filename} deleted successfully',
                'filename': filename,
                'backup_created': backup_info.get('backup_path') if backup_info else None,
                'timestamp': time.time()
            }
        
        except Exception as e:
            self._log_update(filename, None, success=False, error=str(e))
            return {
                'success': False,
                'error': f'Unexpected error during deletion: {str(e)}',
                'stage': 'unknown'
            }
    
    def list_backups(self) -> Dict[str, Any]:
        """List all available backups"""
        try:
            backups = []
            
            for filename in os.listdir(self.backups_path):
                if filename.endswith('.backup'):
                    file_path = os.path.join(self.backups_path, filename)
                    stat = os.stat(file_path)
                    backups.append({
                        'filename': filename,
                        'path': file_path,
                        'size_bytes': stat.st_size,
                        'created': datetime.fromtimestamp(stat.st_ctime).isoformat()
                    })
            
            backups.sort(key=lambda x: x['created'], reverse=True)
            
            return {
                'success': True,
                'backups': backups,
                'count': len(backups)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Could not list backups: {str(e)}'
            }

