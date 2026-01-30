# Test Plan — HOTWHEELS Control Stack

Each test case references the requirements in `Requirements.md`.  Test IDs have
the form `TC-<layer>-<number>` where layer ∈ {UNIT, INT, SYS}.

---

## 1. Unit-Level Tests (module scope)

| Test ID | Script | Focus | Main Actions | Key Assertions | Requirements | Result (pass/fail) |
|---------|--------|-------|--------------|----------------|--------------|--------------------|
| TC-UNIT-01 | `hw_robot_calc_posxy.test.js` | Cassette → XYZ translation helper. | Calls `HW_ROBOT_CALC_POSXY_FROM_CASNR` with cassette 32 metadata. | Populated arrays match expected XYZ offsets. | FR-03 | |
| TC-UNIT-02a | `hw_robot_mode_parser_program_running.test.js` | Telemetry parser while program is running. | Crafts payload with program bit set and feeds `handleRobotModeData`. | Robot status toggles `isConnected`, `isRobotOn`, `isAvailable=false`. | FR-04, QR-01 | |
| TC-UNIT-02b | `hw_robot_mode_parser_program_stopped.test.js` | Telemetry parser when a program finishes. | Sends running payload followed by stopped payload. | `isProgramRunning` clears and availability returns to true. | FR-04, QR-01 | |
| TC-UNIT-03 | `hw_order_processor_count_duplicates.test.js` | Order helper duplicate counting. | Passes arrays with/without duplicates to `countDuplicates`. | Unique list returns `{}`, repeated list returns `{CAR_A:3, CAR_B:2}`. | FR-02, FR-05 | |
| TC-UNIT-04 | `sio_update_banner.test.js` | Operator UI banner logic. | Extracts `updateBanner` function from `__HW_SIO.ejs`, mutates stubbed DOM nodes. | Text/class toggles correctly for dev/retail/unknown modes and handles missing node. | FR-01, FR-09 | |
| TC-UNIT-05 | `hw_db_init_error.test.js` | Database connection error handling. | Injects a mocked `mysql2.createConnection` that returns `ER_ACCESS_DENIED`. | `HW_DB_INIT` rejects and emits no Socket.IO events. | FR-07, QR-05 | |

> **Why six scripts for five requirements?**  
> The original “robot mode parser” case is split into two single-purpose scripts (program running vs. program stopped) so each transition is independently verifiable.

---

## 2. Integration Tests (multiple modules, mocked externals)

| Test ID | Script | Scenario | Main Actions | Key Assertions | Requirements | Result (pass/fail) |
|---------|--------|----------|--------------|----------------|--------------|--------------------|
| TC-INT-01 | `order_processor_picknext.int.test.js` | Order processor promotes the next queued order. | Chains DB mock responses, stubs robot module entry points. | Correct SQL sequence and `HW_ROBOT_PROCESS_ORDER` invocation with populated cassette coordinates. | FR-02, FR-03, FR-05, QR-02 | |
| TC-INT-02 | `robot_command_endpoint.int.test.js` | Manual command endpoint forwarding. | Runs Express + robot HTTP init, posts `ROBOT_STOP`. | HTTP 200 and socket `write` contains stop script. | FR-06, QR-03 | |
| TC-INT-03 | `robot_status_broadcast.int.test.js` | Socket.IO status broadcast. | Seeds `robotStatus` and calls `updateRobotStateDisplay`. | `emit` receives JSON payload tagged `ROBOT_STATUS_UPDATE`. | FR-04, QR-01, QR-04 | |
| TC-INT-04 | `db_env_boot.int.test.js` | dotenv-driven DB bootstrap. | Overrides env vars, mocks mysql2 connection, runs `HW_DB_INIT`. | Connection uses env credentials and machine config populates GLOBALS. | FR-07, CR-02 | |
| TC-INT-05 | `broadcast_cueline.int.test.js` | Cue-line (MFS) broadcasting. | Mocks DB queries (including fallback) and Socket.IO emitter. | HTML message includes “up next!” row, fallback query invoked on missing column. | FR-08 | |
| TC-INT-06 | `robot_gripper_commands.int.test.js` | URScript emission for gripper commands. | Calls `/HW_ROBOT_COMMAND` with `GCLOSE_MEDIUM` and `GOPEN` (activation occurs on the teaching pendant). | Output scripts include the close/open `ROBOT_G_*` functions. | FR-10 | |
| TC-INT-07 | `qr_creation_full_insert.int.test.js` | QR creation happy path. | Redirects QR folders to temp dir, lets first insert succeed. | QR images written and full insert executed. | FR-11 | |
| TC-INT-08 | `qr_creation_fallback_insert.int.test.js` | QR creation schema fallback. | Forces first insert to throw `ER_BAD_FIELD_ERROR`, then provides column list. | Fallback insert executes after schema probe. | FR-11 | |
| TC-INT-09 | `qr_operator_tags.int.test.js` | Operator QR tag generation. | Points operator QR path to a temp dir and calls the three operator helpers. | PNG files exist for operator, testpass and freepass tags. | FR-11 | |
| TC-INT-10 | `esp_connection.int.test.js` _(skipped)_ | ESP TCP reconnect placeholder. | Planned net.Socket lifecycle mock. | Pending hardware mock stabilisation. | FR-12 | |

