/**
 * Suyog AI Hardware Test: Active Buzzer (5V)
 * Pin: GPIO 25 (Active Buzzer, HIGH = Sound ON)
 */

#include <Arduino.h>

#define PIN_BUZZER 25

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== Suyog AI Hardware Bring-Up: Buzzer Test ===");
  Serial.println("Testing buzzer reminder pattern (3 short beeps) then silence.");

  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
}

void loop() {
  Serial.println("[Buzzer] Playing Medicine Reminder Chime...");
  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(150);
    digitalWrite(PIN_BUZZER, LOW);
    delay(100);
  }

  Serial.println("[Buzzer] Pausing for 5 seconds...");
  delay(5000);

  Serial.println("[Buzzer] Playing Emergency SOS Siren...");
  for (int i = 0; i < 2; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(800);
    digitalWrite(PIN_BUZZER, LOW);
    delay(200);
  }

  Serial.println("[Buzzer] Pausing for 5 seconds...");
  delay(5000);
}
