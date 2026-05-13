import json
import logging
import os
from pathlib import Path

# Bypass potential misconfigured system proxies (e.g., 127.0.0.1:9)
os.environ["NO_PROXY"] = "google-auth,googleapis.com,oauth2.googleapis.com,spreadsheets.google.com"
os.environ["no_proxy"] = os.environ["NO_PROXY"]

import gspread
from gspread.exceptions import SpreadsheetNotFound
from google.oauth2.service_account import Credentials


BOOKING_HEADERS = ["#", "Name", "Phone", "Date", "Time", "Doctor", "Specialty", "Token", "Status", "Booked At", "Patient ID"]
MEDICINE_HEADERS = [
    "#",
    "Phone",
    "Medicine",
    "Dosage",
    "Frequency",
    "Duration",
    "Start Date",
    "End Date",
    "Instructions",
    "Status",
    "Created At",
    "Type",
    "Time 1",
    "Time 2",
    "Time 3",
    "Appointment ID",
    "Last Sent",
]
TEST_HEADERS = [
    "#",
    "Phone",
    "Test Name",
    "Date",
    "Instructions",
    "Status",
    "Created At",
    "Last Sent",
]
FOLLOWUP_HEADERS = [
    "#",
    "Phone",
    "Reason",
    "Date",
    "Instructions",
    "Status",
    "Created At",
]


SCOPES = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
logger = logging.getLogger(__name__)


def _credentials():
    # 1. Try direct JSON from environment variables
    credentials_json = os.getenv("GOOGLE_CREDENTIALS") or os.getenv("GOOGLE_CREDENTIALS_JSON")
    if credentials_json:
        try:
            creds = Credentials.from_service_account_info(json.loads(credentials_json), scopes=SCOPES)
            logger.info("Credentials loaded from environment variable (JSON)")
            return creds
        except Exception as e:
            logger.error(f"Failed to load credentials from GOOGLE_CREDENTIALS env var: {e}")

    # 2. Try file path from environment variable or default
    # We must be careful: sometimes users paste the JSON into GOOGLE_APPLICATION_CREDENTIALS by mistake
    path_val = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "credentials.json")
    
    # If the path_val looks like JSON (starts with {), it's not a file path!
    if path_val.strip().startswith("{"):
        try:
            logger.info("GOOGLE_APPLICATION_CREDENTIALS looks like JSON, attempting to parse...")
            creds = Credentials.from_service_account_info(json.loads(path_val), scopes=SCOPES)
            logger.info("Credentials loaded from GOOGLE_APPLICATION_CREDENTIALS (JSON)")
            return creds
        except Exception as e:
            logger.error(f"Failed to parse GOOGLE_APPLICATION_CREDENTIALS as JSON: {e}")
            return None

    # Treat as actual file path
    credentials_file = Path(path_val)
    try:
        if credentials_file.exists() and credentials_file.is_file():
            logger.info(f"Loading credentials from file: {credentials_file}")
            return Credentials.from_service_account_file(str(credentials_file), scopes=SCOPES)
    except OSError as oe:
        logger.error(f"OS error checking credentials file '{path_val[:30]}...': {oe}")
    
    logger.error("No valid Google credentials found (checked env and file)")
    return None


def get_client():
    return gspread.authorize(_credentials())


class SheetSetupError(RuntimeError):
    pass


def open_sheet(sheet_name=None, spreadsheet_id=None):
    client = get_client()
    if spreadsheet_id:
        return client.open_by_key(spreadsheet_id).sheet1

    try:
        return client.open(sheet_name).sheet1
    except SpreadsheetNotFound:
        if os.getenv("AUTO_CREATE_GOOGLE_SHEETS", "true").lower() not in {"1", "true", "yes"}:
            raise SheetSetupError(f"Google Sheet not found or not shared with the service account: {sheet_name}") from None
        logger.info("Google Sheet %s not found; creating it with service account", sheet_name)
        try:
            return client.create(sheet_name).sheet1
        except Exception as exc:
            raise SheetSetupError(
                f"Google Sheet {sheet_name} was not found/shared, and auto-create failed: {exc}"
            ) from exc


def ensure_headers(sheet, headers):
    existing = sheet.row_values(1)
    if existing[: len(headers)] != headers:
        end_column = chr(ord("A") + len(headers) - 1)
        sheet.update(f"A1:{end_column}1", [headers])


def append_booking(clinic, row):
    sheet = open_sheet(clinic.get("sheet_name"), clinic.get("sheet_id"))
    ensure_headers(sheet, BOOKING_HEADERS)
    next_row = len(sheet.get_all_values()) + 1
    # Force string format for dates to avoid '12:00:00 AM' issue
    formatted_row = [f"'{val}" if isinstance(val, str) and "-" in val and len(val) <= 10 else val for val in row]
    data = [next_row - 1] + formatted_row
    sheet.insert_row(data, next_row)


def append_medicine(clinic, row):
    sheet = open_sheet(clinic.get("medicines_sheet"), clinic.get("medicines_sheet_id"))
    ensure_headers(sheet, MEDICINE_HEADERS)
    next_row = len(sheet.get_all_values()) + 1
    # Force string format for dates
    formatted_row = [f"'{val}" if isinstance(val, str) and "-" in val and len(val) <= 10 else val for val in row]
    data = [next_row - 1] + formatted_row
    sheet.insert_row(data, next_row)


def append_test(clinic, row):
    test_sheet_name = f"{clinic.get('name', 'clinic').lower().replace(' ', '_')}_test"
    sheet = open_sheet(test_sheet_name)
    ensure_headers(sheet, TEST_HEADERS)
    next_row = len(sheet.get_all_values()) + 1
    # Force string format for dates
    formatted_row = [f"'{val}" if isinstance(val, str) and "-" in val and len(val) <= 10 else val for val in row]
    data = [next_row - 1] + formatted_row
    sheet.insert_row(data, next_row)


def append_followup(clinic, row):
    followup_sheet_name = f"{clinic.get('name', 'clinic').lower().replace(' ', '_')}_followup"
    sheet = open_sheet(followup_sheet_name)
    ensure_headers(sheet, FOLLOWUP_HEADERS)
    next_row = len(sheet.get_all_values()) + 1
    # Force string format for dates
    formatted_row = [f"'{val}" if isinstance(val, str) and "-" in val and len(val) <= 10 else val for val in row]
    data = [next_row - 1] + formatted_row
    sheet.insert_row(data, next_row)
