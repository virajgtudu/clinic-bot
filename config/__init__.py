import json
import os
import logging
from pathlib import Path
from datetime import datetime
import pytz

CONFIG_DIR = Path(__file__).parent
PROJECT_ROOT = CONFIG_DIR.parent
CONFIG_FILE = CONFIG_DIR / "clinics.json"
USERS_FILE = Path(os.getenv("CLINIC_USERS_FILE", PROJECT_ROOT / "users.json"))
STATE_FILE = CONFIG_DIR / "state.json"

def get_now():
    """Get current time in IST (naive for compatibility)"""
    ist = pytz.timezone("Asia/Kolkata")
    return datetime.now(ist).replace(tzinfo=None)

def _clean_json_env(data):
    """Helper to handle common copy-paste artifacts like extra quotes"""
    if not data: return data
    data = data.strip()
    if data.startswith('"') and data.endswith('"'):
        data = data[1:-1].strip()
    return data

# User management functions
def load_users():
    # Priority 1: Environment Variable (Cloud)
    env_data = _clean_json_env(os.getenv("CLINIC_USERS_DATA"))
    if env_data:
        try:
            data = json.loads(env_data)
            logging.info(f"Loaded users from CLINIC_USERS_DATA env var. Found {len(data)} users.")
            return data
        except Exception as e:
            logging.error(f"Failed to parse CLINIC_USERS_DATA env var: {e}")

    if not USERS_FILE.exists():
        logging.warning(f"Users file not found: {USERS_FILE}")
        return {}
    
    try:
        with open(USERS_FILE, "r") as f:
            data = json.load(f)
            logging.info(f"Loaded users from local file: {USERS_FILE}")
            return data
    except Exception as e:
        logging.error(f"Failed to read local users file: {e}")
        return {}

def save_users(users):
    if not os.getenv("CLINIC_USERS_DATA"):
        USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(USERS_FILE, "w") as f:
            json.dump(users, f, indent=2)

def verify_user(email, password):
    users = load_users()
    user = users.get(email)
    if user and user.get("password") == password:
        return user
    return None

def add_user(email, password, role="clinic", clinic_phone_id=None):
    users = load_users()
    users[email] = {
        "password": password,
        "role": role,
        "clinic_phone_id": clinic_phone_id
    }
    save_users(users)
    return True

def update_password(email, new_password):
    users = load_users()
    if email in users:
        users[email]["password"] = new_password
        save_users(users)
        return True
    return False

def delete_user(email):
    users = load_users()
    if email in users:
        del users[email]
        save_users(users)
        return True
    return False

def get_user(email):
    users = load_users()
    return users.get(email)

def load_config():
    """Load clinic configurations from Env or JSON file"""
    # Priority 1: Environment Variable (Cloud)
    env_data = _clean_json_env(os.getenv("CLINIC_CONFIG_DATA"))
    if env_data:
        try:
            data = json.loads(env_data)
            logging.info(f"Loaded config from CLINIC_CONFIG_DATA env var. Found {len(data)} clinics.")
            return data
        except Exception as e:
            logging.error(f"Failed to parse CLINIC_CONFIG_DATA env var: {e}")
            logging.error(f"Env data start: {env_data[:50]}...")

    # Priority 2: Local File
    if not CONFIG_FILE.exists():
        logging.warning(f"Config file not found: {CONFIG_FILE}")
        return {}
    
    try:
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
            logging.info(f"Loaded config from local file: {CONFIG_FILE}")
            return data
    except Exception as e:
        logging.error(f"Failed to read local config file: {e}")
        return {}

def save_config(config):
    """Save clinic configurations to JSON file"""
    if not os.getenv("CLINIC_CONFIG_DATA"):
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)

