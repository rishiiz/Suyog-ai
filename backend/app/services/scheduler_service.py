import datetime
import json
import logging
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select
from app.database import engine
from app.models.elder import Elder, ElderSettings
from app.models.device import Device
from app.models.medicine import Medicine, MedicineSchedule, MedicineLog
from app.models.alert import Alert
from app.services.rules_engine import RulesEngine
from app.services.escalation_engine import EscalationEngine
from app.services.mqtt_service import mqtt_service

logger = logging.getLogger("SuyogAI.Scheduler")

scheduler = AsyncIOScheduler()

async def check_medicine_schedules():
    """FR-6: Checks scheduled medicines, issues reminder commands, handles repeats."""
    now = datetime.datetime.utcnow()
    # Note: Use current local/configured time for hour:minute comparison
    current_time_str = now.strftime("%H:%M")
    current_weekday = str(now.weekday())

    with Session(engine) as session:
        schedules = session.exec(select(MedicineSchedule)).all()
        for sched in schedules:
            # Check days of week
            if sched.days_of_week != "daily" and current_weekday not in sched.days_of_week.split(","):
                continue

            med = session.get(Medicine, sched.medicine_id)
            if not med:
                continue

            # 1. Check if due now
            if sched.time == current_time_str:
                # Avoid duplicate creation within the same minute
                minute_start = now.replace(second=0, microsecond=0)
                existing_log = session.exec(
                    select(MedicineLog).where(
                        MedicineLog.schedule_id == sched.id,
                        MedicineLog.due_ts >= minute_start
                    )
                ).first()

                if not existing_log:
                    log_entry = MedicineLog(
                        schedule_id=sched.id,
                        elder_id=med.elder_id,
                        due_ts=now,
                        status="pending",
                        repeat_count=0
                    )
                    session.add(log_entry)
                    session.commit()

                    # Send command to device hub
                    device = session.exec(select(Device).where(Device.elder_id == med.elder_id)).first()
                    if device:
                        mqtt_service.send_command(device.device_id, {
                            "cmd": "reminder_start",
                            "medicine": med.name,
                            "dose": med.dosage,
                            "compartment": sched.compartment or 1
                        })
                    logger.info(f"Triggered medicine reminder for {med.name} ({med.dosage}) to Elder {med.elder_id}")

        # 2. Check pending logs for repeat cycles (every 5 minutes, up to 3 times)
        active_pending = session.exec(
            select(MedicineLog).where(MedicineLog.status.in_(["pending", "late"]))
        ).all()

        for log in active_pending:
            elapsed_minutes = (now - log.due_ts).total_seconds() / 60.0
            expected_repeats = int(elapsed_minutes // 5)

            if expected_repeats > log.repeat_count:
                if expected_repeats <= 3:
                    log.repeat_count = expected_repeats
                    log.status = "late"
                    session.add(log)
                    session.commit()

                    sched = session.get(MedicineSchedule, log.schedule_id)
                    med = session.get(Medicine, sched.medicine_id) if sched else None
                    if med:
                        device = session.exec(select(Device).where(Device.elder_id == med.elder_id)).first()
                        if device:
                            mqtt_service.send_command(device.device_id, {
                                "cmd": "reminder_start",
                                "medicine": med.name,
                                "dose": med.dosage,
                                "repeat": log.repeat_count
                            })
                        logger.info(f"Medicine repeat #{log.repeat_count} for {med.name}")
                else:
                    # Exceeded 3 repeats without confirmation -> Mark MISSED
                    log.status = "missed"
                    session.add(log)
                    session.commit()

                    sched = session.get(MedicineSchedule, log.schedule_id)
                    med = session.get(Medicine, sched.medicine_id) if sched else None
                    if med and med.critical:
                        logger.warning(f"Critical medicine {med.name} marked MISSED for elder {med.elder_id}")
                        # Check consecutive missed doses
                        alert_dict = RulesEngine.check_critical_medicine_adherence(session, med.elder_id)
                        if alert_dict:
                            await EscalationEngine.create_alert(
                                session=session,
                                elder_id=med.elder_id,
                                alert_type="missed_critical_medicine",
                                severity="high",
                                note=alert_dict["message"],
                                mqtt_service=mqtt_service
                            )

async def check_inactivity_and_morning_activity():
    """FR-12 & FR-13: Periodic check for inactivity and morning check."""
    now = datetime.datetime.utcnow()
    with Session(engine) as session:
        elders = session.exec(select(Elder)).all()
        for elder in elders:
            # 1. Inactivity Rule Check
            inact_res = RulesEngine.check_inactivity(session, elder.id, current_dt=now)
            if inact_res:
                logger.warning(f"Inactivity detected for elder {elder.name} ({inact_res['inactive_hours']} hrs)")
                await EscalationEngine.create_alert(
                    session=session,
                    elder_id=elder.id,
                    alert_type="inactivity",
                    severity="high",
                    note=f"No room motion detected for {inact_res['inactive_hours']} hours.",
                    mqtt_service=mqtt_service
                )

            # 2. Morning Activity Rule Check
            morn_res = RulesEngine.check_morning_activity(session, elder.id, current_dt=now)
            if morn_res:
                logger.warning(f"Morning inactivity for elder {elder.name}")
                await EscalationEngine.create_alert(
                    session=session,
                    elder_id=elder.id,
                    alert_type="no_morning_activity",
                    severity="high",
                    note=morn_res["message"],
                    mqtt_service=mqtt_service
                )

async def check_escalation_progress():
    """
    FR-15 & Section 8: Monitors active alerts and steps through stages:
    Stage 0 (0-60s) -> Stage 1 (1-3 min) -> Stage 2 (3-6 min) -> Stage 3 (6-10 min)
    """
    now = datetime.datetime.utcnow()
    with Session(engine) as session:
        active_alerts = session.exec(select(Alert).where(Alert.status == "active")).all()
        for alert in active_alerts:
            settings_obj = session.exec(select(ElderSettings).where(ElderSettings.elder_id == alert.elder_id)).first()
            stage0_limit = 60
            stage1_limit = 180
            stage2_limit = 360
            if settings_obj and settings_obj.escalation_timings_json:
                try:
                    timings = json.loads(settings_obj.escalation_timings_json)
                    stage0_limit = timings.get("stage0_sec", 60)
                    stage1_limit = stage0_limit + timings.get("stage1_sec", 120)
                    stage2_limit = stage1_limit + timings.get("stage2_sec", 180)
                except Exception:
                    pass

            elapsed = (now - alert.created_ts).total_seconds()

            if alert.stage == 0 and elapsed >= stage0_limit:
                # Stage 0 cancel window expired without green button -> advance to Stage 1!
                logger.info(f"Alert {alert.id} Stage 0 expired ({elapsed:.1f}s). Advancing to Stage 1.")
                await EscalationEngine.execute_stage(session, alert.id, stage=1, mqtt_service=mqtt_service)

            elif alert.stage == 1 and elapsed >= stage1_limit:
                # Advance to Stage 2
                logger.info(f"Alert {alert.id} unacknowledged at {elapsed:.1f}s. Advancing to Stage 2.")
                await EscalationEngine.execute_stage(session, alert.id, stage=2, mqtt_service=mqtt_service)

            elif alert.stage == 2 and elapsed >= stage2_limit:
                # Advance to Stage 3
                logger.info(f"Alert {alert.id} unacknowledged at {elapsed:.1f}s. Advancing to Stage 3.")
                await EscalationEngine.execute_stage(session, alert.id, stage=3, mqtt_service=mqtt_service)

async def check_device_heartbeats():
    """Checks for offline devices (last_seen > 15 minutes)."""
    now = datetime.datetime.utcnow()
    threshold = now - datetime.timedelta(minutes=15)
    with Session(engine) as session:
        devices = session.exec(select(Device)).all()
        for dev in devices:
            if dev.last_seen and dev.last_seen < threshold and dev.status == "online":
                dev.status = "offline"
                session.add(dev)
                session.commit()
                logger.warning(f"Device {dev.device_id} is now OFFLINE (no heartbeat > 15m)")

                if dev.elder_id:
                    # Low severity alert for device offline
                    await EscalationEngine.create_alert(
                        session=session,
                        elder_id=dev.elder_id,
                        alert_type="device_offline",
                        severity="low",
                        note=f"Hub {dev.device_id} has not reported heartbeats for 15+ minutes.",
                        mqtt_service=mqtt_service
                    )

def start_scheduler():
    # Schedule periodic tasks
    scheduler.add_job(check_medicine_schedules, "interval", seconds=30, id="check_medicine_schedules")
    scheduler.add_job(check_inactivity_and_morning_activity, "interval", seconds=60, id="check_inactivity")
    scheduler.add_job(check_escalation_progress, "interval", seconds=10, id="check_escalation_progress")
    scheduler.add_job(check_device_heartbeats, "interval", minutes=2, id="check_device_heartbeats")

    if not scheduler.running:
        scheduler.start()
        logger.info("Suyog AI Scheduler started successfully.")

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Suyog AI Scheduler stopped.")
