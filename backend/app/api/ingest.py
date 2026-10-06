from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.mqtt_service import mqtt_service

router = APIRouter(prefix="", tags=["Ingestion Fallback"])

class IngestEventRequest(BaseModel):
    event_type: str  # motion | button | pill | heartbeat
    payload: Dict[str, Any]

@router.post("/ingest/{device_id}")
async def http_ingest_event(device_id: str, req: IngestEventRequest):
    """
    Section 10: Optional HTTPS POST ingestion fallback when MQTT port 1883 is blocked.
    """
    await mqtt_service.process_device_message(device_id, req.event_type, req.payload)
    return {"status": "success", "device_id": device_id, "event_type": req.event_type}
