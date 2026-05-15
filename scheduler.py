import os
import sys
import time
import re
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import get_all_clinics, get_clinic, get_now
from services.sheets import MEDICINE_HEADERS, TEST_HEADERS, ensure_headers, open_sheet
from services.whatsapp import send_text, send_buttons
from services.database import get_db


def get_active_tests(clinic):
    """Get all active test reminders for a clinic from Supabase"""
    db = get_db()
    if not db:
        return []
        
    clinic_id = clinic["phone_number_id"]
    try:
        # Fetch active test reminders from Supabase
        response = db.table("reminders") \
            .select("*") \
            .eq("clinic_id", clinic_id) \
            .eq("type", "test") \
            .eq("status", "Active") \
            .execute()
            
        now = get_now()
        today_str = now.strftime("%Y-%m-%d")
        tomorrow_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")

        active = []
        for r in response.data:
            start_date = r.get("start_date")
            if start_date in [today_str, tomorrow_str]:
                # Map Supabase fields to the format expected by the existing sender logic
                active.append({
                    "id": r["id"],
                    "Phone": r["patient_phone"],
                    "Test Name": r["item_name"],
                    "Instructions": r.get("metadata", {}).get("instructions", "Follow prescribed precautions."),
                    "Date": datetime.strptime(start_date, "%Y-%m-%d").strftime("%d-%m-%Y"),
                    "Last Sent": r.get("metadata", {}).get("last_sent", ""),
                    "source": "supabase"
                })
        return active
    except Exception as e:
        print(f"Error reading tests for {clinic.get('name')} from Supabase: {e}")
        return []

def send_test_reminders():
    """Main function to send test reminders"""
    now = get_now()
    print(f"\n{'='*50}")
    print(f"🧪 Running Test Reminder Check - {now.strftime('%d-%m-%Y %H:%M')}")
    print(f"{'='*50}")

    clinics = get_all_clinics()
    today_str = now.strftime("%d-%m-%Y")
    tomorrow_str = (now + timedelta(days=1)).strftime("%d-%m-%Y")
    current_hour = now.hour

    for clinic in clinics:
        if clinic.get("subscription_status") != "active":
            continue

        tests = get_active_tests(clinic)
        if not tests:
            continue

        print(f"   Found {len(tests)} potential tests for {clinic['name']}")
        sheet = None
        for t in tests:
            phone = str(t.get('Phone', ''))
            test_name = t.get('Test Name', '')
            instr = t.get('Instructions', '')
            test_date = t.get('Date', '').replace("'", "")
            last_sent = str(t.get('Last Sent', ''))

            msg = None
            type_sent = ""

            if test_date == tomorrow_str and "tomorrow" not in last_sent.lower():
                # 1 day before reminder
                msg = (
                    f"🧪 *Test Reminder (Tomorrow)*\n\n"
                    f"Hi, this is a reminder that you have a test scheduled for tomorrow ({test_date}):\n\n"
                    f"📋 Test: {test_name}\n"
                    f"📝 Instructions: {instr}\n\n"
                    f"Please follow the instructions carefully."
                )
                type_sent = "tomorrow"
            elif test_date == today_str and current_hour < 11 and "today" not in last_sent.lower():
                # Same day morning reminder
                msg = (
                    f"🧪 *Test Reminder (Today)*\n\n"
                    f"Hi, this is a reminder for your scheduled test today ({test_date}):\n\n"
                    f"📋 Test: {test_name}\n"
                    f"📝 Instructions: {instr}\n\n"
                    f"Please follow the instructions carefully."
                )
                type_sent = "today"

            if msg and send_whatsapp(clinic, phone, msg):
                try:
                    new_val = f"{type_sent} ({get_now().strftime('%d-%m-%Y %H:%M')})"
                    if t.get("source") == "supabase":
                        db = get_db()
                        # Fetch current metadata
                        res = db.table("reminders").select("metadata").eq("id", t["id"]).execute()
                        meta = res.data[0]["metadata"] if res.data else {}
                        meta["last_sent"] = new_val
                        db.table("reminders").update({"metadata": meta}).eq("id", t["id"]).execute()
                    else:
                        if not sheet:
                            sheet = open_sheet(t['_sheet_name'])
                        headers = sheet.row_values(1)
                        if "Last Sent" in headers:
                            col_idx = headers.index("Last Sent") + 1
                            sheet.update_cell(t['_row_idx'], col_idx, new_val)
                    print(f"      ✅ Sent {type_sent} reminder to {phone}")
                except Exception as e:
                    print(f"      ⚠️ Sent but failed to update status: {e}")

