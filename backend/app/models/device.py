import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

class Device(SQLModel, table=True):
    __tablename__ = "devices"

    id: Optional[int] = Field(default=None, primary_key=True)
    elder_id: Optional[int] = Field(default=None, index=True)
    device_id: str = Field(unique=True, index=True)
    credentials_hash: Optional[str] = None
    firmware: str = "1.0.0"
    last_seen: Optional[datetime.datetime] = None
    rssi: Optional[int] = None
    status: str = "offline"  # online | offline

class DeviceSensor(SQLModel, table=True):
    __tablename__ = "device_sensors"

    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: str = Field(index=True)
    kind: str  # pir | reed | button
    pin: int
    room_or_compartment: str  # bedroom | livingroom | compartment_1 | compartment_2

class DeviceEvent(SQLModel, table=True):
    __tablename__ = "events"

    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: str = Field(index=True)
    type: str = Field(index=True)  # motion | button | pill | heartbeat
    payload_json: str
    ts: datetime.datetime = Field(default_factory=datetime.datetime.utcnow, index=True)
