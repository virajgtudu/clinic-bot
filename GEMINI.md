# ClinicPRO Project

## Overview
ClinicPRO is a professional, multi-tenant clinic management platform. It integrates WhatsApp for patient interactions (booking, reminders, status tracking), Supabase for real-time queue management and multi-clinic security, and a modern dashboard for clinic administrators.

## Architecture
- **Backend:** Flask (`app.py`) handles WhatsApp webhooks via Meta Graph API, exposes REST API endpoints for the frontend (e.g. manual-remind), manages CORS, and hosts the integrated Background Scheduler (APScheduler).
- **Frontend Dashboard:**
    - **React:** (`frontend/`) High-fidelity dashboard for clinic administrators and staff. Features real-time queue views, patient analytics, doctor schedules, automated reminders management, and platform administration. Connects to the Flask backend via `VITE_API_URL` to trigger live WhatsApp messages.
- **Primary Database:** Supabase (PostgreSQL) handles:
    - **Real-time Queue:** `appointments` table with Postgres Changes subscription.
    - **Atomic Token Generation:** `create_appointment` RPC function.
    - **Automated Reminders:** `reminders` table used by the background scheduler for real-time dose/test alerts.
    - **Multi-Tenant Security:** Row Level Security (RLS) and Supabase Auth.
- **Secondary Database:** Google Sheets acts as a master record for bookings and reminders, providing redundant storage and easy manual export.
- **Timezone:** Standardized to **Asia/Kolkata (IST)** across all modules (`config.get_now()`).

## Core Features
- **Smart Queue:** Real-time patient flow monitoring with "Now Serving" updates and "Next Patient" automated status transitions. The "Next Patient" action conditionally prompts the administrator to select a doctor if multiple doctors exist (bypassing the selection if only one doctor is configured) and advances the queue by reverting the currently serving patient back to `Pending` status (which removes them from the active dashboard queue while keeping their status as `Pending` inside history and appointments) and serving the next waiting one.
- **Doctor Management:** UI-driven management of doctors, specialties, and session timings/slots.
- **Initials-based Tokens:** Sequential tokens per doctor/date using first and last initials (e.g., `PJ-001` for Dr. Prabhat Jain).
- **Automated Reminders:** Medication (interactive buttons), Test, and Follow-up reminders delivered via WhatsApp. Reminders are dual-synced between Supabase and Sheets.
- **Manual Control:** Instant "Remind" functionality allows staff to bypass automated schedules for immediate patient notification. The React dashboard can trigger these WhatsApp messages securely through the backend API.
- **Live Analytics:** Dynamic calculation of average wait times and peak traffic visualization.

## Conventions & Standards
- **Patient Identification:** Identified by **Name + Mobile Number + Age**.
- **Phone Numbers:** System-wide standard is digits only with country code (e.g., `919876543210`). Sanitized via `services.whatsapp.clean_phone_number()`.
- **Date Standard:** System-wide standard is **`DD-MM-YYYY`** for display and **`YYYY-MM-DD`** for Supabase queries.
- **Token Format:** `[Initials]-[000]` (e.g., `PJ-001`), unique per doctor/date.
- **Queue Statuses:** `Pending`, `Serving`, `Completed`, `Cancelled`, `Emergency`.
- **WhatsApp State Management:** Sending greetings (e.g., `"Hi"`, `"Hello"`, `"Start"`) resets the user's session step to `main_menu` and clears any active prompt states (like `followup_prompt`). Generic booking/cancellation keywords (e.g., `"book"`, `"cancel"`) only trigger follow-up booking/cancellation actions when the user is explicitly in the `followup_prompt` state, preventing them from hijacking standard booking requests.
- **Data Access:** Always use `.get()` for dictionary keys (especially `phone_number_id` and `sheet_name`) to ensure resilience against differing clinic configurations.

## Admin Upgrades & Dynamic Branding
- **Clinic Upgrade Policy:**
  - Package tier updates (switching between `Essential` and `Professional`) are exclusive to the Super Admin. Clinics cannot upgrade their plan tier themselves.
  - The endpoint `/api/admin/update-clinic` (POST) is used by the Super Admin to update the clinic's tier, ensuring only authorized platform administrators can modify package plans.
- **Dynamic CSS Shading Engine:**
  - When the clinic is on the `"Professional"` tier, custom branding (logo and brand color) is unlocked.
  - Toggling preset colors or choosing a custom hex value triggers an automatic JavaScript mix engine (`applyBrandPalette`).
  - This engine converts the primary brand color to RGB values and generates 11 dynamic brand shades (`--brand-50` to `--brand-950`) stored as space-separated decimals (e.g., `14 165 233` for `#0ea5e9`).
  - These custom variables override Tailwind CSS color definitions, allowing full support for opacity utility suffixes (e.g., `bg-brand-500/10`) dynamically at runtime.
  - Unused features (e.g., "Queue Board TV Settings" and "Scale to Enterprise") have been removed from the Settings panel.

## Deployment (Render)
- **Environment Variables:**
  - `SUPABASE_URL`: Your Supabase project URL.
  - `SUPABASE_KEY`: Service Role (Secret) key for the backend bot.
  - `WHATSAPP_TOKEN_[ID]`: Meta Access Token for specific clinics.
  - `VERIFY_TOKEN`: WhatsApp webhook verification token.
  - `GOOGLE_CREDENTIALS`: Service account JSON for GSheets/Calendar.

## Development Workflow
- **Running Backend + Reminders:** `python app.py`
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
