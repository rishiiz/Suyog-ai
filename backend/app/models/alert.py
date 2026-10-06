import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

class Alert(SQLModel, table=True):
    __tablename__ = "alerts"

    id: Optional[int] = Field(default=None, primary_key=True)
    elder_id: int = Field(index=True)
    type: str = Field(index=True)        # panic | inactivity | missed_medicine | device_offline | test
    severity: str = "medium"             # low | medium | high | critical
    stage: int = 0                       # 0 = Local, 1 = Primary, 2 = Secondary, 3 = Emergency
    status: str = "active"               # active | acknowledged | cancelled | resolved
    created_ts: datetime.datetime = Field(default_factory=datetime.datetime.utcnow, index=True)
    acknowledged_by: Optional[str] = None
    acknowledged_ts: Optional[datetime.datetime] = None
    resolved_ts: Optional[datetime.datetime] = None
    note: Optional[str] = None

class AlertAction(SQLModel, table=True):
    __tablename__ = "alert_actions"

    id: Optional[int] = Field(default=None, primary_key=True)
    alert_id: int = Field(index=True)
    stage: int
    channel: str                         # local_hub | sms | voice | emergency_service
    target: str                          # phone number or device_id
    result: str                          # success | failed | simulated
    message: Optional[str] = None
    ts: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
