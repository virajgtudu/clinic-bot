import streamlit as st
import pandas as pd
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from config import get_all_clinics, get_clinic, get_clinic_stats, add_clinic, update_clinic, delete_clinic
from services.sheets import open_sheet

st.set_page_config(
    page_title="Clinic Bot - Admin Panel",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded"
)

IS_LOCAL = os.path.exists("credentials.json")

def get_sheet_local(sheet_name):
    return open_sheet(sheet_name=sheet_name)

def load_all_bookings():
    all_bookings = []
    clinics = get_all_clinics()
    
    for clinic in clinics:
        try:
            if IS_LOCAL:
                sheet = get_sheet_local(clinic["sheet_name"])
                records = sheet.get_all_records()
                df = pd.DataFrame(records)
                if not df.empty and 'Date' in df.columns:
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

st.markdown("""
<style>
    .stButton > button {
        width: 100%;
    }
</style>
""", unsafe_allow_html=True)

st.title("🏥 Clinic Bot - Admin Panel")

st.sidebar.markdown("## 🔐 Admin Controls")

# Admin stats
stats = get_clinic_stats()

st.markdown("### 📊 Overview")

c1, c2, c3, c4 = st.columns(4)
c1.metric("Total Clinics", stats["total"])
c2.metric("Active", stats["active"])
c3.metric("Inactive", stats["inactive"])
c4.metric("Monthly Revenue", f"₹{stats['monthly_revenue']}")

st.divider()

# Tab structure
tab1, tab2, tab3 = st.tabs(["🏢 Clinics", "📅 All Appointments", "➕ Add New Clinic"])

with tab1:
    st.subheader("Manage Clinics")
    
    clinics = get_all_clinics()
    
    if clinics:
        for clinic in clinics:
            with st.expander(f"🏥 {clinic['name']} ({clinic.get('subscription_status', 'active').title()})"):
                col1, col2, col3 = st.columns([2, 1, 1])
                
                with col1:
                    st.write(f"**Phone:** {clinic.get('phone', 'N/A')}")
                    st.write(f"**Address:** {clinic.get('address', 'N/A')}")
                    st.write(f"**Created:** {clinic.get('created_date', 'N/A')}")
                    st.write(f"**Expiry:** {clinic.get('expiry_date', 'N/A')}")
                
                with col2:
                    st.write(f"**Monthly Fee:** ₹{clinic.get('monthly_fee', 0)}")
                    status = clinic.get('subscription_status', 'active')
                    color = "green" if status == "active" else "red"
                    st.markdown(f"**Status:** :{color}[{status.upper()}]")
                
                with col3:
                    new_status = st.selectbox(
                        "Change Status",
                        ["active", "inactive", "trial"],
                        index=["active", "inactive", "trial"].index(status),
                        key=f"status_{clinic['id']}"
                    )
                    if new_status != status:
                        update_clinic(clinic["id"], {"subscription_status": new_status})
                        st.success("Updated!")
                        st.rerun()
                    
                    if st.button("Delete", key=f"del_{clinic['id']}"):
                        delete_clinic(clinic["id"])
                        st.warning("Clinic deleted!")
                        st.rerun()
    else:
        st.info("No clinics added yet.")

with tab2:
    st.subheader("All Appointments Across Clinics")
    
    all_data = load_all_bookings()
    
    if not all_data.empty:
        # Filters
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
        c_token = st.text_input("WhatsApp Token*", type="password")
        c_phone_id = st.text_input("Phone Number ID*")
        
        st.markdown("#### Subscription")
        c_fee = st.number_input("Monthly Fee (₹)", min_value=0, value=1500)
        c_status = st.selectbox("Status", ["active", "trial", "inactive"])
        c_expiry = st.date_input("Expiry Date", datetime(2026, 12, 31))
        
        st.markdown("#### Doctors (at least one)")
        
        # Dynamic doctor inputs
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
            if not c_name or not c_phone or not c_token or not c_phone_id:
                st.error("Please fill all required fields!")
            elif not doctors:
                st.error("Please add at least one doctor!")
            else:
                new_clinic = {
                    "name": c_name,
                    "phone": c_phone,
                    "address": c_address,
                    "whatsapp_token": c_token,
                    "phone_number_id": c_phone_id,
                    "webhook_verify_token": f"clinic_bot_{datetime.now().strftime('%Y%m%d')}",
                    "subscription_status": c_status,
                    "monthly_fee": c_fee,
                    "created_date": datetime.now().strftime("%Y-%m-%d"),
                    "expiry_date": c_expiry.strftime("%Y-%m-%d"),
                    "doctors": doctors,
                    "sheet_name": f"{c_name.lower().replace(' ', '_')}_bookings",
                    "medicines_sheet": f"{c_name.lower().replace(' ', '_')}_medicines"
                }
                
                add_clinic(new_clinic)
                st.success(f"Clinic '{c_name}' added successfully!")
                st.rerun()

st.markdown("---")
st.caption("🏥 Clinic Bot Admin Panel - Manage all clinics from here")