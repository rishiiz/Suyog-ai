import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

class Elder(SQLModel, table=True):
    __tablename__ = "elders"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    age: int
    phone: Optional[str] = None
    address: str
    landmark: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    blood_group: Optional[str] = None
    conditions: Optional[str] = None     # Comma-separated or JSON
    allergies: Optional[str] = None
    preferred_hospital: Optional[str] = None
    consent_accepted_at: Optional[datetime.datetime] = None
    away_mode: bool = False             # Suppresses inactivity alerts if True
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

class ElderSettings(SQLModel, table=True):
    __tablename__ = "settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    elder_id: int = Field(unique=True, index=True)
    inactivity_day_hours: float = 3.0    # Alert after 3 hours of waking inactivity
    inactivity_night_hours: float = 10.0 # Alert after 10 hours of night inactivity
    sleep_start: str = "22:00"           # 10 PM
    sleep_end: str = "07:00"             # 7 AM
    morning_check_time: str = "10:00"    # Alert if no morning activity by 10 AM
    escalation_timings_json: str = '{"stage0_sec":60, "stage1_sec":120, "stage2_sec":180, "stage3_sec":240}'
    enable_emergency_services: bool = False
