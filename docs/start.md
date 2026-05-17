# Start Guide

This guide explains how to start the backend and frontend on Windows.

## Prerequisites
- Node.js (LTS recommended)
- MongoDB (local service)
- Optional: Node-RED (for custom workflows)
- Mosquitto broker (for MQTT between ESP32 and server)
- ESP32 and server machine connected to the same local WiFi/LAN

## 1) Messaging Layer (Mosquitto MQTT)
1. Start Mosquitto broker:
   ```
   net start mosquitto
   ```
2. Confirm MQTT broker availability on port `1883`.

## 2) Backend (Node.js API + web server)
1. Install dependencies (first time only):
   ```
   npm install
   ```
2. Start MongoDB service:
   ```
   net start MongoDB
   ```
3. Create a `.env` file in the project root (if not already present):
   ```
   MONGODB_URI=mongodb://YOUR_MONGODB_HOST:27017/YOUR_DATABASE_NAME
   SESSION_SECRET=your-secret-key-here-change-in-production
   PORT=3000
   ```
4. Start the server:
   ```
   npm start
   ```

## 3) Frontend (Web UI)
The frontend is served by the same Node.js server.
- Open the dashboard in a browser:
  ```
  http://localhost:3000
  ```
- For LAN access from other devices, use `http://<SERVER_LAN_IP>:3000`.

## 4) LAN Quick Check (Before ESP32 Test)
1. Find server LAN IP on the server machine:
   ```
   ipconfig
   ```
   Use the IPv4 address of your active WiFi/Ethernet adapter.

2. From another device on the same LAN, verify API reachability:
   ```
   http://<SERVER_LAN_IP>:3000
   ```
   The dashboard page should open.

3. Verify MQTT broker port is open from the server machine:
   ```
   Test-NetConnection 127.0.0.1 -Port 1883
   ```
   Check that `TcpTestSucceeded` is `True`.

4. If ESP32 still cannot connect, check Windows Firewall rules for ports `3000` and `1883`.

## 5) Optional: Node-RED
If you want optional workflow automation:
1. Start Node-RED:
   ```
   npm run red
   ```
2. Open Node-RED and import the flow from `node-red-flows.json`:
   ```
   http://localhost:1880
   ```

## Common Troubleshooting
- MongoDB not running: verify the service or start it manually.
- Port 3000 in use: change `PORT` in `.env`.