> **Why ten scripts for seven integration scenarios?**  
> Some requirements (for example QR creation and operator tags) are verified through multiple focused scripts so we can exercise both the happy path and fallback logic. The ESP connection test remains marked `skip` until the hardware mock is finalised.

---

## 3. System / End-to-End Tests

These use a real MySQL instance (Docker or local), the Node.js server, and
either a UR robot simulator or the physical robot.  They are intended to run
manually before major releases; automation scripts may be added later.

| ID | Scenario | Verifies | Setup / Procedure | Result (pass/fail) |
|----|----------|----------|-------------------|--------------------|
| TC-SYS-01 | Full order cycle from kiosk QR scan to robot drop-off. | FR-01 through FR-06, QR-01 | **Setup:** (1) Start docker-compose (`docker compose up`) to boot MySQL + server. (2) Launch kiosk frontend on tablet/PC. (3) Seed sample inventory via `/scripts/seed_dev_data.sql`. **Procedure:** (1) Scan QR at kiosk. (2) Monitor robot panel -> ensure order moves `inCue` → `picking` → `vend`. (3) Observe physical/sim robot moves cassette, drops car, and vending UI updates. | |
| TC-SYS-02 | Robot failover and automatic reconnect. | FR-04, FR-06, QR-07 | **Setup:** (1) Connect to UR controller via ethernet switch. (2) Start server and ensure robot connects. **Procedure:** (1) Pull network cable / disable port for 30 s. (2) Confirm server logs `Robot connection timeout` and status broadcast shows disconnected. (3) Restore link; verify reconnect occurs within `robotConfig.reconnectDelayMs` and queued command resumes. | |
| TC-SYS-03 | Operator dashboard telemetry and cue-line UI smoke test. | FR-01, FR-04, FR-08 | **Setup:** (1) Start server and webpack dev server (`npm run dev`). (2) Open operator dashboard in Chrome kiosk mode. **Procedure:** (1) Trigger simulated orders via `/scripts/create_test_order.js`. (2) Confirm dashboard lists orders, robot status indicator toggles with `handleRobotModeData` feed, and manual controls trigger expected Socket.IO events (verify via browser dev tools). | |
| TC-SYS-04 | ESP32 car-present sensor integration. | FR-09, FR-12 | **Setup:** (1) Connect ESP32 dev board to local network; configure `.env` for IP. (2) Start `HW_ESP_TCP` service. **Procedure:** (1) Send manual sensor triggers (`hw_esp_cli.py --slot 32 --state occupied`). (2) Observe server logs and dashboard updates. (3) Power-cycle ESP to ensure reconnect logic works. | |

---

## 4. Regression / Performance Smoke

| ID | Scenario | Verifies | Notes | Result (pass/fail) |
|----|----------|----------|-------|--------------------|
| TC-SMOKE-01 _(planned)_ | API responsiveness under expected kiosk load (20 concurrent users). | PR-01 | Target command: `k6 run perf/kiosk_scenario.js` (script to be implemented). Check 95th percentile response time < 250 ms once available. | |
| TC-SMOKE-02 | Socket.IO queue durability during 5 min network flap. | QR-04 | Disconnect kiosk network (Wi-Fi off) for 5 min; reconnect and ensure queue resynchronises without manual refresh. | |

---

## 5. Traceability & Reporting

- Each automated Jest test includes requirement IDs in the description (e.g.
  `describe("FR-03", …)`).
- System tests are documented in this plan with step-by-step procedures; test
  evidence (photos/logs) should be stored in `/docs/test-evidence/<date>/`.
- A spreadsheet in `/docs/regression_matrix.xlsx` maps release versions to
  executed test IDs.

---

## 6. Automation Notes

- Prefer Jest + `ts-jest` (if TS adopted) for unit/integration tests.  
- Use `testcontainers` or docker-compose override to spin MySQL + UR stub for system tests.  
- Playwright provides a clean way to automate the operator UI flows.  
- Include requirement IDs in test names/descriptions to keep traceability current (e.g. `describe("FR-03", …)`).

---

Maintaining this plan alongside the requirements file ensures every requirement
has at least one associated verification activity, and any new feature adds both
a requirement entry and corresponding tests before merge.
