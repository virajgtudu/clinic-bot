import logging
import os
import sys
from datetime import datetime

from flask import Flask, jsonify
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler

from routes.webhook import webhook_bp
from scheduler import send_medicine_reminders, send_test_reminders, send_appointment_reminders, send_followup_reminders
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

        logging.info("Checking follow-up reminders...")
        send_followup_reminders()
        
        # Appointment reminders run once a day at 18:00 (6 PM) IST
        if now.hour == 18:
            logging.info("Checking appointment reminders...")
            send_appointment_reminders()
    except Exception as e:
        import traceback
        logging.error(f"Error in scheduled tasks: {e}\n{traceback.format_exc()}")


def create_app():
    flask_app = Flask(__name__)
    flask_app.register_blueprint(webhook_bp)

    @flask_app.get("/")
    def health():
        return jsonify({"status": "ok", "service": "clinic-bot"})

    # Initialize Scheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=run_scheduled_tasks, trigger="interval", minutes=1)
    scheduler.start()
    logging.info("🚀 Background Scheduler Started")

    return flask_app


app = create_app()


def _running_under_streamlit():
    return any("streamlit" in module_name for module_name in sys.modules)


if __name__ == "__main__":
    if _running_under_streamlit():
        import streamlit as st

        st.error("This is the Flask backend entrypoint. Run the dashboard with: streamlit run dashboard.py")
        st.code("streamlit run dashboard.py", language="powershell")
        st.stop()

    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=False)
