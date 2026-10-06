from app.config import settings
from app.services.notifications.base import BaseNotificationProvider
from app.services.notifications.mock_provider import mock_notifier, MockNotificationProvider
from app.services.notifications.twilio_provider import TwilioProvider
from app.services.notifications.msg91_provider import Msg91Provider

def get_notification_provider() -> BaseNotificationProvider:
    provider = settings.NOTIFICATION_PROVIDER.lower()
    if provider == "twilio":
        return TwilioProvider()
    elif provider == "msg91":
        return Msg91Provider()
    else:
        return mock_notifier

__all__ = [
    "BaseNotificationProvider",
    "MockNotificationProvider",
    "TwilioProvider",
    "Msg91Provider",
    "get_notification_provider",
    "mock_notifier",
]