def send_whatsapp(clinic, phone, message, buttons=None):
    """Send WhatsApp message (text or interactive)"""
    if not clinic:
        return False
    try:
        if buttons:
            send_buttons(clinic, phone, message, buttons)
        else:
            send_text(clinic, phone, message)
        print(f"Sent to {phone}")
        return True
    except Exception as e:
        print(f"WhatsApp error: {e}")
        return False

def get_active_medicines(clinic):
    """Get all active medicine reminders for a clinic from Supabase"""
    db = get_db()
    if not db:
        return []
        
    clinic_id = clinic["phone_number_id"]
    try:
        # Fetch active medication reminders from Supabase
        response = db.table("reminders") \
            .select("*") \
            .eq("clinic_id", clinic_id) \
            .eq("type", "medication") \
            .eq("status", "Active") \
            .execute()
            
        now = get_now()
        today = now.date()
        
        active = []
        for r in response.data:
            start_date = datetime.strptime(r["start_date"], "%Y-%m-%d").date()
            end_date = datetime.strptime(r["end_date"], "%Y-%m-%d").date() if r.get("end_date") else today
            
            if start_date <= today <= end_date:
                # Map to format expected by existing logic
                active.append({
                    "id": r["id"],
                    "Phone": r["patient_phone"],
                    "Medicine": r["item_name"],
                    "Frequency": r["frequency"],
                    "Instructions": r.get("metadata", {}).get("instructions", ""),
                    "Last Sent": r.get("metadata", {}).get("last_sent", ""),
                    "times": r["times"],
                    "source": "supabase"
                })
        return active
    except Exception as e:
        print(f"Error reading medicines for {clinic.get('name')} from Supabase: {e}")
        return []

def should_send_reminder(medicine, last_sent_date):
    # This is handled inline in send_medicine_reminders
    return True

def get_reminder_time(frequency):
    """Get appropriate reminder times based on frequency"""
    frequency = frequency.lower()
    
    if "thrice" in frequency or "3" in frequency:
        return ["09:00", "14:00", "21:00"]
    if 'twice' in frequency or "2" in frequency:
        return ["09:00", "21:00"]
    elif 'daily' in frequency or 'once' in frequency or "1" in frequency:
        return ["09:00"]
    elif 'weekly' in frequency:
        return ["10:00"]
    else:
        return ["09:00"]

