import streamlit as st
import pandas as pd
import requests
import os
from datetime import datetime, timedelta

# ===== PAGE CONFIG =====
st.set_page_config(
    page_title="Super Clinic - Admin Dashboard",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ===== CHECK IF RUNNING LOCALLY =====
IS_LOCAL = os.path.exists("credentials.json")

# ===== GOOGLE SHEETS (Local only) =====
def get_sheet_local():
    import gspread
    from oauth2client.service_account import ServiceAccountCredentials
    scope = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive"
    ]
    creds = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", scope)
    client = gspread.authorize(creds)
    return client.open("clinic-bookings").sheet1

# ===== MOCK DATA (Cloud / Demo) =====
def get_mock_data():
    today = datetime.now().strftime("%d-%m-%Y")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%d-%m-%Y")
    
    return pd.DataFrame([
        {"Name": "Priya Sharma", "Phone": "919876543210", "Date": today, "Time": "10:00 AM", "Doctor": "Dr. Sharma", "Specialty": "General Physician", "Token": "#SC-001", "Status": "Confirmed", "Booked At": "03-05-2026 09:00"},
        {"Name": "Amit Patel", "Phone": "919876543211", "Date": today, "Time": "11:30 AM", "Doctor": "Dr. Verma", "Specialty": "Cardiologist", "Token": "#SC-002", "Status": "Confirmed", "Booked At": "03-05-2026 09:15"},
        {"Name": "Sunita Devi", "Phone": "919876543212", "Date": today, "Time": "02:00 PM", "Doctor": "Dr. Patel", "Specialty": "Dermatologist", "Token": "#SC-003", "Status": "Completed", "Booked At": "02-05-2026 16:00"},
        {"Name": "Rajesh Kumar", "Phone": "919876543213", "Date": today, "Time": "04:30 PM", "Doctor": "Dr. Sharma", "Specialty": "General Physician", "Token": "#SC-004", "Status": "Confirmed", "Booked At": "03-05-2026 10:30"},
        {"Name": "Vikram Singh", "Phone": "919876543214", "Date": tomorrow, "Time": "10:00 AM", "Doctor": "Dr. Verma", "Specialty": "Cardiologist", "Token": "#SC-005", "Status": "Confirmed", "Booked At": "03-05-2026 11:00"},
        {"Name": "Neha Gupta", "Phone": "919876543215", "Date": tomorrow, "Time": "03:00 PM", "Doctor": "Dr. Patel", "Specialty": "Dermatologist", "Token": "#SC-006", "Status": "Cancelled", "Booked At": "02-05-2026 14:00"},
    ])

# ===== LOAD DATA =====
def load_data():
    if IS_LOCAL:
        try:
            sheet = get_sheet_local()
            records = sheet.get_all_records()
            return pd.DataFrame(records)
        except Exception as e:
            st.error(f"Sheet error: {e}")
            return get_mock_data()
    else:
        return get_mock_data()

df = load_data()

# ===== WHATSAPP API =====
def send_whatsapp(phone, message):
    token = os.getenv("WHATSAPP_TOKEN")
    phone_id = os.getenv("PHONE_NUMBER_ID")
    
    if not token or not phone_id:
        st.error("WhatsApp credentials not configured in secrets!")
        return False
    
    url = f"https://graph.facebook.com/v18.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": message}
    }
    try:
        response = requests.post(url, headers=headers, json=payload)
        return response.status_code == 200
    except Exception as e:
        st.error(f"Failed to send: {e}")
        return False

# ===== SIDEBAR =====
with st.sidebar:
    st.markdown("## 🏥 Super Clinic")
    st.caption("WhatsApp Appointment System")
    
    if IS_LOCAL:
        st.success("🟢 Connected to Google Sheets")
    else:
        st.info("☁️ Demo Mode (Mock Data)")
    
    st.divider()
    
    today = datetime.now().strftime("%d-%m-%Y")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%d-%m-%Y")
    
    date_filter = st.selectbox(
        "📅 View Schedule",
        ["All Dates", f"Today ({today})", f"Tomorrow ({tomorrow})", "This Week"]
    )
    
    st.divider()
    
    if not df.empty:
        total = len(df)
        today_count = len(df[df['Date'] == today])
        st.metric("Total Bookings", total)
        st.metric("Today's Appointments", today_count)

# ===== MAIN HEADER =====
col_title, col_refresh = st.columns([4, 1])
with col_title:
    st.title("📊 Appointment Dashboard")
with col_refresh:
    if st.button("🔄 Refresh", use_container_width=True):
        st.rerun()

