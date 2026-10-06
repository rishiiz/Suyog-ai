# Suyog AI — Elder Care Monitor & Medicine Reminder

> **Phase 1 MVP Implementation**  
> Zero-Hardware Demo Path: Full end-to-end simulator included.

Suyog AI helps elderly individuals living alone through:
1. **Scheduled Medicine Reminders** via buzzer patterns and 0.96" OLED with physical intake confirmation (button / pill-box reed switch).
2. **Passive Room-Level Motion Tracking** across bedrooms and living areas using low-cost PIR sensors.
3. **Staged Emergency Escalation Engine** with a local "Are you OK?" cancel window, alerting primary caregivers via SMS & automated voice call, secondary contacts in priority order, and emergency services / 112 guidance.

---

## 1. Hardware Specification & BOM

| # | Component | Qty | Purpose & Wiring Note |
|---|---|---|---|
| 1 | **ESP32 DevKit V1 (30-pin)** | 1 | Central Hub Controller with Wi-Fi & NVS flash |
| 2 | **HC-SR501 PIR Sensor** | 2 | Bedroom (GPIO 27) & Living Room (GPIO 26) motion |
| 3 | **Big Push Button (Red)** | 1 | Emergency Panic / SOS (GPIO 32, 2s long press) |
| 4 | **Big Push Button (Green)** | 1 | Medicine Confirm / "I'm OK" (GPIO 33, short press) |
| 5 | **Active Buzzer (5V)** | 1 | Medicine reminder chime & alert siren (GPIO 25) |
| 6 | **LEDs (Red + Green) + 220Ω** | 2+2 | Red = Alert/Reminder (GPIO 14), Green = Confirmed (GPIO 13) |
| 7 | **0.96" I2C OLED (SSD1306)** | 1 | Next medicine, time, instructions (SDA=21, SCL=22) |
| 8 | **Reed Switch + Magnet** | 2 | Pill-box compartment lid sensing (GPIO 34, 35) |
| 9 | **Breadboard** | 1 | Circuit prototyping |
| 10 | **Jumper Wire Set** | 1 | Breadboard & module connections |
| 11 | **5V 2A Adapter + Micro-USB** | 1 | Regulated power supply |

---

## 2. Pin Mapping (ESP32 DevKit V1 30-Pin)

| Hardware Component | ESP32 GPIO | Pin Mode | Circuit Notes |
|---|---|---|---|
| **PIR 1 (Bedroom)** | `GPIO 27` | `INPUT` | VCC to VIN (5V), GND to GND, OUT to GPIO 27 (3.3V safe) |
| **PIR 2 (Living Room)**| `GPIO 26` | `INPUT` | VCC to VIN (5V), GND to GND, OUT to GPIO 26 (3.3V safe) |
| **Panic Button (Red)**| `GPIO 32` | `INPUT_PULLUP`| Switch to GND. Requires 2000 ms long press to avoid mis-triggers |
| **Confirm Button (Green)**| `GPIO 33` | `INPUT_PULLUP`| Switch to GND. 50 ms debounce for short press |
| **Active Buzzer (5V)** | `GPIO 25` | `OUTPUT` | Digital HIGH = Sound ON. Connected with 220Ω/transistor driver |
| **Red Status LED** | `GPIO 14` | `OUTPUT` | Series 220Ω resistor to GND |
| **Green Status LED** | `GPIO 13` | `OUTPUT` | Series 220Ω resistor to GND *(Avoid GPIO 12: strapping pin)* |
| **Reed Switch 1 (Box 1)** | `GPIO 34` | `INPUT` | Input-only pin. Needs external 10kΩ pull-up to 3.3V |
| **Reed Switch 2 (Box 2)** | `GPIO 35` | `INPUT` | Input-only pin. Needs external 10kΩ pull-up to 3.3V |
| **OLED SDA** | `GPIO 21` | `I2C SDA` | SSD1306 I2C (Address `0x3C`) |
| **OLED SCL** | `GPIO 22` | `I2C SCL` | SSD1306 I2C (Address `0x3C`) |

---

## 3. Architecture

