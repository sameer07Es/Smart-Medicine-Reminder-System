# Project Submission Report

## Smart Medicine Reminder System for Industrial IoT

### Abstract
The Smart Medicine Reminder System is a LAN-based Industrial IoT application designed to improve medicine adherence through automated scheduling, device communication, and real-time intake tracking. The solution combines an ESP32-based reminder device, a Node.js backend, MongoDB storage, MQTT-based messaging, and a browser dashboard for configuration and monitoring. It supports device registration, medicine schedule management, heartbeat monitoring, intake logging, and weekly adherence reporting. The system is intended for local network deployment, making it suitable for environments where low-latency communication, offline reliability, and controlled device operation are important.

### 1. Introduction
Medicine non-adherence is a common problem in both home care and supervised environments. Missed or delayed intake can reduce treatment effectiveness and increase health risks. This project addresses the problem by providing an embedded reminder device that can receive schedules from a central server and report intake events back to the platform.

The project follows an Industrial IoT pattern because it connects embedded hardware, a message broker, a backend application, and a web dashboard into one coordinated control system. The design emphasizes local communication, persistent data storage, device status tracking, and operational visibility.

### 2. Problem Statement
The main problem is to reliably manage medicine reminders for one or more devices and to track whether scheduled doses were actually taken. A practical solution must:

- Allow authenticated users to manage device registrations.
- Store and update medicine schedules centrally.
- Deliver schedules to ESP32 devices with minimal delay.
- Record intake events and heartbeat updates.
- Show device health and weekly adherence data in a dashboard.
- Work within a local network without depending on cloud services.

### 3. Objectives
The project was built with the following objectives:

- Develop a secure login-based web dashboard for users.
- Register and manage medicine reminder devices.
- Store schedules and intake logs in MongoDB.
- Use MQTT for fast device-server communication.
- Automatically publish updated schedules whenever medicines are created, edited, or deleted.
- Maintain device status using heartbeats and last-seen timestamps.
- Present weekly intake statistics and history to the user.

### 4. Scope of the Project
The current implementation covers the complete workflow from user authentication to schedule delivery and intake reporting. The system supports:

- User registration, login, and logout.
- Device creation, claiming, editing, deletion, and discovery.
- Medicine schedule creation with multiple daily times and selected active days.
- Intake logging from ESP32 through MQTT or HTTP fallback.
- Weekly adherence reporting and recent history display.
- LAN-only operation with local MongoDB and Mosquitto broker.

### 5. System Overview
The project is organized into four main layers:

1. **Web Layer** - A browser-based dashboard used for user login, device control, and schedule management.
2. **Application Layer** - An Express.js backend that exposes REST APIs and handles business logic.
3. **Messaging Layer** - An MQTT broker used for low-latency communication with ESP32 devices.
4. **Data Layer** - MongoDB collections that persist users, devices, medicines, intake records, and sensor entries.

### 6. Architecture
The architecture is centered around a Node.js server that acts as the coordinator between the web dashboard and the ESP32 devices.

#### Main Components
- **Frontend dashboard**: `public/index.html`, `public/dashboard.js`, and `public/styles.css`.
- **Backend server**: `server.js` with Express routing and MongoDB connection.
- **Device communication service**: `services/mqttService.js`.
- **Authentication middleware**: session-based access control in `middleware/auth.js`.
- **MongoDB models**: `User`, `Device`, `Medicine`, `MedicineIntake`, and `Sensor`.
- **ESP32 firmware**: `provisioning_tool.ino` and `medicine_reminder_node/medicine_reminder_node.ino`.

#### High-Level Data Flow
1. The user registers or logs in through the dashboard.
2. The user registers an ESP32 device using a device name that matches the provisioned firmware name.
3. The user creates medicine schedules for that device.
4. The server saves the schedule in MongoDB.
5. The server publishes the updated schedule through MQTT.
6. The ESP32 requests schedules or receives updates and performs reminder actions.
7. The ESP32 sends heartbeat and intake status updates back to the server.
8. The dashboard displays live device status, active medicines, intake history, and weekly statistics.

### 7. Hardware and Software Requirements
#### Hardware
- ESP32 development board.
- Medicine reminder hardware module or enclosure.
- Local Wi-Fi access point or LAN router.
- Optional display and notification peripherals depending on firmware configuration.

#### Software
- Node.js runtime.
- MongoDB database server.
- Mosquitto MQTT broker.
- Web browser for dashboard access.
- ESP32 firmware compiled and uploaded through Arduino IDE or a compatible toolchain.

