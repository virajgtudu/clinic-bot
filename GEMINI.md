# ClinicPRO Project

## Overview
ClinicPRO is a professional, multi-tenant clinic management platform. It integrates WhatsApp for patient interactions (booking, reminders, status tracking), Supabase for real-time queue management and multi-clinic security, and a modern dashboard for clinic administrators.

## Architecture
- **Backend:** Flask (`app.py`) handles WhatsApp webhooks via Meta Graph API, exposes REST API endpoints for the frontend (e.g. manual-remind), manages CORS, and hosts the integrated Background Scheduler (APScheduler).
- **Admin Dashboards:**
    - **Streamlit:** (`dashboard.py`) Primary tool for clinic staff to manage real-time queues, set reminders, and view analytics.
    - **React:** (`frontend/`) High-fidelity dashboard for monitoring and doctor management. Connects to the Flask backend via `VITE_API_URL` to trigger live WhatsApp messages.
- **Primary Database:** Supabase (PostgreSQL) handles:
    - **Real-time Queue:** `appointments` table with Postgres Changes subscription.
    - **Atomic Token Generation:** `create_appointment` RPC function.
    - **Automated Reminders:** `reminders` table used by the background scheduler for real-time dose/test alerts.
    - **Multi-Tenant Security:** Row Level Security (RLS) and Supabase Auth.
- **Secondary Database:** Google Sheets acts as a master record for bookings and reminders, providing redundant storage and easy manual export.
- **Timezone:** Standardized to **Asia/Kolkata (IST)** across all modules (`config.get_now()`).

## Core Features
- **Smart Queue:** Real-time patient flow monitoring with "Now Serving" updates and "Next Patient" automated status transitions.
- **Doctor Management:** UI-driven management of doctors, specialties, and session timings/slots.
- **Initials-based Tokens:** Sequential tokens per doctor/date using first and last initials (e.g., `PJ-001` for Dr. Prabhat Jain).
- **Automated Reminders:** Medication (interactive buttons), Test, and Follow-up reminders delivered via WhatsApp. Reminders are dual-synced between Supabase and Sheets.
- **Manual Control:** Instant "Remind" functionality allows staff to bypass automated schedules for immediate patient notification. Both Streamlit and React dashboards can trigger these WhatsApp messages securely through the backend API.
- **Live Analytics:** Dynamic calculation of average wait times and peak traffic visualization.

## Conventions & Standards
- **Patient Identification:** Identified by **Name + Mobile Number + Age**.
- **Phone Numbers:** System-wide standard is digits only with country code (e.g., `919876543210`). Sanitized via `services.whatsapp.clean_phone_number()`.
- **Date Standard:** System-wide standard is **`DD-MM-YYYY`** for display and **`YYYY-MM-DD`** for Supabase queries.
- **Token Format:** `[Initials]-[000]` (e.g., `PJ-001`), unique per doctor/date.
- **Queue Statuses:** `Pending`, `Serving`, `Completed`, `Cancelled`, `Emergency`.
- **Data Access:** Always use `.get()` for dictionary keys (especially `phone_number_id` and `sheet_name`) to ensure resilience against differing clinic configurations.

## Deployment (Render)
- **Environment Variables:**
  - `SUPABASE_URL`: Your Supabase project URL.
  - `SUPABASE_KEY`: Service Role (Secret) key for the backend bot.
  - `WHATSAPP_TOKEN_[ID]`: Meta Access Token for specific clinics.
  - `VERIFY_TOKEN`: WhatsApp webhook verification token.
  - `GOOGLE_CREDENTIALS`: Service account JSON for GSheets/Calendar.

## Development Workflow
- **Running Backend + Reminders:** `python app.py`
- **Running Admin Dashboard:** `streamlit run dashboard.py`
- **Running React Frontend:** 
  Ensure `VITE_API_URL` is set in your frontend `.env` to point to the Flask backend.
  ```bash
  cd frontend
  npm run dev
  ```

## Security (RLS)
- **Multi-Tenancy:** Each staff member is linked to a `clinic_id` in the `profiles` table.
- **Access Control:** RLS policies ensure that users can only see and manage data belonging to their own clinic.
- **Bot Access:** The backend bot uses the `service_role` key to bypass RLS for system-wide operations.
