/**
 * Suyog AI Hardware Test: Buttons & Status LEDs
 * Red Panic Button: GPIO 32 (INPUT_PULLUP, 2-sec long press required)
 * Green Confirm Button: GPIO 33 (INPUT_PULLUP, short press)
 * Red LED: GPIO 14 (with 220 ohm resistor)
 * Green LED: GPIO 13 (with 220 ohm resistor)
 */

#include <Arduino.h>

#define PIN_BTN_PANIC    32
#define PIN_BTN_CONFIRM  33
#define PIN_LED_RED      14
#define PIN_LED_GREEN    13

unsigned long panicPressStart = 0;
bool panicFired = false;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== Suyog AI Hardware Bring-Up: Buttons & LEDs Test ===");
  Serial.println("Instructions:");
  Serial.println("1. Press Green button (GPIO 33) -> Green LED (GPIO 13) lights up.");
  Serial.println("2. Press Red button (GPIO 32) and HOLD for 2 seconds -> Red LED (GPIO 14) lights up.");

  pinMode(PIN_BTN_PANIC, INPUT_PULLUP);
  pinMode(PIN_BTN_CONFIRM, INPUT_PULLUP);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);

  // Initial LED self-test flash
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_LED_GREEN, HIGH);
  delay(500);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_GREEN, LOW);
}

void loop() {
  // Confirm Button (Short press)
  if (digitalRead(PIN_BTN_CONFIRM) == LOW) {
    digitalWrite(PIN_LED_GREEN, HIGH);
    Serial.println("[Confirm Button] Pressed! Green LED ON.");
  } else {
    digitalWrite(PIN_LED_GREEN, LOW);
  }

  // Panic Button (2-second long press)
  if (digitalRead(PIN_BTN_PANIC) == LOW) {
    if (panicPressStart == 0) {
      panicPressStart = millis();
      panicFired = false;
      Serial.println("[Panic Button] Holding... Keep holding for 2 seconds.");
    } else if (!panicFired && (millis() - panicPressStart >= 2000)) {
      panicFired = true;
      digitalWrite(PIN_LED_RED, HIGH);
      Serial.println("[Panic Button] *** 2-SECOND LONG PRESS TRIGGERED! RED LED ON ***");
    }
  } else {
    if (panicPressStart > 0 && !panicFired) {
      Serial.println("[Panic Button] Released too early (< 2 seconds). Ignored.");
    }
    panicPressStart = 0;
    panicFired = false;
    digitalWrite(PIN_LED_RED, LOW);
  }

  delay(50);
}