### 8. Technologies Used
| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML, CSS, JavaScript | Browser UI for users |
| Backend | Node.js, Express.js | API server and application logic |
| Database | MongoDB, Mongoose | Persistent storage |
| Messaging | MQTT, Mosquitto | Device communication |
| Session Management | express-session | Login session handling |
| Security | bcryptjs | Password hashing |
| Networking | CORS, REST APIs | Browser and device interoperability |

### 9. Functional Modules
#### 9.1 Authentication Module
The authentication module provides user registration, login, logout, and current session lookup. It stores user credentials securely and uses sessions to protect dashboard routes.

Implemented endpoints include:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/current-user`

#### 9.2 Device Management Module
The device module supports both registered devices and discovered devices that have connected but are not yet assigned to a user. It also supports automatic heartbeat-based updates.

Capabilities include:
- Register a device.
- Claim an unassigned device.
- Update a device nickname.
- Delete a device.
- Fetch a device by name for ESP32 compatibility.
- Track device `lastSeen` and status.

Important endpoints:
- `GET /api/devices`
- `GET /api/devices/discovered`
- `GET /api/devices/name/:deviceName`
- `GET /api/devices/time`
- `POST /api/devices/heartbeat`
- `POST /api/devices`
- `PUT /api/devices/:id`
- `DELETE /api/devices/:id`

#### 9.3 Medicine Scheduling Module
This module creates and maintains medicine reminder schedules tied to a specific device. Each medicine can have multiple daily times and selected active days.

Supported features:
- Medicine name and dosage.
- Multiple reminder times per day.
- Active day selection using day numbers or day names.
- Start and end dates.
- Optional notes.
- Activation/deactivation of schedules.

Important endpoints:
- `GET /api/medicines`
- `GET /api/medicines/device/:deviceName`
- `POST /api/medicines`
- `PUT /api/medicines/:id`
- `DELETE /api/medicines/:id`

When a medicine is added, updated, or removed, the server republishes the latest schedule to the corresponding ESP32 device through MQTT.

#### 9.4 Intake Logging Module
The intake module stores whether a scheduled dose was taken, missed, or remains pending. It supports both history views and weekly analytics.

Main capabilities:
- Log intake from ESP32 events.
- Store scheduled time and actual taken time.
- Retrieve recent history.
- Retrieve today’s pending medicines.
- Compute weekly adherence statistics.

Important endpoints:
- `GET /api/intake/history`
- `GET /api/intake/pending`
- `POST /api/intake/log`
- `GET /api/intake/stats/weekly`

#### 9.5 Dashboard and Reporting Module
The dashboard presents a structured interface for operational monitoring. It includes:
- Device summary cards.
- Connected device status.
- My devices list.
- Medicine schedule management.
- Weekly medicine intake report.
- Recent intake history.

The dashboard refreshes regularly so that heartbeat changes and new device events are visible quickly.

#### 9.6 MQTT Communication Module
MQTT is the core transport layer used for device-server interaction. The service subscribes to device topics and reacts to heartbeats, intake events, and schedule requests.

Published and subscribed topic pattern:
- `smsr/device/<deviceName>/schedule/request`
- `smsr/device/<deviceName>/schedule`
- `smsr/device/<deviceName>/intake`
- `smsr/device/<deviceName>/heartbeat`
- `smsr/device/<deviceName>/time/request`
- `smsr/device/<deviceName>/time`

This message-based design allows the ESP32 device to remain lightweight while the backend handles persistence and business logic.

### 10. Database Design
The system uses MongoDB collections for persistent storage.

#### 10.1 User Collection
Stores login credentials and profile information.

Typical fields:
- Username
- Email
- Hashed password
- Timestamps

#### 10.2 Device Collection
Tracks connected hardware devices.

Key fields:
- `userId`
- `deviceName`
- `nickname`
- `deviceType`
- `status`
- `lastSeen`
- `createdAt`

#### 10.3 Medicine Collection
Stores schedule definitions linked to a user and device.

Key fields:
- `userId`
- `deviceId`
- `name`
- `dosage`
- `times`
- `days`
- `active`
- `startDate`
- `endDate`
- `notes`

#### 10.4 Medicine Intake Collection
Stores actual intake records and adherence data.

Key fields:
- `userId`
- `deviceId`
- `medicineId`
- `scheduledTime`
- `takenTime`
- `status`
- `notes`
- `createdAt`

Indexes are used to keep queries efficient and to prevent duplicate records for the same medicine slot.

#### 10.5 Sensor Collection
A sensor model is included for extensibility. It supports sensor readings such as temperature, humidity, pressure, motion, light, and custom values. This can be used for future industrial monitoring enhancements.

### 11. Backend Implementation Details
The main server is implemented in `server.js`.

Important backend responsibilities:
- Initialize Express, CORS, JSON parsing, and static file hosting.
- Configure session management.
- Connect to MongoDB.
- Run cleanup for duplicate intake records.
- Initialize MQTT once the database connection is ready.
- Register API routes for auth, sensors, dashboard, devices, medicines, and intake.
- Serve the dashboard page from `public/index.html`.

A key reliability improvement in the server is the duplicate intake cleanup routine. It groups records by device, medicine, and scheduled time, then removes older duplicates so the reporting data stays consistent.

### 12. Frontend Implementation Details
The dashboard frontend is a single-page style interface built with plain HTML, CSS, and JavaScript.

Key user interface elements:
- Login and registration form.
- Device management cards.
- Medicine schedule form with time picker and day selectors.
- Weekly report section.
- Connected device monitoring panel.
- Modal dialogs for create and edit actions.

The frontend calls REST endpoints directly and updates the view dynamically without requiring a framework.

### 13. ESP32 and Embedded Side
The repository includes firmware and provisioning artifacts for the ESP32 device. The device is expected to:

- Connect to local Wi-Fi.
- Use a device name that matches the backend registration.
- Request or receive schedule payloads.
- Trigger reminders based on scheduled times.
- Publish intake and heartbeat messages.
- Optionally use server time for synchronization.

This separation keeps the embedded logic focused on real-time operation while the server handles persistence and analytics.

### 14. Industrial IoT Relevance
Although the project is presented as a medicine reminder solution, it follows several industrial IoT design principles:

- **Edge device communication** through MQTT.
- **Local network reliability** without dependence on cloud availability.
- **Persistent backend storage** for operational history.
- **Heartbeat monitoring** for device health awareness.
- **Role-based access control** through authentication sessions.
- **Analytics and reporting** for adherence visibility.
- **Modular service separation** to support future scaling and maintenance.

These patterns are directly transferable to other industrial monitoring and automation use cases.

### 15. Testing and Validation
The system can be validated at the application level through the following checks:

- User registration and login.
- Device registration and claiming.
- Medicine creation, update, and deletion.
- MQTT schedule publication after medicine changes.
- ESP32 heartbeat reception and status updates.
- Intake logging and deduplication.
- Weekly adherence report generation.
- Dashboard refresh and state synchronization.

Expected results:
- Devices appear in the dashboard after registration or heartbeat.
- Active schedules are reflected in MQTT payloads.
- Intake history shows the latest slot status only once.
- Weekly report counts taken, missed, and pending doses correctly.

### 16. Strengths of the Project
- Clear separation of web, backend, messaging, and database layers.
- Works in LAN-only environments.
- Uses MQTT for low-latency device interaction.
- Supports both manual dashboard actions and device-driven updates.
- Includes operational reporting and device health tracking.
- Uses schema validation and query indexes for data consistency.

### 17. Limitations
- The system currently assumes a local Mosquitto and MongoDB setup.
- Session-based authentication is simple and suitable for local deployment, but it is not a full enterprise identity solution.
- The current hardware workflow is centered on a single device name mapping model.
- Sensor monitoring exists as an extensible model, but the medicine reminder workflow is the primary production path in this repository.

### 18. Future Enhancements
The project can be extended in several useful ways:

- Add notification channels such as SMS, email, or mobile push notifications.
- Integrate cloud deployment and remote access for wider deployment.
- Add multi-user roles such as caregiver, patient, and administrator.
- Extend analytics with adherence trends, missed-dose alerts, and streak tracking.
- Add sensor-based environmental monitoring around the medicine storage area.
- Improve firmware with local alarms, display animations, and retry logic.
- Add OTA firmware updates for ESP32 devices.
- Add QR-based or NFC-based device onboarding.

### 19. Conclusion
The Smart Medicine Reminder System demonstrates a complete Industrial IoT workflow that connects an embedded ESP32 reminder device with a Node.js backend, MongoDB storage, MQTT messaging, and a browser-based dashboard. The system handles authentication, device registration, schedule distribution, intake logging, and weekly adherence reporting in a compact local-network deployment.

The project is well suited as a submission for an Industrial IoT course or lab because it shows both embedded communication and backend software integration. It also provides a practical foundation for future expansion into more advanced healthcare or industrial monitoring systems.

### 20. References
- Node.js and Express.js documentation.
- MongoDB and Mongoose documentation.
- MQTT and Mosquitto documentation.
- ESP32 Arduino framework documentation.
- Project source files in this repository, especially `server.js`, `services/mqttService.js`, `routes/`, `models/`, and `public/`.
