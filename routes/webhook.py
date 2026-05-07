import os

from flask import Blueprint, current_app, request

from config import get_clinic_by_phone_id, load_config
from services.booking_logic import handle_message


webhook_bp = Blueprint("webhook", __name__)


def _valid_verify_token(token):
    expected = os.getenv("VERIFY_TOKEN")
    if expected and token == expected:
        return True

    return any(token == clinic.get("webhook_verify_token") for clinic in load_config().values())


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
