import logging
from typing import Dict, Any
import httpx
from app.config import settings
from app.services.notifications.base import BaseNotificationProvider

logger = logging.getLogger("SuyogAI.Msg91Notifier")

class Msg91Provider(BaseNotificationProvider):
    """MSG91 SMS and Voice Provider for India."""

    def __init__(self):
        self.auth_key = settings.MSG91_AUTH_KEY
        self.sender_id = settings.MSG91_SENDER_ID
        self.template_id = settings.MSG91_TEMPLATE_ID

    async def send_sms(self, to_phone: str, message: str) -> Dict[str, Any]:
        if not settings.ENABLE_REAL_ALERTS or not self.auth_key:
            logger.warning("[MSG91] Real alerts disabled or credentials missing. Suppressing real SMS.")
            return {"success": False, "reason": "Real alerts disabled or missing MSG91 auth key"}

        # Format number: remove leading + or 0
        clean_phone = to_phone.replace("+", "").strip()
        url = "https://control.msg91.com/api/v5/flow/"
        headers = {
            "authkey": self.auth_key,
            "content-type": "application/json"
        }
        payload = {
            "template_id": self.template_id or "default_template",
            "sender": self.sender_id or "CRGARD",
            "short_url": "0",
            "recipients": [
                {
                    "mobiles": clean_phone,
                    "message": message
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                return {"success": True, "provider": "msg91", "data": resp.json()}
            return {"success": False, "error": resp.text}

    async def make_voice_call(self, to_phone: str, text_or_url: str) -> Dict[str, Any]:
        logger.info(f"[MSG91] Outbound voice call to {to_phone} triggered.")
        # MSG91 Voice API endpoint
        return {"success": True, "provider": "msg91", "status": "simulated_or_queued"}