def send_medicine_reminders():
    """Main function to send medicine reminders"""
    now = get_now()
    print(f"\n{'='*50}")
    print(f"🏥 Running Medicine Reminder Check - {now.strftime('%d-%m-%Y %H:%M')}")
    print(f"{'='*50}")
    
    clinics = get_all_clinics()
    print(f"Found {len(clinics)} clinics")
    
    today_str = now.strftime("%d-%m-%Y")
    
    for clinic in clinics:
        if clinic.get("subscription_status") != "active":
            print(f"Skipping {clinic['name']} - not active")
            continue
        
        print(f"\n📋 Processing: {clinic['name']}")
        
        medicines = get_active_medicines(clinic)
        print(f"   Found {len(medicines)} active medicines for {clinic['name']}")
        
        sent_count = 0
        for med in medicines:
            phone = med.get('Phone', '')
            medicine_name = med.get('Medicine', '')
            print(f"      - Processing {medicine_name} for {phone}")
            
            dosage = med.get('Dosage', '')
            frequency = med.get('Frequency', '')
            instructions = med.get("Instructions", "")
            last_sent = str(med.get("Last Sent", ""))
            
            # Get times from Time 1, Time 2, Time 3 columns
            configured_times = []
            for i in range(1, 4):
                val = str(med.get(f"Time {i}", "")).strip()
                if val:
                    configured_times.append(val)
            
            # Check instructions for override
            if "Reminder Times:" in instructions:
                match = re.search(r"Reminder Times:\s*(.*)", instructions)
                if match:
                    instruction_times = [item.strip() for item in match.group(1).split(",") if item.strip()]
                    if instruction_times:
                        configured_times = instruction_times

            # Fallback to frequency-based defaults if no times configured
            reminder_times = configured_times if configured_times else get_reminder_time(frequency)
            
            sheet = None
            for reminder_time in reminder_times:
                try:
                    # Robust time parsing for both 12h (1:00 PM) and 24h (13:00) formats
                    t_clean = str(reminder_time).strip().upper()
                    if not t_clean: continue
                    
                    if "AM" in t_clean or "PM" in t_clean:
                        parsed_time = datetime.strptime(t_clean, "%I:%M %p")
                    elif ":" in t_clean:
                        parsed_time = datetime.strptime(t_clean, "%H:%M")
                    else:
                        continue
                    
                    reminder_hour = parsed_time.hour
                    reminder_minute = parsed_time.minute
                except Exception as te:
                    print(f"      ⚠️ Time parse error for '{reminder_time}': {te}")
                    continue
                
                # Unique ID for this specific dose today
                dose_id = f"{today_str}@{reminder_hour:02d}:{reminder_minute:02d}"
                
                current_time = get_now()
                current_hour = current_time.hour
                current_minute = current_time.minute
                
                # Trigger if we are at or past the scheduled time today and haven't sent it yet
                is_past_time = (current_hour > reminder_hour or (current_hour == reminder_hour and current_minute >= reminder_minute))
                
                if is_past_time and dose_id not in last_sent:
                    print(f"   📱 Sending to {phone}: {medicine_name} (Scheduled: {reminder_time}, Current: {current_hour}:{current_minute:02d})")
                    print(f"      Dose ID: {dose_id}, Last Sent: {last_sent}")
                    
                    tests_line = ""
                    if "Tests:" in instructions:
                        tests_line = "\n🧪 Tests:\n" + instructions.split("Tests:", 1)[1].strip()

                    msg = (
                        f"💊 *Medicine Reminder*\n\n"
                        f"Time to take your medicines ({reminder_time}):\n- " + "\n- ".join([m.strip() for m in medicine_name.split(",") if m.strip()]) + "\n\n"
                        f"⏰ Time: {reminder_time}"
                        f"{tests_line}"
                    )
                    
                    buttons = [
                        {"id": "med_taken", "title": "Taken ✅"},
                        {"id": "med_skip", "title": "Skip ⏭️"}
                    ]
                    
                    if send_whatsapp(clinic, phone, msg, buttons=buttons):
                        sent_count += 1
                        try:
                            new_val = (last_sent + "," + dose_id).strip(",")
                            if med.get("source") == "supabase":
                                db = get_db()
                                # Fetch current metadata
                                res = db.table("reminders").select("metadata").eq("id", med["id"]).execute()
                                meta = res.data[0]["metadata"] if res.data else {}
                                meta["last_sent"] = new_val
                                db.table("reminders").update({"metadata": meta}).eq("id", med["id"]).execute()
                                last_sent = new_val
                            else:
                                if not sheet:
                                    sheet = open_sheet(med['_sheet_name'])
                                headers = sheet.row_values(1)
                                if "Last Sent" in headers:
                                    col_idx = headers.index("Last Sent") + 1
                                    sheet.update_cell(med['_row_idx'], col_idx, new_val)
                                    last_sent = new_val
                            print(f"      ✅ Sent!")
                        except Exception as e:
                            print(f"      ⚠️ Sent but failed to update status: {e}")
                    else:
                        print(f"      ❌ Failed")
        
        print(f"   Sent {sent_count} reminders")
    
    print(f"\n{'='*50}")
    print("✅ Reminder check complete")
    print(f"{'='*50}\n")

def send_appointment_reminders():
    """Send appointment reminders for tomorrow"""
    now = get_now()
    print(f"\n🏥 Checking for appointment reminders...")
    
    clinics = get_all_clinics()
    tomorrow = (now + timedelta(days=1)).strftime("%d-%m-%Y")
    
    for clinic in clinics:
        if clinic.get("subscription_status") != "active":
            continue
        
        sheet_name = clinic.get("sheet_name")
        if not sheet_name:
            continue
            
        sheet = open_sheet(sheet_name)
        if not sheet:
            continue
        
        try:
            records = sheet.get_all_records()
            
            for r in records:
                if r.get('Date') == tomorrow and r.get('Status') == 'Confirmed':
                    phone = r.get('Phone', '')
                    name = r.get('Name', 'Patient')
                    time_val = r.get('Time', '')
                    doctor = r.get('Doctor', '')
                    token = r.get('Token', '')
                    
                    msg = (
                        f"⏰ Appointment Reminder\n\n"
                        f"Hi {name}, this is a reminder for your appointment tomorrow:\n\n"
                        f"📅 Date: {tomorrow}\n"
                        f"🕐 Time: {time_val}\n"
                        f"👨‍⚕️ Doctor: {doctor}\n"
                        f"🔖 Token: {token}\n\n"
                        f"Please arrive 15 minutes early.\n"
                        f"Reply CANCEL to cancel."
                    )
                    
                    send_whatsapp(clinic, phone, msg)
                    print(f"Sent appointment reminder to {phone}")
        
        except Exception as e:
            print(f"Error: {e}")

