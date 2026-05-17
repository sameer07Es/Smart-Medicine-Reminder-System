# OLED Display Outcomes

This document lists the OLED screens shown by the ESP32 sketch during normal operation.

## Online (WiFi OK)
- Main status screen:
  - Line 1: "Medicine Reminder"
  - Line 2: "Time: HH:MM:SS"
  - Line 3: "WiFi: OK"
  - Line 4: "Taken: <n> Missed: <n>"
  - Line 5: "Next: HH:MM" (or "No schedule")

## Offline (WiFi failed or disconnected)
- WiFi connect attempt:
  - Line 1: "WiFi"
  - Line 2: "Connecting..."
  - Line 3: "<SSID>"
- WiFi failed:
  - Line 1: "WiFi Failed"
  - Line 2: "Retrying..."
  - Line 3: ""
- Main status screen (when offline):
  - Line 1: "Medicine Reminder"
  - Line 2: "Time: Time N/A" (if time not synced)
  - Line 3: "WiFi: X"
  - Line 4: "Taken: <n> Missed: <n>"
  - Line 5: "Next: HH:MM" (or "No schedule")

## Reminder (alert active)
- Alert screen:
  - Line 1: "TIME FOR"
  - Line 2: "<medicine name>"
  - Line 3: "Press Button!"

## Other transient screens
- Startup:
  - Line 1: "Medicine Reminder"
  - Line 2: "<device name>"
  - Line 3: "Starting..."
- WiFi connected:
  - Line 1: "WiFi Connected"
  - Line 2: "<device IP>"
  - Line 3: ""
- Time sync:
  - Line 1: "Time Sync"
  - Line 2: "Connecting NTP..."
  - Line 3: ""
- Time sync success:
  - Line 1: "Time Synced"
  - Line 2: "Success"
  - Line 3: ""
- Time sync failed:
  - Line 1: "Time Sync"
  - Line 2: "Failed"
  - Line 3: ""
- Loading schedule (HTTP fallback):
  - Line 1: "Loading"
  - Line 2: "Medicine Schedule"
  - Line 3: ""
- Schedule loaded:
  - Line 1: "Schedule Loaded"
  - Line 2: "<n> medicines"
  - Line 3: ""
- Medicine taken confirmation:
  - Line 1: "Medicine Taken"
  - Line 2: "<medicine name>"
  - Line 3: "Thank You!"
