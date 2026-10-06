import datetime
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.database import get_session
from app.models.elder import Elder
from app.models.device import Device, DeviceEvent
from app.models.medicine import Medicine, MedicineSchedule, MedicineLog
from app.models.alert import Alert

router = APIRouter(prefix="", tags=["Status & Timeline"])

@router.get("/elders/{elder_id}/status")
def get_elder_status(elder_id: int, session: Session = Depends(get_session)):
    elder = session.get(Elder, elder_id)
    if not elder:
        raise HTTPException(status_code=404, detail="Elder not found")

    device = session.exec(select(Device).where(Device.elder_id == elder_id)).first()

    # 1. Active Alerts
    active_alerts = session.exec(
        select(Alert).where(Alert.elder_id == elder_id, Alert.status == "active")
    ).all()

    # 2. Overall Status determination
    if any(a.severity in ["high", "critical"] for a in active_alerts):
        overall_status = "red"  # Emergency / Active Critical Alert
    elif active_alerts or (device and device.status == "offline"):
        overall_status = "yellow"  # Attention needed
    else:
        overall_status = "green"  # Normal

    # 3. Last motion per room
    now = datetime.datetime.utcnow()
    rooms_status = {}
    if device:
        # Check bedroom motion
        motion_events = session.exec(
            select(DeviceEvent)
            .where(DeviceEvent.device_id == device.device_id, DeviceEvent.type == "motion")
            .order_by(DeviceEvent.ts.desc())
            .limit(100)
        ).all()

        for ev in motion_events:
            try:
                payload = json.loads(ev.payload_json)
                room = payload.get("room", "unknown")
                if room not in rooms_status:
                    mins_ago = int((now - ev.ts).total_seconds() / 60)
                    rooms_status[room] = {
                        "last_motion_ts": ev.ts.isoformat(),
                        "minutes_ago": mins_ago
                    }
            except Exception:
                pass

    # Fill default rooms if empty
    if "bedroom" not in rooms_status:
        rooms_status["bedroom"] = {"last_motion_ts": None, "minutes_ago": None}
    if "livingroom" not in rooms_status:
        rooms_status["livingroom"] = {"last_motion_ts": None, "minutes_ago": None}

    # 4. Next medicine
    meds = session.exec(select(Medicine).where(Medicine.elder_id == elder_id)).all()
    next_medicine = None
    all_schedules = []
    for m in meds:
        scheds = session.exec(select(MedicineSchedule).where(MedicineSchedule.medicine_id == m.id)).all()
        for s in scheds:
            all_schedules.append({
                "medicine_name": m.name,
                "dosage": m.dosage,
                "time": s.time,
                "compartment": s.compartment,
                "critical": m.critical
            })
    # Sort schedules by time
    if all_schedules:
        all_schedules.sort(key=lambda x: x["time"])
        next_medicine = all_schedules[0]

    return {
        "elder_id": elder.id,
        "name": elder.name,
        "overall_status": overall_status,
        "away_mode": elder.away_mode,
        "consent_accepted": elder.consent_accepted_at is not None,
        "active_alerts": active_alerts,
        "rooms": rooms_status,
        "next_medicine": next_medicine,
        "device": {
            "device_id": device.device_id if device else None,
            "status": device.status if device else "unregistered",
            "rssi": device.rssi if device else None,
            "firmware": device.firmware if device else None,
            "last_seen": device.last_seen.isoformat() if (device and device.last_seen) else None
        }
    }

@router.get("/elders/{elder_id}/timeline")
def get_timeline(elder_id: int, date_str: Optional[str] = Query(None, alias="date"), session: Session = Depends(get_session)):
    """FR-10 & FR-18: Returns chronological timeline of events."""
    device = session.exec(select(Device).where(Device.elder_id == elder_id)).first()
    if not device:
        return []

    query = select(DeviceEvent).where(DeviceEvent.device_id == device.device_id).order_by(DeviceEvent.ts.desc()).limit(100)
    events = session.exec(query).all()

    timeline = []
    for ev in events:
        try:
            p = json.loads(ev.payload_json)
        except Exception:
            p = {}
        timeline.append({
            "id": ev.id,
            "type": ev.type,
            "ts": ev.ts.isoformat(),
            "details": p
        })
    return timeline
