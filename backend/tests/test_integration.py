import pytest
import datetime
import json
from sqlmodel import Session, select
from app.database import engine, init_db
from app.models.elder import Elder
from app.models.device import Device
from app.models.alert import Alert, AlertAction
from app.services.mqtt_service import mqtt_service
from app.services.notifications import mock_notifier

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    mock_notifier.clear_history()

@pytest.mark.asyncio
async def test_panic_event_integration_pipeline():
    with Session(engine) as session:
        elder = session.exec(select(Elder)).first()
        assert elder is not None, "Database should have seeded demo elder"

        device = session.exec(select(Device).where(Device.elder_id == elder.id)).first()
        assert device is not None

        # Simulate device sending panic button event
        payload = {"type": "panic", "ts": int(datetime.datetime.utcnow().timestamp())}
        await mqtt_service.process_device_message(device.device_id, "button", payload)

        # Verify an alert was created and escalated to Stage 1
        active_panic_alert = session.exec(
            select(Alert).where(Alert.elder_id == elder.id, Alert.type == "panic", Alert.status == "active")
        ).first()

        assert active_panic_alert is not None
        assert active_panic_alert.stage >= 1

        # Check mock notifier has recorded the outbound notification
        history = mock_notifier.get_recent_notifications()
        assert len(history) >= 1
        assert any("PANIC" in h.get("message", "") for h in history)

@pytest.mark.asyncio
async def test_motion_event_telemetry_pipeline():
    with Session(engine) as session:
        device = session.exec(select(Device)).first()
        payload = {"room": "bedroom", "state": 1, "ts": int(datetime.datetime.utcnow().timestamp())}

        await mqtt_service.process_device_message(device.device_id, "motion", payload)

        # Refresh device
        session.refresh(device)
        assert device.status == "online"
        assert device.last_seen is not None
