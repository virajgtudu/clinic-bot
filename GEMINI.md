# Clinic Bot Project

## Overview
This project is a clinic management bot that integrates WhatsApp for user interactions, Flask for webhooks, and Streamlit for a management dashboard. It uses Google Sheets as a primary database for bookings and various reminder types.

## Architecture
- **Backend:** Flask (`app.py`) handles incoming webhooks and hosts the integrated Background Scheduler for reminders.
- **Timezone:** Standardized to **Asia/Kolkata (IST)** across all modules (`config.get_now()`).
- **Dashboard:** Streamlit (`dashboard.py`) provides a UI for clinic administrators to manage bookings, doctors, and reminders.
- **Queue Management:** 
  - Tokens are generated sequentially **per-doctor and per-date**.
  - Statuses: `Pending`, `Serving`, `Completed`, `Cancelled`.
  - Live tracking via `status` command on WhatsApp.
- **Database:** 
  - Current: Google Sheets (Source of Truth for data) + Local JSON/Env Vars (for config).
  - Planned: Supabase (PostgreSQL) for atomic token generation and **Live Config persistence** (to avoid manual redeploys).
- **Services:**
  - `services/sheets.py`: Google Sheets integration.
  - `services/database.py`: (In-progress) Supabase integration.
  - `services/whatsapp.py`: WhatsApp messaging integration via Meta Graph API.
  - `services/booking_logic.py`: Core logic for WhatsApp flows, patient identification, and per-doctor queue logic.
  - `services/calendar.py`: Integration with Google Calendar for doctor-specific appointments.
- **Scheduler:** Integrated into `app.py` via `APScheduler`. Handles automated delivery for Medicine (interactive buttons), Test, and Appointment reminders.

## Conventions
- **Patient Identification:** Identified by **Name + Mobile Number + Age**.
- **Date Standard:** System-wide standard is **`DD-MM-YYYY`**.
- **Token Format:** `[Prefix]-[000]` (e.g., `VI-001`), unique per doctor/date.
- **Google Sheets Database:**
  - `[clinic]_bookings`: Master appointment list.
  - `[clinic]_medicines`: Medicine prescriptions (16 columns explicit, includes `Time 3`).
  - `[clinic]_test`: Medical test reminders.
- **Medicine Reminders:** Supports interactive buttons (Taken/Skip). Defaults to 24-hour format (09:00, 14:00, 21:00).
- **Slot Pagination:** WhatsApp List Messages are limited to **10 rows**. The booking flow automatically paginates slots with "Next/Previous" buttons if a doctor has more than 10 available times.

## Deployment (Render)
- **Environment Variables:**
  - `CLINIC_CONFIG_DATA`: Full JSON content of `clinics.json`.
  - `CLINIC_USERS_DATA`: Full JSON content of `users.json`.
  - `GOOGLE_CREDENTIALS`: Full JSON content of service account credentials.
  - `VERIFY_TOKEN`: Token for WhatsApp webhook verification.
- **Start Command:** `python app.py` (or `gunicorn --workers 1 --bind 0.0.0.0:$PORT app:app`).

## Development Workflow
- **Running Backend + Reminders:** `python app.py`
- **Running Dashboard:** `streamlit run dashboard.py`

## Troubleshooting
- **Missing Reminders:** Check `Last Sent` column in Google Sheets. It tracks `DD-MM-YYYY@HH:MM` to prevent duplicates.
- **Clinic Not Found:** Ensure `CLINIC_CONFIG_DATA` in Render environment matches the `phone_number_id` coming from Meta.
- **JSON Parse Errors:** Code includes `_clean_json_env` to strip accidental quotes from environment variables.
