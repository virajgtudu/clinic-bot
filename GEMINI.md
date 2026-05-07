# Clinic Bot Project

## Overview
This project is a clinic management bot that integrates WhatsApp for user interactions, Flask for webhooks, and Streamlit for a management dashboard. It uses Google Sheets as a primary database for bookings and various reminder types.

## Architecture
- **Backend:** Flask (`app.py`) handles incoming webhooks (`routes/webhook.py`).
- **Dashboard:** Streamlit (`dashboard.py`) provides a UI for clinic administrators to manage bookings, doctors, and reminders.
- **Services:**
  - `services/sheets.py`: Google Sheets integration. Uses `'` prefix for dates to force literal string storage.
  - `services/whatsapp.py`: WhatsApp messaging integration via Meta Graph API.
  - `services/booking_logic.py`: Core logic for WhatsApp flows, patient identification, and multi-session doctor availability.
  - `services/calendar.py`: Integration with Google Calendar for doctor-specific appointments and recurring availability blocks.
- **Scheduler:** `scheduler.py` handles automated delivery for Medicine and Test reminders.

## Conventions
- **Patient Identification:** Every patient is identified by a combination of **Name + Mobile Number + Age**.
- **Date Standard:** The system-wide standard for dates is **`DD-MM-YYYY`**.
- **Google Sheets Database:**
  - `[clinic]_bookings`: Master appointment list.
  - `[clinic]_medicines`: Medicine prescriptions and schedules.
  - `[clinic]_test`: Medical test reminders.
  - `[clinic]_followup`: Patient follow-up schedules.
- **Doctor Availability:** Supports "Multi-Session" windows (e.g., split shifts) within a 24-hour range. Availability can be synced to personal Google Calendars as recurring events.
- **Security:** Subscription status and fees are restricted to the `admin.py` panel only.

## Development Workflow
- **Running Flask:** `python app.py`
- **Running Dashboard:** `streamlit run dashboard.py`
- **Running Reminders:** `python scheduler.py`

## Troubleshooting
- **Date Column Issues:** If dates show "12:00:00 AM", ensure the sheet cell starts with a literal `'` (e.g., `'09-05-2026`). The `append_` functions in `sheets.py` handle this automatically.
- **Calendar Not Syncing:** Check the `google_calendar_id` in the doctor's profile or clinic settings, and ensure `ENABLE_GOOGLE_CALENDAR=true` in `.env`.
- **Reminder Loophole:** Patient-initiated reminders are locked to "Completed" booking sessions from the last 48 hours to prevent unauthorized use.
