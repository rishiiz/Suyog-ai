import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.api import api_router
from app.services.mqtt_service import mqtt_service
from app.services.scheduler_service import start_scheduler, shutdown_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("SuyogAI.Main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Suyog AI database...")
    init_db()

    logger.info("Starting MQTT Ingestion Worker...")
    mqtt_service.start()

    logger.info("Starting Background Job Scheduler...")
    start_scheduler()

    yield

    logger.info("Stopping Suyog AI background services...")
    shutdown_scheduler()
    mqtt_service.stop()

app = FastAPI(
    title="Suyog AI Elder Care Monitor API",
    description="Backend API for Suyog AI — low-cost IoT elder monitoring, scheduled medicine reminders, and staged emergency escalation.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "env": settings.APP_ENV,
        "mqtt_connected": mqtt_service.connected,
        "real_alerts_enabled": settings.ENABLE_REAL_ALERTS,
        "notification_provider": settings.NOTIFICATION_PROVIDER
    }
