import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models.device import Device, DeviceSensor, DeviceEvent

router = APIRouter(prefix="/devices", tags=["Devices"])

class SensorMapping(BaseModel):
    kind: str  # pir | reed | button
    pin: int
    room_or_compartment: str

class DeviceRegisterRequest(BaseModel):
    device_id: str
    elder_id: Optional[int] = None
    sensors: Optional[List[SensorMapping]] = None

@router.get("")
def list_devices(session: Session = Depends(get_session)):
    return session.exec(select(Device)).all()

@router.post("/register")
def register_device(req: DeviceRegisterRequest, session: Session = Depends(get_session)):
    """FR-3: Register a device by device ID and map sensors to room names."""
    device = session.exec(select(Device).where(Device.device_id == req.device_id)).first()
    if not device:
        device = Device(
            device_id=req.device_id,
            elder_id=req.elder_id,
            status="offline",
            firmware="1.0.0"
        )
        session.add(device)
    else:
        if req.elder_id is not None:
            device.elder_id = req.elder_id
        session.add(device)
    session.commit()
    session.refresh(device)

    # Save sensor mappings
    if req.sensors:
        # Clear previous mappings for this device
        existing_sensors = session.exec(select(DeviceSensor).where(DeviceSensor.device_id == req.device_id)).all()
        for s in existing_sensors:
            session.delete(s)

        for s in req.sensors:
            sensor = DeviceSensor(
                device_id=req.device_id,
                kind=s.kind,
                pin=s.pin,
                room_or_compartment=s.room_or_compartment
            )
            session.add(sensor)
        session.commit()

    return {"status": "success", "device": device}

@router.get("/{device_id}/health")
def get_device_health(device_id: str, session: Session = Depends(get_session)):
    """FR-21: Device health inspection (last heartbeat, RSSI, firmware version)."""
    device = session.exec(select(Device).where(Device.device_id == device_id)).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    sensors = session.exec(select(DeviceSensor).where(DeviceSensor.device_id == device_id)).all()
    latest_heartbeat = session.exec(
        select(DeviceEvent)
        .where(DeviceEvent.device_id == device_id, DeviceEvent.type == "heartbeat")
        .order_by(DeviceEvent.ts.desc())
    ).first()

    return {
        "device_id": device.device_id,
        "elder_id": device.elder_id,
        "status": device.status,
        "firmware": device.firmware,
        "rssi": device.rssi,
        "last_seen": device.last_seen.isoformat() if device.last_seen else None,
        "latest_heartbeat_payload": latest_heartbeat.payload_json if latest_heartbeat else None,
        "sensors": sensors
    }
