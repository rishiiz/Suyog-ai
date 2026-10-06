from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.elders import router as elders_router
from app.api.medicines import router as medicines_router
from app.api.status import router as status_router
from app.api.alerts import router as alerts_router
from app.api.devices import router as devices_router
from app.api.ingest import router as ingest_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(elders_router)
api_router.include_router(medicines_router)
api_router.include_router(status_router)
api_router.include_router(alerts_router)
api_router.include_router(devices_router)
api_router.include_router(ingest_router)

__all__ = ["api_router"]