def get_active_followups(clinic):
    """Get all active follow-up reminders for a clinic from Supabase"""
    db = get_db()
    if not db:
        return []
        
    clinic_id = clinic["phone_number_id"]
    try:
        # Fetch active follow-up reminders from Supabase
        response = db.table("reminders") \
            .select("*") \
            .eq("clinic_id", clinic_id) \
            .eq("type", "follow_up") \
            .eq("status", "Active") \
            .execute()
            
        now = get_now()
        today_str = now.strftime("%Y-%m-%d")

        active = []
        for r in response.data:
            start_date = r.get("start_date")
            # For follow-ups, start_date is the appointment date
            if start_date == today_str:
                active.append({
                    "id": r["id"],
                    "Phone": r["patient_phone"],
                    "Patient Name": r["patient_name"],
                    "Item": r["item_name"],
                    "Date": start_date,
                    "Last Sent": r.get("metadata", {}).get("last_sent", ""),
                    "source": "supabase"
                })
        return active
    except Exception as e:
        print(f"Error reading follow-ups for {clinic.get('name')} from Supabase: {e}")
        return []

def send_followup_reminders():
    """Main function to send follow-up reminders"""
    now = get_now()
    if now.hour != 8: # Only send follow-ups at 8 AM
        return

    print(f"\n{'='*50}")
    print(f"📅 Running Follow-up Reminder Check - {now.strftime('%d-%m-%Y %H:%M')}")
    print(f"{'='*50}")

    clinics = get_all_clinics()
    for clinic in clinics:
        if clinic.get("subscription_status") != "active":
            continue

        followups = get_active_followups(clinic)
        for f in followups:
            phone = f['Phone']
            name = f['Patient Name']
            reason = f['Item']
            last_sent = f['Last Sent']

            if "sent" not in last_sent.lower():
                msg = (
                    f"👨‍⚕️ *Follow-up Reminder*\n\n"
                    f"Hi {name}, this is a reminder for your scheduled follow-up today regarding:\n"
                    f"📝 *{reason}*\n\n"
                    f"Please contact the clinic if you have any questions or need to reschedule."
                )

                if send_whatsapp(clinic, phone, msg):
                    try:
                        db = get_db()
                        res = db.table("reminders").select("metadata").eq("id", f["id"]).execute()
                        meta = res.data[0]["metadata"] if res.data else {}
                        meta["last_sent"] = f"sent ({get_now().strftime('%d-%m-%Y %H:%M')})"
                        db.table("reminders").update({"metadata": meta}).eq("id", f["id"]).execute()
                        print(f"      ✅ Sent follow-up to {phone}")
                    except Exception as e:
                        print(f"      ⚠️ Failed to update status: {e}")

def run_scheduler(interval_minutes=1):
    """Run the scheduler continuously"""
    print("🚀 Medicine Reminder Scheduler Started")
    print(f"⏰ Checking every {interval_minutes} minutes")
    print("Press Ctrl+C to stop\n")
    
    while True:
        try:
            now = get_now()
            print(f"\n--- 🕒 Scheduler Pulse: {now.strftime('%d-%m-%Y %H:%M:%S')} ---")
            send_medicine_reminders()
            send_test_reminders()
            send_followup_reminders()
            
            if now.hour == 18 and now.minute < interval_minutes:
                send_appointment_reminders()
            
            print(f"💤 Sleeping for {interval_minutes} minutes...")
            time.sleep(interval_minutes * 60)
            
        except KeyboardInterrupt:
            print("\n🛑 Scheduler stopped")
            break
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(60)

def test_reminder():
    """Test sending a reminder"""
    clinic = get_all_clinics()[0] if get_all_clinics() else None
    if clinic:
        test_phone = "919876543210"
        msg = "💊 Test Reminder\n\nThis is a test message from the scheduler."
        result = send_whatsapp(clinic, test_phone, msg)
        print(f"Test result: {result}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Clinic Bot Scheduler")
    parser.add_argument("--test", action="store_true", help="Send test reminder")
    parser.add_argument("--interval", type=int, default=1, help="Check interval in minutes")
    
    args = parser.parse_args()
    
    if args.test:
        test_reminder()
    else:
        run_scheduler(args.interval)
