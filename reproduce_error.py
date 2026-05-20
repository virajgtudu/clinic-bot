import logging
import os
from dotenv import load_dotenv
from scheduler import send_medicine_reminders, send_test_reminders, send_appointment_reminders
from config import get_now

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

def run_scheduled_tasks():
    """Wrapper to run all scheduled tasks"""
    now = get_now()
    logging.info(f"⏰ Running scheduled tasks pulse... (IST: {now.strftime('%H:%M')})")
    try:
        logging.info("Checking medicine reminders...")
        send_medicine_reminders()
        
        logging.info("Checking test reminders...")
        send_test_reminders()
    except Exception as e:
        import traceback
        logging.error(f"Error in scheduled tasks: {e}\n{traceback.format_exc()}")

if __name__ == "__main__":
    run_scheduled_tasks()
