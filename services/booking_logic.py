import json
import logging
import re
from datetime import datetime, timedelta
from pathlib import Path

from services.calendar import create_calendar_event
from services.sheets import MEDICINE_HEADERS, append_booking, append_medicine, append_test, append_followup, ensure_headers, open_sheet
from services.whatsapp import send_buttons, send_list, send_text
from config import get_now


TOKEN_FILE = Path(__file__).resolve().parent.parent / "daily_token.json"
logger = logging.getLogger(__name__)
user_sessions = {}


def _session_key(clinic_id, phone):
    return f"{clinic_id}:{phone}"


def _load_token_state():
    if not TOKEN_FILE.exists():
        return {}
    with open(TOKEN_FILE, "r") as f:
        return json.load(f)


def _save_token_state(state):
    with open(TOKEN_FILE, "w") as f:
        json.dump(state, f, indent=2)


def get_next_token_from_sheet(clinic, date_str, doctor_name):
    """Generate sequential token for a specific doctor and date from GSheet"""
    try:
        sheet = open_sheet(clinic.get("sheet_name"), clinic.get("sheet_id"))
        records = sheet.get_all_records()
        
        # Filter for same date and doctor
        count = 0
        for r in records:
            if str(r.get("Date")) == date_str and str(r.get("Doctor")) == doctor_name:
                count += 1
        
        next_num = count + 1
        # Use doctor's first 2 letters as prefix
        prefix = "".join([c for c in doctor_name if c.isalnum()])[:2].upper()
        return f"{prefix}-{next_num:03d}"
    except Exception as e:
        logger.error(f"Error generating token from sheet: {e}")
        # Fallback to simple timestamp-based token if sheet fails
        return f"TK-{int(get_now().timestamp()) % 1000:03d}"


def _clinic_name(clinic):
    return clinic.get("name") or clinic.get("clinic_name") or "Clinic"


def _doctor_rows(doctors):
    return [
        {
            "id": f"doc_{index}",
            "title": doctor["name"][:24],
            "description": doctor.get("specialty", "")[:72],
        }
        for index, doctor in enumerate(doctors)
    ]


def _is_doctor_available_on(doctor, date_obj):
    """Check if the doctor is available on a specific day of the week."""
    availability = doctor.get("availability", {})
    if availability.get("mode") == "Manual Slots":
        return True  # Assume always available for manual mode (original behavior)
        
    allowed_days = availability.get("days", [])
    if not allowed_days:
        return True
        
    day_name = date_obj.strftime("%a") # e.g. "Mon"
    return day_name in allowed_days


def _date_options(doctor, days=7):
    dates = []
    now = get_now()
    for offset in range(days):
        value = now + timedelta(days=offset)
        if not _is_doctor_available_on(doctor, value):
            continue
            
        label = value.strftime("%b %d (%a)")
        if offset == 0:
            label = f"Today - {label}"
        elif offset == 1:
            label = f"Tomorrow - {label}"
        dates.append({"display": label, "value": value.strftime("%d-%m-%Y")})
    return dates


def _date_rows(dates):
    return [
        {"id": f"date_{index}", "title": date["display"][:24], "description": date["value"]}
        for index, date in enumerate(dates)
    ]


def _slot_rows(slots, offset=0):
    limit = 10
    if len(slots) <= limit:
        return [{"id": f"slot_{i}", "title": slots[i][:24]} for i in range(len(slots))]
    
    # Pagination logic
    # If we are at the start, show 9 slots + 1 "Next"
    if offset == 0:
        rows = [{"id": f"slot_{i}", "title": slots[i][:24]} for i in range(9)]
        rows.append({"id": "slots_next_9", "title": "Next slots ➡️"})
        return rows
    
    # If we are in the middle/end, show "Prev" + up to 8 slots + "Next"
    rows = [{"id": f"slots_prev_{max(0, offset - 9)}", "title": "⬅️ Previous"}]
    
    # Calculate how many slots we can show
    remaining = len(slots) - offset
    if remaining <= 9: # Can fit all remaining + Prev
        for i in range(offset, len(slots)):
            rows.append({"id": f"slot_{i}", "title": slots[i][:24]})
    else:
        # Show 8 slots + Prev + Next
        for i in range(offset, offset + 8):
            rows.append({"id": f"slot_{i}", "title": slots[i][:24]})
        rows.append({"id": f"slots_next_{offset + 8}", "title": f"Next slots ➡️"})
    
    return rows


def _extract_text(message):
    message_type = message.get("type", "")
    if message_type == "interactive":
        interactive = message.get("interactive", {})
        if "button_reply" in interactive:
            value = interactive["button_reply"].get("id", "")
            return value.strip(), value.strip().lower()
        if "list_reply" in interactive:
            value = interactive["list_reply"].get("id", "")
            return value.strip(), value.strip().lower()
        return "", ""

    value = message.get("text", {}).get("body", "")
    return value.strip(), value.strip().lower()


