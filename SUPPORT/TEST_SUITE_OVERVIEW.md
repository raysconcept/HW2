# Test Suite Overview

Hot Wheels ships with Jest unit and integration tests that cover the most critical backend workflows.  
This document lists every suite in `tests/` and explains what behavior it exercises so you know what breaks when a test fails.

## Unit Tests (`tests/unit`)

| File | What it verifies |
| --- | --- |
| `hw_db_init_error.test.js` | Stubs `mysql2.createConnection` to reject and asserts `HW_DB_INIT` surfaces the MySQL error instead of continuing boot. |
| `hw_order_processor_count_duplicates.test.js` | Exercises the private `countDuplicates` helper to confirm it tallies repeated car assets correctly and returns an empty object when no duplicates exist. |
| `hw_robot_calc_posxy.test.js` | Mocks robot geometry values and calls `HW_ROBOT_CALC_POSXY_FROM_CASNR` to ensure cassette coordinates and depth offsets are written into the `userOrder` payload with the expected magnitudes. |
| `hw_robot_mode_parser_program_running.test.js` | Builds a fake UR controller mode packet and feeds it to `handleRobotModeData` to verify the robot is marked connected, powered, and unavailable when a program is running. |
| `hw_robot_mode_parser_program_stopped.test.js` | Uses the same helper buffers to confirm the robot transitions back to “available” once the program-running flag turns off. |
| `hw_vending_qr_validation.test.js` | Calls `HW_VENDING_L_CLIENT_QR_CHECK_VALIDITY` with success, missing QR, and DB-error scenarios to ensure the controller validates QR codes and returns proper HTTP statuses. |
| `sio_update_banner.test.js` | Parses the `updateBanner` function out of `views/__HW_SIO.ejs` and simulates DOM events to guarantee the right text and CSS classes are applied for dev/retail/unknown modes. |

## Integration Tests (`tests/integration`)

| File | What it verifies |
| --- | --- |
| `broadcast_cueline.int.test.js` | Runs `HW_BROADCAST_L_CUELINE` against mocked queries to ensure it emits Socket.IO HTML updates and switches to the fallback SQL when `orderTimeQrScanned` is missing. |
| `db_env_boot.int.test.js` | Boots `HW_DB_INIT` with env variables and a stubbed MySQL connection to confirm it reads `.env` overrides, pulls kiosk metadata, and announces “DATABASECONFIRMCONNECT”. |
| `esp_connection.int.test.js` | Mocks Node’s `net` module so `HW_ESP_TCP.ESP_INIT` can be exercised end-to-end; the test verifies commands are queued only while connected, disconnections emit status events, and reconnects honor the configured retry delay. |
| `order_processor_picknext.int.test.js` | Stubs the chain of DB queries executed by `ORDER_PROCESSOR_L_CUELINE_PICKNEXT` to make sure it upgrades orders from `inCue`→`picking`, decrements reservations/cassettes, parses both JSON and legacy underscore car lists, and eventually calls the robot’s pick routine. |
| `qr_creation_fallback_insert.int.test.js` | Forces an `ER_BAD_FIELD_ERROR` when inserting new QR orders so that `HW_DB_ORDER_QRCREATE` proves it can discover the table schema (`SHOW COLUMNS`) and build a reduced insert statement. |
| `qr_creation_full_insert.int.test.js` | Runs the happy-path QR creation, checking that QR image folders are created, `qrcode.toFile` is invoked, and a full `INSERT … SET` is executed when the schema matches expectations. |
| `qr_operator_tags.int.test.js` | Invokes the three operator QR helpers (`HW_DB_OPERATOR_QRCREATE_TAG|TESTPASS|FREEPASS`) and confirms each one produces a PNG under the configured operator directory. |
| `robot_command_endpoint.int.test.js` | Uses an Express stub to register `/HW_ROBOT_COMMAND`, then posts `ROBOT_STOP` to ensure the handler writes the URScript command (`ROBOTSTOP_MANUALLY`) to the connected robot socket and answers HTTP 200. |
| `robot_gripper_commands.int.test.js` | Similar Express-level test that issues `GCLOSE_MEDIUM` and `GOPEN` (activation is handled on the pendant) and asserts the close/open gripper macros are emitted in the URScript sent to the mocked socket. |
| `robot_status_broadcast.int.test.js` | Calls `updateRobotStateDisplay` with a populated `robotStatus` and verifies the Socket.IO message payload (serialized JSON) contains the latest joint, TCP, and flag values. |

Use this list when deciding where to add new coverage or to understand which subsystem is implicated when CI reports a failing suite.
