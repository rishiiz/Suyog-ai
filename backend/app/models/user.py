from typing import Optional
from sqlmodel import SQLModel, Field

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    phone: str
    email: str = Field(index=True, unique=True)
    password_hash: str
    role: str = "caregiver"  # caregiver | admin

class ElderCaregiver(SQLModel, table=True):
    __tablename__ = "elder_caregivers"

    id: Optional[int] = Field(default=None, primary_key=True)
    elder_id: int = Field(index=True)
    user_id: int = Field(index=True)
    priority: int = 1  # 1 = primary, 2 = secondary, etc.
    relationship: Optional[str] = "Family"
