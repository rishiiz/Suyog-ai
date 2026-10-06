"""
Suyog AI Seed Data Script
Creates demo elder, caregiver, emergency contacts, medicine schedule, and device mapping.
"""
import datetime
from sqlmodel import Session, select
from app.database import engine, init_db
from app.models.user import User, ElderCaregiver
from app.models.elder import Elder, ElderSettings
from app.models.device import Device, DeviceSensor
from app.models.medicine import Medicine, MedicineSchedule, MedicineLog
from app.utils.security import hash_password

def seed():
    init_db()
    with Session(engine) as session:
        # Check if already seeded
        existing_elder = session.exec(select(Elder)).first()
        if existing_elder:
            print("[Seed] Database already seeded. Skipping.")
            return

        print("[Seed] Seeding Suyog AI demo data...")

        # 1. Caregiver Users
        caregiver_pri = User(
            name="Rohit Kulkarni (Son)",
            email="rohit.kulkarni@example.com",
            phone="+919822012345",
            password_hash=hash_password("caregiver123"),
            role="caregiver"
        )
        caregiver_sec = User(
            name="Dr. Anjali Deshmukh (Neighbor/Doctor)",
            email="anjali.deshmukh@example.com",
            phone="+919822054321",
            password_hash=hash_password("doctor123"),
            role="caregiver"
        )
        session.add(caregiver_pri)
        session.add(caregiver_sec)
        session.commit()
        session.refresh(caregiver_pri)
        session.refresh(caregiver_sec)

        # 2. Elder Profile
        elder = Elder(
            name="Ramchandra Kulkarni",
            age=74,
            phone="+919822099999",
            address="Flat 402, Shanti Heights, Shivaji Nagar, Pune, Maharashtra",
            landmark="Opposite Model Colony Post Office",
            lat=18.5314,
            lng=73.8446,
            blood_group="B+",
            conditions="Type 2 Diabetes, Hypertension",
            allergies="Penicillin",
            preferred_hospital="+912025651234 (Sahyadri Hospital, Pune)",
            consent_accepted_at=datetime.datetime.utcnow(),
            away_mode=False
        )
        session.add(elder)
        session.commit()
        session.refresh(elder)

        # 3. Settings
        settings = ElderSettings(
            elder_id=elder.id,
            inactivity_day_hours=3.0,
            inactivity_night_hours=10.0,
            sleep_start="22:00",
            sleep_end="07:00",
            morning_check_time="10:00",
            enable_emergency_services=False
        )
        session.add(settings)

        # 4. Caregiver Relationship Links (Priorities 1 & 2)
        rel1 = ElderCaregiver(elder_id=elder.id, user_id=caregiver_pri.id, priority=1, relationship="Son")
        rel2 = ElderCaregiver(elder_id=elder.id, user_id=caregiver_sec.id, priority=2, relationship="Neighbor / Family Physician")
        session.add(rel1)
        session.add(rel2)

        # 5. Device & Sensors
        device = Device(
            device_id="cg_device_001",
            elder_id=elder.id,
            firmware="1.0.0",
            status="online",
            rssi=-58,
            last_seen=datetime.datetime.utcnow()
        )
        session.add(device)
        session.commit()

        s1 = DeviceSensor(device_id="cg_device_001", kind="pir", pin=27, room_or_compartment="bedroom")
        s2 = DeviceSensor(device_id="cg_device_001", kind="pir", pin=26, room_or_compartment="livingroom")
        s3 = DeviceSensor(device_id="cg_device_001", kind="button", pin=32, room_or_compartment="panic")
        s4 = DeviceSensor(device_id="cg_device_001", kind="button", pin=33, room_or_compartment="confirm")
        s5 = DeviceSensor(device_id="cg_device_001", kind="reed", pin=34, room_or_compartment="compartment_1")
        s6 = DeviceSensor(device_id="cg_device_001", kind="reed", pin=35, room_or_compartment="compartment_2")
        session.add_all([s1, s2, s3, s4, s5, s6])

        # 6. Medicines & Schedules
        med1 = Medicine(
            elder_id=elder.id,
            name="Metformin",
            dosage="500mg",
            instructions="Take after breakfast with water",
            critical=True,
            stock=28
        )
        med2 = Medicine(
            elder_id=elder.id,
            name="Telmisartan",
            dosage="40mg",
            instructions="Take in morning for blood pressure",
            critical=True,
            stock=25
        )
        med3 = Medicine(
            elder_id=elder.id,
            name="Multivitamin (Zincovit)",
            dosage="1 tab",
            instructions="Daily supplement after lunch",
            critical=False,
            stock=45
        )
        session.add_all([med1, med2, med3])
        session.commit()
        session.refresh(med1)
        session.refresh(med2)
        session.refresh(med3)

        sched1 = MedicineSchedule(medicine_id=med1.id, time="09:00", days_of_week="daily", compartment=1)
        sched2 = MedicineSchedule(medicine_id=med2.id, time="09:00", days_of_week="daily", compartment=2)
        sched3 = MedicineSchedule(medicine_id=med3.id, time="14:00", days_of_week="daily", compartment=1)
        session.add_all([sched1, sched2, sched3])
        session.commit()

        print("[OK] Suyog AI demo data successfully seeded!")
        print(f"Elder: {elder.name} (ID: {elder.id})")
        print(f"Primary Caregiver Login: rohit.kulkarni@example.com / caregiver123")
        print(f"Device: cg_device_001")

if __name__ == "__main__":
    seed()
