# Test Checklist — HOTWHEELS

Printable sheet for recording the latest pass/fail state of every test case.

## Unit Tests

| Test ID | Script | Focus | Result (pass/fail) | Notes |
|---------|--------|-------|--------------------|-------|
| TC-UNIT-01 | tests/unit/hw_robot_calc_posxy.test.js | Cassette → XYZ translation helper | | |
| TC-UNIT-02a | tests/unit/hw_robot_mode_parser_program_running.test.js | Robot mode parser — running | | |
| TC-UNIT-02b | tests/unit/hw_robot_mode_parser_program_stopped.test.js | Robot mode parser — stopped | | |
| TC-UNIT-03 | tests/unit/hw_order_processor_count_duplicates.test.js | Order helper duplicate counting | | |
| TC-UNIT-04 | tests/unit/sio_update_banner.test.js | Operator UI banner logic | | |
| TC-UNIT-05 | tests/unit/hw_db_init_error.test.js | DB connection error handling | | |

## Integration Tests

| Test ID | Script | Scenario | Result (pass/fail) | Notes |
|---------|--------|----------|--------------------|-------|
| TC-INT-01 | tests/integration/order_processor_picknext.int.test.js | Order processor promotes next order | | |
| TC-INT-02 | tests/integration/robot_command_endpoint.int.test.js | Manual command endpoint forwarding | | |
| TC-INT-03 | tests/integration/robot_status_broadcast.int.test.js | Socket.IO status broadcast | | |
| TC-INT-04 | tests/integration/db_env_boot.int.test.js | dotenv-driven DB bootstrap | | |
| TC-INT-05 | tests/integration/broadcast_cueline.int.test.js | Cue-line broadcast HTML | | |
| TC-INT-06 | tests/integration/robot_gripper_commands.int.test.js | Gripper URScript emission (close/open) | | |
| TC-INT-07 | tests/integration/qr_creation_full_insert.int.test.js | QR creation happy path | | |
| TC-INT-08 | tests/integration/qr_creation_fallback_insert.int.test.js | QR creation fallback path | | |
| TC-INT-09 | tests/integration/qr_operator_tags.int.test.js | Operator/Test/Free-pass QR tags | | |
| TC-INT-10 | tests/integration/esp_connection.int.test.js _(skipped)_ | ESP TCP reconnect placeholder | | |

## System / End-to-End Tests

| Test ID | Scenario | Result (pass/fail) | Notes |
|---------|----------|--------------------|-------|
| TC-SYS-01 | Full order cycle from kiosk QR scan to robot drop-off | | |
| TC-SYS-02 | Robot failover and automatic reconnect | | |
| TC-SYS-03 | Operator dashboard telemetry & cue-line smoke test | | |
| TC-SYS-04 | ESP32 car-present sensor integration | | |

## Smoke / Performance (Planned)

| Test ID | Scenario | Result (pass/fail) | Notes |
|---------|----------|--------------------|-------|
| TC-SMOKE-01 _(planned)_ | API responsiveness under kiosk load | | |
| TC-SMOKE-02 | Socket.IO queue durability during 5‑minute network flap | | |