def _show_main_menu(clinic, phone):
    send_buttons(
        clinic,
        phone,
        f"Welcome to {_clinic_name(clinic)}.\n\nHow can I help you today?",
        [
            {"id": "book", "title": "Book"},
            {"id": "reminders", "title": "My Reminders"},
            {"id": "help", "title": "Help"},
        ],
    )


def _show_doctors(clinic, phone, doctors):
    if len(doctors) <= 3:
        send_buttons(
            clinic,
            phone,
            "Select a doctor",
            [{"id": f"doc_{index}", "title": doctor["name"][:20]} for index, doctor in enumerate(doctors)],
        )
        return

    send_list(clinic, phone, "Select a doctor", [{"title": "Doctors", "rows": _doctor_rows(doctors)}])


BANNED_WORDS = ["gym", "water", "meeting", "study"]


def _has_active_prescription_session(clinic, phone):
    """Check if the patient has 'Completed' bookings in the last 48 hours and return unique names."""
    try:
        sheet = open_sheet(clinic.get("sheet_name"), clinic.get("sheet_id"))
        rows = sheet.get_all_records()
        normalized_phone = _normalize_phone(phone)
        now = get_now()
        completed_patients = []
        for row in reversed(rows):
            if _normalize_phone(row.get("Phone")) == normalized_phone:
                if row.get("Status") != "Completed":
                    continue
                booked_at_str = row.get("Booked At")
                if not booked_at_str:
                    continue
                try:
                    booked_at = datetime.strptime(booked_at_str, "%d-%m-%Y %H:%M")
                    if (now - booked_at).total_seconds() < 48 * 3600:
                        name = row.get("Name")
                        if name and name not in completed_patients:
                            completed_patients.append(name)
                except ValueError:
                    continue
        return completed_patients
    except Exception as exc:
        logger.error("Error checking prescription session: %s", exc)
    return []


def _is_banned_medicine(medicine):
    medicine_lower = medicine.lower()
    return any(word in medicine_lower for word in BANNED_WORDS)


def _show_patient_reminders_menu(clinic, phone):
    send_buttons(
        clinic,
        phone,
        "My Reminders\n\nManage your medication reminders.",
        [
            {"id": "patient_rem_add", "title": "Add Reminder"},
            {"id": "patient_rem_view", "title": "View Active"},
            {"id": "patient_rem_cancel", "title": "Cancel"},
        ],
    )


