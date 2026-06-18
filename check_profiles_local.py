import os
from dotenv import load_dotenv
load_dotenv()
from services.database import get_db

db = get_db()
if db:
    res = db.table("profiles").select("*").execute()
    print("PROFILES:")
    for row in res.data:
        print(row)
else:
    print("Could not initialize Supabase db client.")
