/**
 * Suyog AI Hardware Test: 0.96" I2C OLED (SSD1306)
 * SDA: GPIO 21, SCL: GPIO 22, Address: 0x3C
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDR     0x3C
#define PIN_SDA       21
#define PIN_SCL       22

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== Suyog AI Hardware Bring-Up: OLED Test ===");

  Wire.begin(PIN_SDA, PIN_SCL);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("SSD1306 initialization failed! Check wiring (SDA=21, SCL=22).");
    while (true) delay(1000);
  }

  Serial.println("SSD1306 initialized successfully.");
}

void loop() {
  // Screen 1: Medicine reminder
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("--- MEDICINE TIME ---");
  display.setTextSize(2);
  display.setCursor(0, 16);
  display.println("Metformin");
  display.setTextSize(1);
  display.setCursor(0, 38);
  display.println("500mg - After food");
  display.setCursor(0, 52);
  display.println("Press Green / Open Box");
  display.display();
  delay(4000);

  // Screen 2: Emergency Are You OK?
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(16, 0);
  display.println("! ARE YOU OK? !");
  display.setCursor(0, 20);
  display.println("No motion detected.");
  display.setCursor(0, 36);
  display.println("If OK, press GREEN");
  display.setCursor(0, 48);
  display.println("button to cancel.");
  display.display();
  delay(4000);

  // Screen 3: Normal idle
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Suyog AI Hub [OK]");
  display.setTextSize(3);
  display.setCursor(18, 18);
  display.println("10:30");
  display.setTextSize(1);
  display.setCursor(0, 52);
  display.println("Sensors Active (IST)");
  display.display();
  delay(4000);
}
