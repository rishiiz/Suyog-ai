import datetime
import json
import logging
from typing import Optional, Dict, Any, List
from sqlmodel import Session, select
from app.config import settings
from app.models.elder import Elder, ElderSettings
from app.models.user import User, ElderCaregiver
from app.models.alert import Alert, AlertAction
from app.models.device import Device
from app.services.notifications import get_notification_provider

logger = logging.getLogger("SuyogAI.EscalationEngine")

# Fixed template for emergency messages (No free-form LLM hallucination - PRD Section 8)
EMERGENCY_TEMPLATE = (
    "EMERGENCY ALERT: Suyog AI notification for {name}, age {age}.\n"
    "Address: {address}, Landmark: {landmark}.\n"
    "Blood Group: {blood_group} | Conditions: {conditions} | Allergies: {allergies}.\n"
    "Event: {event_type} triggered at {time}.\n"
    "Action: Immediate assistance required. Call 112 / 108 or hospital: {preferred_hospital}."
)

class EscalationEngine:
    """
    Manages the 4-stage emergency escalation state machine:
    - Stage 0 (0-60s): Local Hub buzzer + OLED cancel window.
    - Stage 1 (1-3 min): Primary caregiver SMS + Voice call.
    - Stage 2 (3-6 min): Secondary contacts in priority order.
    - Stage 3 (6-10 min): Emergency services step / Call 112 instruction.
    """

    @staticmethod
    async def create_alert(
        session: Session,
        elder_id: int,
        alert_type: str,
        severity: str = "high",
        note: Optional[str] = None,
        mqtt_service = None
    ) -> Alert:
        # Check if an active alert of this type exists to avoid spamming
        existing = session.exec(
            select(Alert).where(
                Alert.elder_id == elder_id,
                Alert.type == alert_type,
                Alert.status == "active"
            )
        ).first()
        if existing:
            return existing

        # Panic buttons skip Stage 0 and immediately enter Stage 1 (PRD Section 8)
        initial_stage = 1 if alert_type == "panic" else 0

        alert = Alert(
            elder_id=elder_id,
            type=alert_type,
            severity=severity,
            stage=initial_stage,
            status="active",
            created_ts=datetime.datetime.utcnow(),
            note=note
        )
        session.add(alert)
        session.commit()
        session.refresh(alert)
        logger.info(f"Created new Alert ID {alert.id} [Type: {alert_type}, Severity: {severity}, Initial Stage: {initial_stage}]")

        # Execute initial stage immediately
        await EscalationEngine.execute_stage(session, alert.id, initial_stage, mqtt_service)
        return alert

    @staticmethod
    async def execute_stage(
        session: Session,
        alert_id: int,
        stage: int,
        mqtt_service = None
    ):
        alert = session.get(Alert, alert_id)
        if not alert or alert.status != "active":
            logger.info(f"Alert {alert_id} is no longer active (status: {alert.status if alert else 'None'}). Skipping stage {stage}.")
            return

        elder = session.get(Elder, alert.elder_id)
        if not elder:
            return

        alert_settings = session.exec(select(ElderSettings).where(ElderSettings.elder_id == elder.id)).first()
        notifier = get_notification_provider()

        logger.info(f"Executing Escalation Stage {stage} for Alert {alert_id} ({alert.type})")

        # STAGE 0: Local Alert on Device Hub
        if stage == 0:
            device = session.exec(select(Device).where(Device.elder_id == elder.id)).first()
            if device and mqtt_service:
                mqtt_service.send_command(device.device_id, {
                    "cmd": "local_alert",
                    "reason": f"{alert.type.replace('_', ' ').title()}"
                })
            action = AlertAction(
                alert_id=alert.id,
                stage=0,
                channel="local_hub",
                target=device.device_id if device else "unknown",
                result="success",
                message="Local buzzer & OLED alert activated on Hub with 60s cancel window."
            )
            session.add(action)
            session.commit()

        # STAGE 1: Primary Caregiver Notification
        elif stage == 1:
            # Find primary contact (priority = 1)
            primary_relation = session.exec(
                select(ElderCaregiver)
                .where(ElderCaregiver.elder_id == elder.id, ElderCaregiver.priority == 1)
            ).first()

            contacts_to_notify = []
            if primary_relation:
                user = session.get(User, primary_relation.user_id)
                if user and user.phone:
                    contacts_to_notify.append(user)
            elif elder.phone:
                # Fallback to elder phone if no caregiver registered
                contacts_to_notify.append(User(name="Primary Contact", phone=elder.phone, email="", password_hash=""))

            msg_text = (
                f"[CAREGUARD ALERT]: {alert.type.upper().replace('_', ' ')} detected for {elder.name}!\n"
                f"Address: {elder.address} ({elder.landmark or 'No landmark'})\n"
                f"Time: {alert.created_ts.strftime('%H:%M:%S UTC')}\n"
                f"Please check on them immediately or open dashboard to acknowledge."
            )

            for contact in contacts_to_notify:
                # Idempotency check: don't resend to same contact in same stage
                already_sent = session.exec(
                    select(AlertAction).where(
                        AlertAction.alert_id == alert.id,
                        AlertAction.stage == 1,
                        AlertAction.target == contact.phone
                    )
                ).first()
                if not already_sent:
                    # Send SMS
                    sms_res = await notifier.send_sms(contact.phone, msg_text)
                    # Voice Call
                    call_res = await notifier.make_voice_call(
                        contact.phone,
                        f"Emergency alert for {elder.name}. {alert.type.replace('_', ' ')} detected. Please check dashboard."
                    )

                    action = AlertAction(
                        alert_id=alert.id,
                        stage=1,
                        channel="sms_and_voice",
                        target=contact.phone,
                        result="success" if (sms_res.get("success") or call_res.get("success")) else "simulated",
                        message=f"Primary contact {contact.name} ({contact.phone}) notified via SMS & Voice."
                    )
                    session.add(action)
            session.commit()

        # STAGE 2: Secondary Contacts in Priority Order
        elif stage == 2:
            secondary_relations = session.exec(
                select(ElderCaregiver)
                .where(ElderCaregiver.elder_id == elder.id, ElderCaregiver.priority > 1)
                .order_by(ElderCaregiver.priority.asc())
            ).all()

            msg_text = (
                f"[CAREGUARD UNRESPONDED ALERT]: {elder.name} triggered {alert.type.upper()}.\n"
                f"Primary caregiver has not acknowledged after 3 minutes.\n"
                f"Address: {elder.address}. Please assist immediately."
            )

            for rel in secondary_relations:
                user = session.get(User, rel.user_id)
                if user and user.phone:
                    already_sent = session.exec(
                        select(AlertAction).where(
                            AlertAction.alert_id == alert.id,
                            AlertAction.stage == 2,
                            AlertAction.target == user.phone
                        )
                    ).first()
                    if not already_sent:
                        sms_res = await notifier.send_sms(user.phone, msg_text)
                        await notifier.make_voice_call(user.phone, f"Unresponded emergency alert for {elder.name}.")
                        action = AlertAction(
                            alert_id=alert.id,
                            stage=2,
                            channel="sms_and_voice",
                            target=user.phone,
                            result="success" if sms_res.get("success") else "simulated",
                            message=f"Secondary contact (Priority {rel.priority}) {user.name} ({user.phone}) notified."
                        )
                        session.add(action)
            session.commit()

        # STAGE 3: Emergency Services Step
        elif stage == 3:
            already_executed = session.exec(
                select(AlertAction).where(
                    AlertAction.alert_id == alert.id,
                    AlertAction.stage == 3
                )
            ).first()
            if already_executed:
                return

            formatted_msg = EMERGENCY_TEMPLATE.format(
                name=elder.name,
                age=elder.age,
                address=elder.address,
                landmark=elder.landmark or "N/A",
                blood_group=elder.blood_group or "Unknown",
                conditions=elder.conditions or "None recorded",
                allergies=elder.allergies or "None recorded",
                event_type=alert.type.upper(),
                time=alert.created_ts.strftime('%H:%M:%S UTC'),
                preferred_hospital=elder.preferred_hospital or settings.DEFAULT_HOSPITAL_PHONE
            )

            # Pluggable option: Check if real emergency service calls are enabled and consent accepted
            can_contact_real_services = (
                settings.ENABLE_REAL_ALERTS and
                elder.consent_accepted_at is not None and
                alert_settings and alert_settings.enable_emergency_services
            )

            if can_contact_real_services:
                # Real call to hospital or configured dispatch
                hospital_phone = elder.preferred_hospital or settings.DEFAULT_HOSPITAL_PHONE
                await notifier.send_sms(hospital_phone, formatted_msg)
                await notifier.make_voice_call(hospital_phone, formatted_msg)
                result_desc = f"Outbound dispatch initiated to hospital {hospital_phone}."
            else:
                # Default Option (a): Prominent notify to all caregivers with "Call 112 now" instruction
                result_desc = "Emergency Stage 3 triggered: Caregivers broadcasted with Call 112 / Hospital instruction."
                # Broadcast SMS to all caregivers
                caregivers = session.exec(select(ElderCaregiver).where(ElderCaregiver.elder_id == elder.id)).all()
                for cg in caregivers:
                    cg_user = session.get(User, cg.user_id)
                    if cg_user and cg_user.phone:
                        await notifier.send_sms(
                            cg_user.phone,
                            f"[CRITICAL ESCALATION (STAGE 3)]: Nobody has acknowledged alert for {elder.name}.\n"
                            f"PLEASE CALL 112 IMMEDIATELY!\n"
                            f"Address: {elder.address}\nHospital: {elder.preferred_hospital or settings.DEFAULT_HOSPITAL_PHONE}"
                        )

            action = AlertAction(
                alert_id=alert.id,
                stage=3,
                channel="emergency_services",
                target=elder.preferred_hospital or settings.EMERGENCY_NUMBER_POLICE,
                result="success",
                message=result_desc
            )
            session.add(action)
            session.commit()

        # Update alert current stage
        alert.stage = stage
        session.add(alert)
        session.commit()

    @staticmethod
    def acknowledge_alert(session: Session, alert_id: int, responder_name: str) -> Optional[Alert]:
        alert = session.get(Alert, alert_id)
        if not alert or alert.status != "active":
            return None

        alert.status = "acknowledged"
        alert.acknowledged_by = responder_name
        alert.acknowledged_ts = datetime.datetime.utcnow()

        action = AlertAction(
            alert_id=alert.id,
            stage=alert.stage,
            channel="dashboard",
            target=responder_name,
            result="success",
            message=f"Alert acknowledged by {responder_name}. Escalation stopped."
        )
        session.add(alert)
        session.add(action)
        session.commit()
        session.refresh(alert)
        logger.info(f"Alert {alert_id} acknowledged by {responder_name}. Escalation halted.")
        return alert

    @staticmethod
    def cancel_stage0_alert(session: Session, elder_id: int) -> Optional[Alert]:
        """Called when elder presses the green button during Stage 0 cancel window."""
        alert = session.exec(
            select(Alert).where(
                Alert.elder_id == elder_id,
                Alert.stage == 0,
                Alert.status == "active"
            )
        ).first()

        if alert:
            alert.status = "cancelled"
            alert.acknowledged_by = "Elder (Green Button Press)"
            alert.resolved_ts = datetime.datetime.utcnow()

            action = AlertAction(
                alert_id=alert.id,
                stage=0,
                channel="hub_green_button",
                target="hub",
                result="success",
                message="Alert cancelled locally by elder within Stage 0 cancel window."
            )
            session.add(alert)
            session.add(action)
            session.commit()
            session.refresh(alert)
            logger.info(f"Alert {alert.id} cancelled by elder via green button.")
            return alert

        return None
