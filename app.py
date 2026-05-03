import os
import re
import requests
from flask import Flask, request
from dotenv import load_dotenv
from datetime import datetime, timedelta
import gspread
from oauth2client.service_account import ServiceAccountCredentials

load_dotenv()

app = Flask(__name__)

TOKEN = os.getenv("WHATSAPP_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID")

# ===== GOOGLE SHEETS =====
scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive"
]
creds = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", scope)
client = gspread.authorize(creds)
sheet = client.open("clinic-bookings").sheet1

# ===== CLINIC CONFIG =====
DOCTORS = {
    "1": {"name": "Dr. Sharma", "specialty": "General Physician", "slots": ["10:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"]},
    "2": {"name": "Dr. Verma", "specialty": "Cardiologist", "slots": ["09:30 AM", "11:00 AM", "03:00 PM", "05:00 PM"]},
    "3": {"name": "Dr. Patel", "specialty": "Dermatologist", "slots": ["10:30 AM", "01:00 PM", "04:00 PM", "06:00 PM"]}
}

CLINIC_NAME = "Super Clinic"
CLINIC_ADDRESS = "123 Main Road, [Your City]"
CLINIC_PHONE = "+91 XXXXX XXXXX"

def save_booking(name, phone, date, time, doctor, specialty, token):
    """Save appointment to Google Sheets"""
    try:
        sheet.append_row([
            name,
            phone,
            date,
            time,
            doctor,
            specialty,
            token,
            "Confirmed",
            datetime.now().strftime("%d-%m-%Y %H:%M")
        ])
        return True
    except Exception as e:
        print(f"Sheet error: {e}")
        return False

def generate_token():
    """Generate unique appointment token"""
    count = len(sheet.get_all_records()) + 1
    return f"#SC-{count:03d}"

def get_date_options():
    """Generate date options for next 3 days"""
    dates = []
    today = datetime.now()
    for i in range(3):
        d = today + timedelta(days=i)
        label = "Today" if i == 0 else "Tomorrow" if i == 1 else "Day after"
        dates.append({
            "key": str(i+1),
            "label": f"{label} ({d.strftime('%d %b')})",
            "value": d.strftime("%d-%m-%Y")
        })
    return dates

def send_message(to, text):
    """Send WhatsApp message via Meta API"""
    url = f"https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"body": text}
    }
    try:
        response = requests.post(url, headers=headers, json=payload)
        print(f"Sent to {to}: {response.status_code}")
        return response.json()
    except Exception as e:
        print(f"Send error: {e}")
        return None

# ===== USER SESSION MEMORY =====
user_state = {}

# ===== PRE-VISIT INSTRUCTIONS =====
def get_previsit_instructions(doctor, specialty):
    base = "• Bring valid ID proof\n• Carry previous prescriptions\n• Arrive 15 minutes early"
    
    if specialty == "Cardiologist":
        return base + "\n• Fasting required for 8 hours\n• Bring recent ECG reports if any"
    elif specialty == "Dermatologist":
        return base + "\n• Avoid makeup/creams on affected area\n• Bring photos of skin condition progression"
    else:
        return base + "\n• No fasting required"

