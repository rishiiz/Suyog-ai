from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseNotificationProvider(ABC):
    """Abstract base class for SMS and voice notification providers."""

    @abstractmethod
    async def send_sms(self, to_phone: str, message: str) -> Dict[str, Any]:
        """Send an outbound SMS message."""
        pass

    @abstractmethod
    async def make_voice_call(self, to_phone: str, text_or_url: str) -> Dict[str, Any]:
        """Initiate an outbound voice phone call with automated speech."""
        pass
