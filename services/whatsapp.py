import os
import logging

import requests


GRAPH_API_VERSION = os.getenv("WHATSAPP_GRAPH_API_VERSION", "v18.0")
logger = logging.getLogger(__name__)


def _token_env_name(phone_number_id):
    safe_id = "".join(ch if ch.isalnum() else "_" for ch in str(phone_number_id))
    return f"WHATSAPP_TOKEN_{safe_id}"


def get_access_token(clinic):
    phone_number_id = clinic.get("phone_number_id") or clinic.get("id")
    token_env = clinic.get("whatsapp_token_env") or _token_env_name(phone_number_id)
    return os.getenv(token_env)


def _messages_url(clinic):
    phone_number_id = clinic.get("phone_number_id") or clinic.get("id")
    return f"https://graph.facebook.com/{GRAPH_API_VERSION}/{phone_number_id}/messages"


def clean_phone_number(phone):
    """Clean phone number to digits only, ensuring it has a country code (default 91)"""
    if not phone:
        return ""
    # Remove all non-digits
    digits = "".join(filter(str.isdigit, str(phone)))
    # If it starts with 0, remove it
    if digits.startswith("0"):
        digits = digits[1:]
    # If it's 10 digits, assume India (+91)
    if len(digits) == 10:
        digits = "91" + digits
    return digits


def send_message(clinic, payload):
    token = get_access_token(clinic)
    if not token:
        raise RuntimeError("Missing WhatsApp access token")

    phone_number_id = clinic.get("phone_number_id") or clinic.get("id")
    # Clean the 'to' number
    if "to" in payload:
        payload["to"] = clean_phone_number(payload["to"])
        
    to_phone = payload.get("to", "")
    message_type = payload.get("type", "")
    logger.info("Sending WhatsApp message type=%s from phone_number_id=%s to=%s", message_type, phone_number_id, to_phone)

    response = requests.post(
        _messages_url(clinic),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=15,
    )
    if not response.ok:
        logger.warning(
            "WhatsApp send failed status=%s phone_number_id=%s response=%s",
            response.status_code,
            phone_number_id,
            response.text[:500],
        )
    response.raise_for_status()
    logger.info("WhatsApp send succeeded status=%s phone_number_id=%s", response.status_code, phone_number_id)
    return response.json() if response.content else {}


def send_text(clinic, to_phone, body):
    return send_message(
        clinic,
        {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "text",
            "text": {"body": body},
        },
    )


def send_buttons(clinic, to_phone, body, buttons):
    return send_message(
        clinic,
        {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body},
                "action": {
                    "buttons": [
                        {"type": "reply", "reply": {"id": button["id"], "title": button["title"][:20]}}
                        for button in buttons[:3]
                    ]
                },
            },
        },
    )


def send_list(clinic, to_phone, body, sections):
    return send_message(
        clinic,
        {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "interactive",
            "interactive": {
                "type": "list",
                "body": {"text": body},
                "action": {
                    "button": "Select",
                    "sections": sections,
                },
            },
        },
    )
