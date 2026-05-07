# Clinic Bot - Project Context

## Overview
A Telegram bot for clinic appointment scheduling and management.

## Tech Stack
- Python 3.14+
- Flask web framework
- Telegram Bot API
- Google Sheets API (for data storage)
- SQLite (scheduler database)
- Streamlit (dashboard)

## Key Files

### Core
- `app.py` - Main Flask application
- `webhook.py` - Telegram webhook handler
- `admin.py` - Admin interface
- `dashboard.py` - Streamlit dashboard
- `scheduler.py` - Appointment scheduler

### Config
- `config/clinics.json` - Clinic configurations
- `.env` - Environment variables

## Commands

### Run
```bash
python app.py          # Run Flask server
python -m streamlit run dashboard.py  # Run dashboard
```

### Test
```bash
pytest  # Run tests if available
```

## Data Flow
1. User messages Telegram bot
2. Webhook receives update
3. Bot processes message and returns response
4. Appointments stored in SQLite + Google Sheets

## Environment Variables
Check `.env` file for secrets (Telegram token, Google credentials, etc.)