def _handle_patient_reminder_flow(clinic, phone, text, raw_text, key, session):
    step = session.get("step", "patient_rem_menu")

    if text in {"reminders", "patient_rem_menu", "menu"}:
        user_sessions[key] = {"step": "patient_rem_menu", "clinic_id": clinic["phone_number_id"], "phone": phone}
        _show_patient_reminders_menu(clinic, phone)
        return True

    if step == "patient_rem_menu" and text == "patient_rem_add":
        verified_names = _has_active_prescription_session(clinic, phone)
        if not verified_names:
            send_text(clinic, phone, "No completed prescription session found in the last 48 hours. Please visit the clinic first.")
            _show_main_menu(clinic, phone)
            return True
        
        if len(verified_names) == 1:
            name = verified_names[0]
            user_sessions[key] = {
                "step": "patient_rem_verify", 
                "clinic_id": clinic["phone_number_id"], 
                "phone": phone,
                "verified_name": name
            }
            send_buttons(
                clinic,
                phone,
                f"📌 Creating reminder for: {name}\n\nIs this medicine prescribed by your doctor at our clinic?",
                [{"id": "presc_yes", "title": "Yes"}, {"id": "presc_no", "title": "No"}]
            )
            return True
        
        # Multiple patients found
        user_sessions[key] = {
            "step": "patient_rem_select_name",
            "clinic_id": clinic["phone_number_id"],
            "phone": phone,
            "names": verified_names
        }
        rows = [{"id": f"pname_{i}", "title": name[:24]} for i, name in enumerate(verified_names)]
        send_list(clinic, phone, "Multiple patients found. Select who this reminder is for:", [{"title": "Completed Patients", "rows": rows}])
        return True

    if step == "patient_rem_select_name" and text.startswith("pname_"):
        try:
            idx = int(text.replace("pname_", ""))
            name = session["names"][idx]
        except (ValueError, IndexError):
            send_text(clinic, phone, "Invalid selection. Reply Hi to start again.")
            return True
            
        user_sessions[key] = {
            "step": "patient_rem_verify",
            "clinic_id": clinic["phone_number_id"],
            "phone": phone,
            "verified_name": name
        }
        send_buttons(
            clinic,
            phone,
            f"📌 Creating reminder for: {name}\n\nIs this medicine prescribed by your doctor at our clinic?",
            [{"id": "presc_yes", "title": "Yes"}, {"id": "presc_no", "title": "No"}]
        )
        return True

    if step == "patient_rem_verify":
        if text == "presc_no":
            send_text(clinic, phone, "Sorry, you can only set reminders for medicines prescribed by our clinic.")
            _show_main_menu(clinic, phone)
            return True
        
        user_sessions[key] = {
            **session,
            "step": "patient_rem_medicine",
        }
        send_text(clinic, phone, "Enter medicine name")
        return True

    if step == "patient_rem_medicine":
        medicine = raw_text.strip()
        if _is_banned_medicine(medicine):
            send_text(clinic, phone, "Invalid medicine name. Please provide a valid prescription medicine.")
            return True
        
        user_sessions[key] = {**session, "step": "patient_rem_freq", "medicine": medicine}
        send_buttons(
            clinic,
            phone,
            "How many times per day?",
            [
                {"id": "freq_1", "title": "Once"},
                {"id": "freq_2", "title": "Twice"},
                {"id": "freq_3", "title": "Thrice"},
            ],
        )
        return True

    if step == "patient_rem_freq" and text.startswith("freq_"):
        choice = text.replace("freq_", "", 1)
        details = _staff_frequency_details(choice)
        frequency_label, reminder_times = details
        user_sessions[key] = {**session, "step": "patient_rem_duration", "freq_label": frequency_label, "times": reminder_times}
        send_text(clinic, phone, "How many days? (Max 10 days)")
        return True

    if step == "patient_rem_duration":
        try:
            days = int(raw_text.strip())
            if days < 1 or days > 10:
                raise ValueError
        except ValueError:
            send_text(clinic, phone, "Enter a valid number of days (1-10)")
            return True
        
        now = get_now()
        start_date = now
        end_date = start_date + timedelta(days=days - 1)
        full_name = session.get("verified_name")
        
        instruction_lines = [
            f"Patient: {full_name}",
            f"Medicine: {session.get('medicine')}",
            f"Set by Patient (Verified Session)",
        ]
        
        times = session.get("times", [])
        append_medicine(
            clinic,
            [
                phone,                          # Col 2: Phone
                session.get("medicine"),        # Col 3: Medicine
                "Patient set",                  # Col 4: Dosage
                session.get("freq_label"),       # Col 5: Frequency
                days,                           # Col 6: Duration
                start_date.strftime("%d-%m-%Y"), # Col 7: Start Date
                end_date.strftime("%d-%m-%Y"),   # Col 8: End Date
                "\n".join(instruction_lines),   # Col 9: Instructions
                "Active",                       # Col 10: Status
                now.strftime("%d-%m-%Y %H:%M"),  # Col 11: Created At
                "PatientPlan",                  # Col 12: Type
                times[0] if len(times) > 0 else "09:00", # Col 13: Time 1
                times[1] if len(times) > 1 else "",      # Col 14: Time 2
                times[2] if len(times) > 2 else "",      # Col 15: Time 3
                ""                              # Col 16: Appointment ID (Empty for patient set)
            ],
        )
        
        send_text(clinic, phone, f"✅ Reminder set for {session.get('medicine')} successfully!")
        _show_main_menu(clinic, phone)
        user_sessions.pop(key, None)
        return True

    if step == "patient_rem_menu" and text == "patient_rem_view":
        reminders = _load_active_staff_reminders(clinic) # Using same helper for now
        my_reminders = [r for r in reminders if _normalize_phone(r.get("Phone")) == _normalize_phone(phone)]
        if not my_reminders:
            send_text(clinic, phone, "You have no active reminders.")
        else:
            lines = [f"💊 {r.get('Medicine')} ({r.get('Frequency')})" for r in my_reminders[:5]]
            send_text(clinic, phone, "Your active reminders:\n\n" + "\n".join(lines))
        _show_patient_reminders_menu(clinic, phone)
        return True

    if step == "patient_rem_menu" and text == "patient_rem_cancel":
        count = _cancel_staff_reminders(clinic, phone)
        send_text(clinic, phone, f"Cancelled {count} active reminders.")
        _show_main_menu(clinic, phone)
        return True

    return False


def _normalize_phone(value):
    return re.sub(r"\D", "", str(value or ""))


def _is_staff_sender(clinic, phone):
    staff_numbers = clinic.get("staff_numbers", [])
    if isinstance(staff_numbers, str):
        staff_numbers = [item.strip() for item in staff_numbers.split(",") if item.strip()]
    normalized = _normalize_phone(phone)
    return normalized in {_normalize_phone(item) for item in staff_numbers}


def _staff_frequency_details(choice):
    mapping = {
        "1": ("Once", ["09:00"]),
        "2": ("Twice", ["09:00", "21:00"]),
        "3": ("Thrice", ["09:00", "14:00", "21:00"]),
    }
    return mapping.get(choice)


def _parse_dd_mm(value):
    value = value.strip()
    parsed = datetime.strptime(value, "%d-%m")
    now = get_now()
    return parsed.replace(year=now.year)


def _staff_summary(session):
    medicines = ", ".join(session.get("medicines", []))
    tests = ", ".join(session.get("tests", [])) if session.get("tests") else "None"
    full_name = f"{session.get('patient_name')} ({session.get('patient_age')})"
    return (
        "Confirm Reminder Setup\n\n"
        f"Patient: {full_name}\n"
        f"Phone: {session.get('patient_phone')}\n"
        f"Medicines: {medicines}\n"
        f"Frequency: {session.get('frequency_label')} ({', '.join(session.get('reminder_times', []))})\n"
        f"Duration: {session.get('start_date')} to {session.get('end_date')}\n"
        f"Tests: {tests}"
    )


