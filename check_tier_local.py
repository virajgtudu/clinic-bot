import os
from dotenv import load_dotenv
load_dotenv()
from services.database import get_db

db = get_db()
if db:
    res = db.table("clinics").select("*").execute()
    print("CLINICS IN DATABASE:")
    for row in res.data:
        print(f"ID: {row.get('id')}, Name: {row.get('name')}, Tier: {row.get('tier')}, Subscription: {row.get('subscription_status')}")
else:
    print("Could not initialize Supabase db client.")
