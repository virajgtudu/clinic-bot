# Clinic Bot - Project Context

## Overview
A clinic appointment scheduling and management system powered by a WhatsApp chatbot and a React-based administration dashboard.

## Tech Stack
- Python 3.14+
- Flask web framework
- WhatsApp Business Cloud API (Meta Graph API)
- Google Sheets API (for data storage)
- Supabase (PostgreSQL primary DB, Auth, Real-time)
- React, Vite, TypeScript, Tailwind CSS (admin dashboard)

## Key Files

### Core
- `app.py` - Main Flask application (WhatsApp webhook and admin REST API)
- `webhook.py` - WhatsApp webhook handler entry point
- `scheduler.py` - Appointment and medication scheduler
- `frontend/` - React frontend dashboard codebase

### Config
- `config/clinics.json` - Clinic configurations
- `.env` - Environment variables

## Commands

### Run
```bash
python app.py          # Run Flask server (port 5000)
cd frontend && npm run dev  # Run React developer server
```

### Test
```bash
pytest  # Run tests if available
```

## Data Flow
1. User messages WhatsApp chatbot
2. Webhook receives update
3. Bot processes message and returns response
4. Appointments stored in Supabase + Google Sheets

## Admin REST APIs & Upgrade Flow
- **Package Plan Upgrades:** Exclusive to the Super Administrator. Clinic owners/admins cannot upgrade their plan tier themselves.
- **Admin Endpoints:** Plan changes are applied by the Super Admin via `/api/admin/update-clinic` (POST).

## Theme & Branding Engine
- **Dynamic CSS Theme:**
  - Dynamic brand color palettes are applied at runtime.
  - The primary brand color is converted into 11 space-separated RGB shades (`--brand-50` to `--brand-950`) and injected into the document root.
  - Tailwind utilities reference these CSS variables, supporting real-time theme previews and dynamic opacity variants (e.g. `bg-brand-500/10`).

## Environment Variables
Check `.env` file for secrets (Supabase tokens, Google credentials, etc.)