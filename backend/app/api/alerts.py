from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from app.database import get_session
from app.models.alert import Alert, AlertAction
from app.models.elder import Elder
from app.services.escalation_engine import EscalationEngine
from app.services.notifications import mock_notifier
from app.services.mqtt_service import mqtt_service

router = APIRouter(prefix="", tags=["Alerts"])

class AcknowledgeRequest(BaseModel):
    responder_name: Optional[str] = "Caregiver"

class TestAlertRequest(BaseModel):
    elder_id: int
    test_type: Optional[str] = "panic"

@router.get("/elders/{elder_id}/alerts")
def list_alerts(elder_id: int, status: Optional[str] = None, session: Session = Depends(get_session)):
    query = select(Alert).where(Alert.elder_id == elder_id)
    if status:
        query = query.where(Alert.status == status)
    query = query.order_by(Alert.created_ts.desc())
    alerts = session.exec(query).all()

    results = []
    for a in alerts:
        actions = session.exec(select(AlertAction).where(AlertAction.alert_id == a.id).order_by(AlertAction.ts.asc())).all()
        results.append({
            "id": a.id,
            "elder_id": a.elder_id,
            "type": a.type,
            "severity": a.severity,
            "stage": a.stage,
            "status": a.status,
            "created_ts": a.created_ts.isoformat(),
            "acknowledged_by": a.acknowledged_by,
            "acknowledged_ts": a.acknowledged_ts.isoformat() if a.acknowledged_ts else None,
            "resolved_ts": a.resolved_ts.isoformat() if a.resolved_ts else None,
            "note": a.note,
            "actions": actions
        })
    return results

@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, req: AcknowledgeRequest, session: Session = Depends(get_session)):
    """FR-16: Acknowledge via dashboard button or link. Halts escalation."""
    alert = EscalationEngine.acknowledge_alert(session, alert_id, req.responder_name or "Caregiver")
    if not alert:
        raise HTTPException(status_code=404, detail="Active alert not found or already acknowledged")
    return {"status": "success", "alert": alert}

@router.post("/elders/{elder_id}/alerts/clear")
def clear_all_alerts(elder_id: int, session: Session = Depends(get_session)):
    """Clear all active alerts for the elder."""
    import datetime
    active_alerts = session.exec(select(Alert).where(Alert.elder_id == elder_id, Alert.status == "active")).all()
    count = 0
    now = datetime.datetime.utcnow()
    for a in active_alerts:
        a.status = "resolved"
        a.acknowledged_by = "Caregiver (Batch Clear)"
        a.resolved_ts = now
        session.add(a)
        count += 1
    session.commit()
    return {"status": "success", "cleared_count": count}

@router.delete("/alerts/{alert_id}")
def delete_alert(alert_id: int, session: Session = Depends(get_session)):
    """Delete an individual alert permanently."""
    alert = session.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    actions = session.exec(select(AlertAction).where(AlertAction.alert_id == alert_id)).all()
    for act in actions:
        session.delete(act)
    session.delete(alert)
    session.commit()
    return {"status": "success", "deleted_id": alert_id}

@router.post("/alerts/test")
async def trigger_test_alert(req: TestAlertRequest, session: Session = Depends(get_session)):
    """
    FR-17: Test mode sends a full alert flow to caregivers only and never contacts emergency services.
    """
    elder = session.get(Elder, req.elder_id)
    if not elder:
        raise HTTPException(status_code=404, detail="Elder not found")

    alert = await EscalationEngine.create_alert(
        session=session,
        elder_id=req.elder_id,
        alert_type="test",
        severity="medium",
        note=f"Caregiver Test Alert Mode ({req.test_type}). Emergency services disabled.",
        mqtt_service=mqtt_service
    )
    return {"status": "success", "alert": alert}

@router.get("/alerts/notifications/live")
def get_live_notifications():
    """Returns recent mock SMS and voice calls for UI demo inspection."""
    return mock_notifier.get_recent_notifications(30)
