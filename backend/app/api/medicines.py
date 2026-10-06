import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models.medicine import Medicine, MedicineSchedule, MedicineLog

router = APIRouter(prefix="", tags=["Medicines"])

class MedicineCreateRequest(BaseModel):
    name: str
    dosage: str
    instructions: Optional[str] = None
    critical: bool = False
    stock: int = 30
    # Schedule fields
    time: str  # "09:00"
    days_of_week: Optional[str] = "daily"
    compartment: Optional[int] = 1

class ManualConfirmRequest(BaseModel):
    notes: Optional[str] = "Confirmed by caregiver via dashboard"

@router.get("/elders/{elder_id}/medicines")
def list_medicines(elder_id: int, session: Session = Depends(get_session)):
    meds = session.exec(select(Medicine).where(Medicine.elder_id == elder_id)).all()
    results = []
    for m in meds:
        schedules = session.exec(select(MedicineSchedule).where(MedicineSchedule.medicine_id == m.id)).all()
        results.append({
            "id": m.id,
            "elder_id": m.elder_id,
            "name": m.name,
            "dosage": m.dosage,
            "instructions": m.instructions,
            "critical": m.critical,
            "stock": m.stock,
            "schedules": schedules
        })
    return results

@router.post("/elders/{elder_id}/medicines")
def create_medicine(elder_id: int, req: MedicineCreateRequest, session: Session = Depends(get_session)):
    med = Medicine(
        elder_id=elder_id,
        name=req.name,
        dosage=req.dosage,
        instructions=req.instructions,
        critical=req.critical,
        stock=req.stock
    )
    session.add(med)
    session.commit()
    session.refresh(med)

    sched = MedicineSchedule(
        medicine_id=med.id,
        time=req.time,
        days_of_week=req.days_of_week or "daily",
        compartment=req.compartment or 1
    )
    session.add(sched)
    session.commit()
    session.refresh(sched)

    return {"medicine": med, "schedule": sched}

@router.get("/elders/{elder_id}/medicine-logs")
def get_medicine_logs(elder_id: int, limit: int = 50, session: Session = Depends(get_session)):
    logs = session.exec(
        select(MedicineLog)
        .where(MedicineLog.elder_id == elder_id)
        .order_by(MedicineLog.due_ts.desc())
        .limit(limit)
    ).all()

    results = []
    for log in logs:
        sched = session.get(MedicineSchedule, log.schedule_id)
        med = session.get(Medicine, sched.medicine_id) if sched else None
        results.append({
            "id": log.id,
            "due_ts": log.due_ts.isoformat(),
            "status": log.status,
            "confirmed_ts": log.confirmed_ts.isoformat() if log.confirmed_ts else None,
            "method": log.method,
            "repeat_count": log.repeat_count,
            "medicine_name": med.name if med else "Unknown",
            "dosage": med.dosage if med else "",
            "compartment": sched.compartment if sched else 1
        })
    return results

@router.post("/medicine-logs/{log_id}/confirm")
def manual_confirm_medicine(log_id: int, req: ManualConfirmRequest, session: Session = Depends(get_session)):
    """FR-7 / Section 10: Manual caregiver confirmation of medicine intake."""
    log = session.get(MedicineLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Medicine log not found")

    log.status = "taken"
    log.confirmed_ts = datetime.datetime.utcnow()
    log.method = "caregiver"
    session.add(log)

    sched = session.get(MedicineSchedule, log.schedule_id)
    if sched:
        med = session.get(Medicine, sched.medicine_id)
        if med and med.stock > 0:
            med.stock -= 1
            session.add(med)

    session.commit()
    session.refresh(log)
    return {"status": "success", "log": log}

@router.get("/elders/{elder_id}/adherence")
def get_adherence(elder_id: int, session: Session = Depends(get_session)):
    """FR-9: Calculates medicine adherence percentage for today and past 7 days."""
    now = datetime.datetime.utcnow()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = day_start - datetime.timedelta(days=7)

    # Today's logs
    today_logs = session.exec(
        select(MedicineLog).where(MedicineLog.elder_id == elder_id, MedicineLog.due_ts >= day_start)
    ).all()

    # Week's logs
    week_logs = session.exec(
        select(MedicineLog).where(MedicineLog.elder_id == elder_id, MedicineLog.due_ts >= week_start)
    ).all()

    def calc_pct(logs):
        if not logs:
            return 100.0
        taken_count = sum(1 for l in logs if l.status in ["taken", "late"])
        return round((taken_count / len(logs)) * 100, 1)

    return {
        "today_adherence_pct": calc_pct(today_logs),
        "today_total_doses": len(today_logs),
        "today_taken_doses": sum(1 for l in today_logs if l.status in ["taken", "late"]),
        "week_adherence_pct": calc_pct(week_logs),
        "week_total_doses": len(week_logs),
        "week_taken_doses": sum(1 for l in week_logs if l.status in ["taken", "late"])
    }
