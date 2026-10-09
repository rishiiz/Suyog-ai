import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models.elder import Elder, ElderSettings
from app.models.user import User, ElderCaregiver
from app.models.device import Device
from app.api.auth import get_current_user

router = APIRouter(prefix="/elders", tags=["Elders"])

class ElderCreateRequest(BaseModel):
    name: str
    age: int
    phone: Optional[str] = None
    address: str = "Home"
    landmark: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    blood_group: Optional[str] = None
    conditions: Optional[str] = None
    allergies: Optional[str] = None
    preferred_hospital: Optional[str] = None
    user_id: Optional[int] = None

class ContactAddRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    relationship: str = "Family"
    priority: int = 1

class SettingsUpdateRequest(BaseModel):
    inactivity_day_hours: Optional[float] = None
    inactivity_night_hours: Optional[float] = None
    sleep_start: Optional[str] = None
    sleep_end: Optional[str] = None
    morning_check_time: Optional[str] = None
    enable_emergency_services: Optional[bool] = None

@router.get("")
def list_elders(session: Session = Depends(get_session)):
    return session.exec(select(Elder)).all()

@router.post("")
def create_elder(req: ElderCreateRequest, session: Session = Depends(get_session)):
    data = req.dict(exclude={"user_id"})
    elder = Elder(**data)
    session.add(elder)
    session.commit()
    session.refresh(elder)

    # Initialize default settings
    settings = ElderSettings(elder_id=elder.id)
    session.add(settings)
    
    # Link to user if user_id is provided
    if req.user_id:
        user = session.get(User, req.user_id)
        if user:
            rel = ElderCaregiver(
                elder_id=elder.id,
                user_id=user.id,
                priority=1,
                relationship="Primary Caregiver"
            )
            session.add(rel)

    # Create default device registration
    dev_id = f"cg_device_{elder.id:03d}"
    device = Device(
        device_id=dev_id,
        elder_id=elder.id,
        firmware="1.0.0",
        status="offline"
    )
    session.add(device)
    session.commit()

    return elder

@router.get("/{elder_id}")
def get_elder(elder_id: int, session: Session = Depends(get_session)):
    elder = session.get(Elder, elder_id)
    if not elder:
        raise HTTPException(status_code=404, detail="Elder not found")
    return elder

@router.put("/{elder_id}")
def update_elder(elder_id: int, req: ElderCreateRequest, session: Session = Depends(get_session)):
    elder = session.get(Elder, elder_id)
    if not elder:
        raise HTTPException(status_code=404, detail="Elder not found")
    for key, val in req.dict().items():
        setattr(elder, key, val)
    session.add(elder)
    session.commit()
    session.refresh(elder)
    return elder

@router.post("/{elder_id}/consent")
def accept_consent(elder_id: int, session: Session = Depends(get_session)):
    """FR-4: Onboarding consent screen acceptance."""
    elder = session.get(Elder, elder_id)
    if not elder:
        raise HTTPException(status_code=404, detail="Elder not found")
    elder.consent_accepted_at = datetime.datetime.utcnow()
    session.add(elder)
    session.commit()
    return {"status": "success", "consent_accepted_at": elder.consent_accepted_at}

@router.post("/{elder_id}/away-mode")
def toggle_away_mode(elder_id: int, away: bool, session: Session = Depends(get_session)):
    """FR-14: Away / hospital / visitor present mode toggle."""
    elder = session.get(Elder, elder_id)
    if not elder:
        raise HTTPException(status_code=404, detail="Elder not found")
    elder.away_mode = away
    session.add(elder)
    session.commit()
    return {"status": "success", "away_mode": elder.away_mode}

@router.get("/{elder_id}/contacts")
def get_contacts(elder_id: int, session: Session = Depends(get_session)):
    relations = session.exec(
        select(ElderCaregiver).where(ElderCaregiver.elder_id == elder_id).order_by(ElderCaregiver.priority.asc())
    ).all()
    results = []
    for rel in relations:
        user = session.get(User, rel.user_id)
        if user:
            results.append({
                "relation_id": rel.id,
                "user_id": user.id,
                "name": user.name,
                "phone": user.phone,
                "email": user.email,
                "priority": rel.priority,
                "relationship": rel.relationship
            })
    return results

@router.post("/{elder_id}/contacts")
def add_contact(elder_id: int, req: ContactAddRequest, session: Session = Depends(get_session)):
    """FR-2: Add emergency contacts with priority order."""
    elder = session.get(Elder, elder_id)
    if not elder:
        raise HTTPException(status_code=404, detail="Elder not found")

    # Find or create user
    email = req.email or f"{req.name.lower().replace(' ', '')}@demo.careguard"
    user = session.exec(select(User).where(User.phone == req.phone)).first()
    if not user:
        user = User(
            name=req.name,
            phone=req.phone,
            email=email,
            password_hash="mock_hash",
            role="caregiver"
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    relation = ElderCaregiver(
        elder_id=elder_id,
        user_id=user.id,
        priority=req.priority,
        relationship=req.relationship
    )
    session.add(relation)
    session.commit()
    session.refresh(relation)
    return {"status": "success", "relation_id": relation.id, "user_id": user.id}

@router.get("/{elder_id}/settings")
def get_settings(elder_id: int, session: Session = Depends(get_session)):
    s = session.exec(select(ElderSettings).where(ElderSettings.elder_id == elder_id)).first()
    if not s:
        s = ElderSettings(elder_id=elder_id)
        session.add(s)
        session.commit()
        session.refresh(s)
    return s

@router.put("/{elder_id}/settings")
def update_settings(elder_id: int, req: SettingsUpdateRequest, session: Session = Depends(get_session)):
    s = session.exec(select(ElderSettings).where(ElderSettings.elder_id == elder_id)).first()
    if not s:
        s = ElderSettings(elder_id=elder_id)
    for key, val in req.dict(exclude_unset=True).items():
        if val is not None:
            setattr(s, key, val)
    session.add(s)
    session.commit()
    session.refresh(s)
    return s
