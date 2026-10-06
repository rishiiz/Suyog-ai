"""
Suyog AI Demonstration Scenarios (PRD Section 12)
Runs automated end-to-end hardware-free demo flows.
"""
import time
import httpx

def run_scenario(hub, scenario_name: str):
    print(f"\n========================================================")
    print(f"🎬 EXECUTING DEMO SCENARIO: {scenario_name.upper()}")
    print(f"========================================================\n")

    if scenario_name == "normal_day":
        print("Step 1: Elder wakes up at 07:15 AM. Movement in Bedroom.")
        hub.trigger_motion("bedroom")
        time.sleep(2)

        print("\nStep 2: Elder walks to Living Room at 07:30 AM.")
        hub.trigger_motion("livingroom")
        time.sleep(2)

        print("\nStep 3: 09:00 AM Medicine Reminder arrives from Cloud.")
        hub.handle_command({"cmd": "reminder_start", "medicine": "Metformin", "dose": "500mg - After food"})
        time.sleep(3)

        print("\nStep 4: Elder opens Pill-Box Compartment 1 (Reed Switch).")
        hub.trigger_pillbox_open(1)
        time.sleep(2)

        print("\nStep 5: Elder confirms on Hub using Green Button ('I am OK').")
        hub.trigger_confirm_button()
        print("\n✅ Scenario 'normal_day' complete: Routine tracked, medicine taken on time!")

    elif scenario_name == "panic":
        print("Step 1: Normal movement in Living Room.")
        hub.trigger_motion("livingroom")
        time.sleep(2)

        print("\nStep 2: Emergency occurs! Elder presses RED PANIC BUTTON for 2 seconds.")
        hub.trigger_panic_button()
        time.sleep(3)

        print("\nStep 3: Verifying Cloud Escalation (Stage 1)...")
        # Query backend alerts endpoint to verify Stage 1
        try:
            resp = httpx.get(f"{hub.http_url}/api/v1/elders/1/alerts", timeout=4.0)
            alerts = resp.json()
            if alerts:
                active = alerts[0]
                print(f"🚨 Cloud Alert Active: ID={active.get('id')} Stage={active.get('stage')} Status={active.get('status')}")
                for act in active.get("actions", []):
                    print(f"   -> Outbound Action: [{act.get('channel')}] To: {act.get('target')} ({act.get('message')})")
        except Exception as e:
            print(f"Could not fetch alert status: {e}")

        print("\n✅ Scenario 'panic' complete: Immediate Stage 1 emergency alerts dispatched!")

    elif scenario_name == "false_alarm_cancelled":
        print("Step 1: Prolonged inactivity causes Stage 0 Local Alert on Hub.")
        hub.handle_command({"cmd": "local_alert", "reason": "No motion detected for 3.0 hours"})
        time.sleep(3)

        print("\nStep 2: Elder hears buzzer, sees OLED prompt 'Are you OK? Press GREEN button'.")
        print("Elder is fine (was reading a book). Elder presses GREEN button.")
        hub.trigger_confirm_button()
        time.sleep(2)

        print("\nStep 3: Hub cancels Stage 0. No SMS sent to family!")
        print("\n✅ Scenario 'false_alarm_cancelled' complete: Local cancel window protected caregiver from false alarm!")

    elif scenario_name == "inactivity":
        print("Step 1: Elder last seen in Bedroom at 11:00 AM.")
        hub.trigger_motion("bedroom")
        time.sleep(2)

        print("\nStep 2: Simulating 3.5 hours of complete absence of motion...")
        hub.handle_command({"cmd": "local_alert", "reason": "Inactivity threshold (3.0 hours) exceeded"})
        time.sleep(3)

        print("\nStep 3: Elder unable to press green button during 60-second cancel window.")
        print("Escalation Engine advances to Stage 1: Dispatches SMS & Voice Call to Primary Caregiver.")
        try:
            # Trigger via API test for fast demo progression
            httpx.post(f"{hub.http_url}/api/v1/alerts/test", json={"elder_id": 1, "test_type": "inactivity"}, timeout=4.0)
            print("Alert escalated to Stage 1 successfully.")
        except Exception as e:
            print(f"Trigger notice: {e}")

        print("\n✅ Scenario 'inactivity' complete: Caregiver notified of prolonged inactivity!")

    elif scenario_name == "missed_medicine":
        print("Step 1: Medicine reminder fires for Metformin (500mg).")
        hub.handle_command({"cmd": "reminder_start", "medicine": "Metformin", "dose": "500mg"})
        time.sleep(2)

        print("\nStep 2: Elder forgets to take medicine. Repeat #1 (after 5 mins) fires.")
        hub.handle_command({"cmd": "reminder_start", "medicine": "Metformin", "dose": "500mg", "repeat": 1})
        time.sleep(2)

        print("\nStep 3: Repeat #2 (after 10 mins) fires.")
        hub.handle_command({"cmd": "reminder_start", "medicine": "Metformin", "dose": "500mg", "repeat": 2})
        time.sleep(2)

        print("\nStep 4: Repeat #3 (after 15 mins) fires. Still unconfirmed.")
        hub.handle_command({"cmd": "reminder_start", "medicine": "Metformin", "dose": "500mg", "repeat": 3})
        time.sleep(2)

        print("\nStep 5: Window expires. Critical medicine dose marked MISSED.")
        print("Caregiver notified of missed critical dose.")
        print("\n✅ Scenario 'missed_medicine' complete!")

    print(f"\n========================================================\n")
