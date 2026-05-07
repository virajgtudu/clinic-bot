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


BOOKING_HEADERS = ["#", "Name", "Phone", "Date", "Time", "Doctor", "Specialty", "Token", "Status", "Booked At"]
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
    credentials_json = os.getenv("GOOGLE_CREDENTIALS") or os.getenv("GOOGLE_CREDENTIALS_JSON")
    if credentials_json:
        return Credentials.from_service_account_info(json.loads(credentials_json), scopes=SCOPES)

    credentials_file = Path(os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "credentials.json"))
    return Credentials.from_service_account_file(credentials_file, scopes=SCOPES)


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
