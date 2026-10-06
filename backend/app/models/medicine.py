import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

class Medicine(SQLModel, table=True):
    __tablename__ = "medicines"

    id: Optional[int] = Field(default=None, primary_key=True)
    elder_id: int = Field(index=True)
    name: str
    dosage: str                          # e.g. "500mg"
    instructions: Optional[str] = None   # e.g. "After breakfast with water"
    critical: bool = False               # Critical medicines alert caregivers if missed
    stock: int = 30                      # Pill count

class MedicineSchedule(SQLModel, table=True):
    __tablename__ = "medicine_schedules"

    id: Optional[int] = Field(default=None, primary_key=True)
    medicine_id: int = Field(index=True)
    time: str                            # "HH:MM" 24h format e.g. "09:00"
    days_of_week: str = "daily"          # "daily" or comma-separated "0,1,2,3,4,5,6"
    compartment: Optional[int] = 1       # 1 or 2 for pill-box lid sensing

class MedicineLog(SQLModel, table=True):
    __tablename__ = "medicine_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    schedule_id: int = Field(index=True)
    elder_id: int = Field(index=True)
    due_ts: datetime.datetime = Field(index=True)
    status: str = "pending"              # pending | taken | late | missed
    confirmed_ts: Optional[datetime.datetime] = None
    method: Optional[str] = None         # button | pillbox | caregiver
    repeat_count: int = 0
