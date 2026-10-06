#ifndef CAREGUARD_CONFIG_H
#define CAREGUARD_CONFIG_H

// ==========================================
// Suyog AI Pin Configuration (ESP32 DevKit V1)
// PRD Section 5: Fixed BOM (≈ ₹1,270)
// ==========================================

// PIR Motion Sensors
#define PIN_PIR_BEDROOM     27   // Powered from VIN (5V), output 3.3V safe
#define PIN_PIR_LIVINGROOM  26   // Powered from VIN (5V), output 3.3V safe

// Push Buttons (Active LOW with internal pullups)
#define PIN_BTN_PANIC       32   // Red button, requires 2000ms long press
#define PIN_BTN_CONFIRM     33   // Green button, short press debounce

// Feedback & Indicators
#define PIN_BUZZER          25   // Active 5V buzzer, digital HIGH = ON
#define PIN_LED_RED         14   // Reminder / Alert Active indicator (220 ohm)
#define PIN_LED_GREEN       13   // Intake Confirmed / OK indicator (220 ohm)
                                 // Note: Avoid GPIO 12 (strapping pin)

// Pill-Box Reed Switches
// Input-only pins, requires external 10k ohm pull-up to 3.3V
#define PIN_REED_BOX1       34   // Compartment 1 lid
#define PIN_REED_BOX2       35   // Compartment 2 lid

// OLED Display (SSD1306 0.96" I2C)
#define PIN_OLED_SDA        21
#define PIN_OLED_SCL        22
#define OLED_I2C_ADDR       0x3C
#define SCREEN_WIDTH        128
#define SCREEN_HEIGHT       64

// ==========================================
// Timings & Constants
// ==========================================
#define PIR_WARMUP_MS       60000UL  // 60-second warm-up after power-on
#define PIR_COOLDOWN_MS     5000UL   // 5-second cooldown between motion reports
#define DEBOUNCE_MS         50UL     // 50ms software debounce
#define PANIC_LONG_PRESS_MS 2000UL   // 2-second press to trigger SOS
#define HEARTBEAT_INTERVAL  60000UL  // 60-second heartbeat interval
#define REMINDER_BEEP_MS    30000UL  // Beep pattern repetition during reminders
#define NTP_OFFSET_SECONDS  19800    // IST UTC+5:30 (5.5 * 3600 = 19800)
#define NTP_DAYLIGHT_OFFSET 0

#define FIRMWARE_VERSION    "1.0.0"

#endif // CAREGUARD_CONFIG_H
