import logging
import os
import sys
from datetime import datetime
from functools import wraps

from flask import Flask, jsonify, request
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler

from routes.webhook import webhook_bp
from scheduler import send_medicine_reminders, send_test_reminders, send_appointment_reminders, send_followup_reminders
from config import get_now


load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401
            
        token = auth_header.split(" ")[1]
        try:
            from services.database import get_db
            db = get_db()
            if not db:
                return jsonify({"error": "Supabase client not initialized"}), 500
                
            user = db.auth.get_user(token)
            if not user or not user.user:
                return jsonify({"error": "Unauthorized"}), 401
                
            email = user.user.email
            super_admin_email = os.getenv("SUPER_ADMIN_EMAIL", "admin@clinicpro.com")
            
            user_id = user.user.id
            profile = db.table("profiles").select("role").eq("id", user_id).limit(1).execute()
            if not profile or not profile.data or len(profile.data) == 0 or profile.data[0].get("role") != "admin" or email != super_admin_email:
                return jsonify({"error": "Forbidden"}), 403
                
        except Exception as e:
            return jsonify({"error": f"Unauthorized: {str(e)}"}), 401
            
        return f(*args, **kwargs)
    return decorated


def run_scheduled_tasks():
    """Wrapper to run all scheduled tasks"""
    now = get_now()
    logging.info(f"⏰ Running scheduled tasks pulse... (IST: {now.strftime('%H:%M')})")
    try:
        logging.info("Checking medicine reminders...")
        send_medicine_reminders()
        
        logging.info("Checking test reminders...")
        send_test_reminders()

        logging.info("Checking follow-up reminders...")
        send_followup_reminders()
        
        # Appointment reminders run once a day at 18:00 (6 PM) IST
        if now.hour == 18:
            logging.info("Checking appointment reminders...")
            send_appointment_reminders()
    except Exception as e:
        import traceback
        logging.error(f"Error in scheduled tasks: {e}\n{traceback.format_exc()}")


def create_app():
    flask_app = Flask(__name__)
    try:
        from flask_cors import CORS
        CORS(flask_app)
    except ImportError:
        pass
    flask_app.register_blueprint(webhook_bp)

    @flask_app.get("/")
    def health():
        return jsonify({"status": "ok", "service": "clinic-bot"})

    # Platform Admin Endpoints
    @flask_app.get("/api/admin/stats")
    @admin_required
    def admin_stats():
        from config import get_clinic_stats
        try:
            stats = get_clinic_stats()
            return jsonify({"status": "success", "stats": stats})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @flask_app.get("/api/admin/clinics")
    @admin_required
    def admin_clinics():
        from config import get_all_clinics
        try:
            clinics = get_all_clinics()
            return jsonify({"status": "success", "clinics": clinics})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @flask_app.post("/api/admin/create-clinic")
    @admin_required
    def admin_create_clinic():
        from config import add_clinic
        from services.database import admin_create_clinic_user
        try:
            data = request.json
            if not data:
                return jsonify({"error": "Missing payload"}), 400
                
            c_name = data.get("name")
            c_phone = data.get("phone")
            c_address = data.get("address", "")
            c_phone_id = data.get("phone_number_id")
            c_status = data.get("subscription_status", "active")
            c_fee = data.get("monthly_fee", 1500)
            c_tier = data.get("tier", "Essential")
            c_expiry = data.get("expiry_date")
            c_doctors = data.get("doctors", [])
            c_token_env = data.get("whatsapp_token_env", f"WHATSAPP_TOKEN_{c_phone_id}")
            
            email = data.get("email")
            password = data.get("password")
            
            if not c_name or not c_phone or not c_phone_id or not email or not password:
                return jsonify({"error": "Missing required fields"}), 400
                
            new_clinic = {
                "name": c_name,
                "phone": c_phone,
                "address": c_address,
                "whatsapp_token_env": c_token_env,
                "phone_number_id": c_phone_id,
                "webhook_verify_token": f"clinic_bot_{datetime.now().strftime('%Y%m%d')}",
                "subscription_status": c_status,
                "monthly_fee": c_fee,
                "tier": c_tier,
                "created_date": datetime.now().strftime("%Y-%m-%d"),
                "expiry_date": c_expiry or f"{datetime.now().year}-12-31",
                "doctors": c_doctors,
                "sheet_name": f"{c_name.lower().replace(' ', '_')}_bookings",
                "medicines_sheet": f"{c_name.lower().replace(' ', '_')}_medicines"
            }
            
            clinic_id = add_clinic(new_clinic)
            admin_create_clinic_user(email, password, clinic_id, c_name)
            
            return jsonify({"status": "success", "clinic_id": clinic_id})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @flask_app.post("/api/admin/update-clinic")
    @admin_required
    def admin_update_clinic():
        from config import update_clinic
        try:
            data = request.json
            if not data or "phone_number_id" not in data:
                return jsonify({"error": "Missing phone_number_id"}), 400
                
            phone_id = data["phone_number_id"]
            updates = data.get("updates", {})
            
            success = update_clinic(phone_id, updates)
            if success:
                return jsonify({"status": "success"})
            return jsonify({"error": "Clinic not found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @flask_app.post("/api/admin/delete-clinic")
    @admin_required
    def admin_delete_clinic_route():
        from config import delete_clinic
        try:
            data = request.json
            if not data or "phone_number_id" not in data:
                return jsonify({"error": "Missing phone_number_id"}), 400
                
            phone_id = data["phone_number_id"]
            success = delete_clinic(phone_id)
            if success:
                try:
                    from services.database import get_db
                    db = get_db()
                    if db:
                        db.table("clinics").delete().eq("id", phone_id).execute()
                except Exception as db_err:
                    logging.error(f"Failed to delete clinic from Supabase clinics table: {db_err}")
                return jsonify({"status": "success"})
            return jsonify({"error": "Clinic not found"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500


    # Initialize Scheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=run_scheduled_tasks, trigger="interval", minutes=1)
    scheduler.start()
    logging.info("🚀 Background Scheduler Started")

    return flask_app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=False)
