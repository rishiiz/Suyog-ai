/**
 * Suyog AI — Elder Care Monitor & Medicine Reminder
 * ESP32 Production Hub Firmware
 * Target: ESP32 DevKit V1 (30-pin)
 *
 * Conforms strictly to PRD Section 5 & 6.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>

#include "config.h"

// If secrets.h exists, include it; otherwise fall back to defaults
#if __has_include("secrets.h")
  #include "secrets.h"
#else
  #define WIFI_SSID       "Demo_WiFi"
  #define WIFI_PASSWORD   "Demo_Password"
  #define MQTT_BROKER     "broker.hivemq.com"
  #define MQTT_PORT       1883
  #define MQTT_CLIENT_ID  "careguard_hub_001"
  #define MQTT_USER       ""
  #define MQTT_PASS       ""
  #define DEVICE_ID       "cg_device_001"
#endif

// Hardware objects
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WiFiClient espClient;
PubSubClient mqttClient(espClient);
Preferences prefs;

// MQTT Topics
String topicMotion    = String("careguard/") + DEVICE_ID + "/motion";
String topicButton    = String("careguard/") + DEVICE_ID + "/button";
String topicPill      = String("careguard/") + DEVICE_ID + "/pill";
String topicHeartbeat = String("careguard/") + DEVICE_ID + "/heartbeat";
String topicCmd       = String("careguard/") + DEVICE_ID + "/cmd";

// System state
bool pirWarmedUp = false;
unsigned long bootTimeMs = 0;
unsigned long lastHeartbeatMs = 0;
unsigned long lastMqttRetryMs = 0;
unsigned long mqttRetryInterval = 2000; // Exponential backoff: 2s up to 60s

// PIR state & cooldowns
int lastPirBedroom = LOW;
int lastPirLiving  = LOW;
unsigned long lastBedroomReportMs = 0;
unsigned long lastLivingReportMs  = 0;

// Button state & debounce
int panicState = HIGH;
int lastPanicReading = HIGH;
unsigned long panicPressStartMs = 0;
bool panicTriggered = false;

int confirmState = HIGH;
int lastConfirmReading = HIGH;
unsigned long confirmDebounceMs = 0;

// Reed switch state (HIGH = Magnet away / lid opened)
int lastReed1State = LOW;
int lastReed2State = LOW;

// Reminder & Alert Engine
enum DeviceMode {
  MODE_IDLE,
  MODE_REMINDER,
  MODE_ALERT_STAGE0,
  MODE_EMERGENCY
};

DeviceMode currentMode = MODE_IDLE;
String activeMedicine = "";
String activeDose = "";
unsigned long reminderStartMs = 0;
unsigned long lastReminderBeepMs = 0;
unsigned long greenLedUntilMs = 0;
unsigned long buzzerUntilMs = 0;

// Beep pattern variables
bool isBeeping = false;
int beepCount = 0;
unsigned long nextBeepToggleMs = 0;

// Function declarations
void setupDisplay();
void setupPins();
void connectWiFi();
void connectMQTT();
void syncNTP();
void updateOLED();
void handleButtons();
void handlePIRs();
void handleReedSwitches();
void handleHeartbeat();
void handleBuzzerPattern();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void triggerLocalAlert(const String& reason);
void startReminder(const String& medicine, const String& dose);
void stopReminder(bool confirmedByElder);
void soundBuzzerTone(unsigned int durationMs);

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[SuyogAI] Starting Hub Firmware v" FIRMWARE_VERSION);

  bootTimeMs = millis();

  setupPins();
  setupDisplay();

  // Initialize NVS Preferences for local schedule caching
  prefs.begin("careguard", false);

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 20);
  display.println("Suyog AI Starting...");
  display.setCursor(10, 36);
  display.println("Connecting Wi-Fi...");
  display.display();

  connectWiFi();
  syncNTP();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  connectMQTT();

  Serial.println("[SuyogAI] Setup complete. Warmup in progress...");
}

void setupPins() {
  pinMode(PIN_PIR_BEDROOM, INPUT);
  pinMode(PIN_PIR_LIVINGROOM, INPUT);

  pinMode(PIN_BTN_PANIC, INPUT_PULLUP);
  pinMode(PIN_BTN_CONFIRM, INPUT_PULLUP);

  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  pinMode(PIN_LED_RED, OUTPUT);
  digitalWrite(PIN_LED_RED, LOW);

  pinMode(PIN_LED_GREEN, OUTPUT);
  digitalWrite(PIN_LED_GREEN, LOW);

  // Reed switches on input-only GPIOs (external pull-ups required)
  pinMode(PIN_REED_BOX1, INPUT);
  pinMode(PIN_REED_BOX2, INPUT);
}

void setupDisplay() {
  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    Serial.println("[SuyogAI] Warning: SSD1306 allocation failed. Check I2C wiring.");
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(16, 24);
    display.println("Suyog AI Hub");
    display.display();
  }
}

void connectWiFi() {
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    delay(250);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] Connection timeout. Operating in offline/fallback mode.");
  }
}

void syncNTP() {
  if (WiFi.status() == WL_CONNECTED) {
    configTime(NTP_OFFSET_SECONDS, NTP_DAYLIGHT_OFFSET, "pool.ntp.org", "time.google.com");
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 5000)) {
      Serial.printf("[NTP] Time synchronized: %02d:%02d:%02d\n",
                    timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
    } else {
      Serial.println("[NTP] Failed to obtain time.");
    }
  }
}

void connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  unsigned long now = millis();
  if (now - lastMqttRetryMs < mqttRetryInterval) return;
  lastMqttRetryMs = now;

  Serial.printf("[MQTT] Connecting to %s:%d as %s...\n", MQTT_BROKER, MQTT_PORT, MQTT_CLIENT_ID);
  bool ok = false;
  if (strlen(MQTT_USER) > 0) {
    ok = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS);
  } else {
    ok = mqttClient.connect(MQTT_CLIENT_ID);
  }

  if (ok) {
    Serial.println("[MQTT] Connected successfully!");
    mqttClient.subscribe(topicCmd.c_str());
    mqttRetryInterval = 2000; // Reset backoff

    // Publish initial online announcement
    StaticJsonDocument<128> doc;
    doc["event"] = "online";
    doc["fw"] = FIRMWARE_VERSION;
    doc["rssi"] = WiFi.RSSI();
    char buffer[128];
    serializeJson(doc, buffer);
    mqttClient.publish(topicHeartbeat.c_str(), buffer);
  } else {
    Serial.printf("[MQTT] Connect failed, rc=%d. Backing off.\n", mqttClient.state());
    mqttRetryInterval = min(mqttRetryInterval * 2, 60000UL); // Max 60s backoff
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char message[256];
  if (length >= sizeof(message)) length = sizeof(message) - 1;
  memcpy(message, payload, length);
  message[length] = '\0';

  Serial.printf("[MQTT RX] %s -> %s\n", topic, message);

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, message);
  if (err) {
    Serial.println("[MQTT] JSON parse error");
    return;
  }

  const char* cmd = doc["cmd"] | "";

  if (strcmp(cmd, "reminder_start") == 0) {
    const char* med = doc["medicine"] | "Medicine";
    const char* dose = doc["dose"] | "Take 1 dose";
    startReminder(String(med), String(dose));
  } else if (strcmp(cmd, "reminder_stop") == 0) {
    stopReminder(false);
  } else if (strcmp(cmd, "local_alert") == 0) {
    triggerLocalAlert(doc["reason"] | "Emergency Alert");
  } else if (strcmp(cmd, "sync_schedule") == 0) {
    // Cache local schedule in NVS for offline fallback
    if (doc.containsKey("schedule")) {
      String schedJson = doc["schedule"].as<String>();
      prefs.putString("offline_sched", schedJson);
      Serial.println("[NVS] Offline schedule cached.");
    }
  }
}

void loop() {
  unsigned long now = millis();

  // Check PIR warm-up (60s after boot)
  if (!pirWarmedUp && (now - bootTimeMs >= PIR_WARMUP_MS)) {
    pirWarmedUp = true;
    Serial.println("[SuyogAI] PIR sensor warm-up complete. Motion detection active.");
  }

  // Non-blocking Wi-Fi & MQTT maintenance
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      connectMQTT();
    } else {
      mqttClient.loop();
    }
  }

  handleButtons();
  handlePIRs();
  handleReedSwitches();
  handleHeartbeat();
  handleBuzzerPattern();
  updateOLED();

  // Green LED timeout check (5 seconds after confirmation)
  if (greenLedUntilMs > 0 && now >= greenLedUntilMs) {
    digitalWrite(PIN_LED_GREEN, LOW);
    greenLedUntilMs = 0;
  }
}

void handleButtons() {
  unsigned long now = millis();

  // 1. Panic Button (Active LOW, GPIO 32)
  // Requires 2000ms continuous press to prevent accidental triggers (PRD Section 6)
  int panicReading = digitalRead(PIN_BTN_PANIC);
  if (panicReading == LOW) {
    if (lastPanicReading == HIGH) {
      panicPressStartMs = now;
      panicTriggered = false;
    } else if (!panicTriggered && (now - panicPressStartMs >= PANIC_LONG_PRESS_MS)) {
      panicTriggered = true;
      Serial.println("[Button] Panic button LONG PRESS detected! Sending SOS.");

      // Local buzzer feedback for panic
      soundBuzzerTone(1000);
      currentMode = MODE_EMERGENCY;

      StaticJsonDocument<128> doc;
      doc["type"] = "panic";
      doc["ts"] = now / 1000;
      char buffer[128];
      serializeJson(doc, buffer);
      if (mqttClient.connected()) {
        mqttClient.publish(topicButton.c_str(), buffer);
      }
    }
  }
  lastPanicReading = panicReading;

  // 2. Confirm Button (Active LOW, GPIO 33)
  // Short press with 50ms software debounce
  int confirmReading = digitalRead(PIN_BTN_CONFIRM);
  if (confirmReading != lastConfirmReading) {
    confirmDebounceMs = now;
  }
  if ((now - confirmDebounceMs) > DEBOUNCE_MS) {
    if (confirmReading != confirmState) {
      confirmState = confirmReading;
      if (confirmState == LOW) { // Button pressed
        Serial.println("[Button] Confirm button pressed.");

        if (currentMode == MODE_REMINDER) {
          stopReminder(true);
        } else if (currentMode == MODE_ALERT_STAGE0) {
          // Stage 0 cancel window: elder pressed "I'm OK"
          Serial.println("[Button] Stage 0 alert CANCELLED by elder.");
          currentMode = MODE_IDLE;
          digitalWrite(PIN_BUZZER, LOW);
          digitalWrite(PIN_LED_RED, LOW);

          // Green LED on for 5 seconds
          digitalWrite(PIN_LED_GREEN, HIGH);
          greenLedUntilMs = now + 5000;

          StaticJsonDocument<128> doc;
          doc["type"] = "confirm";
          doc["context"] = "cancel_stage0";
          doc["ts"] = now / 1000;
          char buffer[128];
          serializeJson(doc, buffer);
          if (mqttClient.connected()) {
            mqttClient.publish(topicButton.c_str(), buffer);
          }
        } else {
          // General "I am OK" check-in
          digitalWrite(PIN_LED_GREEN, HIGH);
          greenLedUntilMs = now + 5000;

          StaticJsonDocument<128> doc;
          doc["type"] = "confirm";
          doc["context"] = "checkin";
          doc["ts"] = now / 1000;
          char buffer[128];
          serializeJson(doc, buffer);
          if (mqttClient.connected()) {
            mqttClient.publish(topicButton.c_str(), buffer);
          }
        }
      }
    }
  }
  lastConfirmReading = confirmReading;
}

void handlePIRs() {
  if (!pirWarmedUp) return;
  unsigned long now = millis();

  // Bedroom PIR (GPIO 27)
  int bedReading = digitalRead(PIN_PIR_BEDROOM);
  if (bedReading != lastPirBedroom && (now - lastBedroomReportMs >= PIR_COOLDOWN_MS)) {
    lastPirBedroom = bedReading;
    lastBedroomReportMs = now;
    if (bedReading == HIGH) {
      Serial.println("[PIR] Motion in Bedroom");
      StaticJsonDocument<128> doc;
      doc["room"] = "bedroom";
      doc["state"] = 1;
      doc["ts"] = now / 1000;
      char buf[128];
      serializeJson(doc, buf);
      if (mqttClient.connected()) mqttClient.publish(topicMotion.c_str(), buf);
    }
  }

  // Living Room PIR (GPIO 26)
  int livingReading = digitalRead(PIN_PIR_LIVINGROOM);
  if (livingReading != lastPirLiving && (now - lastLivingReportMs >= PIR_COOLDOWN_MS)) {
    lastPirLiving = livingReading;
    lastLivingReportMs = now;
    if (livingReading == HIGH) {
      Serial.println("[PIR] Motion in Living Room");
      StaticJsonDocument<128> doc;
      doc["room"] = "livingroom";
      doc["state"] = 1;
      doc["ts"] = now / 1000;
      char buf[128];
      serializeJson(doc, buf);
      if (mqttClient.connected()) mqttClient.publish(topicMotion.c_str(), buf);
    }
  }
}

void handleReedSwitches() {
  unsigned long now = millis();

  // Reed switch 1 (Box 1, GPIO 34)
  int r1 = digitalRead(PIN_REED_BOX1);
  if (r1 != lastReed1State) {
    lastReed1State = r1;
    if (r1 == HIGH) { // Lid opened
      Serial.println("[PillBox] Box 1 opened");
      StaticJsonDocument<128> doc;
      doc["compartment"] = 1;
      doc["state"] = "opened";
      doc["ts"] = now / 1000;
      char buf[128];
      serializeJson(doc, buf);
      if (mqttClient.connected()) mqttClient.publish(topicPill.c_str(), buf);

      if (currentMode == MODE_REMINDER) {
        stopReminder(true);
      }
    }
  }

  // Reed switch 2 (Box 2, GPIO 35)
  int r2 = digitalRead(PIN_REED_BOX2);
  if (r2 != lastReed2State) {
    lastReed2State = r2;
    if (r2 == HIGH) { // Lid opened
      Serial.println("[PillBox] Box 2 opened");
      StaticJsonDocument<128> doc;
      doc["compartment"] = 2;
      doc["state"] = "opened";
      doc["ts"] = now / 1000;
      char buf[128];
      serializeJson(doc, buf);
      if (mqttClient.connected()) mqttClient.publish(topicPill.c_str(), buf);

      if (currentMode == MODE_REMINDER) {
        stopReminder(true);
      }
    }
  }
}

void handleHeartbeat() {
  unsigned long now = millis();
  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL) {
    lastHeartbeatMs = now;

    StaticJsonDocument<128> doc;
    doc["rssi"] = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
    doc["uptime"] = now / 1000;
    doc["fw"] = FIRMWARE_VERSION;
    char buf[128];
    serializeJson(doc, buf);
    if (mqttClient.connected()) {
      mqttClient.publish(topicHeartbeat.c_str(), buf);
    }
    Serial.printf("[Heartbeat] Sent. Uptime: %lu s, RSSI: %d dBm\n", doc["uptime"].as<unsigned long>(), doc["rssi"].as<int>());
  }
}

void startReminder(const String& medicine, const String& dose) {
  currentMode = MODE_REMINDER;
  activeMedicine = medicine;
  activeDose = dose;
  reminderStartMs = millis();
  lastReminderBeepMs = 0;

  digitalWrite(PIN_LED_RED, HIGH);
  Serial.printf("[Reminder] Started for %s (%s)\n", medicine.c_str(), dose.c_str());
}

void stopReminder(bool confirmedByElder) {
  currentMode = MODE_IDLE;
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);
  isBeeping = false;

  if (confirmedByElder) {
    digitalWrite(PIN_LED_GREEN, HIGH);
    greenLedUntilMs = millis() + 5000; // 5 seconds green light

    StaticJsonDocument<128> doc;
    doc["type"] = "confirm";
    doc["context"] = "medicine_taken";
    doc["medicine"] = activeMedicine;
    doc["ts"] = millis() / 1000;
    char buf[128];
    serializeJson(doc, buf);
    if (mqttClient.connected()) {
      mqttClient.publish(topicButton.c_str(), buf);
    }
    Serial.printf("[Reminder] Confirmed: %s taken!\n", activeMedicine.c_str());
  } else {
    Serial.println("[Reminder] Stopped by server command.");
  }
  activeMedicine = "";
  activeDose = "";
}

void triggerLocalAlert(const String& reason) {
  currentMode = MODE_ALERT_STAGE0;
  digitalWrite(PIN_LED_RED, HIGH);
  soundBuzzerTone(2000);
  Serial.printf("[Alert] Stage 0 Local Alert: %s. Awaiting green button.\n", reason.c_str());
}

void soundBuzzerTone(unsigned int durationMs) {
  digitalWrite(PIN_BUZZER, HIGH);
  buzzerUntilMs = millis() + durationMs;
}

void handleBuzzerPattern() {
  unsigned long now = millis();

  // Turn off single-shot buzzer after timeout
  if (buzzerUntilMs > 0 && now >= buzzerUntilMs) {
    digitalWrite(PIN_BUZZER, LOW);
    buzzerUntilMs = 0;
  }

  // Periodic reminder chime (beeps 3 times every 30 seconds)
  if (currentMode == MODE_REMINDER) {
    if (!isBeeping && (now - lastReminderBeepMs >= REMINDER_BEEP_MS)) {
      isBeeping = true;
      beepCount = 0;
      nextBeepToggleMs = now;
      lastReminderBeepMs = now;
    }

    if (isBeeping && now >= nextBeepToggleMs) {
      if (beepCount < 6) { // 3 on-off cycles
        bool turnOn = (beepCount % 2 == 0);
        digitalWrite(PIN_BUZZER, turnOn ? HIGH : LOW);
        beepCount++;
        nextBeepToggleMs = now + (turnOn ? 150 : 100); // 150ms beep, 100ms silence
      } else {
        digitalWrite(PIN_BUZZER, LOW);
        isBeeping = false;
      }
    }
  }
}

void updateOLED() {
  static unsigned long lastOledUpdateMs = 0;
  unsigned long now = millis();
  if (now - lastOledUpdateMs < 500) return;
  lastOledUpdateMs = now;

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  if (currentMode == MODE_REMINDER) {
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("--- MEDICINE TIME ---");
    display.setTextSize(2);
    display.setCursor(0, 16);
    display.println(activeMedicine);
    display.setTextSize(1);
    display.setCursor(0, 38);
    display.println(activeDose);
    display.setCursor(0, 52);
    display.println("Press Green / Open Box");
  } else if (currentMode == MODE_ALERT_STAGE0) {
    display.setTextSize(1);
    display.setCursor(16, 0);
    display.println("! ARE YOU OK? !");
    display.setTextSize(1);
    display.setCursor(0, 20);
    display.println("No activity detected.");
    display.setCursor(0, 36);
    display.println("If you are OK, press");
    display.setTextSize(1);
    display.setCursor(0, 48);
    display.println("the GREEN button now!");
  } else if (currentMode == MODE_EMERGENCY) {
    display.setTextSize(2);
    display.setCursor(10, 8);
    display.println("! SOS !");
    display.setTextSize(1);
    display.setCursor(0, 32);
    display.println("Alerting Caregiver...");
    display.setCursor(0, 48);
    display.println("Help is on the way.");
  } else {
    // Normal Idle Screen
    struct tm timeinfo;
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print("Suyog AI Hub ");
    if (WiFi.status() == WL_CONNECTED) {
      display.println("[WiFi OK]");
    } else {
      display.println("[Offline]");
    }

    if (getLocalTime(&timeinfo, 10)) {
      char timeStr[16];
      snprintf(timeStr, sizeof(timeStr), "%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
      display.setTextSize(3);
      display.setCursor(18, 18);
      display.println(timeStr);
    } else {
      display.setTextSize(2);
      display.setCursor(10, 20);
      display.println("Normal");
    }

    display.setTextSize(1);
    display.setCursor(0, 52);
    if (!pirWarmedUp) {
      display.println("Sensors warming up...");
    } else {
      display.println("System Monitoring OK");
    }
  }

  display.display();
}
