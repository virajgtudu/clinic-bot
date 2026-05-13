# ClinicPRO Project

## Overview
ClinicPRO is a professional, multi-tenant clinic management platform. It integrates WhatsApp for patient interactions (booking, reminders, status tracking), Supabase for real-time queue management and multi-clinic security, and a modern React dashboard for clinic administrators.

## Architecture
- **Backend:** Flask (`app.py`) handles WhatsApp webhooks via Meta Graph API and hosts the integrated Background Scheduler.
- **Frontend:** React + Vite + TypeScript (`frontend/`) provides a high-fidelity dashboard for real-time queue monitoring, doctor management, and analytics.
- **Primary Database:** Supabase (PostgreSQL) handles:
    - **Real-time Queue:** `appointments` table with Postgres Changes subscription.
    - **Atomic Token Generation:** `create_appointment` RPC function.
    - **Multi-Tenant Security:** Row Level Security (RLS) and Supabase Auth.
    - **Dynamic Configuration:** `doctors` table for per-clinic staff and slot management.
- **Secondary Database:** Google Sheets acts as a master record for bookings and reminders, providing redundant storage and easy manual export.
- **Timezone:** Standardized to **Asia/Kolkata (IST)** across all modules (`config.get_now()`).

## Core Features
- **Smart Queue:** Real-time patient flow monitoring with "Now Serving" updates.
- **Doctor Management:** UI-driven management of doctors, specialties, and session timings/slots.
- **Initials-based Tokens:** Sequential tokens per doctor/date using first and last initials (e.g., `PJ-001` for Dr. Prabhat Jain).
- **Automated Reminders:** Medicine (interactive buttons), Test, and Appointment reminders delivered via WhatsApp.
- **Live Analytics:** Dynamic calculation of average wait times and peak traffic visualization.

## Conventions
- **Patient Identification:** Identified by **Name + Mobile Number + Age**.
- **Date Standard:** System-wide standard is **`DD-MM-YYYY`** for display and **`YYYY-MM-DD`** for Supabase queries.
- **Token Format:** `[Initials]-[000]` (e.g., `PJ-001`), unique per doctor/date.
- **Queue Statuses:** `Pending`, `Serving`, `Completed`, `Cancelled`, `Emergency`.

## Deployment (Render)
- **Environment Variables:**
  - `SUPABASE_URL`: Your Supabase project URL.
  - `SUPABASE_KEY`: Service Role (Secret) key for the backend bot.
  - `WHATSAPP_TOKEN_[ID]`: Meta Access Token for specific clinics.
  - `VERIFY_TOKEN`: WhatsApp webhook verification token.
  - `GOOGLE_CREDENTIALS`: Service account JSON for GSheets/Calendar.

## Development Workflow
- **Running Backend + Reminders:** `python app.py`
- **Running Frontend Dashboard:** 
  ```bash
  cd frontend
  npm run dev
  ```

## Security (RLS)
- **Multi-Tenancy:** Each staff member is linked to a `clinic_id` in the `profiles` table.
- **Access Control:** RLS policies ensure that users can only see and manage data belonging to their own clinic.
- **Bot Access:** The backend bot uses the `service_role` key to bypass RLS for system-wide operations.
