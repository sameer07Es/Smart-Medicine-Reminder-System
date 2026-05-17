# Industrial IoT: Smart Medication & Sensor Remediation (SMSR) — Project Report

## Abstract
This project implements an industrial-grade IoT system for medication reminders and environmental sensing in small-scale healthcare or manufacturing-adjacent deployments. It integrates ESP32-based edge devices, MQTT messaging, a Node.js middleware/server, and a web dashboard to monitor devices, register medication schedules, and log intake events. The design emphasizes reliability, simple provisioning, secure network communications, and extensibility for future analytics and cloud integration.

## Keywords
Industrial IoT, ESP32, MQTT, Node.js, medication reminder, sensors, provisioning, security, dashboard

## 1. Introduction
This report summarizes the architecture, design decisions, implementation details, testing, and deployment instructions for the SMSR_iot4.0 project. The aim is to demonstrate a robust end-to-end IoT solution suitable for industrial or institutional contexts where medication reminders, device telemetry, and audit trails are required.

## 2. Project Goals
- Provide reliable medication reminder and intake logging using low-cost edge hardware.
- Collect sensor telemetry (e.g., temperature, ambient light) for context-aware alerts and monitoring.
- Offer a web dashboard for device management, schedules, and historical intake analytics.
- Use standard, well-supported protocols (MQTT, HTTP) for interoperability and scaling.

## 3. System Overview
High-level components:
- Edge devices: ESP32 microcontrollers running firmware for sensors, display, and MQTT client.
- Messaging: MQTT broker mediates telemetry and command messages between devices and the server.
- Middleware / Server: Node.js application (server.js) providing REST APIs, MQTT integration, user/device models, and web UI assets.
- Web Dashboard: Browser-based dashboard for monitoring devices, viewing scheduled medications, and logging intake events.

Communication flow: Edge devices publish telemetry and subscribe to command topics; the middleware bridges messages with application logic and stores events in the backend models. The dashboard communicates with the middleware via HTTP endpoints and WebSocket/MQTT as implemented by the server.

## 4. Hardware
- Controller: ESP32 (development boards compatible with Arduino or PlatformIO).
- Display: small OLED/ST7789 displays used for local reminders (see `oled.md`).
- Sensors: Any supported sensors mounted to the ESP32 (temperature, ambient light, accelerometer as applicable).
- Firmware provisioning: `provisioning_tool.ino` demonstrates device provisioning and network setup.

Design considerations:
- Use low-power sleep schedules if battery operation required (not enforced in provided firmware but documented).
- Local reminder display gives immediate feedback; devices still report all events for centralized logging and audit.

## 5. Software Architecture
The repository provides a modular Node.js backend plus static UI assets:

- `server.js`: Application entrypoint and server process. Handles HTTP routes, MQTT client integration, and static file serving.
- `middleware/` and `services/`: Encapsulate authentication and business logic. `services/mqttService.js` contains the broker/client integration logic.
- `routes/`: HTTP endpoints for authentication (`auth.js`), dashboard, devices, medications, sensor telemetry, and intake logging.
- `models/`: Data models representing `Device`, `Medicine`, `MedicineIntake`, `Sensor`, and `User`.
- `public/`: Frontend assets (`index.html`, `dashboard.js`, styles) for the web dashboard.

Data flow and persistence:
- Devices publish telemetry via MQTT; the server subscribes and persists telemetry to the appropriate model.
- Medication schedules are stored via REST endpoints and served to the dashboard; reminders are triggered locally on devices and logged centrally.

## 6. Authentication & Security
- Basic auth middleware is implemented in `middleware/auth.js` and `public/auth.js`. For production, replace with OAuth2/OpenID Connect or a robust token-based system.
- MQTT transport: use TLS in production and require client certificates or secure credentials. The demo stack may use unencrypted MQTT for local testing but the design recommends always using encrypted channels on public networks.
- Data storage: sanitize inputs on all endpoints (the codebase includes express routes—validate payloads before persisting). Add server-side rate limiting and input validation for production readiness.

