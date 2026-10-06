import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "Suyog AI"
    APP_ENV: str = "development"
    SECRET_KEY: str = "careguard_super_secret_jwt_key_change_in_production_32chars"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALGORITHM: str = "HS256"

    # Database
    DATABASE_URL: str = "sqlite:///./careguard.db"

    # MQTT Broker Configuration
    MQTT_BROKER_HOST: str = "broker.hivemq.com"
    MQTT_BROKER_PORT: int = 1883
    MQTT_CLIENT_ID: str = "careguard_backend_server"
    MQTT_USERNAME: Optional[str] = None
    MQTT_PASSWORD: Optional[str] = None
    MQTT_KEEPALIVE: int = 60
    MQTT_TOPIC_PREFIX: str = "careguard"

    # Safety Guardrail: Set to true ONLY to enable real SMS/Calls/112
    ENABLE_REAL_ALERTS: bool = False

    # Notification Provider: mock | twilio | msg91
    NOTIFICATION_PROVIDER: str = "mock"

    # Twilio
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_PHONE: Optional[str] = None

    # MSG91
    MSG91_AUTH_KEY: Optional[str] = None
    MSG91_SENDER_ID: Optional[str] = None
    MSG91_TEMPLATE_ID: Optional[str] = None

    # Emergency configuration
    EMERGENCY_NUMBER_POLICE: str = "112"
    EMERGENCY_NUMBER_AMBULANCE: str = "108"
    DEFAULT_HOSPITAL_PHONE: str = "+919876543210"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
