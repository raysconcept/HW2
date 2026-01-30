# Requirements — HOTWHEELS Control Stack

These requirements mirror the behaviour and architecture that actually exist in
the HotWheels repository (Node.js server, MySQL database, UR robot control, and
Socket.IO driven operator UI).

---

## 1. Functional Requirements (FR)

| ID | Description | Implemented in |
|----|-------------|----------------|
| FR-01 | The server shall expose the operator UI at `/HW_ROBOT`, rendering robot status, joints, TCP pose, and control buttons. | `views/__HW_ROBOT.ejs`, `views/__HW_SIO.ejs` |
| FR-02 | The server shall read orders from table `hwv00_orders` (status `inCue`) and queue them for robot execution. | `src/server/controllers/HW_ORDER_PROCESSOR.js` |
| FR-03 | The system shall translate cassette IDs into Cartesian targets for the UR robot when composing pick scripts. | `src/server/controllers/HW_ROBOT_MODULE.js` (`HW_ROBOT_CALC_POSXY_FROM_CASNR`, script builders) |
| FR-04 | The system shall send URScript commands to the robot via TCP (`config.robotConfig.host:port`) and emit status updates via Socket.IO channel `MFS`. | `HW_ROBOT_MODULE.js`, `views/__HW_SIO.ejs` |
| FR-05 | The order processor shall mark the active order `picking`, decrement reservations/cassette amounts, and update it to `picked` when the robot becomes available again. | `HW_ORDER_PROCESSOR.js` |
| FR-06 | The REST endpoint `POST /HW_ROBOT_COMMAND` shall accept manual commands (e.g. `ROBOT_STOP`, cassette moves) and forward them to the robot. | `HW_ROBOT_MODULE.js` (`HW_ROBOT_CALLS`) |
| FR-07 | The DB controller shall establish and maintain a MySQL connection using credentials from the active configuration, emitting a `DATABASECONFIRMCONNECT` message on success. | `HW_DB.js` |
| FR-08 | The broadcasting controller shall periodically publish the cue line (`SIO_LIST_CUELINE`) and leaderboard data to Socket.IO clients. | `HW_BROADCASTING.js` |
| FR-09 | The system shall expose configuration-driven system mode banners (`SYSTEM_NORMALMODE`, `SYSTEM_DEVMODE`) to all connected operator UIs. | `HW_SERVER.js`, `HW_BROADCASTING.js`, `views/__HW_SIO.ejs` |
| FR-10 | The robot control service shall support manual gripper commands (`GOPEN`, `GCLOSE_*`, `GACTIVATE`) and forward the corresponding UR scripts to the robot. | `HW_ROBOT_MODULE.js` |
| FR-11 | The QR management module shall create new vending QR codes (persisted under `public/qr/` with `hwv00_orders` entries) and operator/test/free-pass tags saved under `public/qrOperator/`. | `HW_ORDER_QR.js` |
| FR-12 | The ESP controller shall establish a TCP connection to the ESP32 module, send JSON commands, emit status updates via Socket.IO, and attempt automatic reconnects on socket close. | `HW_ESP_TCP.js` |

---

## 2. Quality & Performance Requirements (QR)

These reflect current behaviour and expectations that can be verified with the
existing code path.

| ID | Description |
|----|-------------|
| QR-01 | Robot status packets received from the UR socket shall be rebroadcast to clients within 200 ms (SIO latency). |
| QR-02 | When a new order enters `inCue` and the robot is available, the order processor shall dispatch it within one processing interval (`config.vendingConfig.timeUpdateOrderProcessor`, default 2000 ms). |
| QR-03 | Manual robot command requests (`/HW_ROBOT_COMMAND`) shall return HTTP 200 or an explicit error within 1 s. |
| QR-04 | Socket.IO clients reconnecting after a disconnect shall receive the latest robot status and system mode within 1 s of connection. |
| QR-05 | Database reconnection errors shall be logged and surfaced without crashing the Node.js process (graceful error handling). |
| QR-06 | Operational data (MySQL tables, log files) shall persist across container restarts and recreate operations by virtue of bind-mount or volume configuration. |
| QR-07 | After a robot network interruption, the system shall reconnect without restarting Node/Docker and immediately restore status broadcast and manual control ability. |

---

## 3. Constraints (CR)

| ID | Description |
|----|-------------|
| CR-01 | The Node.js service shall use the `mysql2` driver for all database access. |
| CR-02 | Environment variables (`HW_DB_*`, `HW_ROBOT_*`, etc.) shall be sourced from the running environment (supporting `.env`, `.env.local`, `.env.docker`). |
| CR-03 | Robot TCP connections shall use the host/port defined in `config/configMain.js` (`robotConfig.host`, `robotConfig.port`). |
| CR-04 | Socket.IO shall operate over the same HTTP server hosting Express (`GLOBALS.SIO`). |
| CR-05 | Robot motion planning relies on cassette metadata stored in `config/configRobot/HW_robot_config.js`; any change requires restart. |
| CR-06 | Operator-facing robot control endpoints/UI shall be protected behind authentication (password or equivalent) so that only authorized users can command the robot. |

---

## 4. Use Cases (UC)

| ID | Title | Primary Actor | Goal / Description |
|----|-------|---------------|--------------------|
| UC-01 | Monitor robot | Operator | View live robot connection/program status, joint data, and TCP pose on `/HW_ROBOT`. |
| UC-02 | Trigger manual robot action | Operator | Send manual commands (connect, stop, cassette moves) via UI buttons → `/HW_ROBOT_COMMAND`. |
| UC-03 | Fulfill order | Kid | Detect `inCue` orders, decrement inventory, send robot pick scripts, update status to `picked`. |
| UC-04 | System start-up | Operator | Start Node.js server, establish DB and robot connections, broadcast ready/system mode to clients. |
| UC-05 | Database outage handling | System Operator | Observe DB connection failure logs, ensure system remains up and retries appropriately. |
| UC-06 | Generate customer QR batches | Operator | From `/HW_QR`, trigger creation of new vending QR codes and verify they are saved with status `open`. |
| UC-07 | Control ESP effects | Operator | Send ESP32 lighting commands from the AVFX tools and receive status feedback. |

---

## 5. Traceability Pointers

Below are example «satisfy»/«verify» relations to seed a traceability matrix.

- UC-01 «deriveReqt» → FR-01, FR-04, QR-01, QR-04  
- UC-02 «deriveReqt» → FR-06, QR-03  
- UC-03 «deriveReqt» → FR-02, FR-03, FR-05, FR-08, QR-02  
- UC-04 «deriveReqt» → FR-07, FR-09, CR-02, CR-04  
- UC-05 «deriveReqt» → FR-07, QR-05  
- UC-06 «deriveReqt» → FR-08, FR-10, FR-11  
- UC-07 «deriveReqt» → FR-12  
- UC-02 «deriveReqt» → FR-10 (already) — for FR-12 maybe new UC? Should add? Need new use case. maybe  add new row? maybe "Control ESP lighting" with operator as actor. |


In SysML: link these requirements to the corresponding components (`HW_ORDER_PROCESSOR`, `HW_ROBOT_MODULE`, `HW_DB`, etc.) via «satisfy», and link test cases (see TestPlan.md) via «verify».