def _show_staff_panel(clinic, phone):
    send_buttons(
        clinic,
        phone,
        "Staff Panel\n\nChoose an action",
        [
            {"id": "staff_add", "title": "Add Reminder"},
            {"id": "staff_view", "title": "View Active"},
            {"id": "staff_cancel", "title": "Cancel Reminder"},
        ],
    )


def _save_staff_reminder(clinic, session):
    now = get_now()
    medicines = session.get("medicines", [])
    tests = session.get("tests", [])
    patient_name = session.get("patient_name")
    patient_age = session.get("patient_age")
    full_name = f"{patient_name} ({patient_age})"
    patient_phone = session.get("patient_phone")
    start_date = session.get("start_date")
    end_date = session.get("end_date")
    frequency_label = session.get("frequency_label")
    reminder_times = session.get("reminder_times", [])
    duration_days = (datetime.strptime(end_date, "%d-%m-%Y") - datetime.strptime(start_date, "%d-%m-%Y")).days + 1

    instruction_lines = [
        f"Patient: {full_name}",
        f"Medicines: {', '.join(medicines)}",
        f"Reminder Times: {', '.join(reminder_times)}",
    ]
    
    # Save Medicines
    append_medicine(
        clinic,
        [
            patient_phone,                  # Col 2: Phone
            ", ".join(medicines),           # Col 3: Medicine
            "Staff configured",             # Col 4: Dosage
            frequency_label,                # Col 5: Frequency
            duration_days,                  # Col 6: Duration
            start_date,                     # Col 7: Start Date
            end_date,                       # Col 8: End Date
            "\n".join(instruction_lines),   # Col 9: Instructions
            "Active",                       # Col 10: Status
            now.strftime("%d-%m-%Y %H:%M"),  # Col 11: Created At
            "StaffPlan",                    # Col 12: Type
            reminder_times[0] if len(reminder_times) > 0 else "09:00", # Col 13: Time 1
            reminder_times[1] if len(reminder_times) > 1 else "",      # Col 14: Time 2
            reminder_times[2] if len(reminder_times) > 2 else "",      # Col 15: Time 3
            ""                              # Col 16: Appointment ID
        ],
    )
    
    # Save Tests
    for test_name in tests:
        append_test(
            clinic,
            [
                patient_phone,
                test_name,
                start_date, # Or maybe a specific test date? For now using start_date
                f"Prescribed for {full_name} by staff",
                "Active",
                now.strftime("%d-%m-%Y %H:%M")
            ]
        )


def _load_active_staff_reminders(clinic):
    sheet = open_sheet(clinic.get("medicines_sheet"), clinic.get("medicines_sheet_id"))
    ensure_headers(sheet, MEDICINE_HEADERS)
    rows = sheet.get_all_records()
    return [row for row in rows if row.get("Status") == "Active"]


def _cancel_staff_reminders(clinic, phone, name_with_age=None):
    sheet = open_sheet(clinic.get("medicines_sheet"), clinic.get("medicines_sheet_id"))
    ensure_headers(sheet, MEDICINE_HEADERS)
    rows = sheet.get_all_records()
    cancelled = 0
    for index, row in enumerate(rows, start=2):
        phone_match = _normalize_phone(row.get("Phone")) == _normalize_phone(phone)
        name_match = True
        if name_with_age:
            # We look into instructions or name if it was stored there. 
            # The current MEDICINE_HEADERS doesn't have a Name column, it has Phone, Medicine, ...
            # But the user said "record and show the age in the name column inside bracket next to patient's name"
            # In MEDICINE_HEADERS, there's no Name column. Let's check MEDICINE_HEADERS in sheets.py again.
            pass
        
        if phone_match and row.get("Status") == "Active":
            # If name_with_age is provided, we should probably check instructions where we saved it.
            if name_with_age and name_with_age not in row.get("Instructions", ""):
                continue
            sheet.update_cell(index, 10, "Cancelled") # Status is now at index 10 due to serial '#'
            cancelled += 1
    return cancelled


