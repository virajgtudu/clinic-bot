import os
import logging
from supabase import create_client, Client

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

_supabase: Client = None

def get_db():
    global _supabase
    if _supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.warning("SUPABASE_URL or SUPABASE_KEY missing in environment variables.")
            return None
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase

def create_appointment(data):
    """
    Call the Postgres function 'create_appointment' to handle atomic token generation and patient matching.
    data = {
        "clinic_id": str,
        "doctor_id": str,
        "name": str,
        "phone": str,
        "age": int,
        "booking_date": "YYYY-MM-DD",
        "time": str,
        "source": "whatsapp" | "walkin" | "call"
    }
    Returns: { "appointment_id": uuid, "token": int, "patient_id": "PID-XXXX" }
    """
    db = get_db()
    if not db:
        return None

    try:
        response = db.rpc("create_appointment", {
            "p_clinic_id": data["clinic_id"],
            "p_doctor_id": data["doctor_id"],
            "p_name": data["name"],
            "p_phone": data["phone"],
            "p_age": int(data.get("age", 0)),
            "p_date": data["booking_date"],
            "p_time": data["time"],
            "p_source": data["source"]
        }).execute()
        return response.data
    except Exception as e:
        logger.error(f"Supabase RPC error: {e}")
        return None
def get_queue_status(clinic_id, doctor_id, date):
    """Get all appointments for a doctor on a specific date, ordered by token."""
    db = get_db()
    if not db:
        return []
        
    try:
        response = db.table("appointments") \
            .select("*") \
            .eq("clinic_id", clinic_id) \
            .eq("doctor_id", doctor_id) \
            .eq("booking_date", date) \
            .order("token") \
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"Supabase query error: {e}")
        return []

def update_appointment_status(appointment_id, status):
    """Update appointment status (Pending, Serving, Completed, Cancelled)."""
    db = get_db()
    if not db:
        return False
        
    try:
        db.table("appointments") \
            .update({"status": status}) \
            .eq("id", appointment_id) \
            .execute()
        return True
    except Exception as e:
        logger.error(f"Supabase update error: {e}")
        return False

def get_doctors(clinic_id):
    """Fetch all doctors for a specific clinic from the doctors table."""
    db = get_db()
    if not db:
        return []
    try:
        response = db.table("doctors") \
            .select("*") \
            .eq("clinic_id", clinic_id) \
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"Supabase fetch doctors error: {e}")
        return []

def get_all_clinics():
    """Fetch all clinics from the clinics table in Supabase and merge with local config."""
    from config import load_config
    db = get_db()
    if not db:
        return []
    try:
        local_config = load_config()
        response = db.table("clinics").select("*").execute()
        
        clinics = []
        for c in response.data:
            clinic_id = str(c.get("id") or "")
            if not clinic_id:
                logger.warning(f"Found clinic with missing ID in Supabase: {c}")
                continue
                
            # Create a base item from Supabase data
            item = dict(c)
            item["phone_number_id"] = clinic_id
            item["id"] = clinic_id
            
            # Merge with local config if available
            if clinic_id in local_config:
                for key, val in local_config[clinic_id].items():
                    item.setdefault(key, val)
            
            clinics.append(item)
        return clinics
    except Exception as e:
        logger.error(f"Supabase fetch all clinics error: {e}")
        return []

# --- Reminders Module ---

def create_reminder(data):
    """Create a new medication, test, or follow-up reminder."""
    db = get_db()
    if not db:
        return None
    try:
        response = db.table("reminders").insert(data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        logger.error(f"Supabase create reminder error: {e}")
        return None

def get_active_reminders(clinic_id, reminder_type=None):
    """Fetch all active reminders for a clinic, optionally filtered by type."""
    db = get_db()
    if not db:
        return []
    try:
        query = db.table("reminders") \
            .select("*") \
            .eq("clinic_id", clinic_id) \
            .eq("status", "Active")
        
        if reminder_type:
            query = query.eq("type", reminder_type)
            
        response = query.order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        logger.error(f"Supabase fetch active reminders error: {e}")
        return []

def update_reminder_status(reminder_id, status):
    """Update reminder status (Active, Cancelled, Completed)."""
    db = get_db()
    if not db:
        return False
    try:
        db.table("reminders").update({"status": status}).eq("id", reminder_id).execute()
        return True
    except Exception as e:
        logger.error(f"Supabase update reminder status error: {e}")
        return False

def log_reminder_compliance(reminder_id, status, clinic_id):
    """Log if a patient took or skipped a medication dose."""
    db = get_db()
    if not db:
        return False
    try:
        db.table("reminder_logs").insert({
            "reminder_id": reminder_id,
            "status": status,
            "clinic_id": clinic_id
        }).execute()
        return True
    except Exception as e:
        logger.error(f"Supabase log compliance error: {e}")
        return False

def log_compliance_by_phone(phone, status, clinic_id):
    """Log compliance for the most recent active reminder for a phone number."""
    db = get_db()
    if not db:
        return False
    try:
        # Find latest active medication reminder for this phone
        res = db.table("reminders") \
            .select("id") \
            .eq("patient_phone", phone) \
            .eq("clinic_id", clinic_id) \
            .eq("type", "medication") \
            .eq("status", "Active") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
            
        if res.data:
            return log_reminder_compliance(res.data[0]["id"], status, clinic_id)
        return False
    except Exception as e:
        logger.error(f"Supabase log compliance by phone error: {e}")
        return False

def get_reminder_analytics(clinic_id):
    """Fetch analytics data for the reminders module."""
    db = get_db()
    if not db:
        return {}
    try:
        # 1. Total active by type
        active_res = db.table("reminders") \
            .select("type, status") \
            .eq("clinic_id", clinic_id) \
            .eq("status", "Active") \
            .execute()
        
        counts = {"medication": 0, "test": 0, "follow_up": 0}
        for r in active_res.data:
            counts[r["type"]] += 1
            
        # 2. Compliance rate (last 7 days)
        # In a real app, this might be a more complex query or multiple RPC calls
        log_res = db.table("reminder_logs") \
            .select("status") \
            .eq("clinic_id", clinic_id) \
            .execute()
            
        taken = sum(1 for l in log_res.data if l["status"] == "Taken")
        total_logs = len(log_res.data)
        compliance_rate = (taken / total_logs * 100) if total_logs > 0 else 100
        
        return {
            "active_counts": counts,
            "compliance_rate": round(compliance_rate, 1),
            "total_active": len(active_res.data)
        }
    except Exception as e:
        logger.error(f"Supabase reminder analytics error: {e}")
        return {}

def admin_create_clinic_user(email, password, clinic_id, full_name):
    """
    Admin-only helper to securely create a clinic user login in Supabase Auth
    and link their profile. Bypasses RLS since it uses service_role key.
    """
    db = get_db()
    if not db:
        return None
    try:
        # 1. Create Auth User
        user_res = db.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": full_name
            }
        })
        if not user_res or not user_res.user:
            return None
            
        user_id = user_res.user.id
        
        # 2. Insert/Update Profile record linked to the clinic
        db.table("profiles").upsert({
            "id": user_id,
            "clinic_id": clinic_id,
            "role": "clinic",
            "full_name": full_name
        }).execute()
        
        return user_id
    except Exception as e:
        logger.error(f"Failed to securely create clinic user: {e}")
        return None
