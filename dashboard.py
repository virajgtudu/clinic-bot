import streamlit as st
import pandas as pd
import requests
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime, timedelta
import os

# ===== PAGE CONFIG =====
st.set_page_config(
    page_title="Super Clinic - Admin Dashboard",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ===== GOOGLE SHEETS =====
@st.cache_resource
def get_sheet():
    scope = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive"
    ]
    creds = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", scope)
    client = gspread.authorize(creds)
    return client.open("clinic-bookings").sheet1

sheet = get_sheet()

# ===== WHATSAPP API =====
def send_whatsapp(phone, message):
    """Send WhatsApp message via Meta API"""
    token = os.getenv("WHATSAPP_TOKEN")
    phone_id = os.getenv("PHONE_NUMBER_ID")
    
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

# ===== LOAD DATA =====
def load_data():
    """Load and format data from Google Sheets"""
    try:
        records = sheet.get_all_records()
        df = pd.DataFrame(records)
        if not df.empty:
            # Ensure all expected columns exist
            expected = ['Name', 'Phone', 'Date', 'Time', 'Doctor', 'Specialty', 'Token', 'Status', 'Booked At']
            for col in expected:
                if col not in df.columns:
                    df[col] = ''
        return df
    except Exception as e:
        st.error(f"Error loading data: {e}")
        return pd.DataFrame()

df = load_data()

# ===== SIDEBAR =====
with st.sidebar:
    st.image("https://img.icons8.com/color/96/hospital.png", width=80)
    st.title("Super Clinic")
    st.caption("WhatsApp Appointment System")
    
    st.divider()
    
    # Date filter
    today = datetime.now().strftime("%d-%m-%Y")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%d-%m-%Y")
    
    date_filter = st.selectbox(
        "📅 View Schedule",
        ["All Dates", f"Today ({today})", f"Tomorrow ({tomorrow})", "This Week"]
    )
    
    st.divider()
    
    # Quick stats
    if not df.empty:
        total = len(df)
        today_count = len(df[df['Date'] == today])
        st.metric("Total Bookings", total)
        st.metric("Today's Appointments", today_count)
    
    st.divider()
    st.caption("v1.0 | Built for Demo")

# ===== MAIN HEADER =====
col_title, col_refresh = st.columns([4, 1])
with col_title:
    st.title("📊 Appointment Dashboard")
with col_refresh:
    if st.button("🔄 Refresh Data", use_container_width=True):
        st.rerun()

# ===== METRICS ROW =====
if not df.empty:
    today_df = df[df['Date'] == today] if 'Date' in df.columns else pd.DataFrame()
    
    m1, m2, m3, m4, m5 = st.columns(5)
    m1.metric("📅 Total", len(df), "all time")
    m2.metric("✅ Confirmed", len(df[df['Status'] == 'Confirmed']) if 'Status' in df.columns else 0)
    m3.metric("🏥 Today", len(today_df))
    m4.metric("✔️ Completed", len(today_df[today_df['Status'] == 'Completed']) if not today_df.empty and 'Status' in today_df.columns else 0)
    m5.metric("❌ No-shows", len(today_df[today_df['Status'] == 'No-show']) if not today_df.empty and 'Status' in today_df.columns else 0)

st.divider()

# ===== FILTER DATA =====
display_df = df.copy()

if date_filter == f"Today ({today})":
    display_df = df[df['Date'] == today] if 'Date' in df.columns else df
elif date_filter == f"Tomorrow ({tomorrow})":
    display_df = df[df['Date'] == tomorrow] if 'Date' in df.columns else df
elif date_filter == "This Week":
    # Show next 7 days
    week_dates = [(datetime.now() + timedelta(days=i)).strftime("%d-%m-%Y") for i in range(7)]
    display_df = df[df['Date'].isin(week_dates)] if 'Date' in df.columns else df

# ===== APPOINTMENTS TABLE =====
st.subheader("📋 Appointment List")

if display_df.empty:
    st.info("No appointments found for selected date.")
else:
    # Format for display
    display_cols = ['Token', 'Name', 'Phone', 'Date', 'Time', 'Doctor', 'Specialty', 'Status']
    available_cols = [c for c in display_cols if c in display_df.columns]
    
    # Add action buttons column
    st.dataframe(
        display_df[available_cols],
        use_container_width=True,
        hide_index=True,
        column_config={
            "Status": st.column_config.SelectboxColumn(
                "Status",
                help="Appointment status",
                width="small",
                options=["Confirmed", "Completed", "No-show", "Cancelled"]
            ),
            "Token": st.column_config.TextColumn("Token", width="small"),
            "Name": st.column_config.TextColumn("Patient", width="medium"),
            "Phone": st.column_config.TextColumn("Phone", width="medium"),
            "Date": st.column_config.TextColumn("Date", width="small"),
            "Time": st.column_config.TextColumn("Time", width="small"),
            "Doctor": st.column_config.TextColumn("Doctor", width="medium"),
        }
    )

