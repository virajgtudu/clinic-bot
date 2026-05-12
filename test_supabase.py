import os
from dotenv import load_dotenv
load_dotenv()  # Load variables before importing services.database

from services.database import get_db, create_appointment, get_queue_status
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_connection():
    print("--- Supabase Connection Test ---")
    
    # 1. Check if client initializes
    db = get_db()
    if not db:
        print("❌ Failed to initialize Supabase client. Check your .env file.")
        return

    print("✅ Supabase client initialized.")

    # 2. Test create_appointment (RPC call)
    test_data = {
        "clinic_id": "TEST_CLINIC",
        "doctor_id": "DR_TEST",
        "name": "Test Patient",
        "phone": "1234567890",
        "booking_date": "2026-05-12",
        "time": "10:00 AM",
        "source": "whatsapp"
    }
    
    print(f"\nAttempting to create test appointment for {test_data['name']}...")
    token = create_appointment(test_data)
    
    if token:
        print(f"✅ Success! Token generated: {token}")
    else:
        print("❌ Failed to create appointment. Ensure you ran the SQL script in Supabase SQL Editor.")
        return

    # 3. Test get_queue_status
    print("\nFetching queue status for today...")
    queue = get_queue_status("TEST_CLINIC", "DR_TEST", "2026-05-12")
    
    if queue:
        print(f"✅ Success! Found {len(queue)} appointments in queue.")
        for appt in queue:
            print(f"   - Token {appt['token']}: {appt['patient_name']} ({appt['status']})")
    else:
        print("❌ Failed to fetch queue status.")

if __name__ == "__main__":
    test_connection()
