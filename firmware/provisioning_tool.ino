/*
 * ESP32 EEPROM Provisioning Tool
 * Writes device name to EEPROM for Medicine Reminder System
 * 
 * Usage:
 * 1. Upload this sketch to ESP32
 * 2. Open Serial Monitor (115200 baud)
 * 3. Type device name (e.g., "MED_001" or "JohnMedicineBox")
 * 4. Press Enter
 * 5. Device name is saved to EEPROM
 * 6. Upload main medicine reminder sketch
 * 
 * EEPROM Memory Map:
 * Address 0-63: Device Name (max 64 characters)
 */

#include <EEPROM.h>

#define EEPROM_SIZE 512
#define DEVICE_NAME_ADDR 0
#define DEVICE_NAME_MAX_LEN 64

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=====================================");
  Serial.println("ESP32 EEPROM Provisioning Tool");
  Serial.println("Medicine Reminder System");
  Serial.println("=====================================\n");
  
  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  
  // Check if device already has a name
  String existingName = readDeviceName();
  
  if (existingName.length() > 0) {
    Serial.println("Current device name: " + existingName);
  } else {
    Serial.println("No device name found in EEPROM");
  }
  
  Serial.println("\n--- Menu ---");
  Serial.println("1. Set new device name");
  Serial.println("2. Read current device name");
  Serial.println("3. Clear EEPROM");
  Serial.println("\nEnter command: 1, 2, or 3");
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    
    if (input == "1") {
      writeNewDeviceName();
    } else if (input == "2") {
      readAndDisplayDeviceName();
    } else if (input == "3") {
      clearEEPROM();
    } else {
      Serial.println("Invalid command. Please enter 1, 2, or 3");
    }
    
    // Show menu again
    Serial.println("\n--- Menu ---");
    Serial.println("1. Set new device name");
    Serial.println("2. Read current device name");
    Serial.println("3. Clear EEPROM");
    Serial.println("\nEnter command:");
  }
}

void writeNewDeviceName() {
  Serial.println("\n=== Set Device Name ===");
  Serial.println("Enter device name (max 63 characters):");
  Serial.println("Examples: MED_001, JohnMedicineBox, Room1Device");
  Serial.println("Waiting for input...");
  
  // Wait for input
  while (Serial.available() == 0) {
    delay(100);
  }
  
  String deviceName = Serial.readStringUntil('\n');
  deviceName.trim();
  
  if (deviceName.length() == 0) {
    Serial.println("ERROR: Empty name not allowed");
    return;
  }
  
  if (deviceName.length() > DEVICE_NAME_MAX_LEN - 1) {
    Serial.println("ERROR: Name too long (max 63 characters)");
    return;
  }
  
  // Write device name to EEPROM
  Serial.println("\nWriting to EEPROM: " + deviceName);
  
  // Clear the area first
  for (int i = 0; i < DEVICE_NAME_MAX_LEN; i++) {
    EEPROM.write(DEVICE_NAME_ADDR + i, 0);
  }
  
  // Write new name
  for (int i = 0; i < deviceName.length(); i++) {
    EEPROM.write(DEVICE_NAME_ADDR + i, deviceName[i]);
  }
  
  // Write null terminator
  EEPROM.write(DEVICE_NAME_ADDR + deviceName.length(), '\0');
  
  // Commit to EEPROM
  if (EEPROM.commit()) {
    Serial.println("SUCCESS: Device name saved!");
    Serial.println("Device name: " + deviceName);
    Serial.println("\nYou can now upload the main medicine reminder sketch.");
    
    // Verify by reading back
    String verify = readDeviceName();
    if (verify == deviceName) {
      Serial.println("Verification: PASSED ✓");
    } else {
      Serial.println("Verification: FAILED ✗");
      Serial.println("Expected: " + deviceName);
      Serial.println("Got: " + verify);
    }
  } else {
    Serial.println("ERROR: Failed to save to EEPROM");
  }
}

void readAndDisplayDeviceName() {
  Serial.println("\n=== Read Device Name ===");
  
  String name = readDeviceName();
  
  if (name.length() > 0) {
    Serial.println("Device name: " + name);
    Serial.println("Length: " + String(name.length()) + " characters");
    
    // Show hex dump
    Serial.println("\nHex dump (first 32 bytes):");
    for (int i = 0; i < 32; i++) {
      byte b = EEPROM.read(DEVICE_NAME_ADDR + i);
      if (b < 16) Serial.print("0");
      Serial.print(b, HEX);
      Serial.print(" ");
      if ((i + 1) % 16 == 0) Serial.println();
    }
  } else {
    Serial.println("No device name found in EEPROM");
  }
}

void clearEEPROM() {
  Serial.println("\n=== Clear EEPROM ===");
  Serial.println("Are you sure? This will erase the device name.");
  Serial.println("Type YES to confirm:");
  
  // Wait for confirmation
  unsigned long startTime = millis();
  while (Serial.available() == 0 && millis() - startTime < 10000) {
    delay(100);
  }
  
  if (Serial.available() == 0) {
    Serial.println("Timeout - operation cancelled");
    return;
  }
  
  String confirm = Serial.readStringUntil('\n');
  confirm.trim();
  
  if (confirm == "YES") {
    Serial.println("Clearing EEPROM...");
    
    for (int i = 0; i < DEVICE_NAME_MAX_LEN; i++) {
      EEPROM.write(DEVICE_NAME_ADDR + i, 0xFF);
    }
    
    if (EEPROM.commit()) {
      Serial.println("SUCCESS: EEPROM cleared");
    } else {
      Serial.println("ERROR: Failed to clear EEPROM");
    }
  } else {
    Serial.println("Operation cancelled");
  }
}

String readDeviceName() {
  String name = "";
  
  for (int i = 0; i < DEVICE_NAME_MAX_LEN; i++) {
    char c = EEPROM.read(DEVICE_NAME_ADDR + i);
    
    // Stop at null terminator or empty EEPROM (0xFF)
    if (c == '\0' || c == 0xFF) {
      break;
    }
    
    name += c;
  }
  
  return name;
}
