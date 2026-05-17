# Smart Medicine Reminder System
The project is designed to help users manage medicine reminders on a local network. A web dashboard is used to create and update medicine schedules, a Node.js backend stores the data and coordinates device communication, and an ESP32-based reminder unit receives the schedules and displays timely alerts.

## Quick Navigation

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Project Purpose](#project-purpose)
5. [Contents](#contents)
6. [Quick Start](#quick-start)
7. [Component Usage](#component-usage)
8. [Security & Configuration](#security-and-configuration-considerations)
9. [Deployment Notes](#deployment-notes)
10. [Troubleshooting](#support-and-troubleshooting)

## Project Overview

This is a LAN-based medicine reminder and tracking system with three integrated components:

1. **Backend** — runs the dashboard, stores data in MongoDB, and coordinates MQTT messages between the application and the device.
2. **ESP32 Firmware** — powers the physical reminder device, connects it to WiFi, receives schedule updates, and reports device activity.
3. **Documentation** — explains the design, communication flow, setup process, and submission context.

The overall workflow is as follows: a user adds or updates medicine entries in the dashboard, the server records the data and publishes the relevant schedule information, and the ESP32 receives those updates, displays reminders locally, and sends intake or status messages back to the server.

## Project Purpose

The project demonstrates a complete end-to-end IoT workflow for medicine adherence. It combines a browser-based management interface, a persistent backend, MQTT-based communication, and an embedded reminder device into a single system that can be deployed on a home or lab network.

The submission is intended to show:

- how a user interface can manage reminder data,
- how a backend can store and distribute device updates,
- how an ESP32 can act as a connected reminder terminal,
- and how the entire system can be documented and prepared for publication.

## System Architecture

**Presentation Tier (Frontend):** A browser-based dashboard served by the Express backend allows users to log in, register devices, create medicine entries, and view intake history. The dashboard communicates with the backend via HTTP REST APIs.

**Application Tier (Backend):** The Node.js server running Express acts as the central orchestrator. It manages user authentication and session state, enforces data validation and access control, stores all application data in MongoDB, bridges HTTP requests to MQTT messages, and coordinates the publication of medicine schedules to registered ESP32 devices.

**Device Tier (Embedded):** The ESP32 microcontroller serves as a networked reminder terminal. Each device maintains a connection to the local MQTT broker, subscribes to device-specific schedule topics, renders medicine reminders on a local OLED display, captures user intake confirmation events, and transmits device status and activity logs back to the server.

**Message Bus (MQTT):** The MQTT broker acts as the message infrastructure connecting the application backend and all ESP32 devices on the local network. The broker ensures reliable delivery of schedule updates and device telemetry using a publish-subscribe pattern.

**Data Persistence (MongoDB):** MongoDB provides document-oriented storage for all user accounts, device registrations, medicine entries, schedules, and intake logs. The schema is designed to support efficient queries for schedule retrieval and intake history aggregation.

## Technology Stack

**Backend:** Node.js, Express.js, MongoDB, Mongoose ODM

**Device:** ESP32 microcontroller, Arduino IDE, ArduinoJson, PubSubClient, Adafruit display drivers

**Communication:** MQTT (pub-sub protocol), HTTP/REST APIs, JSON message format

**Database:** MongoDB with predefined schemas for Users, Devices, Medicines, and Intake Records

**Frontend:** HTML5, CSS, vanilla JavaScript for dashboard UI

**Infrastructure:** MQTT broker (Mosquitto compatible), local network deployment

## Key Features

- Dashboard-based medicine management
- MongoDB-backed persistence for users, devices, schedules, and intake logs
- MQTT communication between the server and ESP32 device
- Local-device reminders with OLED status feedback
- Separate provisioning workflow for device identification
- Clean publish-ready folder structure with placeholder configuration values

## System Data Flow

### User Registration and Authentication

1. A new user registers in the web dashboard with email and password.
2. The backend hashes the password using bcryptjs and stores the user account in MongoDB.
3. The user logs in and receives a secure session cookie.

### Device Provisioning

1. An ESP32 is programmed with the provisioning sketch, which writes a unique device name to EEPROM.
2. The same ESP32 is then flashed with the main firmware, which reads the stored device name at startup.
3. The device connects to WiFi and the MQTT broker using credentials from `secrets.h`.
4. The device publishes a heartbeat message announcing its availability.

### Medicine Schedule Management

1. A logged-in user opens the dashboard and adds a new medicine entry (name, dosage, frequency).
2. The backend stores the medicine record and associates it with the user.
3. The user creates a medicine intake schedule (which medicine, which device, reminder times).
4. The backend publishes the schedule to the ESP32 via an MQTT topic specific to that device.
5. The ESP32 receives the schedule, stores it locally, and begins showing reminders at the specified times.

### Medicine Reminder and Intake Logging

1. At a scheduled reminder time, the ESP32 displays a reminder on the OLED screen (e.g., "Medicine X — Take Now").
2. The user acknowledges the reminder using a hardware button or touch interface on the device.
3. The ESP32 publishes an intake confirmation message to the MQTT broker.
4. The backend receives the message and records the intake event in MongoDB with a timestamp.
5. The user can view their intake history in the web dashboard.

### Device Status and Telemetry

1. The ESP32 periodically publishes heartbeat and status messages to indicate it is online and responsive.
2. The backend listens for these messages and updates device status in the database.
3. If a device goes offline, the backend can flag it and display an alert in the dashboard.

## Contents

- `backend/` - Node.js server, API routes, MongoDB models, MQTT service, and dashboard UI
- `firmware/` - ESP32 firmware, provisioning sketch, and device configuration files
- `docs/` - project reports, flow diagrams, and setup notes
- `.gitignore` - version control exclusions for secrets and dependencies

### Repository Structure

The submission is arranged so each major part of the system can be reviewed independently:

- `backend/` contains the server-side implementation and browser dashboard.
- `firmware/` contains the embedded code for the ESP32 reminder device.
- `docs/` contains the technical reports and supporting documentation used for submission.

### Backend Directory

- `server.js` — Entry point that initializes Express, connects to MongoDB, sets up MQTT, and starts the HTTP server.
- `package.json` — Node.js dependencies and npm scripts.
- `routes/` — API endpoints for auth, dashboard, devices, medicines, intake, and sensors.
- `models/` — MongoDB schema definitions (User, Device, Medicine, MedicineIntake, Sensor).
- `services/mqttService.js` — MQTT communication layer for publishing schedules and subscribing to device messages.
- `middleware/auth.js` — Authentication middleware validating sessions.
- `public/` — Browser dashboard UI (HTML, CSS, JavaScript).

**Backend API Endpoints:**
- `POST /auth/register` — register a new user account
- `POST /auth/login` — authenticate and create a session
- `POST /auth/logout` — terminate the user session
- `GET /dashboard` — render the main dashboard (requires authentication)
- `GET /api/devices` — list all devices for the authenticated user
- `POST /api/devices` — register a new device
- `GET /api/medicines` — list all medicines for the user
- `POST /api/medicines` — create a new medicine entry
- `GET /api/intake` — retrieve medicine intake history
- `POST /api/intake` — log a medicine intake event
- `GET /api/sensors` — retrieve device telemetry data (if available)

**Backend Configuration (.env):**
- `MONGODB_URI` — connection string to MongoDB (e.g., `mongodb://localhost:27017/medicine_app`)
- `SESSION_SECRET` — random string used to sign session cookies
- `PORT` — HTTP server port (default 3000)
- `MQTT_BROKER_URL` — MQTT broker connection string (e.g., `mqtt://localhost:1883`)
- `MQTT_TOPIC_PREFIX` — prefix for all MQTT topics (e.g., `smsr`)

### Firmware Directory

- `medicine_reminder_node.ino` — Main ESP32 sketch that connects to WiFi, receives schedules via MQTT, displays reminders on OLED, and publishes intake events.
- `provisioning_tool.ino` — One-time sketch to write device name to EEPROM.
- `secrets.h` — Header file with WiFi, MQTT, and timezone configuration macros.
- `PROVISIONING_INSTRUCTIONS.md` — Device setup guide.
- `oled.md` — OLED display message reference.

**Firmware Configuration (secrets.h):**
```cpp
#define WIFI_SSID "YOUR_SSID"
#define WIFI_PASSWORD "YOUR_PASSWORD"
#define MQTT_BROKER_HOST "YOUR_MQTT_BROKER_IP"
#define MQTT_PORT 1883
#define GMT_OFFSET_SEC 0
#define DAYLIGHT_OFFSET_SEC 0
#define DEFAULT_DEVICE_NAME "ESP32_DEVICE"
```

**Firmware MQTT Topics:**
- Outgoing (Device → Server): `smsr/device/{DEVICE_NAME}/heartbeat`, `smsr/device/{DEVICE_NAME}/intake`
- Incoming (Server → Device): `smsr/device/{DEVICE_NAME}/schedule`

### Documentation Directory

- `PROJECT_REPORT.md` — Comprehensive technical report with design, implementation, and results.
- `PROJECT_SUBMISSION_REPORT.md` — Academic submission write-up.
- `communication-flowchart.mmd` — Mermaid diagram of message flow between user, server, broker, and devices.
- `node-red-flows.json` — Archived Node-RED flow configuration.
- `start.md` — Quick reference guide.

## Quick Start

### Prerequisites

- Node.js (v12 or later)
- npm package manager
- MongoDB running locally or accessible on the network
- MQTT broker (e.g., Mosquitto) running locally or accessible on the network
- Arduino IDE or VS Code with Arduino extension
- ESP32 development board and USB cable
- OLED display connected to ESP32 (SSD1306, 128x64 or equivalent)

### Backend Startup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your local MongoDB and MQTT broker settings
npm start
```

The backend will be available at `http://localhost:3000`.

### Firmware Startup

1. Connect the ESP32 to your computer via USB.
2. Open `firmware/medicine_reminder_node.ino` in the Arduino IDE.
3. Edit `firmware/secrets.h` with your WiFi SSID, password, MQTT broker address, and device name.
4. Select the ESP32 board and COM port in the Arduino IDE.
5. Upload the sketch.
6. Open the Serial Monitor (baud rate 115200) to verify WiFi and MQTT connections.

## Component Usage

### Backend

Use the backend to run the dashboard or test the server-side application.

**Setup:**
1. Change into the `backend/` folder.
2. Create your local `.env` from `.env.example`.
3. Set `MONGODB_URI`, `SESSION_SECRET`, `PORT`, `MQTT_BROKER_URL`, and `MQTT_TOPIC_PREFIX`.
4. Run `npm install`.
5. Start MongoDB and the MQTT broker.
6. Run `npm start`.

**Testing:**
1. Navigate to `http://localhost:3000` and register a new user account.
2. Log in with the registered credentials.
3. Register a new device by providing the device name (must match the ESP32's device name from `secrets.h`).
4. Add a medicine entry with name and dosage information.
5. Create an intake schedule linking the medicine to the registered device.
6. When an ESP32 comes online, the server will publish the schedule via MQTT.
7. Check the intake history page to see logged events from the device.

**Purpose:** The backend stores data, serves the browser interface, and bridges MQTT messages between the ESP32 and the application logic.

### Firmware

Use the firmware to program the ESP32 reminder device.

**Setup:**
1. Open the `firmware/` folder in your Arduino development environment.
2. Update `secrets.h` with your local WiFi and MQTT settings.
3. Upload `provisioning_tool.ino` if the device name still needs to be written to EEPROM.
4. Upload `medicine_reminder_node.ino` after provisioning.
5. Watch the serial monitor and OLED for WiFi, MQTT, and time-sync status.

**Debugging:**
- If the device does not connect, open the Arduino Serial Monitor (baud rate 115200) and check for connection messages.
- Verify that `secrets.h` contains the correct WiFi SSID, password, and MQTT broker address.
- Ensure the ESP32, WiFi network, and MQTT broker are all reachable.
- Check that the device name in `secrets.h` matches the device name registered in the backend.
- If the OLED is not displaying, verify the I2C address and pinout in the firmware code.

**Purpose:** The firmware connects the device to the local network, receives medicine schedules, displays reminders, and sends device status back to the server.

### Documentation

Use the documentation to understand the project design or prepare the submission.

1. Read `docs/PROJECT_REPORT.md` for the project explanation.
2. Read `docs/PROJECT_SUBMISSION_REPORT.md` for the submission write-up.
3. Open `docs/communication-flowchart.mmd` to see the system flow.
4. Keep the docs together when you upload the project to GitHub.

**Purpose:** The documentation makes the project easier to evaluate, explain, and present.

## Security and Configuration Considerations

### Credential Management

This submission uses placeholder values for all sensitive configuration:

- `backend/.env.example` contains placeholder MongoDB and MQTT URIs.
- `firmware/secrets.h` contains placeholder WiFi credentials and broker addresses.
- Before deployment, replace all placeholder values with actual credentials appropriate for your network.
- Never commit real credentials to version control. Only commit `.env.example` and the `secrets.h` template.

### Authentication and Authorization

- User passwords are hashed using bcryptjs before storage in MongoDB.
- Session cookies are signed with `SESSION_SECRET` to prevent tampering.
- API endpoints check for valid sessions before allowing access to user data.
- Each device is associated with a user account; only the owning user can view and modify that device's schedules.

### Network Security

- The system is designed for deployment on a local LAN behind a home or lab firewall.
- MQTT communication is unencrypted by default. For production deployments, consider using MQTT over TLS (mqtts://).
- The HTTP backend does not use HTTPS by default; for remote access, use a reverse proxy with TLS termination.

### Data Privacy

- Medicine intake records are stored per-device and per-user; users cannot access other users' data.
- The system does not transmit data outside the local network by default.
- Backup and archival of MongoDB are the responsibility of the deployment administrator.

## Deployment Notes

### Local Testing Environment

For initial testing:

1. Install MongoDB locally (or use Docker: `docker run -d -p 27017:27017 mongo:latest`).
2. Install and start an MQTT broker (Mosquitto: `mosquitto` or `brew install mosquitto && mosquitto`).
3. Follow the Quick Start section to run the backend and flash the firmware.

### Production Considerations

For a persistent home or lab deployment:

- Use a dedicated MongoDB instance (e.g., managed MongoDB Atlas or a persistent VM).
- Deploy the backend to a reliable machine that remains on (NAS, always-on server, or cloud instance).
- Use a stable MQTT broker accessible from all ESP32 devices (e.g., Mosquitto on a dedicated Pi).
- Document the configuration values (IP addresses, hostnames, credentials) for future troubleshooting.
- Implement automated backups of the MongoDB database.
- Monitor backend uptime and alert on failures.

## Testing and Validation

The submission includes:

- Backend API tests covering registration, authentication, device management, medicine CRUD, and intake logging.
- Firmware integration tests validating WiFi connection, MQTT subscription, and message parsing.
- End-to-end test scenarios verifying the complete workflow from user dashboard to device reminder to intake logging.

See `docs/PROJECT_REPORT.md` for detailed test results and performance metrics.

## Local Configuration

- `backend/.env` for server settings
- `firmware/secrets.h` for ESP32 WiFi and MQTT settings

## Publish Checklist

Before publishing this folder to GitHub, ensure the following:

1. `backend/.env` does not exist in the published copy. Keep only `backend/.env.example` in the repo.
2. `firmware/secrets.h` keeps placeholder values unless you intentionally want to publish your real local settings.
3. Do not add `node_modules/`, build outputs, or generated files.
4. Review the docs if you want to publish only the final submission artifacts.

## Project Metadata

- **Project Name:** Smart Medicine Reminder System (SMSR)
- **Type:** IoT Application, Full-stack Web/Embedded System
- **Architecture:** Three-tier (Frontend, Backend, Device)
- **Target Platform:** ESP32 microcontroller with OLED display, Node.js backend, MongoDB persistence
- **Communication Protocol:** MQTT pub-sub, HTTP REST APIs
- **License:** [Specify your license, e.g., MIT, Apache 2.0, or proprietary]
- **Submission Date:** [Date of submission]
- **Contact:** [Your name or team contact information]

## Support and Troubleshooting

### Common Issues

**Backend fails to start:**
- Verify MongoDB is running: `mongosh` or check `localhost:27017`.
- Check that `MONGODB_URI` in `.env` is correct.
- Review backend error logs for connection failures.

**ESP32 cannot connect to WiFi:**
- Verify WiFi SSID and password in `secrets.h` are correct.
- Confirm the 2.4 GHz WiFi network is accessible and not using WPA3 (ESP32 may not support it).
- Check that the ESP32 is within range of the WiFi router.

**MQTT messages not being published:**
- Verify the MQTT broker is running and listening on the specified port (default 1883).
- Check that `MQTT_BROKER_URL` in backend `.env` and `MQTT_BROKER_HOST` in firmware `secrets.h` are the same.
- Use an MQTT client tool (e.g., `mosquitto_pub`, `mqtt-explorer`) to test broker connectivity.

**Device not appearing in dashboard:**
- Verify the device name in the firmware matches the device name registered in the backend.
- Check that both the backend and ESP32 are connected to the same MQTT broker.
- Review the ESP32 serial monitor for connection messages.

For additional support, refer to the detailed logs in `docs/PROJECT_REPORT.md` and the communication flowchart in `docs/communication-flowchart.mmd`.

## Notes

- Keep all real secrets out of the repository.
- Publish only placeholder values in `backend/.env.example` and `firmware/secrets.h`.
- The project is designed for LAN use with MongoDB and an MQTT broker on the same local network.
- If the repository is made public, replace any real IP addresses, broker URLs, passwords, or device names before uploading.
