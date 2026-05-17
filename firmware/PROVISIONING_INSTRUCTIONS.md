# ESP32 Provisioning Instructions

## Overview
Before deploying your ESP32 medicine reminder devices, each one must be provisioned with a unique device name. This name is stored in EEPROM and used to identify the device when communicating with the server.

## Prerequisites
- Arduino IDE installed with ESP32 board support
- ESP32 board connected via USB
- Serial Monitor access

## Step-by-Step Provisioning Process

### 1. Upload Provisioning Tool
1. Open `provisioning_tool.ino` in Arduino IDE
2. Select your ESP32 board (Tools → Board → ESP32 Dev Module)
3. Select the correct COM port (Tools → Port)
4. Click Upload button
5. Wait for upload to complete

### 2. Open Serial Monitor
1. Click Serial Monitor icon (top right) or press Ctrl+Shift+M
2. Set baud rate to **115200**
3. Set line ending to **Newline** or **Both NL & CR**

### 3. Provision Device Name
1. You should see the menu:
   ```
   ESP32 EEPROM Provisioning Tool
   Medicine Reminder System
   =====================================
   
   --- Menu ---
   1. Set new device name
   2. Read current device name
   3. Clear EEPROM
   
   Enter command:
   ```

2. Type `1` and press Enter to set a new device name

3. Enter a unique device name (max 63 characters):
   - Examples: `MED_001`, `JohnMedicineBox`, `Room1Device`
   - Use alphanumeric characters, underscores, or hyphens
   - Keep it descriptive but concise
   - **Each device MUST have a unique name**

4. Press Enter

5. You should see:
   ```
   SUCCESS: Device name saved!
   Device name: MED_001
   Verification: PASSED ✓
   ```

### 4. Verify Device Name (Optional)
1. Type `2` and press Enter
2. Confirm the device name is stored correctly

### 5. Upload Main Medicine Reminder Sketch
1. Close Serial Monitor
2. Open `medicine_reminder_node.ino` in Arduino IDE
3. **Update WiFi credentials** at the top of the file:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
4. **Update LAN server and MQTT broker hosts**:
   ```cpp
   const char* serverHost = "YOUR_SERVER_HOST";
   const char* mqttBrokerHost = "YOUR_MQTT_BROKER_HOST";
   const int serverPort = 3000;
   const int mqttPort = 1883;
   ```
5. Click Upload button
6. Wait for upload to complete

### 6. Register Device on Server
1. Open web dashboard at `http://localhost:3000`
2. Log in with your account
3. Navigate to Devices section
4. Click "Register New Device"
5. Enter:
   - **Device Name**: Must match the name you provisioned (e.g., `MED_001`)
   - **Nickname**: User-friendly name (e.g., "John's Medicine Box")
6. Click Save

### 7. Add Medicine Schedule
1. Go to Medicines section
2. Select your registered device
3. Add medicines with:
   - Medicine name (e.g., "Aspirin")
   - Dosage (e.g., "100mg")
   - Times (e.g., 08:00, 14:00, 20:00)
   - Active days (select days of week)
4. Click Save

### 8. Test the Device
1. Open Serial Monitor again (115200 baud)
2. You should see:
   ```
   Device Name: MED_001
   Connecting to WiFi...
   WiFi connected
   Time synced: 2024-01-15 14:30:00
   Fetched 3 medicines
   Medicine 1: Aspirin at 08:00, 14:00, 20:00
   ```
3. Wait until a scheduled medicine time
4. Device should beep and display alert on OLED
5. Press the button to confirm medicine taken
6. Check web dashboard for intake log

## Troubleshooting

### "No device name found in EEPROM"
- Device hasn't been provisioned yet
- Use option 1 to set device name

### "Device not found" error on ESP32
- Device name doesn't exist on server
- Register the device on the web dashboard first
- Make sure the name exactly matches (case-sensitive)

### "Failed to fetch medicine schedule"
- Check WiFi connection
- Verify the LAN server host/IP is correct
- Ensure server is running
- Ensure Mosquitto broker is reachable on port 1883
- Check firewall settings

### Time is incorrect
- Make sure NTP sync succeeded
- Check timezone offset in code (default: IST GMT+5:30)
- Adjust `gmtOffset_sec` and `daylightOffset_sec` if needed

### Button doesn't respond
- Check GPIO0 connection
- Hold button for at least 50ms (debounce)
- Check Serial Monitor for "Button pressed" message

## Important Notes

1. **Unique Device Names**: Each ESP32 in your system must have a unique device name
2. **Server Registration**: Device must be registered on server before ESP32 can fetch schedules
3. **WiFi Credentials**: Update in `medicine_reminder_node.ino` before uploading
4. **Time Sync**: Device needs internet access for external NTP synchronization (or use local time/NTP alternatives)
5. **EEPROM Persistence**: Device name persists even after power loss or code updates

## Device Naming Conventions

Suggested naming patterns:
- Sequential: `MED_001`, `MED_002`, `MED_003`
- Location-based: `Room1_Med`, `Bedroom_Med`, `Kitchen_Med`
- User-based: `John_Med`, `Mary_Med`, `Dad_Med`
- Purpose-based: `Morning_Meds`, `Insulin_Alert`, `BP_Reminder`

## Multiple Device Management

For managing multiple devices:
1. Provision each ESP32 with unique name using this tool
2. Keep a record of which device name is assigned to which physical device
3. Label physical devices with their device names
4. Register all devices on the server under appropriate user accounts
5. Assign medicine schedules to specific devices based on user needs

## Re-provisioning a Device

To change a device name:
1. Upload `provisioning_tool.ino` again
2. Use option 1 to set a new device name
3. Update device name on the server (or register as new device)
4. Upload `medicine_reminder_node.ino` again

## Clearing EEPROM

To completely erase device name:
1. In provisioning tool, select option 3
2. Type `YES` to confirm
3. Device will be deprogrammed and ready for new provisioning