## 7. Provisioning and Deployment
Provisioning:
- Use the `provisioning_tool.ino` as the basis for onboarding new ESP32 devices. Implement a secure provisioning flow (one-time tokens or QR-based device pairing) for production.

Local deployment steps (developer/testing):
1. Install Node.js (v16+ recommended).
2. In the project root, install dependencies:

```bash
npm install
```

3. Start the server (will serve the dashboard and run MQTT client integration):

```bash
node server.js
```

4. Point a browser to the server address (default served static `public/index.html`).

For production:
- Run the Node.js server behind a process manager (PM2, systemd) with environment variables set for configuration (PORT, MQTT broker URL, DB connection string).
- Use a secure, managed MQTT broker (or cluster) with TLS.

## 8. User Interface
The dashboard (`public/index.html`, `public/dashboard.js`) provides:
- Device list and status
- Medication schedules and creation UI
- Intake logging and history charts
- Sensor telemetry viewer

UI design notes:
- Keep UI responsive; pages are lightweight to run on constrained hosting.
- Add role-based access control before exposing management features to broader user groups.

## 9. Testing & Validation
Unit & integration tests:
- Recommended: add Jest/Mocha tests for route handlers and model logic. The current repo contains core components and routes but does not include automated tests; add test harnesses before production rollout.

Manual tests performed:
- Device registration and provisioning using `provisioning_tool.ino`.
- MQTT telemetry flow verified using local Mosquitto broker and verifying server ingestion.
- Dashboard CRUD operations for medicines and intake events via the UI.

Metrics & acceptance criteria:
- Delivery reliability: >= 99% message delivery between devices and middleware under LAN conditions.
- Data integrity: intake logs must be immutable once recorded (write-once policy recommended at DB level for audit events).

## 10. Evaluation and Results
- The prototype demonstrates end-to-end functionality: device provisioning, reminder display, telemetry reporting, and centralized intake logging via the dashboard.
- Observed performance: sub-second local acknowledgement for telemetry on LAN; dashboard UI loads under 1s on local test machines.

## 11. Limitations
- No production-grade authentication or TLS enforced by default—these must be configured for real deployments.
- Persistent storage layer is not specified in this repository; integrate a DB (Postgres, MongoDB) for production.
- Scalability: current single-instance Node.js + single MQTT client is suitable for small deployments; consider clustering and message broker scaling for larger fleets.

## 12. Future Work
- Add automated test suite and CI pipeline.
- Integrate a resilient DB and backup policies.
- Add device OTA firmware update pipeline.
- Add OTA rollback, device health monitoring, and alerting rules.
- Add analytics pipeline (streaming telemetry to a time-series DB) and ML-based anomaly detection.

## 13. File Map and Important Files
- `server.js` — server entrypoint and HTTP + MQTT integration
- `provisioning_tool.ino` — device provisioning example firmware
- `services/mqttService.js` — MQTT messaging logic
- `models/` — data model definitions
- `public/` — dashboard assets
- `communication-flowchart.mmd` — architecture flowchart

## 14. References
- Project repository (this submission) contains implementation and supporting docs.
- ESP32 documentation, MQTT specification (OASIS), Node.js and Express guides.

## 15. Appendices
- Appendix A: Example MQTT topics and payloads

Topic examples:
- `smsr/device/{deviceId}/telemetry` — JSON payload with sensor readings
- `smsr/device/{deviceId}/events` — JSON payload for intake events

Payload example:

```json
{
  "deviceId": "esp32-001",
  "timestamp": "2026-05-02T12:34:56Z",
  "sensors": { "temperature": 22.8, "light": 120 }
}
```

- Appendix B: Deployment checklist
  - Configure TLS for MQTT
  - Add persistent DB and backups
  - Enforce authentication and RBAC
  - Add monitoring and alerting (Prometheus/Grafana or cloud equivalents)

---
_Prepared for submission: SMSR_iot4.0 — Industrial IoT project._