st.divider()

# ===== TODAY'S SCHEDULE WITH ACTIONS =====
st.subheader("⏰ Today's Schedule - Quick Actions")

if today_df.empty or today_df is None:
    st.info("No appointments for today.")
else:
    for idx, row in today_df.iterrows():
        with st.container(border=True):
            cols = st.columns([2, 2, 1.5, 1.5, 1, 1, 1])
            
            cols[0].markdown(f"**{row.get('Name', 'N/A')}**")
            cols[1].caption(f"📞 {row.get('Phone', 'N/A')}")
            cols[2].markdown(f"🕐 **{row.get('Time', 'N/A')}**")
            cols[3].markdown(f"👨‍⚕️ {row.get('Doctor', 'N/A')}")
            cols[4].markdown(f"🔖 `{row.get('Token', 'N/A')}`")
            
            status = row.get('Status', 'Confirmed')
            if status == 'Confirmed':
                cols[5].badge("Confirmed", color="green")
            elif status == 'Completed':
                cols[5].badge("Done", color="blue")
            elif status == 'No-show':
                cols[5].badge("No-show", color="red")
            else:
                cols[5].badge(status, color="gray")
            
            # Action buttons
            with cols[6]:
                phone = str(row.get('Phone', '')).strip()
                name = row.get('Name', 'Patient')
                time = row.get('Time', '')
                doctor = row.get('Doctor', '')
                token = row.get('Token', '')
                
                if st.button("📤 Remind", key=f"rem_{idx}", use_container_width=True):
                    msg = (
                        f"⏰ Reminder from Super Clinic\n\n"
                        f"Hi {name}, your appointment is today at {time} with {doctor}.\n"
                        f"Token: {token}\n\n"
                        f"Please arrive 15 minutes early.\n"
                        f"Reply CANCEL if you can't make it."
                    )
                    if send_whatsapp(phone, msg):
                        st.toast(f"✅ Reminder sent to {name}!")
                    else:
                        st.toast(f"❌ Failed to send to {name}")
                
                if st.button("✅ Done", key=f"done_{idx}", use_container_width=True):
                    # In production, update sheet status
                    st.toast(f"Marked {name} as completed")
                    st.rerun()

st.divider()

# ===== ADD NEW APPOINTMENT =====
with st.expander("➕ Add New Appointment (Manual Booking)"):
    with st.form("manual_booking"):
        col1, col2 = st.columns(2)
        
        with col1:
            new_name = st.text_input("Patient Name*", placeholder="Rajesh Kumar")
            new_phone = st.text_input("Phone*", placeholder="919876543210")
            new_date = st.date_input("Date*", datetime.now())
        
        with col2:
            new_doctor = st.selectbox("Doctor*", ["Dr. Sharma", "Dr. Verma", "Dr. Patel"])
            new_time = st.selectbox("Time*", [
                "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", 
                "11:30 AM", "01:00 PM", "02:00 PM", "03:00 PM", 
                "04:00 PM", "04:30 PM", "05:00 PM", "06:00 PM"
            ])
            new_status = st.selectbox("Status", ["Confirmed", "Completed", "No-show", "Cancelled"])
        
        submitted = st.form_submit_button("📲 Book & Send WhatsApp", use_container_width=True)
        
        if submitted:
            if not new_name or not new_phone:
                st.error("Name and Phone are required!")
            else:
                # Determine specialty
                specialties = {
                    "Dr. Sharma": "General Physician",
                    "Dr. Verma": "Cardiologist",
                    "Dr. Patel": "Dermatologist"
                }
                specialty = specialties.get(new_doctor, "General Physician")
                
                # Generate token
                token = f"#SC-{len(df)+1:03d}"
                
                # Save to sheet
                try:
                    sheet.append_row([
                        new_name,
                        new_phone,
                        new_date.strftime("%d-%m-%Y"),
                        new_time,
                        new_doctor,
                        specialty,
                        token,
                        new_status,
                        datetime.now().strftime("%d-%m-%Y %H:%M")
                    ])
                    
                    # Send WhatsApp
                    msg = (
                        f"✅ Appointment Confirmed!\n\n"
                        f"Patient: {new_name}\n"
                        f"Date: {new_date.strftime('%d-%m-%Y')}\n"
                        f"Time: {new_time}\n"
                        f"Doctor: {new_doctor} ({specialty})\n"
                        f"Token: {token}\n\n"
                        f"📋 Please bring ID proof and previous prescriptions.\n"
                        f"Reply CANCEL to reschedule."
                    )
                    
                    if send_whatsapp(new_phone, msg):
                        st.success(f"✅ Booked and WhatsApp sent to {new_name}!")
                        st.rerun()
                    else:
                        st.warning("Saved but WhatsApp failed to send")
                        
                except Exception as e:
                    st.error(f"Error: {e}")

# ===== FOOTER =====
st.divider()
st.caption("🏥 Super Clinic WhatsApp Bot")