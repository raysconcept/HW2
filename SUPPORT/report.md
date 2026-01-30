# Hot Wheels Project – Deployment & Operations Report

![System Architecture](images/architecture.png)

## 1. Project Overview
The Hot Wheels software stack powers the vending, robot-picking, and ESP32-driven lighting subsystems for a physical installation. The core is a Node.js service (`src/server/HW_SERVER.js`) that exposes Express HTTP endpoints and Socket.IO channels to multiple terminals (customer kiosks, operator panels, dashboards). Hardware interactions include:
- A robot controller reachable over TCP (ports 30002/30003) for picking cars.
- An ESP32-based LED controller communicating via TCP or serial.
- A video server producing customer-visible highlight reels.
State, inventory, and order progression are persisted in MySQL. Static assets (EJS views, QR codes, video overlays) live in the repository and are served by the Node application.

Key goals of this deployment effort:
1. Containerize the stack for consistent delivery on Ubuntu development hosts and field hardware (Windows 10-based Dell OptiPlex 3020).
2. Provide reproducible environment configuration via `.env.local` (native) and `.env.docker` (containers).
3. Equip operators with documentation covering setup, hardware connectivity, troubleshooting, and extension.

## 2. Architecture Summary
The simplified diagram above conveys the primary flows:
- **Clients → Node.js** (blue): HTTP and Socket.IO requests land on the Node server (`HW_SERVER.js`).
- **Shared GLOBALS context** (orange): Configuration objects and shared state are injected into each controller module once during boot (see `configMain.js`).
- **Controllers → External Services** (green/red/brown):
  - `HW_DB` and related modules query or mutate MySQL (green lines).
  - `HW_ROBOT_MODULE` and `HW_ESP_TCP` command hardware via TCP/serial (red).
  - `HW_ORDER_PROCESSOR` notifies the video server (brown).
- **Controllers → Node.js → Clients** (purple): All realtime messages are emitted back to the Node server, which relays them via Socket.IO channels to subscribed browsers.

### 2.1 Major Modules
| Module | Responsibility | Key Files |
| --- | --- | --- |
| Express & Socket.IO | Serve EJS views, REST endpoints, realtime events | `src/server/HW_SERVER.js`, `HW_ROUTING.js`, `HW_CORE_SIO.js` |
| Database | Inventory, orders, configuration tables | `src/server/controllers/HW_DB.js` |
| Order Processing | Queue management, robot triggers, status updates | `HW_ORDER_PROCESSOR.js`, `HW_ORDER_VENDING.js` |
| Robot Control | TCP connection management, UR script dispatch | `HW_ROBOT_MODULE.js`, `HW_ROBOT_UR_SCRIPTS.js` |
| ESP Control | TCP/serial LED commands, status events | `HW_ESP_TCP.js`, `HW_ESP.js` |
| Broadcasting | Push order queue & leaderboard updates | `HW_BROADCASTING.js` |
| Video | Composition scripts and server bridge | `src/video/*`, `HW_VIDEO_MODULE.js` |

## 3. Configuration & Environment Management
- `configMain.js` reads all user-modifiable values from environment variables, with safe fallbacks.
- `.env.local` sets defaults for native development: `HW_DB_HOST=localhost`, `HW_DB_USER=hotwheels`, `HW_ROBOT_HOST=192.168.1.11`, etc. Load with `set -a; source .env.local; set +a` before `npm start`.
- `.env.docker` is consumed by Docker Compose so containers inherit the correct ports, credentials, and hardware flags. Compose references it via `env_file: .env.docker`.
- MySQL credentials for local development require the creation of `hotwheels@localhost` (documented in README and reproduced below).

### 3.1 Local MySQL Preparation
```sql
CREATE USER 'hotwheels'@'localhost' IDENTIFIED BY 'strongpassword';
GRANT ALL PRIVILEGES ON hw11_2_jazan.* TO 'hotwheels'@'localhost';
FLUSH PRIVILEGES;
```
Use `ALTER USER` if the account exists. Update `.env.local` if you choose different credentials.

## 4. Dockerization Pipeline
1. **Dependencies Stage (`deps`)**
   - Base image: `node:18-bullseye-slim`.
   - Installs build tools (`build-essential`, `python3`, `make`, `g++`).
   - Copies `package*.json` and runs `npm ci` for deterministic installs.
2. **Runtime Stage (`runtime`)**
   - Installs runtime packages: `ffmpeg`, `udev`, `netcat-openbsd` (for hardware polling and readiness checks).
   - Copies `node_modules` from the deps stage and the full project source.
   - Copies `scripts/docker-entrypoint.sh` (entrypoint script).
   - Sets `ENTRYPOINT` to the custom script.
3. **Entrypoint Responsibilities**
   - Create and `chown` `/app/logs`, `/app/public/qr`, `/app/public/qrOperator`, `/app/public/video` to the `node` user.
   - Wait for MySQL to accept TCP connections (`nc -z $HW_DB_HOST $HW_DB_PORT`).
   - Drop privileges to `node` and launch the application (`node src/server/HW_SERVER.js`).
4. **Compose Orchestration**
   - `app` service builds the runtime stage, mounts named volumes, and depends on MySQL health.
   - `mysql` service initializes from `bu_databse/250526_hw_db.sql` on first run, exposing port `3309` on the host.
   - Healthcheck uses `mysqladmin ping` to ensure readiness before `app` starts.