# ===== METRICS =====
if not df.empty:
    today_df = df[df['Date'] == today] if 'Date' in df.columns else pd.DataFrame()
    
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("📅 Total", len(df))
    c2.metric("✅ Confirmed", len(df[df['Status'] == 'Confirmed']) if 'Status' in df.columns else 0)
    c3.metric("🏥 Today", len(today_df))
    c4.metric("✔️ Completed", len(today_df[today_df['Status'] == 'Completed']) if not today_df.empty and 'Status' in today_df.columns else 0)
    c5.metric("❌ No-shows", len(today_df[today_df['Status'] == 'No-show']) if not today_df.empty and 'Status' in today_df.columns else 0)

st.divider()

# ===== FILTER =====
display_df = df.copy()
if date_filter == f"Today ({today})":
    display_df = df[df['Date'] == today] if 'Date' in df.columns else df
elif date_filter == f"Tomorrow ({tomorrow})":
    display_df = df[df['Date'] == tomorrow] if 'Date' in df.columns else df
elif date_filter == "This Week":
    week_dates = [(datetime.now() + timedelta(days=i)).strftime("%d-%m-%Y") for i in range(7)]
    display_df = df[df['Date'].isin(week_dates)] if 'Date' in df.columns else df

# ===== TABLE =====
st.subheader("📋 Appointments")
if display_df.empty:
    st.info("No appointments found.")
else:
    cols = ['Token', 'Name', 'Phone', 'Date', 'Time', 'Doctor', 'Specialty', 'Status']
    available = [c for c in cols if c in display_df.columns]
    st.dataframe(display_df[available], use_container_width=True, hide_index=True)

st.divider()

# ===== TODAY'S ACTIONS =====
st.subheader("⏰ Quick Actions")
if today_df.empty or today_df is None:
    st.info("No appointments today.")
else:
    for idx, row in today_df.iterrows():
        with st.container(border=True):
            c1, c2, c3, c4, c5 = st.columns([2, 2, 1.5, 1, 1.5])
            
            c1.markdown(f"**{row.get('Name', 'N/A')}**")
            c2.caption(f"🕐 {row.get('Time', 'N/A')} | {row.get('Doctor', 'N/A')}")
            c3.markdown(f"🔖 `{row.get('Token', 'N/A')}`")
            
            status = row.get('Status', 'Confirmed')
            color = "green" if status == "Confirmed" else "blue" if status == "Completed" else "red"
            c4.markdown(f":{color}[{status}]")
            
            with c5:
                phone = str(row.get('Phone', '')).strip()
                name = row.get('Name', 'Patient')
                time = row.get('Time', '')
                doctor = row.get('Doctor', '')
                token = row.get('Token', '')
                
                if st.button("📤 Remind", key=f"rem_{idx}", use_container_width=True):
                    msg = f"⏰ Reminder: Hi {name}, your appointment is today at {time} with {doctor}. Token: {token}. Please arrive 15 minutes early."
                    if send_whatsapp(phone, msg):
                        st.success("Sent!")
                    else:
                        st.error("Failed")

st.divider()

# ===== ADD NEW =====
with st.expander("➕ Add Appointment"):
    with st.form("manual"):
        a1, a2 = st.columns(2)
        with a1:
            new_name = st.text_input("Name*", placeholder="Rajesh Kumar")
            new_phone = st.text_input("Phone*", placeholder="919876543210")
            new_date = st.date_input("Date*", datetime.now())
        with a2:
            new_doctor = st.selectbox("Doctor*", ["Dr. Sharma", "Dr. Verma", "Dr. Patel"])
            new_time = st.selectbox("Time*", ["10:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"])
            new_status = st.selectbox("Status", ["Confirmed", "Completed", "No-show", "Cancelled"])
        
        if st.form_submit_button("📲 Book & Send WhatsApp"):
            if not new_name or not new_phone:
                st.error("Required fields missing!")
            else:
                spec = {"Dr. Sharma": "General Physician", "Dr. Verma": "Cardiologist", "Dr. Patel": "Dermatologist"}
                token = f"#SC-{len(df)+1:03d}"
                
                msg = f"✅ Confirmed!\n\nPatient: {new_name}\nDate: {new_date.strftime('%d-%m-%Y')}\nTime: {new_time}\nDoctor: {new_doctor} ({spec[new_doctor]})\nToken: {token}\n\nReply CANCEL to reschedule."
                
                if send_whatsapp(new_phone, msg):
                    st.success(f"Sent to {new_name}!")
                    # In local mode, save to sheet too
                    if IS_LOCAL:
                        try:
                            sheet = get_sheet_local()
                            sheet.append_row([new_name, new_phone, new_date.strftime("%d-%m-%Y"), new_time, new_doctor, spec[new_doctor], token, new_status, datetime.now().strftime("%d-%m-%Y %H:%M")])
                        except Exception as e:
                            st.warning(f"Saved to WhatsApp but sheet error: {e}")
                    st.rerun()
                else:
                    st.error("WhatsApp failed")

st.caption("🏥 Super Clinic WhatsApp Bot")