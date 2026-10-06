/**
 * Suyog AI Hardware Test: Pill-Box Reed Switches
 * Box 1: GPIO 34 (Input-only, external 10k pullup to 3.3V)
 * Box 2: GPIO 35 (Input-only, external 10k pullup to 3.3V)
 * Magnet present (Lid closed): Switch closed to GND -> LOW
 * Magnet removed (Lid opened): Switch open -> HIGH via 10k pullup
 */

#include <Arduino.h>

#define PIN_REED_BOX1 34
#define PIN_REED_BOX2 35

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== Suyog AI Hardware Bring-Up: Reed Switch Test ===");
  Serial.println("Note: GPIO 34 and 35 require an external 10k ohm resistor to 3.3V.");

  pinMode(PIN_REED_BOX1, INPUT);
  pinMode(PIN_REED_BOX2, INPUT);
}

void loop() {
  int r1 = digitalRead(PIN_REED_BOX1);
  int r2 = digitalRead(PIN_REED_BOX2);

  Serial.printf("[%lu ms] Compartment 1 (GPIO 34): %s | Compartment 2 (GPIO 35): %s\n",
                millis(),
                (r1 == HIGH) ? "OPENED" : "CLOSED",
                (r2 == HIGH) ? "OPENED" : "CLOSED");

  delay(500);
}