## 5. Persistent Data & Volumes
| Volume | Container Path | Purpose |
| --- | --- | --- |
| `logs` | `/app/logs` | Rotating Winston/Console logs |
| `qr` | `/app/public/qr` | Generated customer QR codes |
| `qr_operator` | `/app/public/qrOperator` | Operator passes |
| `video` | `/app/public/video` | Compiled highlight videos |
| `mysql_data` | `/var/lib/mysql` | Database data files |

Use bind mounts in production if operators need direct filesystem access or for backups.

## 6. Hardware Integration Notes
- **Robot**: `HW_ROBOT_MODULE.js` negotiates TCP handshake, loads UR scripts from `configRobot`, and logs status through Socket.IO channels.
- **ESP32**: `HW_ESP_TCP.js` handles persistent TCP socket, line-delimited JSON protocol, and forwards events to clients.
- **Throttle Controls**: `HW_ROBOT_ENABLED` and `HW_ESP_ENABLED` guarantee container boot without physical devices. When set to `false`, the modules log “disabled via configuration” and skip connections.
- **Network Reachability**: Ensure the host (or container network) can ping hardware addresses. If robotics and ESP controllers are on a different VLAN, consider `network_mode: host` or static routes.

## 7. Deployment on Ubuntu (Native)
```bash
set -a
source .env.local
set +a
npm install
npm start
```
Check the log for `System ready`. Confirm local MySQL authentication. Use `npm run docs` to regenerate JSDoc documentation.

## 8. Deployment on Ubuntu / Windows (Docker)
```bash
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up
```
Monitor with `docker compose logs -f app`. The UI becomes available at `http://localhost:3101/HW` (or `http://<host-ip>:3101/HW`).

## 9. Windows (OptiPlex 3020) Deployment

### 9.1 Connectivity
- OptiPlex lacks Wi-Fi; Ubuntu laptop shares Wi-Fi via Ethernet.
- On Ubuntu: `Settings → Network → Wired → Shared to other computers`. Verify `ip addr` shows `eno1` with `10.42.0.1/24`.
- On Windows (PowerShell as Admin):
  ```powershell
  ipconfig /release
  ipconfig /renew
  ipconfig
  ```
  Expect `IPv4 Address . . . . . . . . . . : 10.42.0.xxx`.
- Test: `ping 10.42.0.1` (gateway) and `ping 8.8.8.8` (internet).

### 9.2 Tooling
- Docker Desktop (Linux containers): https://www.docker.com/products/docker-desktop/
- Git for Windows: https://git-scm.com/download/win
- Visual Studio Code (optional): https://code.visualstudio.com
- WSL kernel update (if prompted): run elevated PowerShell `wsl --update` and reboot if required.

### 9.3 Clone via SSH
1. **Generate key** (Git Bash):
   ```bash
   ssh-keygen -t ed25519 -C "optiplex-hw"
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   clip < ~/.ssh/id_ed25519.pub
   ```
2. **Register key** (GitHub): Add to account SSH keys or repo deploy keys with write access.
3. **Test**: `ssh -T git@github.com` should greet you.
4. **Clone**:
   ```bash
   mkdir C:\Projects
   cd C:\Projects
   git clone git@github.com:ORG/REPO.git
   ```
5. **Configure Git identity**:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```

### 9.4 Hardware Reachability
- Ensure the OptiPlex can ping robot and ESP controllers:
  ```powershell
  ping 192.168.1.11
  ping 192.168.1.20
  ```
- If unreachable, confirm the laptop bridge routes between 10.42.0.x and 192.168.1.x networks or adjust the network topology.

### 9.5 Container Execution
- In the repo directory:
  ```powershell
  docker compose --env-file .env.docker build
  docker compose --env-file .env.docker up
  ```
- Tail logs: `docker compose logs -f app`
- Access UI: `http://localhost:3101/HW`
- Observe logs for `Robot connection established successfully` and `ESP32 TCP connection established successfully`.

## 10. Troubleshooting Checklist
| Symptom | Likely Cause | Remediation |
| --- | --- | --- |
| `Access denied for user` during DB init | MySQL credentials mismatch | Sync `.env` with actual user/pass; run grants.
| `connect ECONNREFUSED` for hardware | Host can’t reach device | Verify ping, adjust Docker networking or firewall.
| `EACCES /app/logs` in container | Volume ownership | Entrypoint script handles `chown`; ensure volumes aren’t bind-mounted read-only.
| `wsl kernel too old` (Windows) | Outdated WSL | `wsl --update`, reboot.
| `git clone` prompts for password | SSH key missing or not added | Re-run `ssh -T git@github.com`, confirm key in GitHub.

## 11. File Inventory of Changes
- `Dockerfile`, `docker-compose.yml`
- `.env.docker`, `.env.local` (split env strategy)
- `scripts/docker-entrypoint.sh`
- `README.md` (extended documentation, WSL instructions, network sharing)
- `images/architecture.png` (simplified architecture diagram with legend)
- `report.md` (this document)

## 12. Future Work / Recommendations
- Create automated health probes or smoke tests that validate hardware connectivity after container startup.
- Expand CI pipeline to build and push Docker images for environments without direct repo access.
- Consider secrets management (Docker secrets, Vault) for database credentials instead of `.env` files in production.
- Investigate using named Compose profiles for “with hardware” vs “simulator” deployments.

---
