/**
 * Suyog AI Hardware Test: PIR Motion Sensors
 * Pins: GPIO 27 (Bedroom PIR), GPIO 26 (Living Room PIR)
 * VCC: 5V (VIN), GND: GND, OUT: GPIO 27 & 26 (3.3V safe)
 */

#include <Arduino.h>

#define PIN_PIR_BEDROOM    27
#define PIN_PIR_LIVINGROOM 26

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== Suyog AI Hardware Bring-Up: PIR Test ===");
  Serial.println("PIR sensors require ~60s warmup. Please do not move in front of sensors during warmup.");

  pinMode(PIN_PIR_BEDROOM, INPUT);
  pinMode(PIN_PIR_LIVINGROOM, INPUT);
}

void loop() {
  int bedState = digitalRead(PIN_PIR_BEDROOM);
  int livingState = digitalRead(PIN_PIR_LIVINGROOM);

  Serial.printf("[%lu ms] Bedroom (GPIO 27): %s | Living Room (GPIO 26): %s\n",
                millis(),
                (bedState == HIGH) ? "MOTION DETECTED" : "Clear",
                (livingState == HIGH) ? "MOTION DETECTED" : "Clear");

  delay(500);
}
