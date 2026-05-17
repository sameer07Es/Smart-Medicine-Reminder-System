/*
 * Smart Medicine Reminder System - ESP32 Node
 * 
 * Hardware:
 * - ESP32 Board
 * - OLED Display (SSD1306) - I2C (SDA: GPIO21, SCL: GPIO22)
 * - Buzzer - GPIO 25
 * - Button - GPIO 14 (external button)
 * - DHT11 Sensor - GPIO 4 (optional for environment monitoring)
 * 
 * Features:
 * - Reads device name from EEPROM
 * - Fetches medicine schedule from server
 * - Beeps at medicine times
 * - Button press confirms medicine taken
 * - Sends intake status to server
 * - Displays status on OLED
 */

#include <WiFi.h>  // ESP32 Core
#define MQTT_MAX_PACKET_SIZE 4096
#include <PubSubClient.h>  // by Nick O'Leary
#include <Wire.h>  // Arduino Core (I2C)
#include <Adafruit_GFX.h>  // by Adafruit
#include <Adafruit_SSD1306.h>  // by Adafruit
#include <EEPROM.h>  // Arduino Core
#include <ArduinoJson.h>  // by Benoit Blanchon
#include <time.h>  // Standard C Library
#include <sys/time.h>  // settimeofday
#include "secrets.h"

// ==================== USER EDITABLE SETTINGS ====================
// WiFi Credentials
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

// Server Configuration
const char* mqttBrokerHost = MQTT_BROKER_HOST;  // LAN IP of the Mosquitto broker
const int mqttPort = MQTT_PORT;    // Local MQTT port

// Timezone offset for server-provided UTC epoch
const long gmtOffset_sec = GMT_OFFSET_SEC;  // IST = GMT+5:30 (5.5 * 3600)
const int daylightOffset_sec = DAYLIGHT_OFFSET_SEC;

// Device Name (Hardcoded)
const char* DEVICE_NAME = DEFAULT_DEVICE_NAME;  // Change this for each device

// Pin Definitions
#define BUZZER_PIN 25
#define BUTTON_PIN 14  // External button (avoid boot pin GPIO0)
#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C


// Timing Configuration
#define CHECK_INTERVAL 30000      // Check schedule every 30 seconds
#define DISPLAY_REFRESH_INTERVAL 1000 // Refresh clock on OLED every second
#define BEEP_DURATION 200         // Beep duration in ms
#define BEEP_INTERVAL 2000        // Beep every 2 seconds
#define SLOT_WINDOW_MINUTES 60    // User can confirm within this time window
#define ALERT_TIMEOUT (SLOT_WINDOW_MINUTES * 60UL * 1000UL)
#define HEARTBEAT_INTERVAL 30000  // Heartbeat every 30 seconds
#define MAX_SCHEDULE_ENTRIES 30

// ==================== APP CONSTANTS ====================

// ==================== OBJECTS ====================
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// ==================== VARIABLES ====================
String deviceName = DEVICE_NAME;  // Hardcoded device name
bool wifiConnected = false;
bool timeSync = false;

struct MedicineSchedule {
  String id;
  String name;
  String dosage;
  int hour;
  int minute;
  uint8_t daysMask;
  bool active;
};

MedicineSchedule medicines[MAX_SCHEDULE_ENTRIES];
int medicineCount = 0;

bool isAlertActive = false;
unsigned long alertStartTime = 0;
unsigned long lastBeepTime = 0;
unsigned long lastCheckTime = 0;
unsigned long lastDisplayRefreshTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastMqttReconnectAttempt = 0;
bool wasMqttConnected = false;
time_t baseEpochLocal = 0;
unsigned long baseEpochMillis = 0;
bool waitingForTimeSync = false;

String currentMedicineId = "";
String currentMedicineName = "";
int activeSlotHour = -1;
int activeSlotMinute = -1;
String activeSlotDate = "";
String lastTriggeredSlotKey = "";
int activeSlotIndices[MAX_SCHEDULE_ENTRIES];
int activeSlotCount = 0;
int takenToday = 0;
int missedToday = 0;

String twoDigits(int value) {
  if (value < 10) return "0" + String(value);
  return String(value);
}

