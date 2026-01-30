# Raspberry Pi Client - System Overview

## Executive Summary

The Raspberry Pi Client is a modular, self-updating TCP server designed for the HotWheels project. It provides a robust communication interface between the main HotWheels server and Raspberry Pi hardware, featuring a protected update mechanism that ensures system stability even during remote code updates. The architecture separates critical system components from updatable functionality, preventing corruption of the update engine itself while allowing safe deployment of new features and bug fixes.

## System Architecture & Capabilities

The system is built on a three-tier architecture consisting of a protected core layer, an updatable handlers layer, and a communication layer. At its heart, the system receives JSON-formatted commands via TCP on port 3000, processes them through dynamically loaded handler modules, and returns JSON responses. The standout feature is its ability to receive code updates remotely while guaranteeing that failed updates cannot break the system—a critical requirement for managing distributed Raspberry Pi devices that may be physically inaccessible. The update engine employs six layers of validation (syntax checking, security scanning, protected import blocking, dependency verification, runtime import testing, and automatic rollback) to ensure that only safe, working code is deployed to production.

The system supports GPIO hardware control (LED manipulation, pin management), system monitoring (temperature, memory usage, uptime), and comprehensive update management (remote code deployment, rollback, backup management, update logging). All operations are thread-safe, supporting multiple simultaneous client connections. The modular design allows developers to add new functionality by simply creating Python files in the handlers directory—new commands are automatically discovered and made available without modifying core system files. This design reduces the original 956-line monolithic codebase to approximately 600 lines spread across focused, maintainable modules.

## Core Components (Protected Layer)

### core/updater.py - Protected Update Engine

The `updater.py` module implements the ProtectedUpdater class that manages all code deployment operations while being immune to remote modification itself. It enforces strict permissions preventing updates to core files, creates automatic backups, validates code through multiple layers, and performs actual import tests before deployment. If any validation step fails, it automatically rolls back to the last known good version and logs all operations with detailed error information.

### core/validator.py - Code Validation System

The `validator.py` module implements the CodeValidator class that performs six independent validation stages on code before deployment. It checks syntax via AST compilation, scans for dangerous patterns (`os.system()`, `eval()`, `rm -rf`), blocks imports of protected core modules, validates dependency availability, and performs actual import tests in temporary modules. Each validation layer returns detailed error information including line numbers and specific patterns that failed, enabling quick identification and fixing of issues.

### core/safe_loader.py - Dynamic Handler Management

The `safe_loader.py` module implements the SafeHandlerLoader class that dynamically loads, reloads, and executes handler modules with fault isolation and comprehensive monitoring. It auto-discovers handlers by scanning for COMMAND_HANDLERS dictionaries or `handle_` prefixed functions, loads each module in isolation to prevent cross-contamination, and maintains detailed statistics including execution counts and error patterns. The loader supports hot-reloading without server restart, wraps all handler execution in exception handling, and automatically suggests rollback when handlers exceed error thresholds (>5 failures).

## Handler Components (Updatable Layer)

### handlers/gpio_handlers.py - Hardware Control Interface

The `gpio_handlers.py` module provides GPIO hardware control commands (`led_on`, `led_off`, `gpio_test`, `gpio_status`) with graceful fallback to simulation mode when RPi.GPIO is unavailable. It maintains internal state tracking for all pins and automatically configures them as outputs in BCM mode when targeted by commands. All operations are wrapped in exception handling and return detailed JSON responses with timestamps and error descriptions.

### handlers/system_handlers.py - System Information & Monitoring

The `system_handlers.py` module implements monitoring commands (`ping`, `get_status`, `system_info`, `echo`) that expose device health, configuration, and runtime status. It provides CPU temperature from thermal sensors, memory and disk usage via psutil (if available), uptime tracking, and platform details, gracefully degrading to "N/A" for unavailable metrics. All responses follow a consistent JSON schema with success flags, timestamps, and type fields for easy parsing.

### handlers/update_handlers.py - Update Management Interface

The `update_handlers.py` module provides the user-facing interface to the protected update system via six commands: `update_handler`, `rollback_handler`, `reload_handler`, `list_backups`, `update_log`, and `handler_stats`. It delegates actual update operations to the protected core updater through injected references, creating a safe indirection layer that is itself updatable without compromising system safety. Each command returns comprehensive JSON responses with success status, timestamps, and detailed operation results or error messages.

## Communication Layer

### client.py - TCP Server & Command Dispatcher

The `client.py` module implements the RaspberryPiClient class that serves as the central TCP server, binding to port 3000 and spawning threads for each connection with 30-second timeouts. It initializes the ProtectedUpdater and SafeHandlerLoader, auto-discovers handlers, and routes newline-delimited JSON commands to the appropriate handler via the loader. All exceptions are caught and converted to error responses, maintaining stability even when handlers fail, while connection statistics and graceful GPIO/socket cleanup ensure robust operation.

### main.py - Application Entry Point

The `main.py` module serves as the minimal entry point, parsing command-line arguments for host and port (defaulting to 0.0.0.0:3000) and instantiating the RaspberryPiClient. It wraps execution in exception handling for KeyboardInterrupt, general exceptions with stack traces, and ensures cleanup() is called via finally block. This minimal design delegates all business logic to the client module, making it easy to create alternative entry points like systemd services.

## Testing & Validation

### test_update_system.py - Update System Test Suite

The `test_update_system.py` module provides an automated test suite with ten test cases that validate all safety mechanisms: syntax validation, dangerous pattern detection, protected import blocking, permission enforcement, valid code deployment, and automatic/manual rollback. Each test creates specific scenarios (valid/broken/malicious code), attempts validation or deployment, and asserts expected behavior with detailed diagnostics. The suite maintains pass/fail counts, cleans up test files after execution, and serves as executable documentation of how validation and rollback operate.

## Integration Testing

### test_new_client.py - Client Integration Tester

The `test_new_client.py` script provides end-to-end integration testing by connecting as a TCP client and executing ten command types: ping, status, system info, GPIO control, handler stats, update logs, and invalid commands to verify error handling. For each command, it constructs JSON payloads, sends them with newline delimiters, receives/parses responses, and displays full JSON output for verification. This validates the complete pipeline (TCP server, JSON parsing, routing, execution, formatting) and serves as example code for developers building client applications.

## System Benefits & Design Philosophy

This modular architecture achieves several critical objectives for managing distributed Raspberry Pi devices. By isolating the update engine from updateable code, it eliminates the catastrophic failure mode where a bad update breaks the update mechanism itself, creating an unrecoverable system requiring physical access to repair. The comprehensive validation ensures code quality through automated checks that catch syntax errors, security vulnerabilities, missing dependencies, and runtime failures before deployment, reducing the risk of downtime from preventable bugs. The automatic rollback capability means the system self-heals from bad deployments without human intervention, critical for devices deployed in inaccessible locations. The modular design dramatically improves maintainability by replacing a 956-line monolithic file with focused modules averaging 150 lines each, making code easier to understand, test, and modify. The handler auto-discovery system allows new functionality to be added by simply creating Python files in a directory, requiring no modifications to core system files and reducing the risk of merge conflicts in team development. The extensive logging and statistics collection provide visibility into system health, update history, and handler performance, enabling proactive problem detection and data-driven optimization. Ultimately, this design transforms code updates from a risky operation requiring careful planning and rollback procedures into a routine, safe operation that can be automated and executed confidently even on production systems.

