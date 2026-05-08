import streamlit as st
import pandas as pd
import requests
import os
import sys
import logging
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).parent))
from config import get_all_clinics, get_clinic, get_current_clinic, set_current_clinic, get_clinic_stats, add_clinic, update_clinic, delete_clinic, get_now
from config import verify_user, add_user, update_password, delete_user, get_user, load_users
from services.whatsapp import get_access_token, send_text, send_buttons
from services.sheets import (
    BOOKING_HEADERS, 
    MEDICINE_HEADERS, 
    TEST_HEADERS, 
    FOLLOWUP_HEADERS, 
    ensure_headers, 
    open_sheet, 
    append_booking, 
    append_medicine, 
    append_test, 
    append_followup
)
from services.calendar import create_calendar_event, sync_doctor_sessions

load_dotenv()

st.set_page_config(
    page_title="Clinic Bot",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if "logged_in" not in st.session_state:
    st.session_state["logged_in"] = False
if "user_role" not in st.session_state:
    st.session_state["user_role"] = None
if "user_email" not in st.session_state:
    st.session_state["user_email"] = None
if "clinic_id" not in st.session_state:
    st.session_state["clinic_id"] = None
if "clinic_name" not in st.session_state:
    st.session_state["clinic_name"] = None
if "session_restored" not in st.session_state:
    st.session_state["session_restored"] = False

# New Reminder Flow State
if "reminder_step" not in st.session_state:
    st.session_state.reminder_step = 1
if "temp_medicines" not in st.session_state:
    st.session_state.temp_medicines = []
if "temp_patient_phone" not in st.session_state:
    st.session_state.temp_patient_phone = ""
if "temp_patient_name" not in st.session_state:
    st.session_state.temp_patient_name = ""
if "temp_appointment_id" not in st.session_state:
    st.session_state.temp_appointment_id = ""
if "temp_duration" not in st.session_state:
    st.session_state.temp_duration = 5
if "temp_start_date" not in st.session_state:
    st.session_state.temp_start_date = get_now().date()


def get_auto_times(frequency):
    if frequency == "Once daily":
        return ["09:00", "", ""]
    elif frequency == "Twice daily":
        return ["09:00", "21:00", ""]
    elif frequency == "Thrice daily":
        return ["09:00", "14:00", "21:00"]
    return ["09:00", "", ""]

def parse_quick_entry(text):
    import re
    # Matches "Medicine Name 2x5" or "Medicine Name 2 x 5"
    pattern = r"([\w\s]+?)\s+(\d+)\s*[xX]\s*(\d+)"
    matches = re.findall(pattern, text)
    results = []
    for m in matches:
        name = m[0].strip()
        freq_num = int(m[1])
        duration = int(m[2])
        freq_str = "Daily"
        if freq_num == 1: freq_str = "Once daily"
        elif freq_num == 2: freq_str = "Twice daily"
        elif freq_num == 3: freq_str = "Thrice daily"
        
        times = get_auto_times(freq_str)
        results.append({
            "name": name,
            "dosage": "1 tablet",
            "frequency": freq_str,
            "duration": duration,
            "times": times
        })
    return results


def _restore_login_from_query_params():
    if st.session_state.get("logged_in") or st.session_state.get("session_restored"):
        return
    auth_email = st.query_params.get("auth_email")
    if not auth_email:
        st.session_state["session_restored"] = True
        return
    user = get_user(auth_email)
    if not user:
        st.session_state["session_restored"] = True
        return
    st.session_state["logged_in"] = True
    st.session_state["user_role"] = user.get("role")
    st.session_state["user_email"] = auth_email
    st.session_state["clinic_id"] = user.get("clinic_phone_id")
    if user.get("clinic_phone_id"):
        clinic = get_clinic(user.get("clinic_phone_id"))
        if clinic:
            st.session_state["clinic_name"] = clinic.get("name", "Unknown")
    st.session_state["session_restored"] = True

def show_login():
    st.markdown("### 🔐 Login")
    
    with st.form("login_form"):
        email = st.text_input("Email")
        password = st.text_input("Password", type="password")
        submit = st.form_submit_button("Login")
        
        if submit:
            user = verify_user(email, password)
            if user:
                st.session_state["logged_in"] = True
                st.session_state["user_role"] = user.get("role")
                st.session_state["user_email"] = email
                st.session_state["clinic_id"] = user.get("clinic_phone_id")
                st.query_params["auth_email"] = email
                
                if user.get("clinic_phone_id"):
                    clinic = get_clinic(user.get("clinic_phone_id"))
                    if clinic:
                        st.session_state["clinic_name"] = clinic.get("name", "Unknown")
                
                st.rerun()
            else:
                st.error("Invalid email or password")
    
    st.markdown("---")
    st.caption("Contact admin if you forgot your password")

def logout():
    st.session_state["logged_in"] = False
    st.session_state["user_role"] = None
    st.session_state["user_email"] = None
    st.session_state["clinic_id"] = None
    st.session_state["clinic_name"] = None
    st.query_params.clear()
    st.rerun()

def show_change_password():
    st.markdown("### 🔑 Change Password")
    
    with st.form("password_form"):
        new_password = st.text_input("New Password", type="password")
        confirm_password = st.text_input("Confirm Password", type="password")
        submit = st.form_submit_button("Update Password")
        
        if submit:
            if new_password != confirm_password:
                st.error("Passwords do not match")
            elif len(new_password) < 4:
                st.error("Password must be at least 4 characters")
            else:
                update_password(st.session_state["user_email"], new_password)
                st.success("Password updated successfully!")
                st.rerun()
    
    if st.button("← Back"):
        st.rerun()

IS_LOCAL = os.path.exists("credentials.json")
DEMO_TOKENS = {"#SC-001", "#SC-002", "#SC-003", "#SC-004", "#SC-005", "#SC-006"}
DEMO_NAMES = {"Priya Sharma", "Amit Patel", "Sunita Devi", "Rajesh Kumar", "Vikram Singh", "Neha Gupta"}

def get_sheet_local(sheet_name):
    return open_sheet(sheet_name=sheet_name)


def _is_demo_row(row):
    return str(row.get("Token", "")).strip() in DEMO_TOKENS or str(row.get("Name", "")).strip() in DEMO_NAMES


def purge_demo_bookings(clinic):
    sheet = get_sheet_local(clinic["sheet_name"])
    ensure_headers(sheet, BOOKING_HEADERS)
    rows = sheet.get_all_records()
    to_delete = [index for index, row in enumerate(rows, start=2) if _is_demo_row(row)]
    for row_index in reversed(to_delete):
        sheet.delete_rows(row_index)
    return len(to_delete)


def update_booking_status_in_sheet(clinic, token, new_status):
    if not token:
        return False, "Missing token"
    sheet = get_sheet_local(clinic["sheet_name"])
    ensure_headers(sheet, BOOKING_HEADERS)
    rows = sheet.get_all_records()
    status_col = BOOKING_HEADERS.index("Status") + 1
    token_col = BOOKING_HEADERS.index("Token") + 1
    for row_index, row in enumerate(rows, start=2):
        if str(row.get("Token", "")).strip() == str(token).strip():
            sheet.update_cell(row_index, status_col, new_status)
            return True, None
    # fallback for non-standard headers
    cell = sheet.find(str(token), in_column=token_col)
    if cell:
        sheet.update_cell(cell.row, status_col, new_status)
        return True, None
    return False, "Token not found"


def load_clinic_data(clinic, demo_mode=False):
    if demo_mode or not IS_LOCAL:
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

    bookings = pd.DataFrame()
    medicines = pd.DataFrame()
    tests = pd.DataFrame()
    followups = pd.DataFrame()

    try:
        bookings_sheet = get_sheet_local(clinic["sheet_name"])
        ensure_headers(bookings_sheet, BOOKING_HEADERS)
        records = bookings_sheet.get_all_records()
        bookings = pd.DataFrame(records)
        if not bookings.empty:
            if "Name" in bookings.columns:
                bookings = bookings[bookings["Name"].astype(str).str.strip() != ""]
            bookings = bookings[~bookings.apply(_is_demo_row, axis=1)]
            if "Booked At" in bookings.columns:
                bookings['Booked At DT'] = pd.to_datetime(bookings['Booked At'], dayfirst=True, errors='coerce')
                bookings = bookings.sort_values("Booked At DT", ascending=True).drop(columns=['Booked At DT'])
            
            if "Date" in bookings.columns:
                raw_dates = bookings['Date'].copy()
                # 1. Try DD-MM-YYYY (Our new standard)
                bookings['Date'] = pd.to_datetime(raw_dates, dayfirst=True, errors='coerce').dt.strftime('%d-%m-%Y')
                
                # 2. If any failed (older data), try standard ISO YYYY-MM-DD
                mask = bookings['Date'].isna() & (raw_dates.astype(str).str.strip() != "")
                if mask.any():
                    bookings.loc[mask, 'Date'] = pd.to_datetime(raw_dates[mask], format='%Y-%m-%d', errors='coerce').dt.strftime('%d-%m-%Y')
                
                # 3. Last fallback for M/D/YYYY
                mask = bookings['Date'].isna() & (raw_dates.astype(str).str.strip() != "")
                if mask.any():
                    bookings.loc[mask, 'Date'] = pd.to_datetime(raw_dates[mask], dayfirst=False, errors='coerce').dt.strftime('%d-%m-%Y')
    except Exception as e:
        st.warning(f"Bookings sheet load issue: {e}")

    try:
        medicines_sheet = get_sheet_local(clinic["medicines_sheet"])
        ensure_headers(medicines_sheet, MEDICINE_HEADERS)
        med_records = medicines_sheet.get_all_records()
        medicines = pd.DataFrame(med_records)
    except Exception as e:
        st.warning(f"Medicines sheet load issue: {e}")

    try:
        test_sheet_name = f"{clinic.get('name', 'clinic').lower().replace(' ', '_')}_test"
        test_sheet = open_sheet(test_sheet_name)
        ensure_headers(test_sheet, TEST_HEADERS)
        test_records = test_sheet.get_all_records()
        tests = pd.DataFrame(test_records)
    except Exception as e:
        logger.error(f"Tests sheet load issue: {e}")

    try:
        followup_sheet_name = f"{clinic.get('name', 'clinic').lower().replace(' ', '_')}_followup"
        followup_sheet = open_sheet(followup_sheet_name)
        ensure_headers(followup_sheet, FOLLOWUP_HEADERS)
        followup_records = followup_sheet.get_all_records()
        followups = pd.DataFrame(followup_records)
    except Exception as e:
        logger.error(f"Follow-ups sheet load issue: {e}")

    return bookings, medicines, tests, followups

def send_whatsapp(clinic, phone, message, buttons=None):
    try:
        if buttons:
            send_buttons(clinic, phone, message, buttons)
        else:
            send_text(clinic, phone, message)
        return True
    except Exception as e:
        logger.error(f"WhatsApp error: {e}")
        return False

def load_all_bookings():
    all_bookings = []
    clinics = get_all_clinics()
    
    for clinic in clinics:
        try:
            if IS_LOCAL:
                sheet = get_sheet_local(clinic["sheet_name"])
                ensure_headers(sheet, BOOKING_HEADERS)
                records = sheet.get_all_records()
                df = pd.DataFrame(records)
                if not df.empty:
                    df = df[~df.apply(_is_demo_row, axis=1)]
                    if 'Date' in df.columns:
                        raw_dates = df['Date'].copy()
                        df['Date'] = pd.to_datetime(raw_dates, dayfirst=False, errors='coerce').dt.strftime('%d-%m-%Y')
                        mask = df['Date'].isna() & (raw_dates.astype(str).str.strip() != "")
                        if mask.any():
                            df.loc[mask, 'Date'] = pd.to_datetime(raw_dates[mask], dayfirst=True, errors='coerce').dt.strftime('%d-%m-%Y')
                df['Clinic'] = clinic['name']
                all_bookings.append(df)
        except:
            pass
    
    if all_bookings:
        return pd.concat(all_bookings, ignore_index=True)
    return pd.DataFrame()

def show_admin_panel():
    st.title("🏥 Clinic Bot - Admin Panel")
    
    stats = get_clinic_stats()
    
    st.markdown("### 📊 Overview")
    
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Clinics", stats["total"])
    c2.metric("Active", stats["active"])
    c3.metric("Inactive", stats["inactive"])
    c4.metric("Monthly Revenue", f"₹{stats['monthly_revenue']}")
    
    st.divider()
    
    tab1, tab2, tab3 = st.tabs(["🏢 Clinics", "👥 Users", "➕ Add New Clinic"])
    
    with tab1:
        st.subheader("Manage Clinics")
        
        clinics = get_all_clinics()
        
        if clinics:
            for clinic in clinics:
                phone_id = clinic.get("phone_number_id") or clinic.get("id")
                
                with st.expander(f"🏥 {clinic['name']} ({clinic.get('subscription_status', 'active').title()})"):
                    col1, col2, col3 = st.columns([2, 1, 1])
                    
                    with col1:
                        st.write(f"**Phone ID:** {phone_id}")
                        st.write(f"**Phone:** {clinic.get('phone', 'N/A')}")
                        st.write(f"**Address:** {clinic.get('address', 'N/A')}")
                    
                    with col2:
                        st.write(f"**Monthly Fee:** ₹{clinic.get('monthly_fee', 0)}")
                        status = clinic.get('subscription_status', 'active')
                        if status not in ["active", "inactive", "trial"]:
                            status = "active"
                        color = "green" if status == "active" else "red"
                        st.markdown(f"**Status:** :{color}[{status.upper()}]")
                    
                    with col3:
                        new_status = st.selectbox(
                            "Change Status",
                            ["active", "inactive", "trial"],
                            index=["active", "inactive", "trial"].index(status),
                            key=f"status_{phone_id}"
                        )
                        if new_status != status:
                            update_clinic(phone_id, {"subscription_status": new_status})
                            st.success("Updated!")
                            st.rerun()
                        
                        if st.button("Delete", key=f"del_{phone_id}"):
                            delete_clinic(phone_id)
                            st.warning("Clinic deleted!")
                            st.rerun()
                        if st.button("Purge Demo Rows", key=f"purge_demo_{phone_id}"):
                            try:
                                removed = purge_demo_bookings(clinic)
                                st.success(f"Removed {removed} demo rows.")
                            except Exception as e:
                                st.error(f"Failed to purge demo rows: {e}")
        else:
            st.info("No clinics added yet.")
    
    with tab2:
        st.subheader("Create Clinic User For Existing Clinic")

        clinics = get_all_clinics()
        clinic_options = {
            f"{clinic.get('name', 'Clinic')} ({clinic.get('phone_number_id') or clinic.get('id')})":
            (clinic.get("phone_number_id") or clinic.get("id"))
            for clinic in clinics
        }

        with st.form("create_existing_clinic_user_form"):
            new_user_email = st.text_input("User Email*")
            new_user_password = st.text_input("Temporary Password*", type="password")
            selected_label = st.selectbox(
                "Select Clinic*",
                list(clinic_options.keys()) if clinic_options else ["No clinics available"],
                disabled=not clinic_options
            )
            submit_new_user = st.form_submit_button("Create Clinic User")

            if submit_new_user:
                clinic_id = clinic_options.get(selected_label)
                if not clinic_id:
                    st.error("No clinic selected. Add a clinic first.")
                elif not new_user_email or not new_user_password:
                    st.error("Email and password are required.")
                elif len(new_user_password) < 4:
                    st.error("Password must be at least 4 characters.")
                elif get_user(new_user_email):
                    st.error("User already exists with this email.")
                else:
                    add_user(new_user_email, new_user_password, role="clinic", clinic_phone_id=clinic_id)
                    st.success(f"Created clinic user '{new_user_email}'")
                    st.rerun()

        st.markdown("#### Existing Users")
        users = load_users()
        user_rows = []
        for email, user in users.items():
            clinic_id = user.get("clinic_phone_id", "")
            clinic = get_clinic(clinic_id) if clinic_id else None
            user_rows.append({
                "Email": email,
                "Role": user.get("role", ""),
                "Clinic ID": clinic_id,
                "Clinic Name": clinic.get("name") if clinic else "",
            })
        if user_rows:
            st.dataframe(pd.DataFrame(user_rows), use_container_width=True, hide_index=True)
        else:
            st.info("No users found.")

        st.divider()
        st.subheader("All Appointments Across Clinics")
        
        all_data = load_all_bookings()
        
        if not all_data.empty:
            col_f1, col_f2 = st.columns(2)
            with col_f1:
                clinic_filter = st.selectbox("Filter by Clinic", ["All Clinics"] + list(all_data['Clinic'].unique()))
            with col_f2:
                status_filter = st.selectbox("Filter by Status", ["All", "Confirmed", "Completed", "Cancelled"])
            
            display_df = all_data.copy()
            if clinic_filter != "All Clinics":
                display_df = display_df[display_df['Clinic'] == clinic_filter]
            if status_filter != "All":
                display_df = display_df[display_df['Status'] == status_filter]
            
            st.dataframe(display_df, use_container_width=True, hide_index=True)
            
            st.metric("Total Appointments", len(display_df))
        else:
            st.info("No appointment data available")
    
    with tab3:
        st.subheader("Add New Clinic")
        
        with st.form("add_clinic_form"):
            st.markdown("#### Clinic Information")
            
            c_name = st.text_input("Clinic Name*")
            c_phone = st.text_input("Phone Number*")
            c_address = st.text_area("Address")
            
            st.markdown("#### WhatsApp Configuration")
            c_phone_id = st.text_input("Phone Number ID*")
            default_token_env = f"WHATSAPP_TOKEN_{c_phone_id}" if c_phone_id else ""
            c_token_env = st.text_input("WhatsApp Token Env Var*", value=default_token_env)

            st.markdown("#### Google Calendar")
            c_calendar_id = st.text_input("Calendar ID", placeholder="clinic@gmail.com or calendar id")
            c_staff_numbers = st.text_input("Staff WhatsApp Numbers (comma separated)", placeholder="9198...,9197...")
            
            st.markdown("#### Subscription")
            c_fee = st.number_input("Monthly Fee (₹)", min_value=0, value=1500)
            c_status = st.selectbox("Status", ["active", "trial", "inactive"])
            c_expiry = st.date_input("Expiry Date", datetime(2026, 12, 31))

            st.markdown("#### Clinic Login")
            account_email = st.text_input("Clinic Login Email*")
            account_password = st.text_input("Temporary Password*", type="password")
            
            st.markdown("#### Doctors (at least one)")
            
            num_doctors = st.number_input("Number of Doctors", min_value=1, max_value=10, value=1)
            
            doctors = []
            for i in range(num_doctors):
                with st.expander(f"Doctor {i+1}"):
                    d_name = st.text_input(f"Name", key=f"d_name_{i}")
                    d_specialty = st.text_input(f"Specialty", key=f"d_specialty_{i}")
                    d_slots = st.multiselect(
                        f"Time Slots",
                        ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", 
                         "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
                         "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
                         "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM"],
                        key=f"d_slots_{i}"
                    )
                    if d_name and d_specialty:
                        doctors.append({
                            "id": f"d{i+1}",
                            "name": d_name,
                            "specialty": d_specialty,
                            "slots": d_slots
                        })
            
            submitted = st.form_submit_button("➕ Add Clinic")
            
            if submitted:
                if not c_name or not c_phone or not c_phone_id or not c_token_env or not account_email or not account_password:
                    st.error("Please fill all required fields!")
                elif not doctors:
                    st.error("Please add at least one doctor!")
                else:
                    new_clinic = {
                        "name": c_name,
                        "phone": c_phone,
                        "address": c_address,
                        "whatsapp_token_env": c_token_env,
                        "phone_number_id": c_phone_id,
                        "webhook_verify_token": f"clinic_bot_{get_now().strftime('%Y%m%d')}",
                        "subscription_status": c_status,
                        "monthly_fee": c_fee,
                        "created_date": get_now().strftime("%Y-%m-%d"),
                        "expiry_date": c_expiry.strftime("%Y-%m-%d"),
                        "doctors": doctors,
                        "sheet_name": f"{c_name.lower().replace(' ', '_')}_bookings",
                        "medicines_sheet": f"{c_name.lower().replace(' ', '_')}_medicines",
                        "google_calendar_id": c_calendar_id,
                        "staff_numbers": [p.strip() for p in c_staff_numbers.split(",") if p.strip()],
                        "timezone": "Asia/Kolkata"
                    }
                    
                    clinic_id = add_clinic(new_clinic)
                    add_user(account_email, account_password, role="clinic", clinic_phone_id=clinic_id)
                    st.success(f"Clinic '{c_name}' and login '{account_email}' added successfully!")
                    st.rerun()
    
    st.markdown("---")
    st.caption("🏥 Admin Panel - Manage all clinics")

