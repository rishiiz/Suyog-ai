import logging
from typing import Dict, Any
import httpx
from app.config import settings
from app.services.notifications.base import BaseNotificationProvider

logger = logging.getLogger("SuyogAI.TwilioNotifier")

class TwilioProvider(BaseNotificationProvider):
    """Twilio SMS & Voice provider."""

    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.from_phone = settings.TWILIO_FROM_PHONE

    async def send_sms(self, to_phone: str, message: str) -> Dict[str, Any]:
        if not settings.ENABLE_REAL_ALERTS or not self.account_sid or not self.auth_token:
            logger.warning("[Twilio] Real alerts disabled or credentials missing. Suppressing real SMS.")
            return {"success": False, "reason": "Real alerts disabled or missing Twilio credentials"}

        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        data = {
            "From": self.from_phone,
            "To": to_phone,
            "Body": message
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, data=data, auth=(self.account_sid, self.auth_token))
            if resp.status_code in [200, 201]:
                return {"success": True, "provider": "twilio", "data": resp.json()}
            logger.error(f"[Twilio] SMS failed: {resp.text}")
            return {"success": False, "error": resp.text}

    async def make_voice_call(self, to_phone: str, text_or_url: str) -> Dict[str, Any]:
        if not settings.ENABLE_REAL_ALERTS or not self.account_sid or not self.auth_token:
            logger.warning("[Twilio] Real alerts disabled or credentials missing. Suppressing real Voice call.")
            return {"success": False, "reason": "Real alerts disabled or missing Twilio credentials"}

        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Calls.json"
        # TwiML for speech synthesis
        twiml = f"<Response><Say voice='alice' language='en-IN'>{text_or_url}</Say></Response>"
        data = {
            "From": self.from_phone,
            "To": to_phone,
            "Twiml": twiml
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, data=data, auth=(self.account_sid, self.auth_token))
            if resp.status_code in [200, 201]:
                return {"success": True, "provider": "twilio", "data": resp.json()}
            logger.error(f"[Twilio] Voice call failed: {resp.text}")
            return {"success": False, "error": resp.text}