String buildSlotKey(const String& date, int hour, int minute) {
  return date + "-" + twoDigits(hour) + ":" + twoDigits(minute);
}

time_t getCurrentEpochLocal() {
  if (!timeSync || baseEpochLocal <= 0) {
    return 0;
  }

  unsigned long elapsedSeconds = (millis() - baseEpochMillis) / 1000;
  return baseEpochLocal + elapsedSeconds;
}

bool isDayAllowed(const MedicineSchedule& med, int weekday) {
  return (med.daysMask & (1 << weekday)) != 0;
}

bool collectMedicinesForSlot(int weekday, int hour, int minute, int* outIndices, int& outCount) {
  outCount = 0;
  for (int i = 0; i < medicineCount; i++) {
    if (!medicines[i].active) continue;
    if (!isDayAllowed(medicines[i], weekday)) continue;
    if (medicines[i].hour != hour || medicines[i].minute != minute) continue;
    outIndices[outCount++] = i;
  }
  return outCount > 0;
}

String buildSlotMedicineSummary(const int* indices, int count) {
  if (count <= 0) return "No medicines";

  String text = "";
  for (int i = 0; i < count; i++) {
    if (i > 0) text += ", ";
    text += medicines[indices[i]].name;
    if (text.length() > 42) {
      text += "...";
      break;
    }
  }
  return text;
}

void logSlotIntake(const String& status) {
  if (activeSlotCount <= 0 || activeSlotHour < 0 || activeSlotMinute < 0 || activeSlotDate.length() == 0) {
    return;
  }

  String scheduledTime = activeSlotDate + "T" + twoDigits(activeSlotHour) + ":" + twoDigits(activeSlotMinute) + ":00";
  for (int i = 0; i < activeSlotCount; i++) {
    const MedicineSchedule& med = medicines[activeSlotIndices[i]];
    logIntake(med.id, status, scheduledTime);
  }
}

void findNextSlotDisplay(String& slotLabel, String& medsLabel) {
  slotLabel = "No schedule";
  medsLabel = "-";

  if (!timeSync || medicineCount == 0) return;

  time_t nowTs = getCurrentEpochLocal();
  if (nowTs <= 0) return;

  struct tm nowInfo;
  localtime_r(&nowTs, &nowInfo);

  int nowMinuteOfDay = nowInfo.tm_hour * 60 + nowInfo.tm_min;
  time_t baseNow = nowTs;

  for (int dayOffset = 0; dayOffset < 7; dayOffset++) {
    time_t dayTs = baseNow + (dayOffset * 24L * 60L * 60L);
    struct tm dayInfo;
    localtime_r(&dayTs, &dayInfo);

    int weekday = dayInfo.tm_wday;
    int bestIndex = -1;
    int bestMinute = 24 * 60 + 1;

    for (int i = 0; i < medicineCount; i++) {
      if (!medicines[i].active) continue;
      if (!isDayAllowed(medicines[i], weekday)) continue;

      int minuteOfDay = medicines[i].hour * 60 + medicines[i].minute;
      if (dayOffset == 0 && minuteOfDay <= nowMinuteOfDay) continue;
      if (minuteOfDay < bestMinute) {
        bestMinute = minuteOfDay;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      int slotHour = medicines[bestIndex].hour;
      int slotMinute = medicines[bestIndex].minute;
      int indices[MAX_SCHEDULE_ENTRIES];
      int count = 0;
      String dayDate = String(dayInfo.tm_year + 1900) + "-" + twoDigits(dayInfo.tm_mon + 1) + "-" + twoDigits(dayInfo.tm_mday);
      collectMedicinesForSlot(weekday, slotHour, slotMinute, indices, count);

      const char* dayNames[7] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
      slotLabel = String(dayNames[weekday]) + " " + twoDigits(slotHour) + ":" + twoDigits(slotMinute);
      medsLabel = buildSlotMedicineSummary(indices, count);
      return;
    }
  }
}

String mqttTopicFor(const String& tail) {
  return "smsr/device/" + deviceName + "/" + tail;
}

void mqttMessageCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  message.reserve(length + 1);

  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  String topicString = String(topic);
  if (topicString == mqttTopicFor("schedule")) {
    Serial.print("MQTT schedule received, bytes=");
    Serial.println(length);
    applyScheduleFromJson(message);
    return;
  }

  if (topicString == mqttTopicFor("time")) {
    DynamicJsonDocument doc(256);
    DeserializationError error = deserializeJson(doc, message);
    if (error) {
      Serial.print("Time payload JSON error: ");
      Serial.println(error.c_str());
      return;
    }

    time_t serverEpoch = doc["epoch"].as<time_t>();
    if (serverEpoch <= 0) {
      Serial.println("Invalid epoch in MQTT time payload");
      return;
    }

    time_t adjustedEpoch = serverEpoch + gmtOffset_sec + daylightOffset_sec;
    struct timeval tv = { adjustedEpoch, 0 };
    settimeofday(&tv, nullptr);

    baseEpochLocal = adjustedEpoch;
    baseEpochMillis = millis();
    timeSync = true;
    waitingForTimeSync = false;

    struct tm timeinfo;
    localtime_r(&baseEpochLocal, &timeinfo);
    Serial.println("Time synced successfully via MQTT");
    Serial.println(&timeinfo, "%A, %B %d %Y %H:%M:%S");
  }
}

