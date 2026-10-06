import datetime
import logging
from typing import Dict, Any, List
from app.services.notifications.base import BaseNotificationProvider

logger = logging.getLogger("SuyogAI.MockNotifier")

class MockNotificationProvider(BaseNotificationProvider):
    """
    Mock notification provider for tests and demos.
    Captures all SMS and voice alerts in memory for dashboard display.
    """

    def __init__(self):
        self.history: List[Dict[str, Any]] = []

    async def send_sms(self, to_phone: str, message: str) -> Dict[str, Any]:
        clean_msg = message.encode("ascii", errors="replace").decode("ascii")
        entry = {
            "type": "SMS",
            "to": to_phone,
            "message": clean_msg,
            "status": "DELIVERED (SIMULATED)",
            "ts": datetime.datetime.utcnow().isoformat()
        }
        self.history.append(entry)
        logger.info(f"[MOCK SMS] >>> To: {to_phone} | Message: {clean_msg}")
        print(f"\n[MOCK SMS TO {to_phone}]: {clean_msg}\n")
        return {"success": True, "provider": "mock", "id": len(self.history), **entry}

    async def make_voice_call(self, to_phone: str, text_or_url: str) -> Dict[str, Any]:
        clean_audio = text_or_url.encode("ascii", errors="replace").decode("ascii")
        entry = {
            "type": "VOICE_CALL",
            "to": to_phone,
            "message": clean_audio,
            "status": "ANSWERED (SIMULATED)",
            "ts": datetime.datetime.utcnow().isoformat()
        }
        self.history.append(entry)
        logger.info(f"[MOCK VOICE] >>> Calling: {to_phone} | Audio: {clean_audio}")
        print(f"\n[MOCK VOICE CALL TO {to_phone}]: {clean_audio}\n")
        return {"success": True, "provider": "mock", "id": len(self.history), **entry}

    def get_recent_notifications(self, limit: int = 50) -> List[Dict[str, Any]]:
        return list(reversed(self.history))[:limit]

    def clear_history(self):
        self.history.clear()

mock_notifier = MockNotificationProvider()