def show_clinic_dashboard(clinic, bookings, medicines, tests=None, followups=None):
    if tests is None: tests = pd.DataFrame()
    if followups is None: followups = pd.DataFrame()
    today = get_now().strftime("%d-%m-%Y")
    tomorrow = (get_now() + timedelta(days=1)).strftime("%d-%m-%Y")
    next_week = [(get_now() + timedelta(days=i)).strftime("%d-%m-%Y") for i in range(7)]
    
    with st.sidebar:
        st.markdown(f"## 🏥 {clinic['name']}")
        st.caption(f"Subscription: {clinic.get('subscription_status', 'active').title()}")
        
        if IS_LOCAL:
            st.success("🟢 Connected to Google Sheets")
        else:
            st.info("☁️ Demo Mode")
        
        st.divider()
        
        date_filter = st.selectbox(
            "📅 View Schedule",
            ["All Dates", f"Today ({today})", f"Tomorrow ({tomorrow})", "This Week"]
        )
        
        doctor_filter = st.selectbox(
            "👨‍⚕️ Filter by Doctor",
            ["All Doctors"] + [d["name"] for d in clinic.get("doctors", [])]
        )
        
        st.divider()
        
        if not bookings.empty:
            today_df = bookings[bookings['Date'] == today] if 'Date' in bookings.columns else pd.DataFrame()
            st.metric("Today's Appointments", len(today_df))
            st.metric("Total Bookings", len(bookings))
        
        st.divider()
        st.markdown("### 🔐 Admin")
        if st.button("⚙️ Admin Panel", use_container_width=True):
            st.query_params["view"] = "admin"
            st.rerun()
    
    # Navigation Tabs
    nav_tabs = ["📅 Appointments", "👥 Patients", "💊 Medicines", "⚙️ Settings"]
    if "active_main_tab" not in st.session_state:
        st.session_state.active_main_tab = nav_tabs[0]
    
    # Check if we need to force a tab switch from a button click
    selected_tab = st.radio("Navigation", nav_tabs, 
                             index=nav_tabs.index(st.session_state.active_main_tab), 
                             horizontal=True, 
                             label_visibility="collapsed",
                             key="main_nav_radio")
    st.session_state.active_main_tab = selected_tab

    if selected_tab == "📅 Appointments":
        col_title, col_refresh = st.columns([3, 1])
        with col_title:
            st.title("📊 Appointment Dashboard")
        with col_refresh:
            if st.button("🔄 Refresh", use_container_width=True):
                st.rerun()
        
        if not bookings.empty:
            today_df = bookings[bookings['Date'] == today] if 'Date' in bookings.columns else pd.DataFrame()
            upcoming_df = bookings[bookings['Date'].isin(next_week)] if 'Date' in bookings.columns else pd.DataFrame()
            
            c1, c2, c3, c4, c5 = st.columns(5)
            c1.metric("📅 Total", len(bookings))
            c2.metric("✅ Confirmed", len(bookings[bookings['Status'] == 'Confirmed']) if 'Status' in bookings.columns else 0)
            c3.metric("🏥 Today", len(today_df))
            c4.metric("✔️ Completed", len(bookings[bookings['Status'] == 'Completed']) if 'Status' in bookings.columns else 0)
            c5.metric("❌ Cancelled", len(bookings[bookings['Status'] == 'Cancelled']) if 'Status' in bookings.columns else 0)
            
            st.divider()
            
            display_df = bookings.copy()
            if date_filter == "All Dates":
                display_df = bookings
            elif date_filter == f"Today ({today})":
                display_df = bookings[bookings['Date'] == today] if 'Date' in bookings.columns else bookings
            elif date_filter == f"Tomorrow ({tomorrow})":
                display_df = bookings[bookings['Date'] == tomorrow] if 'Date' in bookings.columns else bookings
            elif date_filter == "This Week":
                display_df = bookings[bookings['Date'].isin(next_week)] if 'Date' in bookings.columns else bookings
            else:
                display_df = bookings
            
            if doctor_filter != "All Doctors":
                display_df = display_df[display_df['Doctor'] == doctor_filter] if 'Doctor' in display_df.columns else display_df
            
            st.subheader(f"📋 Appointments - {date_filter}")
            
            col_search, col_export = st.columns([3, 1])
            with col_search:
                search = st.text_input("🔍 Search by name or phone", placeholder="Enter name or phone...")
            with col_export:
                csv = display_df.to_csv(index=False) if not display_df.empty else ""
                st.download_button("📥 Export CSV", csv, "appointments.csv", "text/csv")
            
            if search:
                display_df = display_df[
                    (display_df['Name'].str.contains(search, case=False, na=False)) |
                    (display_df['Phone'].str.contains(search, case=False, na=False))
                ] if 'Name' in display_df.columns else display_df
            
            if display_df.empty:
                st.info("No appointments found.")
            else:
                cols = ['Token', 'Name', 'Phone', 'Date', 'Time', 'Doctor', 'Specialty', 'Status']
                available = [c for c in cols if c in display_df.columns]
                st.dataframe(display_df[available], use_container_width=True, hide_index=True)
            
            st.divider()
            
            st.subheader("⏰ Today's Actions")
            if today_df.empty or today_df is None:
                st.info("No appointments today.")
            else:
                today_filtered = today_df
                if doctor_filter != "All Doctors":
                    today_filtered = today_df[today_df['Doctor'] == doctor_filter] if 'Doctor' in today_df.columns else today_df

                # --- NEXT PATIENT LOGIC ---
                col_next_p, _ = st.columns([1, 3])
                with col_next_p:
                    if st.button("⏭️ Next Patient", use_container_width=True, help="Mark current as Completed and next as Serving"):
                        # Logic: Find current 'Serving', mark Completed. Find first 'Pending', mark Serving.
                        try:
                            # We need the most recent data from the sheet for this
                            sheet = get_sheet_local(clinic["sheet_name"])
                            records = sheet.get_all_records()

                            serving_token = None
                            next_pending_token = None

                            # Filter for today and doctor
                            today_str = get_now().strftime("%d-%m-%Y")
                            doctor = doctor_filter if doctor_filter != "All Doctors" else None

                            for r in records:
                                if str(r.get("Date")) == today_str:
                                    if doctor and r.get("Doctor") != doctor:
                                        continue

                                    if r.get("Status") == "Serving":
                                        serving_token = r.get("Token")
                                    elif r.get("Status") == "Pending" and next_pending_token is None:
                                        next_pending_token = r.get("Token")

                            if serving_token:
                                update_booking_status_in_sheet(clinic, serving_token, "Completed")

                            if next_pending_token:
                                update_booking_status_in_sheet(clinic, next_pending_token, "Serving")
                                st.success(f"Now serving: {next_pending_token}")
                                st.rerun()
                            elif serving_token:
                                st.info("Queue finished!")
                                st.rerun()
                            else:
                                st.warning("No pending patients found.")
                        except Exception as e:
                            st.error(f"Error updating queue: {e}")
                # ---------------------------

                for idx, row in today_filtered.iterrows():

                    with st.container(border=True):
                        c1, c2, c3, c4, c5, c6, c7, c8 = st.columns([2, 2, 1, 0.8, 0.6, 0.6, 0.6, 0.6])
                        
                        c1.markdown(f"**{row.get('Name', 'N/A')}**")
                        c2.caption(f"🕐 {row.get('Time', 'N/A')} | {row.get('Doctor', 'N/A')}")
                        c3.markdown(f"🔖 `{row.get('Token', 'N/A')}`")
                        
                        status = row.get('Status', 'Confirmed')
                        color = "green" if status == "Confirmed" else "blue" if status == "Completed" else "red"
                        c4.markdown(f":{color}[{status}]")
                        
                        phone = str(row.get('Phone', '')).strip()
                        name = row.get('Name', 'Patient')
                        time = row.get('Time', '')
                        doctor = row.get('Doctor', '')
                        token = row.get('Token', '')
                        appointment_date = row.get('Date', '')
                        
                        with c5:
                            if st.button("📤", key=f"rem_{idx}", help="Send Reminder"):
                                msg = f"⏰ Reminder: Hi {name}, your appointment is today at {time} with {doctor}. Token: {token}. Please arrive 15 minutes early."
                                if send_whatsapp(clinic, phone, msg):
                                    st.success("Sent!")
                                else:
                                    st.error("Failed")
                        
                        with c6:
                            if st.button("💊", key=f"med_rem_{idx}", help="Set Medicine Reminder"):
                                st.session_state.temp_patient_phone = phone
                                st.session_state.temp_patient_name = name
                                st.session_state.temp_appointment_id = token
                                st.session_state.reminder_step = 2
                                st.session_state.reminder_expanded = True
                                st.session_state.reminder_type_radio = "Medicine" # Ensure radio matches
                                st.session_state.active_main_tab = "💊 Medicines" # Switch to Medicines tab
                                st.rerun()

                        with c7:
                            current_status = row.get('Status', 'Confirmed')
                            status_choice = st.selectbox(
                                "Status",
                                ["Pending", "Serving", "Completed", "Cancelled"],
                                index=["Pending", "Serving", "Completed", "Cancelled"].index(current_status) if current_status in ["Pending", "Serving", "Completed", "Cancelled"] else 0,
                                key=f"status_select_{idx}",
                                label_visibility="collapsed",
                            )
                            if st.button("OK", key=f"stat_{idx}", help="Update status"):
                                ok, err = update_booking_status_in_sheet(clinic, token, status_choice)
                                if ok:
                                    st.success(f"Updated!")
                                    st.rerun()
                                else:
                                    st.error("Failed")
                        
                        with c8:
                            with st.popover("🔄", help="Set Re-visit"):
                                st.markdown("### Follow-up")
                                with st.form(f"followup_{idx}"):
                                    days_after = st.number_input("Remind after (days)", min_value=1, max_value=30, value=5)
                                    followup_msg = st.text_area("Custom Message (optional)", "Hi {name}, this is a follow-up reminder for your visit with {doctor} on {date}. Please book an appointment.")
                                    
                                    test_options = ["None"] + [t['name'] for t in clinic.get('tests', [])]
                                    selected_test = st.selectbox("If any test required", test_options)
                                    
                                    if st.form_submit_button("Set Reminder"):
                                        followup_date = (get_now() + timedelta(days=days_after)).strftime('%d-%m-%Y')
                                        test_instr = ""
                                        if selected_test != "None":
                                            for t in clinic.get('tests', []):
                                                if t['name'] == selected_test:
                                                    test_instr = f"\n\n🧪 Test: {selected_test}\nInstructions: {t['instructions']}"
                                        
                                        final_msg = followup_msg.format(name=name, doctor=doctor, date=appointment_date) + test_instr
                                        
                                        try:
                                            append_followup(clinic, [
                                                phone,
                                                f"Follow-up: {name}",
                                                followup_date,
                                                final_msg,
                                                "Pending",
                                                get_now().strftime("%d-%m-%Y %H:%M")
                                            ])
                                            st.success(f"Reminder set for {followup_date}!")
                                        except Exception as e:
                                            st.error(f"Error: {e}")
        
        st.divider()
        
        with st.expander("➕ Add New Appointment"):
            with st.form("manual_add"):
                a1, a2 = st.columns(2)
                with a1:
                    new_name = st.text_input("Patient Name*", placeholder="Rajesh Kumar")
                    new_phone = st.text_input("Phone*", placeholder="919876543210")
                    new_date = st.date_input("Date*", get_now())
                with a2:
                    doctor_options = [d["name"] for d in clinic.get("doctors", [])]
                    new_doctor = st.selectbox("Doctor*", doctor_options if doctor_options else ["Dr. Sharma", "Dr. Verma", "Dr. Patel"])
                    time_options = ["10:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"]
                    new_time = st.selectbox("Time*", time_options)
                    new_status = st.selectbox("Status", ["Confirmed", "Completed", "No-show", "Cancelled"])
                
                if st.form_submit_button("📲 Book & Send WhatsApp"):
                    if not new_name or not new_phone:
                        st.error("Required fields missing!")
                    else:
                        spec_map = {d["name"]: d["specialty"] for d in clinic.get("doctors", [])}
                        spec = spec_map.get(new_doctor, "General Physician")
                        date_str = new_date.strftime('%d-%m-%Y')
                        from services.booking_logic import get_next_token_from_sheet
                        token = get_next_token_from_sheet(clinic, date_str, new_doctor)
                        
                        msg = f"✅ Confirmed!\n\nPatient: {new_name}\nDate: {date_str}\nTime: {new_time}\nDoctor: {new_doctor} ({spec})\nToken: {token}\n\nReply CANCEL to reschedule."
                        
                        if send_whatsapp(clinic, new_phone, msg):
                            try:
                                append_booking(clinic, [
                                    new_name,
                                    new_phone,
                                    new_date.strftime('%d-%m-%Y'),
                                    new_time,
                                    new_doctor,
                                    spec,
                                    token,
                                    new_status,
                                    get_now().strftime("%d-%m-%Y %H:%M")
                                ])
                                try:
                                    start_dt = datetime.strptime(f"{new_date.strftime('%d-%m-%Y')} {new_time}", "%d-%m-%Y %I:%M %p")
                                    create_calendar_event(
                                        clinic,
                                        {
                                            "patient_name": new_name,
                                            "phone": new_phone,
                                            "doctor_name": new_doctor,
                                            "token": token,
                                            "start_datetime": start_dt.isoformat(),
                                            "end_datetime": (start_dt + timedelta(minutes=30)).isoformat(),
                                        },
                                    )
                                except Exception:
                                    pass
                            except Exception as e:
                                st.error(f"Sheet save error: {e}")
                            st.success(f"Sent to {new_name}!")
                            st.rerun()
                        else:
                            st.error("WhatsApp failed")
    
    elif selected_tab == "👥 Patients":
        st.subheader("👥 Patient Directory")
        
        if not bookings.empty:
            patients = bookings.groupby('Phone').agg({
                'Name': 'first',
                'Date': 'count',
                'Status': lambda x: list(x.unique())
            }).reset_index()
            patients.columns = ['Phone', 'Name', 'Total Visits', 'All Statuses']
            
            search_patient = st.text_input("🔍 Search patient by name or phone", placeholder="Enter name or phone...")
            if search_patient:
                patients = patients[
                    (patients['Name'].str.contains(search_patient, case=False, na=False)) |
                    (patients['Phone'].str.contains(search_patient, case=False, na=False))
                ]
            
            st.dataframe(patients, use_container_width=True, hide_index=True)
            
            st.divider()
            
            st.subheader("📞 Patient Contact History")
            
            col_p1, col_p2 = st.columns([2, 1])
            with col_p1:
                selected_phone = st.selectbox("Select patient to view history", patients['Phone'].unique() if not patients.empty else [])
            with col_p2:
                if st.button("View History"):
                    pass
            
            if selected_phone:
                patient_bookings = bookings[bookings['Phone'] == selected_phone] if 'Phone' in bookings.columns else pd.DataFrame()
                patient_medicines = medicines[medicines['Phone'] == selected_phone] if 'Phone' in medicines.columns else pd.DataFrame()
                
                c1, c2 = st.columns(2)
                with c1:
                    st.markdown("#### 📅 Appointment History")
                    if not patient_bookings.empty:
                        st.dataframe(patient_bookings[['Date', 'Time', 'Doctor', 'Status', 'Token']], use_container_width=True, hide_index=True)
                    else:
                        st.info("No appointment history")
                
                with c2:
                    st.markdown("#### 💊 Medicine History")
                    if not patient_medicines.empty:
                        med_cols = [c for c in ['Medicine', 'Dosage', 'Frequency', 'Start Date', 'End Date', 'Status'] if c in patient_medicines.columns]
                        if med_cols:
                            st.dataframe(patient_medicines[med_cols], use_container_width=True, hide_index=True)
                        else:
                            st.info("No medicine data")
                    else:
                        st.info("No medicine history")
                
                if not patient_bookings.empty:
                    latest = patient_bookings.iloc[-1]
                    st.markdown(f"**Last Visit:** {latest.get('Date', 'N/A')} at {latest.get('Time', 'N/A')} with {latest.get('Doctor', 'N/A')}")
        else:
            st.info("No patient data available")
    
    elif selected_tab == "💊 Medicines":
        st.subheader("🔔 Reminders Management")
        
        rtab1, rtab2, rtab3 = st.tabs(["💊 Medicines", "🧪 Tests", "🔄 Follow-ups"])
        
        with rtab1:
            st.dataframe(medicines, use_container_width=True, hide_index=True)
        with rtab2:
            st.dataframe(tests, use_container_width=True, hide_index=True)
        with rtab3:
            st.dataframe(followups, use_container_width=True, hide_index=True)
        
        st.divider()
        
        with st.expander("➕ Add New Reminder", expanded=st.session_state.get("reminder_expanded", False)):
            m_type = st.radio("Reminder Type", ["Medicine", "Test", "Follow-up"], 
                              key="reminder_type_radio", horizontal=True)
            
            if st.session_state.get("reminder_type_radio") == "Medicine":
                steps = ["👤 Patient", "💊 Medicines", "📅 Schedule", "📋 Preview"]
                cols = st.columns(len(steps))
                for i, step in enumerate(steps):
                    if st.session_state.reminder_step == i + 1:
                        cols[i].markdown(f"**{step}**")
                    else:
                        cols[i].caption(step)
                
                st.divider()

                if st.session_state.reminder_step == 1:
                    st.session_state.temp_patient_phone = st.text_input("Patient Phone*", value=st.session_state.temp_patient_phone, placeholder="919876543210")
                    st.session_state.temp_patient_name = st.text_input("Patient Name (Optional)", value=st.session_state.temp_patient_name, placeholder="John Doe")
                    
                    if st.button("Next: Add Medicines ➡️"):
                        if not st.session_state.temp_patient_phone:
                            st.error("Phone required!")
                        else:
                            st.session_state.reminder_step = 2
                            st.rerun()

                elif st.session_state.reminder_step == 2:
                    st.markdown("#### ⚡ Quick Entry Mode")
                    quick_text = st.text_area("Paste like: Paracetamol 2x5", placeholder="Paracetamol 2x5\nAmoxicillin 1x3")
                    if st.button("Parse & Add"):
                        new_meds = parse_quick_entry(quick_text)
                        st.session_state.temp_medicines.extend(new_meds)
                        st.success(f"Added {len(new_meds)} medicines!")
                    
                    st.divider()
                    st.markdown("#### 💊 Current Medicines")
                    if not st.session_state.temp_medicines:
                        st.info("No medicines added yet.")
                    
                    for i, med in enumerate(st.session_state.temp_medicines):
                        with st.container(border=True):
                            m_cols = st.columns([2, 1, 1, 0.5])
                            med['name'] = m_cols[0].text_input("Medicine", med['name'], key=f"med_name_{i}")
                            med['dosage'] = m_cols[1].text_input("Dosage", med['dosage'], key=f"med_dosage_{i}")
                            
                            freq_options = ["Once daily", "Twice daily", "Thrice daily", "Weekly", "Once"]
                            current_freq = med.get('frequency', "Once daily")
                            med['frequency'] = m_cols[2].selectbox("Freq", freq_options, 
                                                                 index=freq_options.index(current_freq) if current_freq in freq_options else 0,
                                                                 key=f"med_freq_{i}")
                            
                            if med['frequency'] != current_freq:
                                med['times'] = get_auto_times(med['frequency'])
                                st.rerun()
                                
                            if m_cols[3].button("🗑️", key=f"med_del_{i}"):
                                st.session_state.temp_medicines.pop(i)
                                st.rerun()
                            
                            with st.expander("🕒 Edit Times (Optional)"):
                                t_cols = st.columns(3)
                                med['times'] = med.get('times', ["09:00", "", ""])
                                med['times'][0] = t_cols[0].text_input("Time 1", med['times'][0], key=f"med_t1_{i}")
                                med['times'][1] = t_cols[1].text_input("Time 2", med['times'][1], key=f"med_t2_{i}")
                                med['times'][2] = t_cols[2].text_input("Time 3", med['times'][2], key=f"med_t3_{i}")
                    
                    with st.container(border=True):
                        st.markdown("➕ **Add Manually**")
                        nm_cols = st.columns([2, 1, 1])
                        new_name = nm_cols[0].text_input("New Medicine", key="new_med_name")
                        new_dosage = nm_cols[1].text_input("Dosage", "1 tablet", key="new_med_dosage")
                        new_freq = nm_cols[2].selectbox("Frequency", ["Once daily", "Twice daily", "Thrice daily", "Weekly", "Once"], key="new_med_freq")
                        if st.button("Add to List"):
                            if new_name:
                                st.session_state.temp_medicines.append({
                                    "name": new_name,
                                    "dosage": new_dosage,
                                    "frequency": new_freq,
                                    "duration": st.session_state.temp_duration,
                                    "times": get_auto_times(new_freq)
                                })
                                st.rerun()

                    st.divider()
                    c1, c2 = st.columns(2)
                    if c1.button("⬅️ Back"):
                        st.session_state.reminder_step = 1
                        st.rerun()
                    if c2.button("Next: Schedule ➡️"):
                        if not st.session_state.temp_medicines:
                            st.error("Add at least one medicine!")
                        else:
                            st.session_state.reminder_step = 3
                            st.rerun()

                elif st.session_state.reminder_step == 3:
                    st.markdown("#### 📅 Schedule & Duration")
                    d1, d2 = st.columns(2)
                    st.session_state.temp_start_date = d1.date_input("Start Date", st.session_state.temp_start_date)
                    st.session_state.temp_duration = d2.number_input("Duration (days)", min_value=1, value=st.session_state.temp_duration)
                    
                    end_date = st.session_state.temp_start_date + timedelta(days=int(st.session_state.temp_duration) - 1)
                    st.info(f"📅 This will end on: **{end_date.strftime('%d-%m-%Y')}**")
                    
                    c1, c2 = st.columns(2)
                    if c1.button("⬅️ Back"):
                        st.session_state.reminder_step = 2
                        st.rerun()
                    if c2.button("Next: Preview ➡️"):
                        st.session_state.reminder_step = 4
                        st.rerun()

                elif st.session_state.reminder_step == 4:
                    st.markdown("#### 📋 Reminder Summary")
                    with st.container(border=True):
                        st.markdown(f"**Patient:** {st.session_state.temp_patient_name or 'Not specified'} ({st.session_state.temp_patient_phone})")
                        if st.session_state.temp_appointment_id:
                            st.markdown(f"**Linked to Appointment:** {st.session_state.temp_appointment_id}")
                        st.markdown(f"**Period:** {st.session_state.temp_start_date.strftime('%d-%m-%Y')} to {(st.session_state.temp_start_date + timedelta(days=int(st.session_state.temp_duration)-1)).strftime('%d-%m-%Y')}")
                        st.divider()
                        for med in st.session_state.temp_medicines:
                            times_str = ", ".join([t for t in med.get('times', []) if t])
                            st.markdown(f"💊 **{med['name']}** - {med['dosage']} - {med['frequency']} (🕒 {times_str})")
                    
                    c1, c2 = st.columns(2)
                    if c1.button("⬅️ Edit"):
                        st.session_state.reminder_step = 2
                        st.rerun()
                    if c2.button("🚀 Confirm & Send WhatsApp", type="primary"):
                        start_date_str = st.session_state.temp_start_date.strftime('%d-%m-%Y')
                        end_date_str = (st.session_state.temp_start_date + timedelta(days=int(st.session_state.temp_duration)-1)).strftime('%d-%m-%Y')
                        
                        full_msg = f"💊 *Medicine Reminder Set!*\n\nPatient: {st.session_state.temp_patient_name or 'Patient'}\n"
                        if st.session_state.temp_appointment_id:
                            full_msg += f"Ref: {st.session_state.temp_appointment_id}\n"
                        full_msg += f"Duration: {st.session_state.temp_duration} days ({start_date_str} to {end_date_str})\n\n"
                        full_msg += "*Medicines:*\n"
                        
                        success_count = 0
                        for med in st.session_state.temp_medicines:
                            times_str = ", ".join([t for t in med.get('times', []) if t])
                            full_msg += f"• {med['name']} - {med['dosage']} ({med['frequency']} @ {times_str})\n"
                            
                            try:
                                append_medicine(clinic, [
                                    st.session_state.temp_patient_phone,
                                    med['name'],
                                    med['dosage'],
                                    med['frequency'],
                                    st.session_state.temp_duration,
                                    start_date_str,
                                    end_date_str,
                                    f"Added via dashboard. Ref: {st.session_state.temp_appointment_id}",
                                    "Active",
                                    get_now().strftime("%d-%m-%Y %H:%M"),
                                    "Medicine",
                                    med['times'][0] if len(med['times']) > 0 else "09:00",
                                    med['times'][1] if len(med['times']) > 1 else "",
                                    med['times'][2] if len(med['times']) > 2 else "",
                                    st.session_state.temp_appointment_id
                                ])
                                success_count += 1
                            except Exception as e:
                                st.error(f"Error saving {med['name']}: {e}")
                        
                        full_msg += "\nPlease confirm these reminders using the buttons below:"
                        buttons = [
                            {"id": "med_confirm", "title": "Confirm ✅"},
                            {"id": "med_modify", "title": "Modify Time 🕒"},
                            {"id": "med_cancel", "title": "Cancel ❌"}
                        ]
                        
                        if send_whatsapp(clinic, st.session_state.temp_patient_phone, full_msg, buttons=buttons):
                            st.success(f"✅ {success_count} medicines scheduled and patient notified!")
                            st.session_state.temp_medicines = []
                            st.session_state.reminder_step = 1
                            st.session_state.reminder_expanded = False
                            st.rerun()
                        else:
                            st.error("Failed to send WhatsApp message.")

            elif st.session_state.get("reminder_type_radio") == "Test":
                with st.form("add_test_reminder"):
                    med_phone = st.text_input("Patient Phone*", value=st.session_state.temp_patient_phone, placeholder="919876543210")
                    test_options = [t['name'] for t in clinic.get('tests', [])]
                    test_name = st.selectbox("Test Name*", test_options)
                    
                    test_instr = ""
                    for t in clinic.get('tests', []):
                        if t['name'] == test_name:
                            test_instr = t['instructions']
                    
                    st.info(f"📋 Instructions: {test_instr}")
                    
                    t1, t2 = st.columns(2)
                    with t1:
                        test_date = st.date_input("Test Date", get_now())
                    with t2:
                        test_time = st.time_input("Test Time", value=datetime.strptime("09:00", "%H:%M").time())
                    
                    med_instructions = st.text_area("Additional Instructions", placeholder="Any additional instructions...")
                    
                    if st.form_submit_button("💾 Save & Notify Patient"):
                        if not med_phone or not test_name:
                            st.error("Phone and Test Name required!")
                        else:
                            time_str = test_time.strftime("%H:%M")
                            msg = (
                                f"🧪 *Test Reminder*\n\n"
                                f"Test: {test_name}\n"
                                f"Date: {test_date.strftime('%d-%m-%Y')}\n"
                                f"Time: {time_str}\n\n"
                                f"📋 Instructions: {test_instr}\n"
                                f"{f'📝 Note: {med_instructions}' if med_instructions else ''}\n\n"
                                f"We will remind you 1 day before and on the morning of the test."
                            )
                            
                            if send_whatsapp(clinic, med_phone, msg):
                                try:
                                    append_test(clinic, [
                                        med_phone,
                                        test_name,
                                        test_date.strftime('%d-%m-%Y'),
                                        med_instructions + (f"\n\nInstructions: {test_instr}" if test_instr else ""),
                                        "Active",
                                        get_now().strftime("%d-%m-%Y %H:%M")
                                    ])
                                    st.success("Test reminder scheduled!")
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"Sheet error: {e}")

            elif st.session_state.get("reminder_type_radio") == "Follow-up":
                with st.form("add_followup_reminder"):
                    med_phone = st.text_input("Patient Phone*", value=st.session_state.temp_patient_phone, placeholder="919876543210")
                    med_name = st.text_input("Follow-up Reason*", placeholder="Post-surgery checkup")
                    
                    f1, f2 = st.columns(2)
                    with f1:
                        med_start = st.date_input("Follow-up Date", get_now() + timedelta(days=7))
                    with f2:
                        time1 = st.time_input("Preferred Time", value=datetime.strptime("10:00", "%H:%M").time())
                    
                    med_instructions = st.text_area("Instructions", placeholder="Any specific instructions...")
                    
                    if st.form_submit_button("💾 Save & Notify Patient"):
                        if not med_phone or not med_name:
                            st.error("Phone and Reason required!")
                        else:
                            time1_str = time1.strftime("%H:%M")
                            msg = (
                                f"🔄 *Follow-up Reminder*\n\n"
                                f"Reason: {med_name}\n"
                                f"Date: {med_start.strftime('%d-%m-%Y')}\n"
                                f"Time: {time1_str}\n\n"
                                f"{f'Instructions: {med_instructions}' if med_instructions else ''}"
                            )
                            
                            if send_whatsapp(clinic, med_phone, msg):
                                try:
                                    append_followup(clinic, [
                                        med_phone,
                                        med_name,
                                        med_start.strftime('%d-%m-%Y'),
                                        med_instructions,
                                        "Pending",
                                        get_now().strftime("%d-%m-%Y %H:%M")
                                    ])
                                    st.success("Follow-up reminder set!")
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"Sheet error: {e}")
        
        st.divider()
        
        st.subheader("📅 Today's Medicine Schedule")
        active_meds = medicines[medicines['Status'] == 'Active'] if 'Status' in medicines.columns else pd.DataFrame()
        if not active_meds.empty:
            # Filter for today
            today_str = get_now().strftime("%d-%m-%Y")
            # Only show if today is between start and end date
            def is_today_active(row):
                try:
                    start = datetime.strptime(row['Start Date'], "%d-%m-%Y").date()
                    end = datetime.strptime(row['End Date'], "%d-%m-%Y").date()
                    return start <= get_now().date() <= end
                except: return False
            
            active_today = active_meds[active_meds.apply(is_today_active, axis=1)]
            
            if not active_today.empty:
                st.info(f"💊 {len(active_today)} patients have medicine reminders for today")
                for idx, row in active_today.head(10).iterrows():
                    with st.container(border=True):
                        c1, c2, c3 = st.columns([2, 2, 1])
                        c1.markdown(f"**{row.get('Phone', 'N/A')}**")
                        times = [row.get('Time 1'), row.get('Time 2'), row.get('Time 3')]
                        times_str = ", ".join([t for t in times if t])
                        c2.caption(f"{row.get('Medicine', '')} ({times_str})")
                        if c3.button(f"Remind", key=f"med_rem_today_{idx}"):
                            msg = f"💊 Reminder: Time to take {row.get('Medicine', '')} ({row.get('Dosage', '')})"
                            if send_whatsapp(clinic, row.get('Phone', ''), msg):
                                st.success("Sent!")
                            else:
                                st.error("Failed")
            else:
                st.info("No medicine reminders due for today.")
        else:
            st.info("No active medicine reminders")
    
    elif selected_tab == "⚙️ Settings":
        st.subheader("⚙️ Clinic Settings")
        
        with st.form("update_clinic"):
            st.markdown("#### Clinic Information")
            c_name = st.text_input("Clinic Name", clinic.get("name", ""))
            c_phone = st.text_input("Phone", clinic.get("phone", ""))
            c_address = st.text_input("Address", clinic.get("address", ""))
            c_calendar_id = st.text_input("Google Calendar ID", clinic.get("google_calendar_id", ""))
            c_staff_numbers = st.text_input(
                "Staff WhatsApp Numbers (comma separated)",
                ",".join(clinic.get("staff_numbers", []))
            )
            
            if st.form_submit_button("💾 Save Changes"):
                update_clinic(clinic["id"], {
                    "name": c_name,
                    "phone": c_phone,
                    "address": c_address,
                    "google_calendar_id": c_calendar_id,
                    "staff_numbers": [p.strip() for p in c_staff_numbers.split(",") if p.strip()],
                })
                st.success("Clinic updated!")
                st.rerun()
        
        st.divider()
        
        st.markdown("#### 🔧 WhatsApp Configuration")
        st.text_input("Phone Number ID", clinic.get("phone_number_id", ""), disabled=True)
        st.text_input("WhatsApp Token Env Var", clinic.get("whatsapp_token_env", ""), disabled=True)
        
        st.divider()
        
        st.markdown("#### 🩺 Doctors Management")
        
        doctors = clinic.get("doctors", [])
        
        # Generate full time list for selectboxes
        TIME_OPTIONS = []
        for h in range(24):
            for m in [0, 30]:
                dt = datetime.strptime(f"{h:02d}:{m:02d}", "%H:%M")
                TIME_OPTIONS.append(dt.strftime("%I:%M %p"))

        if doctors:
            for i, doctor in enumerate(doctors):
                with st.expander(f"Dr. {doctor['name']} - {doctor['specialty']}"):
                    col_d1, col_d2 = st.columns([3, 1])
                    
                    with col_d1:
                        st.write(f"**Specialty:** {doctor['specialty']}")
                        st.write(f"**Calendar ID:** `{doctor.get('google_calendar_id', 'Not Set')}`")
                        st.write(f"**Slots:** {', '.join(doctor.get('slots', []))}")
                        if "availability" in doctor:
                            avail = doctor["availability"]
                            st.write(f"**Mode:** {avail.get('mode')}")
                            if avail.get('mode') == "Scheduled Range":
                                st.write(f"**Days:** {', '.join(avail.get('days', []))}")
                                for s_idx, session in enumerate(avail.get('sessions', [])):
                                    st.write(f"**Session {s_idx+1}:** {session.get('start')} - {session.get('end')} ({session.get('interval')}m)")
                    
                    with col_d2:
                        if st.button("✏️ Edit", key=f"edit_doctor_{i}"):
                            st.session_state[f"editing_doctor_{i}"] = True
                        
                        if st.button("🗑️ Remove", key=f"del_doctor_{i}"):
                            new_doctors = [d for j, d in enumerate(doctors) if j != i]
                            update_clinic(clinic["id"], {"doctors": new_doctors})
                            st.success("Doctor removed!")
                            st.rerun()
                    
                    if st.session_state.get(f"editing_doctor_{i}"):
                        with st.form(f"edit_doctor_form_{i}"):
                            e_name = st.text_input("Name", doctor["name"])
                            e_spec = st.text_input("Specialty", doctor["specialty"])
                            e_cal_id = st.text_input("Doctor's Google Calendar ID", doctor.get("google_calendar_id", ""))
                            e_mode = st.radio("Mode", ["Manual Slots", "Scheduled Range"], 
                                             index=0 if doctor.get("availability", {}).get("mode") == "Manual Slots" else 1)
                            
                            e_slots = []
                            e_avail_data = {"mode": e_mode}

                            if e_mode == "Manual Slots":
                                e_slots = st.multiselect("Slots", 
                                    TIME_OPTIONS,
                                    default=[s for s in doctor.get("slots", []) if s in TIME_OPTIONS])
                            else:
                                e_days = st.multiselect("Days", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                                                       default=doctor.get("availability", {}).get("days", ["Mon", "Tue", "Wed", "Thu", "Fri"]))
                                
                                num_sessions = st.number_input("Number of Sessions", 1, 5, value=len(doctor.get("availability", {}).get("sessions", [1])))
                                e_sessions = []
                                for s_i in range(num_sessions):
                                    st.markdown(f"**Session {s_i+1}**")
                                    prev_sess = doctor.get("availability", {}).get("sessions", [{}])[s_i] if s_i < len(doctor.get("availability", {}).get("sessions", [])) else {}
                                    
                                    sc1, sc2, sc3 = st.columns(3)
                                    with sc1:
                                        s_start = st.selectbox(f"Start {s_i+1}", TIME_OPTIONS, 
                                                              index=TIME_OPTIONS.index(prev_sess.get("start", "09:00 AM")) if prev_sess.get("start") in TIME_OPTIONS else 18)
                                    with sc2:
                                        s_end = st.selectbox(f"End {s_i+1}", TIME_OPTIONS, 
                                                            index=TIME_OPTIONS.index(prev_sess.get("end", "01:00 PM")) if prev_sess.get("end") in TIME_OPTIONS else 26)
                                    with sc3:
                                        s_int = st.selectbox(f"Interval {s_i+1}", [15, 20, 30, 45, 60], 
                                                            index=[15, 20, 30, 45, 60].index(prev_sess.get("interval", 30)))
                                    
                                    e_sessions.append({"start": s_start, "end": s_end, "interval": s_int})
                                
                                # Generate combined slots
                                def gen_slots_multi(sessions):
                                    fmt = "%I:%M %p"
                                    res = []
                                    for sess in sessions:
                                        curr = datetime.strptime(sess["start"], fmt)
                                        end_dt = datetime.strptime(sess["end"], fmt)
                                        while curr < end_dt:
                                            res.append(curr.strftime(fmt))
                                            curr += timedelta(minutes=sess["interval"])
                                    return sorted(list(set(res)), key=lambda x: datetime.strptime(x, fmt))
                                
                                e_slots = gen_slots_multi(e_sessions)
                                e_avail_data["days"] = e_days
                                e_avail_data["sessions"] = e_sessions
                            
                            if st.form_submit_button("Update Doctor"):
                                doctors[i] = {
                                    "id": doctor["id"],
                                    "name": e_name,
                                    "specialty": e_spec,
                                    "google_calendar_id": e_cal_id,
                                    "slots": e_slots,
                                    "availability": e_avail_data
                                }
                                update_clinic(clinic["id"], {"doctors": doctors})
                                sync_doctor_sessions(clinic, doctors[i])
                                st.session_state[f"editing_doctor_{i}"] = False
                                st.success("Doctor updated and availability synced to Calendar!")
                                st.rerun()
                        
                        if st.button("Cancel Edit", key=f"cancel_edit_{i}"):
                            st.session_state[f"editing_doctor_{i}"] = False
                            st.rerun()
        
        st.markdown("##### ➕ Add New Doctor")
        
        with st.form("add_doctor"):
            d_name = st.text_input("Doctor Name*")
            d_specialty = st.text_input("Specialty*")
            d_cal_id = st.text_input("Doctor's Google Calendar ID")
            
            avail_mode = st.radio("Availability Mode", ["Manual Slots", "Scheduled Range"], horizontal=True)
            
            d_slots = []
            avail_data = {"mode": avail_mode}

            if avail_mode == "Manual Slots":
                d_slots = st.multiselect(
                    "Available Time Slots*",
                    TIME_OPTIONS,
                    key="new_doc_slots"
                )
            else:
                d_days = st.multiselect("Select Days", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], default=["Mon", "Tue", "Wed", "Thu", "Fri"])
                
                num_sessions = st.number_input("Number of Sessions", 1, 5, value=1)
                d_sessions = []
                for s_i in range(int(num_sessions)):
                    st.markdown(f"**Session {s_i+1}**")
                    sc1, sc2, sc3 = st.columns(3)
                    with sc1:
                        s_start = st.selectbox(f"Start {s_i+1}", TIME_OPTIONS, index=18) # 09:00 AM
                    with sc2:
                        s_end = st.selectbox(f"End {s_i+1}", TIME_OPTIONS, index=26) # 01:00 PM
                    with sc3:
                        s_int = st.selectbox(f"Interval {s_i+1}", [15, 20, 30, 45, 60], index=2) # 30 mins
                    d_sessions.append({"start": s_start, "end": s_end, "interval": s_int})
                
                # Logic to generate slots
                def generate_slots_multi(sessions):
                    fmt = "%I:%M %p"
                    res = []
                    for sess in sessions:
                        start = datetime.strptime(sess["start"], fmt)
                        end = datetime.strptime(sess["end"], fmt)
                        current = start
                        while current < end:
                            res.append(current.strftime(fmt))
                            current += timedelta(minutes=sess["interval"])
                    return sorted(list(set(res)), key=lambda x: datetime.strptime(x, fmt))
                
                d_slots = generate_slots_multi(d_sessions)
                avail_data["days"] = d_days
                avail_data["sessions"] = d_sessions
                st.info(f"Generated {len(d_slots)} total slots.")
            
            if st.form_submit_button("➕ Add Doctor"):
                if not d_name or not d_specialty or not d_slots:
                    st.error("Please fill all fields!")
                else:
                    new_doctor = {
                        "id": f"d{len(doctors)+1}",
                        "name": d_name,
                        "specialty": d_specialty,
                        "google_calendar_id": d_cal_id,
                        "slots": d_slots,
                        "availability": avail_data
                    }
                    updated_doctors = doctors + [new_doctor]
                    update_clinic(clinic["id"], {"doctors": updated_doctors})
                    sync_doctor_sessions(clinic, new_doctor)
                    st.success(f"Doctor {d_name} added and availability synced!")
                    st.rerun()
        
        st.divider()
        
        st.markdown("#### 🧪 Tests & Instructions")
        
        tests = clinic.get("tests", [])
        
        if tests:
            for i, test in enumerate(tests):
                with st.expander(f"🧪 {test['name']}"):
                    st.write(f"**Instructions:** {test['instructions']}")
                    if st.button("🗑️ Remove", key=f"del_test_{i}"):
                        new_tests = [t for j, t in enumerate(tests) if j != i]
                        update_clinic(clinic["id"], {"tests": new_tests})
                        st.success("Test removed!")
                        st.rerun()
        
        st.markdown("##### ➕ Add New Test")
        
        with st.form("add_test"):
            t_name = st.text_input("Test Name*")
            t_instructions = st.text_area("Instructions*")
            
            if st.form_submit_button("➕ Add Test"):
                if not t_name or not t_instructions:
                    st.error("Please fill all fields!")
                else:
                    new_test = {
                        "id": f"t{len(tests)+1}",
                        "name": t_name,
                        "instructions": t_instructions
                    }
                    updated_tests = tests + [new_test]
                    update_clinic(clinic["id"], {"tests": updated_tests})
                    st.success(f"Test {t_name} added!")
                    st.rerun()