bool connectMqtt() {
  if (!wifiConnected) return false;
  if (mqttClient.connected()) return true;

  Serial.print("Connecting MQTT to ");
  Serial.print(mqttBrokerHost);
  Serial.print(":");
  Serial.println(mqttPort);
  String clientId = "smsr-" + deviceName + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);

  if (mqttClient.connect(clientId.c_str())) {
    Serial.println("MQTT connected");
    if (mqttClient.subscribe(mqttTopicFor("schedule").c_str(), 1)) {
      Serial.println("MQTT subscribed: schedule");
    } else {
      Serial.println("MQTT subscribe failed: schedule");
    }
    if (mqttClient.subscribe(mqttTopicFor("time").c_str(), 1)) {
      Serial.println("MQTT subscribed: time");
    } else {
      Serial.println("MQTT subscribe failed: time");
    }
    requestMedicineSchedule();
    return true;
  }

  Serial.print("MQTT connect failed, rc=");
  Serial.println(mqttClient.state());
  return false;
}

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== Medicine Reminder System Starting ===");
  
  Serial.print("Device Name: ");
  Serial.println(DEVICE_NAME);
  
  Serial.print("Device Name: ");
  Serial.println(deviceName);
  
  // Initialize pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_BUILTIN, LOW);
  
  // Startup beep
  beep(100);
  delay(100);
  beep(100);
  
  // Initialize OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("SSD1306 allocation failed");
    while(1) {
      errorBeep();
      delay(2000);
    }
  }
  
  display.clearDisplay();
  displayMessage("Smart Medicine Reminder System", deviceName.c_str(), "Starting...");
  display.display();
  delay(2000);
  
  // Connect to WiFi
  connectWiFi();

  mqttClient.setServer(mqttBrokerHost, mqttPort);
  mqttClient.setBufferSize(4096);
  mqttClient.setKeepAlive(30);
  mqttClient.setSocketTimeout(5);
  mqttClient.setCallback(mqttMessageCallback);
  
  // Sync time via MQTT
  if (wifiConnected) {
    connectMqtt();
    syncTime();
    requestMedicineSchedule();
  }
  
  Serial.println("=== Setup Complete ===\n");
  updateMainDisplay();
}

