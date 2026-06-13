import os
import re
from flask import Blueprint, current_app, request, jsonify

from config import get_clinic_by_phone_id, load_config
from services.booking_logic import handle_message


webhook_bp = Blueprint("webhook", __name__)


def _valid_verify_token(token):
    expected = os.getenv("VERIFY_TOKEN")
    if expected and token == expected:
        return True

    return any(token == clinic.get("webhook_verify_token") for clinic in load_config().values())


@webhook_bp.route("/webhook/notify-next", methods=["POST"])
def notify_next():
    """Endpoint triggered by Supabase trigger to notify the next patient."""
    data = request.get_json(silent=True) or {}
    phone = data.get("phone")
    patient_name = data.get("patient_name")
    doctor_id = data.get("doctor_id")
    token = data.get("token")
    clinic_id = data.get("clinic_id")

    if not all([phone, patient_name, doctor_id, clinic_id]):
        return jsonify({"error": "Missing parameters"}), 400

    clinic = get_clinic_by_phone_id(clinic_id)
    if not clinic:
        return jsonify({"error": "Clinic not found"}), 404

    # Fetch doctor name if doctor_id is a UUID
    doctor_display_name = doctor_id
    try:
        from services.database import get_db
        db = get_db()
        if db:
            # Check if doctor_id is a UUID (roughly)
            if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', str(doctor_id).lower()):
                res = db.table("doctors").select("name").eq("id", doctor_id).execute()
                if res.data:
                    doctor_display_name = res.data[0].get("name", doctor_id)
    except Exception as e:
        current_app.logger.error(f"Error fetching doctor name for notification: {e}")

    # Format token nicely: [Prefix]-[000]
    clean_name = re.sub(r'^Dr\.?\s+', '', doctor_display_name, flags=re.IGNORECASE).strip()
    name_parts = clean_name.split()
    if len(name_parts) >= 2:
        prefix = (name_parts[0][0] + name_parts[-1][0]).upper()
    elif len(name_parts) == 1:
        prefix = name_parts[0][:2].upper()
    else:
        prefix = "TK"
    
    formatted_token = f"{prefix}-{int(token):03d}" if str(token).isdigit() else token

    message = (
        f"🔔 *Queue Update*\n\n"
        f"Hi {patient_name}, {doctor_display_name} is ready.\n"
        f"You are *next* in queue (Token: {formatted_token}).\n\n"
        f"Please be ready and proceed to the consultation room soon!"
    )

    try:
        from services.whatsapp import send_text
        send_text(clinic, phone, message)
        return jsonify({"status": "sent"}), 200
    except Exception as e:
        current_app.logger.error(f"Failed to send next-patient notification: {e}")
        return jsonify({"error": str(e)}), 500


@webhook_bp.route("/webhook/confirm-walkin", methods=["POST"])
def confirm_walkin():
    """Endpoint triggered by Supabase trigger to confirm walk-in bookings."""
    data = request.get_json(silent=True) or {}
    phone = data.get("phone")
    patient_name = data.get("patient_name")
    doctor_id = data.get("doctor_id")
    token = data.get("token")
    clinic_id = data.get("clinic_id")

    if not all([phone, patient_name, doctor_id, clinic_id]) or phone == 'walk-in':
        return jsonify({"status": "skipped"}), 200

    clinic = get_clinic_by_phone_id(clinic_id)
    if not clinic:
        return jsonify({"error": "Clinic not found"}), 404

    # Format token
    clean_name = re.sub(r'^Dr\.?\s+', '', doctor_id, flags=re.IGNORECASE).strip()
    name_parts = clean_name.split()
    prefix = (name_parts[0][0] + name_parts[-1][0]).upper() if len(name_parts) >= 2 else doctor_id[:2].upper()
    formatted_token = f"{prefix}-{int(token):03d}" if str(token).isdigit() else token

    message = (
        f"✅ *Booking Confirmed!*\n\n"
        f"Hi {patient_name}, your walk-in appointment has been added to the queue.\n\n"
        f"👨‍⚕️ *Doctor:* {doctor_id}\n"
        f"🎫 *Token:* {formatted_token}\n\n"
        f"You can track your live queue status by replying *status* anytime."
    )

    try:
        from services.whatsapp import send_text
        send_text(clinic, phone, message)
        return jsonify({"status": "sent"}), 200
    except Exception as e:
        current_app.logger.error(f"Failed to send walk-in confirmation: {e}")
        return jsonify({"error": str(e)}), 500


@webhook_bp.route("/webhook/manual-remind", methods=["POST", "OPTIONS"])
def manual_remind():
    data = request.get_json(silent=True) or {}
    phone = data.get("phone")
    message = data.get("message")
    clinic_id = data.get("clinic_id")

    if not all([phone, message, clinic_id]):
        return jsonify({"error": "Missing parameters"}), 400

    clinic = get_clinic_by_phone_id(clinic_id)
    if not clinic:
        return jsonify({"error": "Clinic not found"}), 404

    try:
        from services.whatsapp import send_text
        send_text(clinic, phone, message)
        return jsonify({"status": "sent"}), 200
    except Exception as e:
        current_app.logger.error(f"Failed to send manual reminder: {e}")
        return jsonify({"error": str(e)}), 500


@webhook_bp.route("/webhook", methods=["GET"])
def verify_webhook():
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    if mode == "subscribe" and token and _valid_verify_token(token):
        current_app.logger.info("Webhook verification succeeded")
        return challenge or "", 200
    current_app.logger.warning("Webhook verification failed")
    return "Invalid token", 403


@webhook_bp.route("/webhook", methods=["POST"])
def receive_webhook():
    payload = request.get_json(silent=True) or {}
    entries = payload.get("entry", [])
    current_app.logger.info("Webhook POST received with %s entries", len(entries))

    for entry in entries:
        for change in entry.get("changes", []):
            value = change.get("value", {})
            phone_number_id = value.get("metadata", {}).get("phone_number_id")
            if not phone_number_id:
                current_app.logger.info("Webhook change skipped because metadata.phone_number_id is missing")
                continue

            clinic = get_clinic_by_phone_id(phone_number_id)
            if not clinic:
                current_app.logger.warning("Clinic not found for phone_number_id=%s", phone_number_id)
                continue

            messages = value.get("messages", [])
            current_app.logger.info(
                "Routing %s messages for clinic=%s phone_number_id=%s",
                len(messages),
                clinic.get("name"),
                phone_number_id,
            )
            for message in messages:
                try:
                    handle_message(clinic, message)
                except Exception as exc:
                    current_app.logger.exception("Webhook handling failed for clinic %s: %s", phone_number_id, exc)

    return "OK", 200