```
[ESP32 Hub + Sensors]
       │ MQTT over TLS (or HTTP Fallback POST /api/v1/ingest/{id})
       ▼
[MQTT Broker] (HiveMQ / Mosquitto)
       │
       ▼
[MQTT Ingestion Worker] ──► [FastAPI Backend] ──► [SQLite / PostgreSQL]
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼                                               ▼
[Rules & Escalation Engine]                    [Caregiver Dashboard (Next.js)]
   ├── Stage 0: Local "Are you OK?" (0-60s)       ├── Live Red/Yellow/Green Banner
   ├── Stage 1: Primary Caregiver SMS & Voice     ├── 1-Click Acknowledge
   ├── Stage 2: Secondary Contacts                ├── Medicine Schedule & Adherence
   └── Stage 3: Emergency Dispatch / Call 112     ├── Room Activity & Device Telemetry
                                                  └── Real-Time Mock Notification Feed
```

---

## 4. Quick Start: Running the System

### Step 1: Start Backend Server
```powershell
cd "d:\Suyog ai\backend"
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```
- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

### Step 2: Start Caregiver Dashboard (Frontend)
```powershell
cd "d:\Suyog ai\frontend"
npm install
npm run dev
```
- Open [http://localhost:3000](http://localhost:3000) in your browser.
- Demo Login: `rohit.kulkarni@example.com` / `caregiver123`

### Step 3: Run Hardware-Free Demo Simulator
Suyog AI includes a virtual ESP32 device simulator so judges and evaluators can experience the full IoT pipeline without hardware:

```powershell
cd "d:\Suyog ai"
# Run automated Panic Escalation scenario:
& .\backend\.venv\Scripts\python.exe simulator\device_simulator.py --scenario panic

# Or launch the interactive virtual hardware console:
& .\backend\.venv\Scripts\python.exe simulator\device_simulator.py --interactive
```

---

## 5. Demonstration Scenarios (Predefined in Simulator)

| Scenario | Command | What Happens |
|---|---|---|
| **Panic SOS** | `python simulator/device_simulator.py --scenario panic` | 2s red button press -> Instant Stage 1 escalation -> Caregiver receives SMS & Voice -> Dashboard flashes RED -> 1-click Acknowledge stops alert. |
| **Normal Day** | `python simulator/device_simulator.py --scenario normal_day` | Morning motion in bedroom/living room -> 09:00 AM medicine chime -> elder opens pill-box lid -> intake confirmed on dashboard. |
| **False Alarm Cancelled** | `python simulator/device_simulator.py --scenario false_alarm_cancelled` | Inactivity causes Stage 0 local alarm on hub -> elder presses green button within 60s -> alert cancelled locally without disturbing family! |
| **Prolonged Inactivity** | `python simulator/device_simulator.py --scenario inactivity` | 3+ hours no motion -> Stage 0 buzzer -> expires unacknowledged -> escalates to caregiver SMS/Voice. |
| **Missed Medicine** | `python simulator/device_simulator.py --scenario missed_medicine` | Reminder sounds -> repeats 3 times every 5 minutes -> marked missed -> caregiver notified. |

---

## 6. Hardware Bring-Up & Verification Sketches

Before flashing the production firmware, independently verify your breadboard wiring using the per-component sketches located in `firmware/tests/`:

1. `firmware/tests/test_pir.ino`: Tests HC-SR501 sensors on GPIO 26 & 27 with Serial feedback.
2. `firmware/tests/test_buttons.ino`: Tests 2-second Panic long-press filter (GPIO 32) and Confirm short-press (GPIO 33).
3. `firmware/tests/test_buzzer.ino`: Tests Active Buzzer reminder chime and siren tones on GPIO 25.
4. `firmware/tests/test_oled.ino`: Tests SSD1306 OLED I2C display screens (GPIO 21 & 22).
5. `firmware/tests/test_reed.ino`: Tests pill-box lid magnetic reed switches on GPIO 34 & 35.

When wiring is verified, copy `firmware/careguard_hub/secrets.h.example` to `secrets.h`, input your Wi-Fi credentials, and flash `firmware/careguard_hub/careguard_hub.ino`.
