import pytest
import datetime
from sqlmodel import Session, SQLModel, create_engine, select
from app.models.elder import Elder, ElderSettings
from app.models.user import User, ElderCaregiver
from app.models.alert import Alert, AlertAction
from app.models.device import Device
from app.services.escalation_engine import EscalationEngine
from app.services.notifications import mock_notifier

@pytest.fixture
def session():
    test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(test_engine)
    with Session(test_engine) as s:
        yield s

@pytest.fixture(autouse=True)
def clean_mock_notifier():
    mock_notifier.clear_history()

@pytest.mark.asyncio
async def test_panic_enters_stage1_immediately(session: Session):
    elder = Elder(name="Panic Test Elder", age=72, address="Pune", phone="+919800000001")
    session.add(elder)
    session.commit()
    session.refresh(elder)

    caregiver = User(name="Primary Caregiver", email="primary@test.com", phone="+919800000002", password_hash="x")
    session.add(caregiver)
    session.commit()
    session.refresh(caregiver)

    rel = ElderCaregiver(elder_id=elder.id, user_id=caregiver.id, priority=1)
    session.add(rel)
    session.commit()

    alert = await EscalationEngine.create_alert(
        session=session,
        elder_id=elder.id,
        alert_type="panic",
        severity="critical"
    )

    # Panic button skips Stage 0 -> Stage 1
    assert alert.stage == 1
    assert alert.status == "active"

    # Verify SMS was dispatched to primary caregiver
    actions = session.exec(select(AlertAction).where(AlertAction.alert_id == alert.id)).all()
    assert len(actions) >= 1
    assert any(a.stage == 1 and a.target == caregiver.phone for a in actions)

@pytest.mark.asyncio
async def test_inactivity_starts_stage0_and_elder_cancels(session: Session):
    elder = Elder(name="Cancel Test Elder", age=80, address="Mumbai", phone="+919800000003")
    session.add(elder)
    session.commit()
    session.refresh(elder)

    alert = await EscalationEngine.create_alert(
        session=session,
        elder_id=elder.id,
        alert_type="inactivity",
        severity="high"
    )

    assert alert.stage == 0
    assert alert.status == "active"

    # Elder presses green button during Stage 0 cancel window
    cancelled_alert = EscalationEngine.cancel_stage0_alert(session, elder.id)
    assert cancelled_alert is not None
    assert cancelled_alert.status == "cancelled"
    assert "Elder" in cancelled_alert.acknowledged_by

@pytest.mark.asyncio
async def test_caregiver_acknowledgement_halts_escalation(session: Session):
    elder = Elder(name="Ack Test Elder", age=76, address="Nashik")
    session.add(elder)
    session.commit()
    session.refresh(elder)

    caregiver = User(name="Ack Caregiver", email="ack@test.com", phone="+919800000004", password_hash="x")
    session.add(caregiver)
    session.commit()
    session.refresh(caregiver)

    session.add(ElderCaregiver(elder_id=elder.id, user_id=caregiver.id, priority=1))
    session.commit()

    alert = await EscalationEngine.create_alert(session, elder.id, "panic", "critical")
    assert alert.status == "active"

    # Caregiver acknowledges alert via dashboard
    ack_alert = EscalationEngine.acknowledge_alert(session, alert.id, "Ack Caregiver")
    assert ack_alert.status == "acknowledged"

    # Attempting to run Stage 2 should do nothing because alert is no longer active
    await EscalationEngine.execute_stage(session, alert.id, stage=2)
    stage2_actions = session.exec(
        select(AlertAction).where(AlertAction.alert_id == alert.id, AlertAction.stage == 2)
    ).all()
    assert len(stage2_actions) == 0

@pytest.mark.asyncio
async def test_stage_execution_idempotency(session: Session):
    elder = Elder(name="Idempotent Elder", age=75, address="Nagpur")
    session.add(elder)
    session.commit()
    session.refresh(elder)

    caregiver = User(name="Idempotent Caregiver", email="idem@test.com", phone="+919800000005", password_hash="x")
    session.add(caregiver)
    session.commit()
    session.refresh(caregiver)

    session.add(ElderCaregiver(elder_id=elder.id, user_id=caregiver.id, priority=1))
    session.commit()

    alert = await EscalationEngine.create_alert(session, elder.id, "panic", "critical")

    # Run Stage 1 twice
    await EscalationEngine.execute_stage(session, alert.id, stage=1)
    await EscalationEngine.execute_stage(session, alert.id, stage=1)

    stage1_actions = session.exec(
        select(AlertAction).where(AlertAction.alert_id == alert.id, AlertAction.stage == 1)
    ).all()
    # Should only have 1 action recorded for this target in stage 1
    assert len(stage1_actions) == 1