# ========== MAIN APP - LOGIN CHECK ==========
_restore_login_from_query_params()

if not st.session_state.get("logged_in"):
    show_login()
else:
    # Show sidebar with user info and logout
    with st.sidebar:
        st.markdown("### 👤 Logged in")
        st.write(f"**Email:** {st.session_state['user_email']}")
        if st.session_state.get("clinic_name"):
            st.write(f"**Clinic:** {st.session_state['clinic_name']}")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("🔑 Password", use_container_width=True):
                st.query_params["page"] = "password"
                st.rerun()
        with col2:
            if st.button("🚪 Logout", use_container_width=True):
                logout()
        
        st.divider()
    
    # Check if user wants to change password
    if st.query_params.get("page") == "password":
        show_change_password()
    # If admin, show admin panel
    elif st.session_state["user_role"] == "admin":
        show_admin_panel()
    # If clinic, show clinic dashboard
    elif st.session_state["user_role"] == "clinic" and st.session_state.get("clinic_id"):
        clinic = get_clinic(st.session_state["clinic_id"])
        if not clinic:
            st.error("Clinic not found. Contact admin.")
        else:
            bookings, medicines, tests, followups = load_clinic_data(clinic, False)
            show_clinic_dashboard(clinic, bookings, medicines, tests, followups)
    else:
        st.error("Access denied. Contact admin.")

st.markdown("---")
st.caption("🏥 Clinic Bot")