def get_all_clinics():
    """Get list of all clinics, merging with Supabase table data if available"""
    config = load_config()
    supabase_clinics = {}
    supabase_emails = {}
    try:
        from services.database import get_db
        db = get_db()
        if db:
            # 1. Fetch clinics
            res = db.table("clinics").select("*").execute()
            if res.data:
                for row in res.data:
                    supabase_clinics[str(row["id"])] = row

            # 2. Fetch profiles and map user emails
            profiles_res = db.table("profiles").select("id, clinic_id").execute()
            if profiles_res.data:
                auth_users = db.auth.admin.list_users()
                user_emails = {u.id: u.email for u in auth_users}
                for prof in profiles_res.data:
                    c_id = str(prof.get("clinic_id"))
                    p_id = prof.get("id")
                    email = user_emails.get(p_id)
                    if email and c_id:
                        if c_id not in supabase_emails:
                            supabase_emails[c_id] = []
                        supabase_emails[c_id].append(email)
    except Exception as e:
        logging.debug(f"Failed to fetch clinics or profiles from Supabase: {e}")

    # Synchronize: If a clinic is in Supabase but not in config, add it!
    config_changed = False
    for phone_id_str, db_clinic in supabase_clinics.items():
        if phone_id_str not in config:
            c_name = db_clinic.get("name") or "New Clinic"
            config[phone_id_str] = {
                "name": c_name,
                "phone": db_clinic.get("phone", ""),
                "address": db_clinic.get("address", ""),
                "webhook_verify_token": f"clinic_bot_{datetime.now().strftime('%Y%m%d')}",
                "subscription_status": db_clinic.get("subscription_status") or "trial",
                "monthly_fee": db_clinic.get("monthly_fee") or 1500,
                "tier": db_clinic.get("tier") or "Essential",
                "created_date": datetime.now().strftime("%Y-%m-%d"),
                "expiry_date": f"{datetime.now().year}-12-31",
                "doctors": [],
                "sheet_name": f"{c_name.lower().replace(' ', '_')}_bookings",
                "medicines_sheet": f"{c_name.lower().replace(' ', '_')}_medicines",
                "whatsapp_token_env": f"WHATSAPP_TOKEN_{phone_id_str}",
                "phone_number_id": phone_id_str
            }
            config_changed = True
            logging.info(f"Auto-imported clinic '{c_name}' ({phone_id_str}) from Supabase to local config.")

    if config_changed:
        save_config(config)

    clinics = []
    for phone_number_id, clinic in config.items():
        item = dict(clinic)
        phone_id_str = str(phone_number_id)
        item.setdefault("id", phone_id_str)
        item.setdefault("phone_number_id", phone_id_str)
        
        # Merge Supabase data if available
        db_clinic = supabase_clinics.get(phone_id_str)
        if db_clinic:
            item["tier"] = db_clinic.get("tier") or item.get("tier", "Essential")
            item["branding_json"] = db_clinic.get("branding_json") or item.get("branding_json")
            if "name" in db_clinic and db_clinic["name"]:
                item["name"] = db_clinic["name"]
        else:
            item.setdefault("tier", "Essential")
            
        # Add associated admin emails
        item["emails"] = supabase_emails.get(phone_id_str, [])
        clinics.append(item)
    return clinics

def get_clinic_by_phone_id(phone_number_id):
    """Get clinic by phone_number_id (primary key)"""
    config = load_config()
    lookup_key = str(phone_number_id)
    clinic = config.get(lookup_key)
    
    if not clinic:
        # Check if it exists in Supabase
        try:
            from services.database import get_db
            db = get_db()
            if db:
                res = db.table("clinics").select("*").eq("id", lookup_key).maybeSingle().execute()
                if res.data:
                    c_name = res.data.get("name") or "New Clinic"
                    new_clinic = {
                        "name": c_name,
                        "phone": res.data.get("phone", ""),
                        "address": res.data.get("address", ""),
                        "webhook_verify_token": f"clinic_bot_{datetime.now().strftime('%Y%m%d')}",
                        "subscription_status": res.data.get("subscription_status") or "trial",
                        "monthly_fee": res.data.get("monthly_fee") or 1500,
                        "tier": res.data.get("tier") or "Essential",
                        "created_date": datetime.now().strftime("%Y-%m-%d"),
                        "expiry_date": f"{datetime.now().year}-12-31",
                        "doctors": [],
                        "sheet_name": f"{c_name.lower().replace(' ', '_')}_bookings",
                        "medicines_sheet": f"{c_name.lower().replace(' ', '_')}_medicines",
                        "whatsapp_token_env": f"WHATSAPP_TOKEN_{lookup_key}",
                        "phone_number_id": lookup_key
                    }
                    config[lookup_key] = new_clinic
                    save_config(config)
                    logging.info(f"Auto-imported clinic '{c_name}' ({lookup_key}) on-demand from Supabase.")
                    clinic = new_clinic
        except Exception as e:
            logging.debug(f"Failed to fetch and import single clinic from Supabase: {e}")

    if not clinic:
        logging.warning(f"Clinic lookup failed for ID: '{lookup_key}'")
        logging.info(f"Available keys in config: {list(config.keys())}")
        return None
        
    item = dict(clinic)
    item.setdefault("id", lookup_key)
    item.setdefault("phone_number_id", lookup_key)
    
    # Merge Supabase data if available
    try:
        from services.database import get_db
        db = get_db()
        if db:
            res = db.table("clinics").select("*").eq("id", lookup_key).maybeSingle().execute()
            if res.data:
                item["tier"] = res.data.get("tier") or item.get("tier", "Essential")
                item["branding_json"] = res.data.get("branding_json") or item.get("branding_json")
                if res.data.get("name"):
                    item["name"] = res.data["name"]
    except Exception as e:
        logging.debug(f"Failed to fetch single clinic from Supabase: {e}")
        
    item.setdefault("tier", "Essential")
    return item