// ==================== MAIN LOOP ====================
void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    connectWiFi();
    if (wifiConnected) {
      connectMqtt();
      syncTime();
      requestMedicineSchedule();
    }
  }

  if (wifiConnected) {
    if (!mqttClient.connected() && millis() - lastMqttReconnectAttempt >= 5000) {
      lastMqttReconnectAttempt = millis();
      if (wasMqttConnected) {
        Serial.println("MQTT disconnected, attempting reconnect...");
      }
      wasMqttConnected = false;
      connectMqtt();
    }

    if (mqttClient.connected()) {
      if (!wasMqttConnected) {
        Serial.println("MQTT session active");
      }
      wasMqttConnected = true;
      mqttClient.loop();
    }
  }
  
  // Check button press
  if (digitalRead(BUTTON_PIN) == LOW) {
    handleButtonPress();
    delay(500);  // Debounce
  }
  
  // Handle active alert
  if (isAlertActive) {
    handleAlert();
  }
  
  // Check medicine schedule periodically
  if (millis() - lastCheckTime >= CHECK_INTERVAL && !isAlertActive) {
    lastCheckTime = millis();
    checkMedicineSchedule();
  }

  // Refresh display clock independently of schedule polling.
  if (!isAlertActive && millis() - lastDisplayRefreshTime >= DISPLAY_REFRESH_INTERVAL) {
    lastDisplayRefreshTime = millis();
    updateMainDisplay();
  }

  // Send heartbeat
  if (wifiConnected && millis() - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = millis();
    publishHeartbeat();
  }
  
  delay(100);
}


// ==================== WIFI FUNCTIONS ====================
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  
  displayMessage("WiFi", "Connecting...", ssid);
  
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\nWiFi Connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    
    displayMessage("WiFi Connected", WiFi.localIP().toString().c_str(), "");
    successBeep();
    delay(2000);
  } else {
    wifiConnected = false;
    Serial.println("\nWiFi Failed!");
    displayMessage("WiFi Failed", "Retrying...", "");
    errorBeep();
  }
}

void requestMedicineSchedule() {
  if (mqttClient.connected()) {
    DynamicJsonDocument doc(128);
    doc["request"] = "schedule";
    doc["ts"] = getCurrentDate() + "T" + getCurrentTime();

    String payload;
    serializeJson(doc, payload);
    mqttClient.publish(mqttTopicFor("schedule/request").c_str(), payload.c_str(), false);
    Serial.println("Requested schedule via MQTT");
    return;
  }

  Serial.println("Skipped schedule request: MQTT not connected");
}

void publishHeartbeat() {
  DynamicJsonDocument doc(256);
  doc["deviceName"] = deviceName;
  doc["status"] = "active";
  doc["ts"] = getCurrentDate() + "T" + getCurrentTime();

  String payload;
  serializeJson(doc, payload);

  if (mqttClient.connected()) {
    mqttClient.publish(mqttTopicFor("heartbeat").c_str(), payload.c_str(), false);
    Serial.println("Heartbeat published via MQTT");
    return;
  }

  Serial.println("Skipped heartbeat: MQTT not connected");
}

void applyScheduleFromJson(const String& payload) {
  DynamicJsonDocument doc(4096);
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    errorBeep();
    return;
  }

  medicineCount = 0;
  JsonArray array = doc.as<JsonArray>();

  for (JsonObject obj : array) {
    String medId = obj["_id"].as<String>();
    String medName = obj["name"].as<String>();
    String medDosage = obj["dosage"].as<String>();
    bool medActive = obj["active"].isNull() ? true : obj["active"].as<bool>();

    uint8_t daysMask = 0;
    if (obj["days"].is<JsonArray>()) {
      JsonArray days = obj["days"].as<JsonArray>();
      for (JsonVariant d : days) {
        int day = d.as<int>();
        if (day >= 0 && day <= 6) {
          daysMask |= (1 << day);
        }
      }
    }
    if (daysMask == 0) {
      daysMask = 0x7F;
    }

    JsonArray times = obj["times"];
    for (JsonObject time : times) {
      if (medicineCount >= MAX_SCHEDULE_ENTRIES) break;
      medicines[medicineCount].id = medId;
      medicines[medicineCount].name = medName;
      medicines[medicineCount].dosage = medDosage;
      medicines[medicineCount].active = medActive;
      medicines[medicineCount].daysMask = daysMask;
      medicines[medicineCount].hour = time["hour"];
      medicines[medicineCount].minute = time["minute"];
      medicineCount++;
    }

    if (medicineCount >= MAX_SCHEDULE_ENTRIES) break;
  }

  Serial.print("Loaded ");
  Serial.print(medicineCount);
  Serial.println(" medicine times");

  displayMessage("Schedule Loaded", (String(medicineCount) + " medicines").c_str(), "");
  successBeep();
  delay(1000);
}

