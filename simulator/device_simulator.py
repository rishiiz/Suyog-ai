"""
Suyog AI Device Simulator (Virtual ESP32 Hub)
Emulates the physical hardware (PIR sensors, buttons, buzzer, OLED, reed switches).
Supports both MQTT and HTTP fallback.
"""
import sys
import time
import json
import argparse
import threading
import httpx
import paho.mqtt.client as mqtt

DEFAULT_DEVICE_ID = "cg_device_001"
DEFAULT_MQTT_BROKER = "broker.hivemq.com"
DEFAULT_MQTT_PORT = 1883
DEFAULT_HTTP_HOST = "http://127.0.0.1:8000"

class VirtualHub:
    def __init__(self, device_id: str = DEFAULT_DEVICE_ID, broker: str = DEFAULT_MQTT_BROKER,
                 port: int = DEFAULT_MQTT_PORT, http_url: str = DEFAULT_HTTP_HOST, use_http: bool = False):
        self.device_id = device_id
        self.broker = broker
        self.port = port
        self.http_url = http_url
        self.use_http = use_http
        self.running = True

        # Virtual hardware state
        self.oled_text = "Suyog AI Hub [IDLE]"
        self.buzzer_active = False
        self.red_led = False
        self.green_led = False

        # MQTT setup
        self.topic_motion = f"careguard/{self.device_id}/motion"
        self.topic_button = f"careguard/{self.device_id}/button"
        self.topic_pill = f"careguard/{self.device_id}/pill"
        self.topic_heartbeat = f"careguard/{self.device_id}/heartbeat"
        self.topic_cmd = f"careguard/{self.device_id}/cmd"

        self.mqtt_client = None
        if not self.use_http:
            try:
                self.mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, f"sim_{self.device_id}")
            except AttributeError:
                self.mqtt_client = mqtt.Client(f"sim_{self.device_id}")
            self.mqtt_client.on_connect = self._on_connect
            self.mqtt_client.on_message = self._on_message

    def start(self):
        if not self.use_http and self.mqtt_client:
            print(f"[SimHub] Connecting MQTT to {self.broker}:{self.port}...")
            try:
                self.mqtt_client.connect(self.broker, self.port, 60)
                self.mqtt_client.loop_start()
            except Exception as e:
                print(f"[SimHub] MQTT connection failed ({e}). Falling back to HTTP.")
                self.use_http = True

        # Start background heartbeat thread
        self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()
        print(f"[SimHub] Virtual Hardware Hub '{self.device_id}' started! Ready for simulation.\n")

    def stop(self):
        self.running = False
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
        print("[SimHub] Virtual Hardware Hub stopped.")

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            print(f"[SimHub] Connected to MQTT broker. Subscribing to {self.topic_cmd}")
            client.subscribe(self.topic_cmd)
            self.send_heartbeat()
        else:
            print(f"[SimHub] MQTT connection returned code {rc}")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            self.handle_command(payload)
        except Exception as e:
            print(f"[SimHub] Error parsing command: {e}")

    def handle_command(self, cmd_dict: dict):
        cmd = cmd_dict.get("cmd")
        if cmd == "reminder_start":
            med = cmd_dict.get("medicine", "Medicine")
            dose = cmd_dict.get("dose", "1 dose")
            self.red_led = True
            self.buzzer_active = True
            self.oled_text = f"[OLED DISPLAY]\n=====================\n--- MEDICINE TIME ---\n{med} ({dose})\nPress Green / Open Box\n====================="
            print(f"\n🔔 [BUZZER CHIME] Beep-beep-beep! Medicine Reminder started.")
            print(self.oled_text + "\n")
        elif cmd == "reminder_stop":
            self.red_led = False
            self.buzzer_active = False
            self.oled_text = "[OLED DISPLAY] Idle / Normal"
            print("\n⏹️ [BUZZER OFF] Reminder stopped.")
        elif cmd == "local_alert":
            reason = cmd_dict.get("reason", "Emergency")
            self.red_led = True
            self.buzzer_active = True
            self.oled_text = f"[OLED DISPLAY]\n=====================\n! ARE YOU OK? !\n{reason}\nPress GREEN button\n====================="
            print(f"\n🚨 [STAGE 0 LOCAL ALERT] Siren sounded! Reason: {reason}")
            print(self.oled_text + "\n")

    def _publish(self, event_type: str, topic: str, payload: dict):
        if self.use_http or not self.mqtt_client or not self.mqtt_client.is_connected():
            url = f"{self.http_url}/api/v1/ingest/{self.device_id}"
            try:
                resp = httpx.post(url, json={"event_type": event_type, "payload": payload}, timeout=5.0)
                print(f"[SimHub -> HTTP POST] {event_type} -> status {resp.status_code}")
            except Exception as e:
                print(f"[SimHub -> HTTP ERR] Could not send {event_type}: {e}")
        else:
            payload_str = json.dumps(payload)
            self.mqtt_client.publish(topic, payload_str)
            print(f"[SimHub -> MQTT TX] {topic} : {payload_str}")

    def _heartbeat_loop(self):
        while self.running:
            self.send_heartbeat()
            time.sleep(60)

    def send_heartbeat(self):
        payload = {"rssi": -55, "uptime": int(time.time()), "fw": "1.0.0-sim"}
        self._publish("heartbeat", self.topic_heartbeat, payload)

    def trigger_motion(self, room: str = "livingroom"):
        payload = {"room": room, "state": 1, "ts": int(time.time())}
        print(f"🚶 [SIMULATOR] Motion detected in {room.upper()}")
        self._publish("motion", self.topic_motion, payload)

    def trigger_panic_button(self):
        print("🛑 [SIMULATOR] RED PANIC BUTTON: 2-second continuous press initiated...")
        time.sleep(0.5)
        payload = {"type": "panic", "ts": int(time.time())}
        self.buzzer_active = True
        self.oled_text = "[OLED DISPLAY] ! SOS ! Alerting Caregivers..."
        print("🚨 [SIMULATOR] PANIC SOS EVENT SENT TO CLOUD!")
        self._publish("button", self.topic_button, payload)

    def trigger_confirm_button(self):
        print("🟢 [SIMULATOR] GREEN CONFIRM BUTTON: Pressed by elder ('I am OK' / Medicine Confirmed).")
        self.green_led = True
        self.buzzer_active = False
        self.red_led = False
        payload = {"type": "confirm", "context": "user_action", "ts": int(time.time())}
        self._publish("button", self.topic_button, payload)

    def trigger_pillbox_open(self, compartment: int = 1):
        print(f"💊 [SIMULATOR] REED SWITCH: Pill-box lid #{compartment} OPENED by elder.")
        payload = {"compartment": compartment, "state": "opened", "ts": int(time.time())}
        self._publish("pill", self.topic_pill, payload)