def get_clinic(clinic_id):
    """Get clinic by phone_number_id (alias)"""
    return get_clinic_by_phone_id(clinic_id)

def get_current_clinic():
    """Get first clinic as default (for backward compatibility)"""
    config = load_config()
    if STATE_FILE.exists():
        with open(STATE_FILE, "r") as f:
            state = json.load(f)
        clinic_id = state.get("current_clinic_id")
        if clinic_id and clinic_id in config:
            return get_clinic_by_phone_id(clinic_id)

    clinic_ids = list(config.keys())
    return get_clinic_by_phone_id(clinic_ids[0]) if clinic_ids else None

def set_current_clinic(clinic_id):
    """Set selected clinic for the legacy single-clinic dashboard."""
    if not get_clinic_by_phone_id(clinic_id):
        return False
    with open(STATE_FILE, "w") as f:
        json.dump({"current_clinic_id": str(clinic_id)}, f, indent=2)
    return True

def get_demo_mode():
    """Dashboard compatibility flag."""
    if not STATE_FILE.exists():
        return False
    with open(STATE_FILE, "r") as f:
        return bool(json.load(f).get("demo_mode", False))

def set_demo_mode(enabled):
    """Dashboard compatibility flag."""
    state = {}
    if STATE_FILE.exists():
        with open(STATE_FILE, "r") as f:
            state = json.load(f)
    state["demo_mode"] = bool(enabled)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)
    return True

def add_clinic(clinic_data):
    """Add a new clinic (phone_number_id is the key)"""
    config = load_config()
    phone_id = clinic_data.get("phone_number_id")
    if not phone_id:
        return None

    phone_id = str(phone_id)
    item = dict(clinic_data)
    item["phone_number_id"] = phone_id
    item.setdefault("sheet_name", f"{item.get('name', 'clinic').lower().replace(' ', '_')}_bookings")
    item.setdefault("medicines_sheet", f"{item.get('name', 'clinic').lower().replace(' ', '_')}_medicines")
    item.setdefault("tier", "Essential")
    config[phone_id] = item
    save_config(config)
    
    # Sync insert to Supabase if available
    try:
        from services.database import get_db
        db = get_db()
        if db:
            db.table("clinics").insert({
                "id": phone_id,
                "name": item.get("name", "New Clinic"),
                "tier": item.get("tier", "Essential"),
                "branding_json": item.get("branding_json", {
                    "logo_url": "",
                    "primary_color": "#0ea5e9",
                    "signature": "",
                    "marquee_text": ""
                })
            }).execute()
    except Exception as e:
        logging.error(f"Failed to sync new clinic to Supabase: {e}")

    return phone_id

def update_clinic(phone_number_id, updates):
    """Update clinic details"""
    config = load_config()
    phone_number_id = str(phone_number_id)
    if phone_number_id in config:
        config[phone_number_id].update(updates)
        config[phone_number_id]["phone_number_id"] = phone_number_id
        save_config(config)
        
        # Sync to Supabase table if available
        try:
            from services.database import get_db
            db = get_db()
            if db:
                db_updates = {}
                if "name" in updates:
                    db_updates["name"] = updates["name"]
                if "tier" in updates:
                    db_updates["tier"] = updates["tier"]
                if "branding_json" in updates:
                    db_updates["branding_json"] = updates["branding_json"]
                
                if db_updates:
                    db.table("clinics").update(db_updates).eq("id", phone_number_id).execute()
        except Exception as e:
            logging.error(f"Failed to sync clinic updates to Supabase: {e}")
            
        return True
    return False

def delete_clinic(phone_number_id):
    """Remove a clinic"""
    config = load_config()
    phone_number_id = str(phone_number_id)
    if phone_number_id in config:
        del config[phone_number_id]
        save_config(config)
        return True
    return False

def get_clinic_stats():
    """Get statistics for all clinics"""
    clinics = get_all_clinics()
    active = sum(1 for c in clinics if c.get("subscription_status") == "active")
    inactive = sum(1 for c in clinics if c.get("subscription_status") == "inactive")
    trial = sum(1 for c in clinics if c.get("subscription_status") == "trial")
    total_fee = sum(c.get("monthly_fee", 0) for c in clinics if c.get("subscription_status") == "active")
    
    return {
        "total": len(clinics),
        "active": active,
        "inactive": inactive,
        "trial": trial,
        "monthly_revenue": total_fee
    }