// ==================== TIME FUNCTIONS ====================
void syncTime() {
  Serial.println("Syncing time with MQTT (max 10s)...");
  displayMessage("Time Sync", "MQTT time", "");

  if (!wifiConnected || !mqttClient.connected()) {
    timeSync = false;
    Serial.println("Time sync failed: MQTT not connected");
    displayMessage("Time Sync", "Failed", "No MQTT");
    errorBeep();
    delay(1000);
    return;
  }

  waitingForTimeSync = true;
  timeSync = false;

  DynamicJsonDocument doc(128);
  doc["request"] = "time";
  doc["ts"] = getCurrentDate() + "T" + getCurrentTime();

  String payload;
  serializeJson(doc, payload);
  mqttClient.publish(mqttTopicFor("time/request").c_str(), payload.c_str(), false);

  const unsigned long startMs = millis();
  while (waitingForTimeSync && (millis() - startMs) < 10000) {
    mqttClient.loop();
    delay(100);
  }

  if (timeSync) {
    displayMessage("Time Synced", "MQTT", "Success");
    successBeep();
    delay(1000);
    return;
  }

  waitingForTimeSync = false;
  Serial.println("Time sync failed (timeout 10s)");
  displayMessage("Time Sync", "Failed", "Timeout 10s");
  errorBeep();
  delay(1000);
}

String getCurrentTime() {
  time_t nowTs = getCurrentEpochLocal();
  if (nowTs <= 0) {
    return "Time N/A";
  }

  struct tm timeinfo;
  localtime_r(&nowTs, &timeinfo);
  
  char buffer[20];
  strftime(buffer, sizeof(buffer), "%H:%M:%S", &timeinfo);
  return String(buffer);
}

String getCurrentDate() {
  time_t nowTs = getCurrentEpochLocal();
  if (nowTs <= 0) {
    return "Date N/A";
  }

  struct tm timeinfo;
  localtime_r(&nowTs, &timeinfo);
  
  char buffer[20];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d", &timeinfo);
  return String(buffer);
}

void logIntake(String medicineId, String status, String scheduledTime) {
  if (!wifiConnected) return;
  
  Serial.println("Logging intake: " + status);
  
  // Create JSON payload
  DynamicJsonDocument doc(512);
  doc["deviceName"] = deviceName;
  doc["medicineId"] = medicineId;
  doc["status"] = status;
  doc["scheduledTime"] = scheduledTime;
  
  String payload;
  serializeJson(doc, payload);

  if (mqttClient.connected()) {
    mqttClient.publish(mqttTopicFor("intake").c_str(), payload.c_str(), false);
    Serial.println("Intake logged via MQTT");
    if (status == "taken") {
      takenToday++;
    } else if (status == "missed") {
      missedToday++;
    }
    return;
  }

  Serial.println("Skipped intake log: MQTT not connected");
}

// ==================== MEDICINE SCHEDULE CHECK ====================
void checkMedicineSchedule() {
  if (!timeSync || medicineCount == 0) return;
  
  time_t nowTs = getCurrentEpochLocal();
  if (nowTs <= 0) return;

  struct tm timeinfo;
  localtime_r(&nowTs, &timeinfo);
  
  int currentHour = timeinfo.tm_hour;
  int currentMinute = timeinfo.tm_min;
  int weekday = timeinfo.tm_wday;
  String currentDate = getCurrentDate();
  String slotKey = buildSlotKey(currentDate, currentHour, currentMinute);

  if (slotKey == lastTriggeredSlotKey) {
    return;
  }
  
  int indices[MAX_SCHEDULE_ENTRIES];
  int count = 0;
  if (collectMedicinesForSlot(weekday, currentHour, currentMinute, indices, count)) {
    lastTriggeredSlotKey = slotKey;
    isAlertActive = true;
    alertStartTime = millis();
    lastBeepTime = 0;
    activeSlotHour = currentHour;
    activeSlotMinute = currentMinute;
    activeSlotDate = currentDate;
    activeSlotCount = count;
    for (int i = 0; i < count; i++) {
      activeSlotIndices[i] = indices[i];
    }

    currentMedicineId = medicines[activeSlotIndices[0]].id;
    currentMedicineName = medicines[activeSlotIndices[0]].name;

    Serial.print("ALERT SLOT: ");
    Serial.print(twoDigits(activeSlotHour));
    Serial.print(":");
    Serial.print(twoDigits(activeSlotMinute));
    Serial.print(" -> ");
    Serial.print(activeSlotCount);
    Serial.println(" medicines");
    displayAlert();
  }
}