# ===== WEBHOOK =====
@app.route("/webhook", methods=["GET", "POST"])
def webhook():
    # VERIFY (Meta webhook verification)
    if request.method == "GET":
        verify_token = request.args.get("hub.verify_token")
        challenge = request.args.get("hub.challenge")
        if verify_token == "clinic_bot_2024":
            print(f"Webhook verified: {challenge}")
            return challenge
        return "Error", 403

    # INCOMING MESSAGES
    data = request.get_json()
    print(f"Webhook received: {data}")

    try:
        entry = data.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})

        if "messages" not in value:
            return "OK", 200

        msg = value["messages"][0]
        
        # Skip non-text messages (images, voice, etc.)
        if msg.get("type") != "text":
            return "OK", 200

        phone = msg.get("from")
        text = msg.get("text", {}).get("body", "").strip()
        
        print(f"From {phone}: {text}")

        # Initialize session
        if phone not in user_state:
            user_state[phone] = {"step": "start"}

        state = user_state[phone]

        # ===== MAIN MENU =====
        if text.lower() in ["hi", "hello", "hey", "start", "menu"] or state["step"] == "start":
            state["step"] = "menu"
            
            menu = (
                f"🏥 Welcome to {CLINIC_NAME}\n\n"
                "I can help you with:\n"
                "1️⃣ Book Appointment\n"
                "2️⃣ Check My Appointment\n"  
                "3️⃣ Cancel Appointment\n"
                "4️⃣ Clinic Info\n\n"
                "Reply with 1, 2, 3, or 4"
            )
            send_message(phone, menu)
            return "OK", 200

        # ===== OPTION 1: BOOK APPOINTMENT =====
        if state["step"] == "menu" and text == "1":
            state["step"] = "select_doctor"
            
            doctors_list = "\n".join([
                f"{k}️⃣ {v['name']} - {v['specialty']}"
                for k, v in DOCTORS.items()
            ])
            
            send_message(phone, f"👨‍⚕️ Select doctor:\n\n{doctors_list}\n\nReply with 1, 2, or 3")
            return "OK", 200

        # Doctor selected
        if state["step"] == "select_doctor":
            if text not in DOCTORS:
                send_message(phone, "❌ Invalid choice. Reply with 1, 2, or 3")
                return "OK", 200
            
            state["doctor_key"] = text
            state["doctor"] = DOCTORS[text]["name"]
            state["specialty"] = DOCTORS[text]["specialty"]
            state["step"] = "select_date"
            
            dates = get_date_options()
            dates_list = "\n".join([f"{d['key']}️⃣ {d['label']}" for d in dates])
            
            send_message(phone, f"📅 Choose date:\n\n{dates_list}\n\nReply with 1, 2, or 3")
            return "OK", 200

        # Date selected
        if state["step"] == "select_date":
            dates = get_date_options()
            valid_keys = [d["key"] for d in dates]
            
            if text not in valid_keys:
                send_message(phone, "❌ Invalid date. Reply with 1, 2, or 3")
                return "OK", 200
            
            selected_date = next(d for d in dates if d["key"] == text)
            state["date"] = selected_date["value"]
            state["date_label"] = selected_date["label"]
            state["step"] = "select_time"
            
            doctor_key = state["doctor_key"]
            slots = DOCTORS[doctor_key]["slots"]
            slots_list = "\n".join([f"{i+1}️⃣ {slot}" for i, slot in enumerate(slots)])
            
            send_message(phone, 
                f"⏰ Available slots for {state['doctor']}, {selected_date['label']}:\n\n"
                f"{slots_list}\n\nReply with 1, 2, 3, or 4"
            )
            return "OK", 200

        # Time selected
        if state["step"] == "select_time":
            doctor_key = state["doctor_key"]
            slots = DOCTORS[doctor_key]["slots"]
            valid_slots = [str(i+1) for i in range(len(slots))]
            
            if text not in valid_slots:
                send_message(phone, f"❌ Invalid slot. Reply with 1 to {len(slots)}")
                return "OK", 200
            
            state["time"] = slots[int(text)-1]
            state["step"] = "enter_name"
            
            send_message(phone, "📝 Please enter your full name:")
            return "OK", 200

        # Name entered
        if state["step"] == "enter_name":
            if len(text) < 3 or not re.match(r'^[A-Za-z\s]+$', text):
                send_message(phone, "❌ Please enter a valid name (letters only, min 3 characters):")
                return "OK", 200
            
            state["name"] = text.title()
            state["step"] = "confirm"
            
            # Generate token and save
            token = generate_token()
            state["token"] = token
            
            save_booking(
                state["name"],
                phone,
                state["date"],
                state["time"],
                state["doctor"],
                state["specialty"],
                token
            )
            
            # Send confirmation
            instructions = get_previsit_instructions(state["doctor"], state["specialty"])
            
            confirmation = (
                f"✅ Appointment Confirmed!\n\n"
                f"Patient: {state['name']}\n"
                f"Date: {state['date']}\n"
                f"Time: {state['time']}\n"
                f"Doctor: {state['doctor']} ({state['specialty']})\n"
                f"Token: {token}\n\n"
                f"📋 Pre-visit Instructions:\n{instructions}\n\n"
                f"📍 {CLINIC_ADDRESS}\n"
                f"📞 {CLINIC_PHONE}\n\n"
                f"Reply CANCEL to reschedule\n"
                f"Reply HELP for assistance"
            )
            
            send_message(phone, confirmation)
            state["step"] = "start"  # Reset for next time
            return "OK", 200

        # ===== OPTION 2: CHECK APPOINTMENT =====
        if (state["step"] == "menu" and text == "2") or text.lower() == "check":
            # Find patient's bookings from sheet
            records = sheet.get_all_records()
            patient_bookings = [
                r for r in records 
                if str(r.get('Phone', '')) == str(phone) and r.get('Status') == 'Confirmed'
            ]
            
            if not patient_bookings:
                send_message(phone, "📅 No active appointments found.\n\nReply BOOK to schedule one.")
            else:
                latest = patient_bookings[-1]
                msg = (
                    f"📅 Your Appointment:\n\n"
                    f"Token: {latest.get('Token', 'N/A')}\n"
                    f"Date: {latest.get('Date')}\n"
                    f"Time: {latest.get('Time')}\n"
                    f"Doctor: {latest.get('Doctor')}\n"
                    f"Status: {latest.get('Status')}"
                )
                send_message(phone, msg)
            
            state["step"] = "start"
            return "OK", 200

        # ===== OPTION 3: CANCEL =====
        if (state["step"] == "menu" and text == "3") or text.lower() == "cancel":
            records = sheet.get_all_records()
            patient_bookings = [
                r for r in records 
                if str(r.get('Phone', '')) == str(phone) and r.get('Status') == 'Confirmed'
            ]
            
            if not patient_bookings:
                send_message(phone, "❌ No active appointment to cancel.")
            else:
                # In real implementation, update sheet status
                send_message(phone, 
                    f"❌ Appointment cancelled successfully.\n\n"
                    f"Token: {patient_bookings[-1].get('Token')}\n"
                    f"Reply BOOK to schedule a new appointment."
                )
            
            state["step"] = "start"
            return "OK", 200

        # ===== OPTION 4: CLINIC INFO =====
        if (state["step"] == "menu" and text == "4") or text.lower() in ["info", "address"]:
            info = (
                f"🏥 {CLINIC_NAME}\n\n"
                f"📍 Address: {CLINIC_ADDRESS}\n"
                f"📞 Helpline: {CLINIC_PHONE}\n"
                f"⏰ Timings: 9:00 AM - 8:00 PM (Mon-Sat)\n"
                f"🩺 Doctors: General Physician, Cardiologist, Dermatologist\n\n"
                f"Reply BOOK to schedule appointment"
            )
            send_message(phone, info)
            state["step"] = "start"
            return "OK", 200

        # ===== CANCEL COMMAND (any state) =====
        if text.lower() == "cancel":
            records = sheet.get_all_records()
            patient_bookings = [
                r for r in records 
                if str(r.get('Phone', '')) == str(phone) and r.get('Status') == 'Confirmed'
            ]
            
            if patient_bookings:
                send_message(phone, 
                    f"❌ Cancelled: {patient_bookings[-1].get('Token')}\n"
                    f"Reply BOOK to reschedule."
                )
            else:
                send_message(phone, "No active appointment found.")
            
            state["step"] = "start"
            return "OK", 200

        # ===== HELP =====
        if text.lower() == "help":
            help_msg = (
                "🏥 Super Clinic Help\n\n"
                "• Reply HI to start\n"
                "• Reply BOOK to book appointment\n"
                "• Reply CHECK to view appointment\n"
                "• Reply CANCEL to cancel\n"
                "• Reply INFO for clinic details"
            )
            send_message(phone, help_msg)
            state["step"] = "start"
            return "OK", 200

        # ===== UNKNOWN INPUT =====
        send_message(phone, 
            "❓ I didn't understand that.\n\n"
            "Reply HI for menu\n"
            "Reply HELP for assistance"
        )
        return "OK", 200

    except Exception as e:
        print(f"ERROR in webhook: {e}")
        import traceback
        traceback.print_exc()
        return "OK", 200

# ===== TEST ENDPOINT =====
@app.route("/test-send", methods=["GET"])
def test_send():
    """Quick test to verify API works"""
    test_phone = os.getenv("RECIPIENT_PHONE", "919876543210")
    msg = (
        f"🏥 {CLINIC_NAME} - Test Message\n\n"
        "Your WhatsApp bot is working!\n"
        "Patients can now book appointments by messaging this number.\n\n"
        "Reply HI to start booking."
    )
    result = send_message(test_phone, msg)
    return {"status": "sent", "result": result}

if __name__ == "__main__":
    app.run(port=5000, debug=True)