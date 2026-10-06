import pytest
import datetime
from sqlmodel import Session, SQLModel, create_engine
from app.models.elder import Elder, ElderSettings
from app.models.device import Device, DeviceEvent
from app.models.medicine import Medicine, MedicineSchedule, MedicineLog
from app.services.rules_engine import RulesEngine, is_within_sleep_hours

@pytest.fixture
def session():
    test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(test_engine)
    with Session(test_engine) as s:
        yield s

def test_sleep_hours_helper():
    # 22:00 to 07:00 (across midnight)
    assert is_within_sleep_hours(datetime.time(23, 0), "22:00", "07:00") is True
    assert is_within_sleep_hours(datetime.time(3, 30), "22:00", "07:00") is True
    assert is_within_sleep_hours(datetime.time(6, 59), "22:00", "07:00") is True
    assert is_within_sleep_hours(datetime.time(7, 1), "22:00", "07:00") is False
    assert is_within_sleep_hours(datetime.time(14, 0), "22:00", "07:00") is False

def test_inactivity_rule_waking_hours(session: Session):
    # Elder active 4 hours ago during waking hours (threshold = 3h)
    elder = Elder(name="Test Elder", age=75, address="123 Test St", away_mode=False)
    session.add(elder)
    session.commit()
    session.refresh(elder)

    settings = ElderSettings(elder_id=elder.id, inactivity_day_hours=3.0, sleep_start="22:00", sleep_end="07:00")
    device = Device(device_id="cg_test_1", elder_id=elder.id, status="online")
    session.add_all([settings, device])
    session.commit()

    now = datetime.datetime(2026, 9, 21, 15, 0, 0) # 3:00 PM (waking hour)
    past_motion = now - datetime.timedelta(hours=4) # 4h ago

    event = DeviceEvent(device_id="cg_test_1", type="motion", payload_json='{"room":"livingroom","state":1}', ts=past_motion)
    session.add(event)
    session.commit()

    res = RulesEngine.check_inactivity(session, elder.id, current_dt=now)
    assert res is not None
    assert res["type"] == "inactivity"
    assert res["inactive_hours"] == 4.0
    assert res["in_sleep_window"] is False

def test_away_mode_suppresses_inactivity(session: Session):
    elder = Elder(name="Away Elder", age=80, address="456 Hill Rd", away_mode=True)
    session.add(elder)
    session.commit()
    session.refresh(elder)

    settings = ElderSettings(elder_id=elder.id, inactivity_day_hours=3.0)
    device = Device(device_id="cg_test_2", elder_id=elder.id, status="online")
    session.add_all([settings, device])
    session.commit()

    now = datetime.datetime(2026, 9, 21, 16, 0, 0)
    # 5 hours inactive but Away Mode is ON
    res = RulesEngine.check_inactivity(session, elder.id, current_dt=now)
    assert res is None # Must be suppressed!

def test_morning_activity_check(session: Session):
    elder = Elder(name="Morning Elder", age=78, address="789 Park Ave", away_mode=False)
    session.add(elder)
    session.commit()
    session.refresh(elder)

    settings = ElderSettings(
        elder_id=elder.id,
        sleep_end="07:00",
        morning_check_time="10:00"
    )
    device = Device(device_id="cg_test_3", elder_id=elder.id, status="online")
    session.add_all([settings, device])
    session.commit()

    # Before morning check time (e.g. 09:30) -> No alert
    now_early = datetime.datetime(2026, 9, 21, 9, 30, 0)
    assert RulesEngine.check_morning_activity(session, elder.id, current_dt=now_early) is None

    # At or after morning check time (e.g. 10:15) with no motion since 7:00 AM -> Triggers alert!
    now_late = datetime.datetime(2026, 9, 21, 10, 15, 0)
    res = RulesEngine.check_morning_activity(session, elder.id, current_dt=now_late)
    assert res is not None
    assert res["type"] == "no_morning_activity"

def test_consecutive_critical_medicine_missed(session: Session):
    elder = Elder(name="Medicine Elder", age=70, address="101 Lake Rd")
    session.add(elder)
    session.commit()
    session.refresh(elder)

    med = Medicine(elder_id=elder.id, name="Critical Heart Med", dosage="10mg", critical=True)
    session.add(med)
    session.commit()
    session.refresh(med)

    sched = MedicineSchedule(medicine_id=med.id, time="09:00", days_of_week="daily")
    session.add(sched)
    session.commit()
    session.refresh(sched)

    # 1 missed dose: no critical alert yet
    log1 = MedicineLog(
        schedule_id=sched.id,
        elder_id=elder.id,
        due_ts=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        status="missed"
    )
    session.add(log1)
    session.commit()
    assert RulesEngine.check_critical_medicine_adherence(session, elder.id) is None

    # 2 consecutive missed doses: triggers alert!
    log2 = MedicineLog(
        schedule_id=sched.id,
        elder_id=elder.id,
        due_ts=datetime.datetime.utcnow(),
        status="missed"
    )
    session.add(log2)
    session.commit()

    alert_dict = RulesEngine.check_critical_medicine_adherence(session, elder.id)
    assert alert_dict is not None
    assert alert_dict["type"] == "missed_critical_medicine"
    assert "Critical Heart Med" in alert_dict["message"]
