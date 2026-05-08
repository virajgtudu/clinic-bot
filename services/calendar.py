import os
from datetime import datetime
from config import get_now


def create_calendar_event(clinic, booking):
    """Create a Google Calendar event when a clinic has calendar configuration.

    This is intentionally optional: Sheets remains the source of truth, and the
    booking flow will continue if Google Calendar credentials are not configured.
    For per-doctor calendars, it uses `doctor_calendar_id` from the booking info.
    """
    calendar_id = booking.get("doctor_calendar_id") or clinic.get("google_calendar_id")
    if not calendar_id or os.getenv("ENABLE_GOOGLE_CALENDAR", "").lower() not in {"1", "true", "yes"}:
        return None

    try:
        from googleapiclient.discovery import build
    except ImportError:
        return None

    try:
        from services.sheets import _credentials

        service = build("calendar", "v3", credentials=_credentials(), cache_discovery=False)
        event = {
            "summary": f"{booking['patient_name']} with {booking['doctor_name']}",
            "description": f"Phone: {booking['phone']}\nToken: {booking['token']}",
            "start": {
                "dateTime": booking["start_datetime"], 
                "timeZone": clinic.get("timezone", "Asia/Kolkata")
            },
            "end": {
                "dateTime": booking["end_datetime"], 
                "timeZone": clinic.get("timezone", "Asia/Kolkata")
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 30},
                ],
            },
        }
        # Force calendarId to 'primary' if 'google_calendar_id' is not working, 
        # but user specifically asked for 'google_calendar_id'.
        return service.events().insert(calendarId=calendar_id, body=event).execute()
    except Exception as exc:
        print(f"Calendar event skipped: {exc}")
        return None


def sync_doctor_sessions(clinic, doctor):
    """Sync doctor availability sessions to Google Calendar as recurring blocks."""
    calendar_id = doctor.get("google_calendar_id") or clinic.get("google_calendar_id")
    if not calendar_id or os.getenv("ENABLE_GOOGLE_CALENDAR", "").lower() not in {"1", "true", "yes"}:
        return None

    try:
        from googleapiclient.discovery import build
        from services.sheets import _credentials
        service = build("calendar", "v3", credentials=_credentials(), cache_discovery=False)
        
        availability = doctor.get("availability", {})
        if availability.get("mode") != "Scheduled Range":
            return None
            
        sessions = availability.get("sessions", [])
        days = availability.get("days", []) # ["Mon", "Tue", ...]
        
        day_map = {"Mon": "MO", "Tue": "TU", "Wed": "WE", "Thu": "TH", "Fri": "FR", "Sat": "SA", "Sun": "SU"}
        rrules_days = ",".join([day_map[d] for d in days if d in day_map])
        
        if not rrules_days:
            return None

        for s_idx, session in enumerate(sessions):
            start_t = session.get("start") # "09:00 AM"
            end_t = session.get("end") # "01:00 PM"
            
            # Create a start date that matches one of the selected days to initialize the recurrence
            # For simplicity, we use today's date and let Google handle the rest
            today = get_now()
            start_dt = datetime.strptime(f"{today.strftime('%Y-%m-%d')} {start_t}", "%Y-%m-%d %I:%M %p")
            end_dt = datetime.strptime(f"{today.strftime('%Y-%m-%d')} {end_t}", "%Y-%m-%d %I:%M %p")
            
            event = {
                "summary": f"🏥 Availability: Dr. {doctor['name']} ({s_idx+1})",
                "description": f"Doctor Availability Session {s_idx+1} sync from Clinic Bot",
                "start": {
                    "dateTime": start_dt.isoformat(),
                    "timeZone": clinic.get("timezone", "Asia/Kolkata"),
                },
                "end": {
                    "dateTime": end_dt.isoformat(),
                    "timeZone": clinic.get("timezone", "Asia/Kolkata"),
                },
                "recurrence": [
                    f"RRULE:FREQ=WEEKLY;BYDAY={rrules_days}"
                ],
                "transparency": "transparent", # Mark as 'Free' so it doesn't block actual bookings if needed
            }
            service.events().insert(calendarId=calendar_id, body=event).execute()
        return True
    except Exception as exc:
        print(f"Calendar sync failed: {exc}")
        return False