def _handle_staff_flow(clinic, phone, text, raw_text, key, session):
    step = session.get("step", "staff_menu")

    if text in {"staff", "staff_menu", "menu", "hi", "hello", "start"}:
        user_sessions[key] = {"step": "staff_menu", "clinic_id": clinic["phone_number_id"], "phone": phone, "is_staff": True}
        _show_staff_panel(clinic, phone)
        return True

    if step == "staff_menu" and text == "staff_add":
        user_sessions[key] = {"step": "staff_name", "clinic_id": clinic["phone_number_id"], "phone": phone, "is_staff": True}
        send_text(clinic, phone, "Enter patient name")
        return True

    if step == "staff_menu" and text == "staff_view":
        reminders = _load_active_staff_reminders(clinic)
        if not reminders:
            send_text(clinic, phone, "No active reminders.")
        else:
            lines = []
            for row in reminders[:10]:
                lines.append(f"{row.get('Phone')} | {row.get('Medicine')} | {row.get('Frequency')}")
            send_text(clinic, phone, "Active reminders\n\n" + "\n".join(lines))
        _show_staff_panel(clinic, phone)
        return True

    if step == "staff_menu" and text == "staff_cancel":
        user_sessions[key] = {"step": "staff_cancel_phone", "clinic_id": clinic["phone_number_id"], "phone": phone, "is_staff": True}
        send_text(clinic, phone, "Enter patient phone number to cancel active reminders")
        return True

    if step == "staff_cancel_phone":
        patient_phone = _normalize_phone(raw_text)
        user_sessions[key] = {**session, "step": "staff_cancel_name", "cancel_phone": patient_phone}
        send_text(clinic, phone, "Enter patient name and age (e.g. John Doe (25)) to confirm")
        return True

    if step == "staff_cancel_name":
        count = _cancel_staff_reminders(clinic, session.get("cancel_phone"), raw_text.strip())
        send_text(clinic, phone, f"Cancelled {count} active reminders for {raw_text.strip()}.")
        user_sessions[key] = {"step": "staff_menu", "clinic_id": clinic["phone_number_id"], "phone": phone, "is_staff": True}
        _show_staff_panel(clinic, phone)
        return True

    if step == "staff_name":
        patient_name = raw_text.strip()
        if len(patient_name) < 2:
            send_text(clinic, phone, "Enter a valid patient name")
            return True
        user_sessions[key] = {
            "step": "staff_age",
            "clinic_id": clinic["phone_number_id"],
            "phone": phone,
            "is_staff": True,
            "patient_name": patient_name,
        }
        send_text(clinic, phone, "Enter patient age")
        return True

    if step == "staff_age":
        patient_age = raw_text.strip()
        user_sessions[key] = {
            **session,
            "step": "staff_phone",
            "patient_age": patient_age,
        }
        send_text(clinic, phone, "Enter patient phone number")
        return True

    if step == "staff_phone":
        patient_phone = _normalize_phone(raw_text)
        if len(patient_phone) < 10:
            send_text(clinic, phone, "Enter a valid phone number")
            return True
        user_sessions[key] = {
            **session,
            "step": "staff_medicines",
            "patient_phone": patient_phone,
            "medicines": [],
        }
        send_text(clinic, phone, "Enter medicine name (type DONE when finished)")
        return True

    if step == "staff_medicines":
        if text == "done":
            medicines = session.get("medicines", [])
            if not medicines:
                send_text(clinic, phone, "Add at least one medicine before DONE")
                return True
            user_sessions[key] = {**session, "step": "staff_frequency"}
            send_buttons(
                clinic,
                phone,
                "How many times per day?",
                [
                    {"id": "freq_1", "title": "Once"},
                    {"id": "freq_2", "title": "Twice"},
                    {"id": "freq_3", "title": "Thrice"},
                ],
            )
            return True

        medicine = raw_text.strip()
        if not medicine:
            send_text(clinic, phone, "Enter medicine name or DONE")
            return True
        medicines = session.get("medicines", []) + [medicine]
        user_sessions[key] = {**session, "medicines": medicines}
        send_text(clinic, phone, f"Added: {medicine}\nEnter next medicine or DONE")
        return True

    if step == "staff_frequency" and text.startswith("freq_"):
        choice = text.replace("freq_", "", 1)
        details = _staff_frequency_details(choice)
        if not details:
            send_text(clinic, phone, "Choose a valid frequency option")
            return True
        frequency_label, reminder_times = details
        user_sessions[key] = {
            **session,
            "step": "staff_schedule_type",
            "frequency_label": frequency_label,
            "reminder_times": reminder_times,
        }
        send_buttons(
            clinic,
            phone,
            "How long should reminders continue?",
            [
                {"id": "sched_duration", "title": "Duration days"},
                {"id": "sched_custom", "title": "Custom dates"},
            ],
        )
        return True

    if step == "staff_schedule_type" and text in {"sched_duration", "sched_custom"}:
        if text == "sched_duration":
            user_sessions[key] = {**session, "step": "staff_duration_days"}
            send_text(clinic, phone, "Enter number of days (example: 5)")
            return True
        user_sessions[key] = {**session, "step": "staff_custom_start"}
        send_text(clinic, phone, "Enter start date (DD-MM)")
        return True

    if step == "staff_duration_days":
        try:
            days = int(raw_text.strip())
            if days < 1:
                raise ValueError
        except ValueError:
            send_text(clinic, phone, "Enter a valid number of days")
            return True
        now = get_now()
        start_date = now
        end_date = start_date + timedelta(days=days - 1)
        user_sessions[key] = {
            **session,
            "step": "staff_tests_choice",
            "start_date": start_date.strftime("%d-%m-%Y"),
            "end_date": end_date.strftime("%d-%m-%Y"),
        }
        send_buttons(clinic, phone, "Any medical tests prescribed?", [{"id": "tests_yes", "title": "Yes"}, {"id": "tests_skip", "title": "Skip"}])
        return True

    if step == "staff_custom_start":
        try:
            start_date = _parse_dd_mm(raw_text)
        except ValueError:
            send_text(clinic, phone, "Invalid date. Enter start date as DD-MM")
            return True
        user_sessions[key] = {**session, "step": "staff_custom_end", "start_date": start_date.strftime("%d-%m-%Y")}
        send_text(clinic, phone, "Enter end date (DD-MM)")
        return True

    if step == "staff_custom_end":
        try:
            end_date = _parse_dd_mm(raw_text)
        except ValueError:
            send_text(clinic, phone, "Invalid date. Enter end date as DD-MM")
            return True
        start_date = datetime.strptime(session.get("start_date"), "%d-%m-%Y")
        if end_date < start_date:
            send_text(clinic, phone, "End date cannot be before start date")
            return True
        user_sessions[key] = {**session, "step": "staff_tests_choice", "end_date": end_date.strftime("%d-%m-%Y")}
        send_buttons(clinic, phone, "Any medical tests prescribed?", [{"id": "tests_yes", "title": "Yes"}, {"id": "tests_skip", "title": "Skip"}])
        return True

    if step == "staff_tests_choice" and text in {"tests_yes", "tests_skip"}:
        if text == "tests_skip":
            next_session = {**session, "tests": [], "step": "staff_confirm"}
            user_sessions[key] = next_session
            send_buttons(clinic, phone, _staff_summary(next_session), [{"id": "staff_confirm", "title": "Confirm"}, {"id": "staff_edit", "title": "Edit"}])
            return True
        user_sessions[key] = {**session, "step": "staff_tests_input", "tests": []}
        send_text(clinic, phone, "Enter test name (type DONE when finished)")
        return True

    if step == "staff_tests_input":
        if text == "done":
            next_session = {**session, "step": "staff_confirm"}
            user_sessions[key] = next_session
            send_buttons(clinic, phone, _staff_summary(next_session), [{"id": "staff_confirm", "title": "Confirm"}, {"id": "staff_edit", "title": "Edit"}])
            return True
        test_name = raw_text.strip()
        if not test_name:
            send_text(clinic, phone, "Enter test name or DONE")
            return True
        tests = session.get("tests", []) + [test_name]
        user_sessions[key] = {**session, "tests": tests}
        send_text(clinic, phone, f"Added test: {test_name}\nEnter next test or DONE")
        return True

    if step == "staff_confirm" and text in {"staff_confirm", "staff_edit"}:
        if text == "staff_edit":
            user_sessions[key] = {"step": "staff_name", "clinic_id": clinic["phone_number_id"], "phone": phone, "is_staff": True}
            send_text(clinic, phone, "Enter patient name")
            return True

        _save_staff_reminder(clinic, session)
        message = (
            "Reminder Scheduled Successfully\n\n"
            "The patient will receive reminders automatically."
        )
        send_text(clinic, phone, message)
        user_sessions[key] = {"step": "staff_menu", "clinic_id": clinic["phone_number_id"], "phone": phone, "is_staff": True}
        _show_staff_panel(clinic, phone)
        return True

    if step.startswith("staff_"):
        send_text(clinic, phone, "Continue with the current step or type staff to restart Staff Panel.")
        return True

    return False


