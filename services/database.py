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
