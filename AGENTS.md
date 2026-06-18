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

## Environment Variables
Check `.env` file for secrets (Supabase tokens, Google credentials, etc.)