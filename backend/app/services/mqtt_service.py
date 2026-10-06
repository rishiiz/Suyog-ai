import json
import logging
import datetime
import asyncio
from typing import Optional, Dict, Any
import paho.mqtt.client as mqtt
from sqlmodel import Session, select
from app.config import settings
from app.database import engine
from app.models.device import Device, DeviceEvent
from app.models.medicine import Medicine, MedicineSchedule, MedicineLog
from app.services.escalation_engine import EscalationEngine

logger = logging.getLogger("SuyogAI.MQTTService")

class MQTTService:
    def __init__(self):
        # Support paho-mqtt v1 and v2 API
        try:
            self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, settings.MQTT_CLIENT_ID)
        except AttributeError:
            self.client = mqtt.Client(settings.MQTT_CLIENT_ID)

        if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
            self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)

        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect
        self.connected = False
        self.loop = None

    def start(self):
        try:
            self.loop = asyncio.get_event_loop()
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

        try:
            logger.info(f"Connecting MQTT to {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}...")
            self.client.connect_async(settings.MQTT_BROKER_HOST, settings.MQTT_BROKER_PORT, settings.MQTT_KEEPALIVE)
            self.client.loop_start()
        except Exception as e:
            logger.error(f"MQTT connection error: {e}")

    def stop(self):
        try:
            self.client.loop_stop()
            self.client.disconnect()
        except Exception as e:
            logger.error(f"MQTT stop error: {e}")

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.connected = True
            sub_topic = f"{settings.MQTT_TOPIC_PREFIX}/+/+"
            client.subscribe(sub_topic)
            logger.info(f"MQTT Connected successfully! Subscribed to {sub_topic}")
        else:
            logger.warning(f"MQTT Connect failed with code {rc}")

    def _on_disconnect(self, client, userdata, rc=None, properties=None):
        self.connected = False
        logger.warning(f"MQTT Disconnected (rc={rc})")

    def _on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            payload_str = msg.payload.decode("utf-8")
            logger.info(f"[MQTT IN] {topic}: {payload_str}")

            parts = topic.split("/")
            if len(parts) >= 3 and parts[0] == settings.MQTT_TOPIC_PREFIX:
                device_id = parts[1]
                event_type = parts[2]
                payload = json.loads(payload_str)

                # Process asynchronously in threadpool/eventloop
                if self.loop and self.loop.is_running():
                    asyncio.run_coroutine_threadsafe(
                        self.process_device_message(device_id, event_type, payload),
                        self.loop
                    )
                else:
                    asyncio.run(self.process_device_message(device_id, event_type, payload))
        except Exception as e:
            logger.error(f"Error handling incoming MQTT message: {e}")

    async def process_device_message(self, device_id: str, event_type: str, payload: Dict[str, Any]):
        with Session(engine) as session:
            device = session.exec(select(Device).where(Device.device_id == device_id)).first()
            if not device:
                # Auto-register device on first contact
                device = Device(device_id=device_id, status="online", last_seen=datetime.datetime.utcnow())
                session.add(device)
                session.commit()
                session.refresh(device)

            # Update device online state
            device.last_seen = datetime.datetime.utcnow()
            device.status = "online"

            # Store raw telemetry event (90-day retention guideline)
            event_record = DeviceEvent(
                device_id=device_id,
                type=event_type,
                payload_json=json.dumps(payload),
                ts=datetime.datetime.utcnow()
            )
            session.add(event_record)

            # 1. HEARTBEAT
            if event_type == "heartbeat":
                if "rssi" in payload:
                    device.rssi = payload["rssi"]
                if "fw" in payload:
                    device.firmware = str(payload["fw"])

            # 2. MOTION
            elif event_type == "motion":
                # Motion detected in a room e.g. {"room": "bedroom", "state": 1}
                logger.info(f"Motion in {payload.get('room')} for device {device_id}")

            # 3. BUTTON
            elif event_type == "button":
                btn_type = payload.get("type")
                if btn_type == "panic":
                    # Instant Panic SOS Trigger!
                    logger.warning(f"🚨 PANIC BUTTON triggered on device {device_id}!")
                    if device.elder_id:
                        await EscalationEngine.create_alert(
                            session=session,
                            elder_id=device.elder_id,
                            alert_type="panic",
                            severity="critical",
                            note="Panic SOS button triggered by elder (2-second press).",
                            mqtt_service=self
                        )

                elif btn_type == "confirm":
                    # Check if there is an active Stage 0 alert to cancel
                    if device.elder_id:
                        cancelled = EscalationEngine.cancel_stage0_alert(session, device.elder_id)
                        if not cancelled:
                            # Also check pending medicine reminders to confirm intake
                            self._confirm_active_medicine_log(session, device.elder_id, method="button")

            # 4. PILL BOX REED SWITCH
            elif event_type == "pill":
                compartment = payload.get("compartment", 1)
                state = payload.get("state", "")
                if state == "opened" and device.elder_id:
                    logger.info(f"Pillbox compartment {compartment} opened for elder {device.elder_id}")
                    self._confirm_active_medicine_log(session, device.elder_id, method="pillbox", compartment=compartment)

            session.add(device)
            session.commit()

    def _confirm_active_medicine_log(self, session: Session, elder_id: int, method: str, compartment: Optional[int] = None):
        """Finds any pending medicine reminders in recent window and marks them as taken."""
        now = datetime.datetime.utcnow()
        # Check logs due within the last 60 minutes
        window_start = now - datetime.timedelta(minutes=60)

        query = select(MedicineLog).where(
            MedicineLog.elder_id == elder_id,
            MedicineLog.status.in_(["pending", "late"]),
            MedicineLog.due_ts >= window_start
        ).order_by(MedicineLog.due_ts.desc())

        pending_logs = session.exec(query).all()
        for log in pending_logs:
            sched = session.get(MedicineSchedule, log.schedule_id)
            if compartment is not None and sched and sched.compartment != compartment:
                continue  # Different compartment

            log.status = "taken" if log.status == "pending" else "late"
            log.confirmed_ts = now
            log.method = method
            session.add(log)

            # Decrement stock count
            if sched:
                med = session.get(Medicine, sched.medicine_id)
                if med and med.stock > 0:
                    med.stock -= 1
                    session.add(med)

            session.commit()
            logger.info(f"Medicine Log {log.id} confirmed as {log.status} via {method}")

            # Send command to stop buzzing on hub
            device = session.exec(select(Device).where(Device.elder_id == elder_id)).first()
            if device:
                self.send_command(device.device_id, {"cmd": "reminder_stop", "reason": "confirmed"})
            break

    def send_command(self, device_id: str, command: Dict[str, Any]):
        topic = f"{settings.MQTT_TOPIC_PREFIX}/{device_id}/cmd"
        payload = json.dumps(command)
        try:
            self.client.publish(topic, payload)
            logger.info(f"[MQTT OUT] {topic}: {payload}")
        except Exception as e:
            logger.error(f"Failed to publish MQTT command: {e}")

mqtt_service = MQTTService()