void handleAlert() {
  unsigned long currentTime = millis();
  
  // Check timeout
  if (currentTime - alertStartTime >= ALERT_TIMEOUT) {
    Serial.println("Slot window ended - marking slot as missed");
    logSlotIntake("missed");
    stopAlert();
    return;
  }
  
  // Beep periodically
  if (currentTime - lastBeepTime >= BEEP_INTERVAL) {
    lastBeepTime = currentTime;
    alertBeep();
  }
}

void stopAlert() {
  isAlertActive = false;
  currentMedicineId = "";
  currentMedicineName = "";
  activeSlotHour = -1;
  activeSlotMinute = -1;
  activeSlotDate = "";
  activeSlotCount = 0;
  updateMainDisplay();
}

// ==================== BUTTON HANDLING ====================
void handleButtonPress() {
  if (!isAlertActive) {
    // Button pressed but no alert - show menu or status
    Serial.println("Button pressed - no alert active");
    return;
  }
  
  // Medicine taken!
  Serial.println("User confirmed current medicine slot");
  logSlotIntake("taken");
  
  displayMessage("Slot Confirmed", "All meds marked", "Thank You!");
  successBeep();
  delay(2000);
  
  stopAlert();
}

// ==================== DISPLAY FUNCTIONS ====================
void displayMessage(const char* line1, const char* line2, const char* line3) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  display.setCursor(0, 10);
  display.println(line1);
  
  display.setCursor(0, 30);
  display.println(line2);
  
  display.setCursor(0, 50);
  display.println(line3);
  
  display.display();
}

void updateMainDisplay() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // Title
  display.setCursor(0, 0);
  display.println("Smart Medicine Reminder System");
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  
  // Time
  display.setCursor(0, 15);
  display.print("Time: ");
  display.println(getCurrentTime());
  
  // WiFi status
  display.setCursor(0, 28);
  display.print("WiFi: ");
  display.println(wifiConnected ? "OK" : "X");
  
  // Today's status
  display.setCursor(0, 41);
  String nextSlot;
  String nextMeds;
  findNextSlotDisplay(nextSlot, nextMeds);
  display.print("Next meds: ");
  if (nextMeds.length() > 14) {
    display.println(nextMeds.substring(0, 14));
  } else {
    display.println(nextMeds);
  }
  
  // Next slot
  display.setCursor(0, 54);
  display.print("Next: ");
  display.println(nextSlot);
  
  display.display();
}

void displayAlert() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  display.setCursor(0, 0);
  display.println("TIME FOR MEDICINES");
  
  display.setCursor(0, 14);
  display.print("Slot: ");
  display.print(twoDigits(activeSlotHour));
  display.print(":");
  display.println(twoDigits(activeSlotMinute));

  display.setCursor(0, 28);
  display.print("Meds: ");
  display.println(activeSlotCount);

  display.setCursor(0, 42);
  display.println(buildSlotMedicineSummary(activeSlotIndices, activeSlotCount));
  
  display.setCursor(0, 56);
  display.println("Press Button to Confirm");
  
  display.display();
}

// ==================== BUZZER FUNCTIONS ====================
void beep(int duration) {
  digitalWrite(BUZZER_PIN, HIGH);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(duration);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_BUILTIN, LOW);
}

void successBeep() {
  beep(100);
  delay(100);
  beep(100);
}

void errorBeep() {
  beep(500);
  delay(100);
  beep(500);
}

void alertBeep() {
  for (int i = 0; i < 3; i++) {
    beep(BEEP_DURATION);
    delay(150);
  }
}