def _parse_booking_datetimes(date_value, selected_time):
    # date_value is now DD-MM-YYYY
    start = datetime.strptime(f"{date_value} {selected_time}", "%d-%m-%Y %I:%M %p")
    end = start + timedelta(minutes=30)
    return start.isoformat(), end.isoformat()


def _get_queue_status_info(clinic, phone):
    """Calculate queue position and now-serving info from GSheet"""
    try:
        sheet = open_sheet(clinic.get("sheet_name"), clinic.get("sheet_id"))
        records = sheet.get_all_records()
        now = get_now()
        today = now.strftime("%d-%m-%Y")
        normalized_phone = _normalize_phone(phone)
        
        # Find patient's active booking for today
        patient_booking = None
        for r in reversed(records):
            if str(r.get("Date")) == today and _normalize_phone(r.get("Phone")) == normalized_phone:
                if r.get("Status") not in ["Cancelled", "Completed"]:
                    patient_booking = r
                    break
        
        if not patient_booking:
            return "No active appointments found for today."
            
        doctor = patient_booking.get("Doctor")
        patient_token = patient_booking.get("Token")
        
        # Filter all bookings for this doctor today
        today_queue = []
        for r in records:
            if str(r.get("Date")) == today and r.get("Doctor") == doctor:
                today_queue.append(r)
        
        # Find currently serving
        serving_token = "Not started"
        serving_idx = -1
        
        # Sort queue by Booked At or Token if possible (assuming sequential entry)
        # For simplicity, we use the order in sheet
        for idx, r in enumerate(today_queue):
            if r.get("Status") == "Serving":
                serving_token = r.get("Token")
                serving_idx = idx
            elif r.get("Status") == "Completed":
                serving_idx = idx
        
        # Find patient position
        patient_idx = -1
        for idx, r in enumerate(today_queue):
            if r.get("Token") == patient_token:
                patient_idx = idx
                break
        
        if patient_idx == -1:
            return f"Your appointment (Token: {patient_token}) was not found in the active queue."
            
        ahead = max(0, patient_idx - serving_idx - 1)
        
        status_msg = (
            f"🏥 *{clinic.get('name')} Queue*\n\n"
            f"Doctor: {doctor}\n"
            f"Your Token: *{patient_token}*\n"
            f"Now Serving: *{serving_token}*\n"
            f"Patients Ahead: {ahead}\n\n"
            f"⏳ Estimated wait: {ahead * 15} mins"
        )
        return status_msg
    except Exception as e:
        logger.error(f"Error getting queue status: {e}")
        return "Sorry, I couldn't retrieve the queue status right now."