def run_interactive(hub: VirtualHub):
    print("\n--- Suyog AI Virtual Hub Console ---")
    print("1: Trigger Bedroom Motion")
    print("2: Trigger Living Room Motion")
    print("3: Trigger Green Confirm Button (I'm OK / Confirm Medicine)")
    print("4: Trigger Red Panic Button (2s Long-Press SOS)")
    print("5: Open Pill-box Compartment 1 (Reed Switch)")
    print("6: Open Pill-box Compartment 2 (Reed Switch)")
    print("7: Send Heartbeat Telemetry")
    print("q: Exit Simulator\n")

    while hub.running:
        try:
            choice = input("Enter action [1-7, q]: ").strip()
            if choice == "1":
                hub.trigger_motion("bedroom")
            elif choice == "2":
                hub.trigger_motion("livingroom")
            elif choice == "3":
                hub.trigger_confirm_button()
            elif choice == "4":
                hub.trigger_panic_button()
            elif choice == "5":
                hub.trigger_pillbox_open(1)
            elif choice == "6":
                hub.trigger_pillbox_open(2)
            elif choice == "7":
                hub.send_heartbeat()
            elif choice.lower() == "q":
                break
            time.sleep(0.3)
        except (KeyboardInterrupt, EOFError):
            break

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Suyog AI Device Simulator")
    parser.add_argument("--device-id", default=DEFAULT_DEVICE_ID, help="Target device ID")
    parser.add_argument("--broker", default=DEFAULT_MQTT_BROKER, help="MQTT Broker host")
    parser.add_argument("--port", type=int, default=DEFAULT_MQTT_PORT, help="MQTT Broker port")
    parser.add_argument("--http-url", default=DEFAULT_HTTP_HOST, help="HTTP fallback URL")
    parser.add_argument("--http", action="store_true", help="Force HTTP fallback instead of MQTT")
    parser.add_argument("--interactive", action="store_true", help="Launch interactive menu")
    parser.add_argument("--scenario", choices=["normal_day", "missed_medicine", "inactivity", "panic", "false_alarm_cancelled"], help="Run predefined demo scenario")
    args = parser.parse_args()

    hub = VirtualHub(
        device_id=args.device_id,
        broker=args.broker,
        port=args.port,
        http_url=args.http_url,
        use_http=args.http
    )
    hub.start()

    if args.scenario:
        from simulator.scenarios import run_scenario
        run_scenario(hub, args.scenario)
        hub.stop()
    elif args.interactive or len(sys.argv) == 1:
        run_interactive(hub)
        hub.stop()
