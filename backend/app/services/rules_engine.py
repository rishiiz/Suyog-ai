import datetime
import json
import logging
from typing import Optional, Dict, Any, List
from sqlmodel import Session, select
from app.models.elder import Elder, ElderSettings
from app.models.device import Device, DeviceEvent
from app.models.medicine import Medicine, MedicineSchedule, MedicineLog
from app.models.alert import Alert

logger = logging.getLogger("SuyogAI.RulesEngine")

def is_within_sleep_hours(check_time: datetime.time, sleep_start_str: str, sleep_end_str: str) -> bool:
    """Helper to determine if a given time is in configured sleep window."""
    try:
        sh, sm = map(int, sleep_start_str.split(":"))
        eh, em = map(int, sleep_end_str.split(":"))
        start = datetime.time(sh, sm)
        end = datetime.time(eh, em)

        if start > end:  # Across midnight e.g. 22:00 to 07:00
            return check_time >= start or check_time <= end
        else:
            return start <= check_time <= end
    except Exception as e:
        logger.error(f"Error parsing sleep hours: {e}")
        return False

class RulesEngine:
    """
    Evaluates elder care safety rules:
    - Inactivity thresholds (day vs night)
    - Morning activity verification
    - Critical medicine adherence
    - Away mode alert suppression
    """

    @staticmethod
    def check_inactivity(session: Session, elder_id: int, current_dt: Optional[datetime.datetime] = None) -> Optional[Dict[str, Any]]:
        if current_dt is None:
            current_dt = datetime.datetime.utcnow()

        elder = session.get(Elder, elder_id)
        if not elder:
            return None

        # FR-14: Suppress inactivity alerts if Away Mode is enabled
        if elder.away_mode:
            logger.info(f"Elder {elder_id} is in Away Mode. Inactivity checks suppressed.")
            return None

        settings = session.exec(select(ElderSettings).where(ElderSettings.elder_id == elder_id)).first()
        if not settings:
            settings = ElderSettings(elder_id=elder_id)

        # Get device associated with elder
        device = session.exec(select(Device).where(Device.elder_id == elder_id)).first()
        if not device or device.status != "online":
            return None

        # Determine threshold based on current time of day
        in_sleep = is_within_sleep_hours(current_dt.time(), settings.sleep_start, settings.sleep_end)
        allowed_inactive_hours = settings.inactivity_night_hours if in_sleep else settings.inactivity_day_hours

        # Find the latest motion event for this device
        latest_motion = session.exec(
            select(DeviceEvent)
            .where(DeviceEvent.device_id == device.device_id, DeviceEvent.type == "motion")
            .order_by(DeviceEvent.ts.desc())
        ).first()

        # If no motion recorded, check device creation/last_seen time
        last_motion_time = latest_motion.ts if latest_motion else (device.last_seen or elder.created_at)
        inactive_seconds = (current_dt - last_motion_time).total_seconds()
        threshold_seconds = allowed_inactive_hours * 3600

        if inactive_seconds >= threshold_seconds:
            # Check if an active inactivity alert already exists
            existing_alert = session.exec(
                select(Alert).where(
                    Alert.elder_id == elder_id,
                    Alert.type == "inactivity",
                    Alert.status == "active"
                )
            ).first()

            if not existing_alert:
                return {
                    "elder_id": elder_id,
                    "type": "inactivity",
                    "severity": "high",
                    "inactive_hours": round(inactive_seconds / 3600, 1),
                    "threshold_hours": allowed_inactive_hours,
                    "in_sleep_window": in_sleep,
                    "last_motion_ts": last_motion_time.isoformat()
                }

        return None

    @staticmethod
    def check_morning_activity(session: Session, elder_id: int, current_dt: Optional[datetime.datetime] = None) -> Optional[Dict[str, Any]]:
        """FR-13: Raises an alert if no motion occurred by configured morning time."""
        if current_dt is None:
            current_dt = datetime.datetime.utcnow()

        elder = session.get(Elder, elder_id)
        if not elder or elder.away_mode:
            return None

        settings = session.exec(select(ElderSettings).where(ElderSettings.elder_id == elder_id)).first()
        if not settings:
            return None

        mh, mm = map(int, settings.morning_check_time.split(":"))
        morning_check = datetime.time(mh, mm)

        # Only trigger at or after the morning check time
        if current_dt.time() < morning_check:
            return None

        device = session.exec(select(Device).where(Device.elder_id == elder_id)).first()
        if not device or device.status != "online":
            return None

        # Look for motion today since sleep_end
        sh, sm = map(int, settings.sleep_end.split(":"))
        today_wake_time = current_dt.replace(hour=sh, minute=sm, second=0, microsecond=0)

        morning_motion = session.exec(
            select(DeviceEvent).where(
                DeviceEvent.device_id == device.device_id,
                DeviceEvent.type == "motion",
                DeviceEvent.ts >= today_wake_time
            )
        ).first()

        if not morning_motion:
            # Check if already alerted today
            existing_alert = session.exec(
                select(Alert).where(
                    Alert.elder_id == elder_id,
                    Alert.type == "no_morning_activity",
                    Alert.created_ts >= today_wake_time
                )
            ).first()

            if not existing_alert:
                return {
                    "elder_id": elder_id,
                    "type": "no_morning_activity",
                    "severity": "high",
                    "message": f"No activity detected since waking hour ({settings.sleep_end}) by check time ({settings.morning_check_time})."
                }

        return None

    @staticmethod
    def check_critical_medicine_adherence(session: Session, elder_id: int) -> Optional[Dict[str, Any]]:
        """
        FR-8 & Section 8: Trigger alert if two consecutive doses of a critical medicine are missed.
        """
        critical_meds = session.exec(
            select(Medicine).where(Medicine.elder_id == elder_id, Medicine.critical == True)
        ).all()

        for med in critical_meds:
            schedules = session.exec(
                select(MedicineSchedule).where(MedicineSchedule.medicine_id == med.id)
            ).all()
            schedule_ids = [s.id for s in schedules]
            if not schedule_ids:
                continue

            # Fetch last 2 logs for these schedules
            recent_logs = session.exec(
                select(MedicineLog)
                .where(MedicineLog.schedule_id.in_(schedule_ids))
                .order_by(MedicineLog.due_ts.desc())
                .limit(2)
            ).all()

            if len(recent_logs) >= 2 and all(log.status == "missed" for log in recent_logs):
                existing_alert = session.exec(
                    select(Alert).where(
                        Alert.elder_id == elder_id,
                        Alert.type == "missed_critical_medicine",
                        Alert.status == "active"
                    )
                ).first()

                if not existing_alert:
                    return {
                        "elder_id": elder_id,
                        "type": "missed_critical_medicine",
                        "severity": "high",
                        "medicine_id": med.id,
                        "medicine_name": med.name,
                        "message": f"Two consecutive doses of critical medicine '{med.name}' ({med.dosage}) were missed!"
                    }

        return None