def handle_message(clinic, message):
    clinic_id = clinic["phone_number_id"]
    phone = message.get("from")
    raw_text, text = _extract_text(message)
    if not phone:
        return

    key = _session_key(clinic_id, phone)
    session = user_sessions.get(key, {"step": "main_menu", "clinic_id": clinic_id, "phone": phone})
    step = session.get("step", "main_menu")
    logger.info("Handling message clinic_id=%s from=%s type=%s step=%s text=%s", clinic_id, phone, message.get("type"), step, text)

    if _is_staff_sender(clinic, phone):
        if _handle_staff_flow(clinic, phone, text, raw_text, key, session):
            return
    
    if text == "status":
        status_msg = _get_queue_status_info(clinic, phone)
        send_text(clinic, phone, status_msg)
        return

    if text == "med_confirm":
        send_text(clinic, phone, "✅ Thank you for confirming! Your reminders are active.")
        return
    
    if text in {"med_taken", "1"}:
        send_text(clinic, phone, "✅ Great! Medicine taken. We will remind you for the next dose.")
        return

    if text in {"med_skip", "2"}:
        send_text(clinic, phone, "⏭️ Medicine skipped. Please try to take it on time if possible. We will remind you for the next dose.")
        return

    if text == "med_cancel":
        count = _cancel_staff_reminders(clinic, phone)
        send_text(clinic, phone, f"❌ Your medicine reminders have been cancelled as requested ({count} removed).")
        return

    if text == "med_modify":
        send_text(clinic, phone, "🕒 To modify times, please reply 'reminders' and select 'View Active'. (Modification feature is being updated, please contact clinic for urgent changes.)")
        return

    if text == "reminders" or step.startswith("patient_rem_"):
        if _handle_patient_reminder_flow(clinic, phone, text, raw_text, key, session):
            return

    if text in {"hi", "hello", "start", "menu"}:
        user_sessions[key] = {"step": "main_menu", "clinic_id": clinic_id, "phone": phone}
        _show_main_menu(clinic, phone)
        return

    if text in {"new", "book"} and step in {"main_menu", "main"}:
        doctors = clinic.get("doctors", [])
        if not doctors:
            send_text(clinic, phone, "No doctors are configured yet. Please contact the clinic.")
            return
        user_sessions[key] = {
            "step": "select_doctor",
            "clinic_id": clinic_id,
            "phone": phone,
            "doctors": doctors,
        }
        _show_doctors(clinic, phone, doctors)
        return

    if text == "help":
        send_text(clinic, phone, "Reply Hi to start. Choose Book to create an appointment.")
        return

    if text in {"cancel", "reschedule"}:
        user_sessions[key] = {"step": "main_menu", "clinic_id": clinic_id, "phone": phone}
        send_text(clinic, phone, f"Please contact {_clinic_name(clinic)} to cancel or reschedule: {clinic.get('phone', 'N/A')}")
        return

    if step == "select_doctor" and text.startswith("doc_"):
        try:
            doctor_index = int(text.replace("doc_", "", 1))
            selected = session.get("doctors", [])[doctor_index]
        except (ValueError, IndexError):
            selected = None
        if not selected:
            send_text(clinic, phone, "Invalid doctor selection. Reply Hi to start again.")
            return

        user_sessions[key] = {
            "step": "enter_name",
            "clinic_id": clinic_id,
            "phone": phone,
            "doctor": selected,
        }
        send_text(clinic, phone, "Please enter your full name.")
        return

    if step == "enter_name":
        name = raw_text.strip()
        if len(name) < 2:
            send_text(clinic, phone, "Please enter a valid name with at least 2 characters.")
            return

        user_sessions[key] = {
            "step": "enter_age",
            "clinic_id": clinic_id,
            "phone": phone,
            "doctor": session.get("doctor"),
            "name": name,
        }
        send_text(clinic, phone, "Please enter your age.")
        return

    if step == "enter_age":
        age = raw_text.strip()
        doctor = session.get("doctor")
        dates = _date_options(doctor)
        user_sessions[key] = {
            "step": "select_date",
            "clinic_id": clinic_id,
            "phone": phone,
            "doctor": doctor,
            "name": session.get("name"),
            "age": age,
            "dates": dates,
        }
        send_list(clinic, phone, "Select a date", [{"title": "Available dates", "rows": _date_rows(dates)}])
        return

    if step == "select_date" and text.startswith("date_"):
        try:
            date_index = int(text.replace("date_", "", 1))
            selected_date = session["dates"][date_index]
        except (ValueError, IndexError, KeyError):
            send_text(clinic, phone, "Invalid date selection. Reply Hi to start again.")
            return

        doctor = session.get("doctor", {})
        slots = doctor.get("slots") or clinic.get("default_slots") or ["10:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"]
        user_sessions[key] = {
            "step": "select_slot",
            "clinic_id": clinic_id,
            "phone": phone,
            "doctor": doctor,
            "name": session.get("name"),
            "age": session.get("age"),
            "date_value": selected_date["value"],
            "date_display": selected_date["display"],
            "slots": slots,
        }
        send_list(clinic, phone, f"Select time for {selected_date['display']}", [{"title": "Time slots", "rows": _slot_rows(slots)}])
        return

    if step == "select_slot":
        if text.startswith("slots_next_") or text.startswith("slots_prev_"):
            try:
                offset = int(text.split("_")[-1])
                slots = session.get("slots", [])
                send_list(clinic, phone, f"Select time for {session.get('date_display')}", [{"title": "Time slots", "rows": _slot_rows(slots, offset)}])
            except (ValueError, IndexError):
                send_text(clinic, phone, "Error navigating slots. Reply Hi to start again.")
            return

        if text.startswith("slot_"):
            try:
                slot_index = int(text.replace("slot_", "", 1))
                selected_time = session["slots"][slot_index]
            except (ValueError, IndexError, KeyError):
                send_text(clinic, phone, "Invalid time selection. Reply Hi to start again.")
                return

        user_sessions[key] = {
            **session,
            "step": "confirm",
            "selected_time": selected_time,
        }
        doctor = session.get("doctor", {})
        full_name = f"{session.get('name')} ({session.get('age')})"
        send_buttons(
            clinic,
            phone,
            (
                "Confirm your appointment\n\n"
                f"Name: {full_name}\n"
                f"Doctor: {doctor.get('name')}\n"
                f"Date: {session.get('date_display')}\n"
                f"Time: {selected_time}"
            ),
            [
                {"id": "confirm", "title": "Confirm"},
                {"id": "change", "title": "Change"},
            ],
        )
        return

    if step == "confirm" and text == "change":
        doctor = session.get("doctor")
        dates = _date_options(doctor)
        user_sessions[key] = {
            **session,
            "step": "select_date",
            "dates": dates,
        }
        send_list(clinic, phone, "Select a new date", [{"title": "Available dates", "rows": _date_rows(dates)}])
        return

    if step == "confirm" and text == "confirm":
        doctor = session.get("doctor", {})
        date_val = session.get("date_value")
        token = get_next_token_from_sheet(clinic, date_val, doctor.get("name"))
        now = get_now()
        booked_at = now.strftime("%d-%m-%Y %H:%M")
        full_name = f"{session.get('name')} ({session.get('age')})"

        try:
            append_booking(
                clinic,
                [
                    full_name,
                    phone,
                    date_val,
                    session.get("selected_time"),
                    doctor.get("name"),
                    doctor.get("specialty"),
                    token,
                    "Pending",
                    booked_at,
                ],
            )
        except Exception as exc:
            logger.exception("Sheet save failed for clinic %s: %s", clinic_id, exc)
            send_text(clinic, phone, "Sorry, I could not save this booking right now. Please try again later.")
            return

        try:
            start_datetime, end_datetime = _parse_booking_datetimes(date_val, session.get("selected_time"))
            create_calendar_event(
                clinic,
                {
                    "patient_name": full_name,
                    "phone": phone,
                    "doctor_name": doctor.get("name"),
                    "doctor_calendar_id": doctor.get("google_calendar_id"),
                    "token": token,
                    "start_datetime": start_datetime,
                    "end_datetime": end_datetime,
                },
            )
        except Exception as exc:
            print(f"Calendar event skipped for clinic {clinic_id}: {exc}")

        user_sessions.pop(key, None)
        send_buttons(
            clinic,
            phone,
            (
                "✅ Booking confirmed!\n\n"
                f"📅 Date: {session.get('date_display')}\n"
                f"🎫 Token: *{token}*\n"
                f"👨‍⚕️ Doctor: {doctor.get('name')}\n"
                f"🕐 Time: {session.get('selected_time')}\n\n"
                "You can reply 'status' anytime to check your queue position.\n"
                "Please arrive 15 minutes early."
            ),
            [
                {"id": "status", "title": "Check Queue 📍"},
                {"id": "new", "title": "New booking"},
                {"id": "cancel", "title": "Cancel"},
            ],
        )
        return

    guidance = {
        "select_doctor": "Please select a doctor from the list. Reply Hi to start again.",
        "enter_name": "Please enter your full name. Reply Hi to start again.",
        "select_date": "Please select a date from the list. Reply Hi to start again.",
        "select_slot": "Please select a time slot from the list. Reply Hi to start again.",
        "confirm": "Please confirm or change your appointment. Reply Hi to start again.",
    }
    if step in guidance:
        send_text(clinic, phone, guidance[step])
    else:
        user_sessions[key] = {"step": "main_menu", "clinic_id": clinic_id, "phone": phone}
        _show_main_menu(clinic, phone)
