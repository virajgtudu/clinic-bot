-- ULTIMATE MIGRATION: Advanced Patient Tracking & Chronological Tokening

-- 0. Add custom branding support to the clinics table
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS branding_json JSONB DEFAULT '{
  "logo_url": "",
  "primary_color": "#0ea5e9",
  "signature": "",
  "marquee_text": ""
}';

-- Add subscription tier column (Essential vs Professional package)
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Essential';

-- 1. Create a sequence for Patient IDs
CREATE SEQUENCE IF NOT EXISTS patient_id_seq START WITH 1001;

-- 2. Create the Patients table (Long-term records)
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id TEXT NOT NULL,
  patient_id_serial TEXT UNIQUE, -- e.g., PID-1001
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(clinic_id, name, phone, age)
);

-- 3. Standardize Appointments Table Structure
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES patients(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS age INTEGER;

-- 4. CLEAN UP EXISTING BAD DATA
-- This fixes the root cause: existing "13:45 PM" values crash the system during comparisons
UPDATE appointments 
SET booking_time = (REGEXP_MATCH(booking_time, '(\d{1,2}:\d{2})'))[1]
WHERE booking_time ~ '(\d{1,2}:\d{2})';

-- 5. Enable Realtime Replication
-- If this fails, it means it's already enabled (ignore error)
DO $$ 
BEGIN
  ALTER publication supabase_realtime ADD TABLE appointments;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 6. Atomic Token Generation & Patient Matching Function
CREATE OR REPLACE FUNCTION create_appointment(
  p_clinic_id TEXT,
  p_doctor_id TEXT,
  p_name TEXT,
  p_phone TEXT,
  p_age INTEGER,
  p_date DATE,
  p_time TEXT,
  p_source TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient_id uuid;
  v_patient_id_serial TEXT;
  v_token INTEGER;
  v_appt_id uuid;
  v_time_scrubbed TEXT;
  v_time_sortable TIME;
BEGIN
  -- A. SCRUB THE INPUT TIME
  v_time_scrubbed := (REGEXP_MATCH(p_time, '(\d{1,2}:\d{2})'))[1];
  IF v_time_scrubbed IS NULL THEN v_time_scrubbed := '09:00'; END IF;
  
  -- Pad single digit hours (e.g. "9:30" -> "09:30")
  IF LENGTH(v_time_scrubbed) = 4 THEN v_time_scrubbed := '0' || v_time_scrubbed; END IF;
  
  v_time_sortable := CAST(v_time_scrubbed AS TIME);

  -- B. Find or Create Patient
  SELECT id, patient_id_serial INTO v_patient_id, v_patient_id_serial
  FROM patients 
  WHERE clinic_id = p_clinic_id AND name = p_name AND phone = p_phone AND age = p_age;

  IF v_patient_id IS NULL THEN
    v_patient_id_serial := 'PID-' || nextval('patient_id_seq');
    INSERT INTO patients (clinic_id, patient_id_serial, name, phone, age)
    VALUES (p_clinic_id, v_patient_id_serial, p_name, p_phone, p_age)
    RETURNING id INTO v_patient_id;
  END IF;

  -- C. Generate Token (Unified Absolute Chronological Order)
  -- 1. Insert the appointment first with a temporary NULL/0 token
  INSERT INTO appointments (
    clinic_id, doctor_id, patient_id, patient_name, phone, age,
    booking_date, booking_time, source, token, status
  )
  VALUES (
    p_clinic_id, p_doctor_id, v_patient_id, p_name, p_phone, p_age,
    p_date, v_time_scrubbed, p_source, 0, 'Pending'
  )
  RETURNING id INTO v_appt_id;

  -- 2. RE-SEQUENCE ALL TOKENS for this doctor and date
  -- This is the "Gold Standard": It re-orders EVERYONE by time, then by booking order.
  -- This ensures the list is ALWAYS 1, 2, 3... in perfect chronological order.
  WITH reordered_queue AS (
    SELECT 
      id, 
      ROW_NUMBER() OVER (
        ORDER BY 
          CAST(booking_time AS TIME) ASC, 
          created_at ASC
      ) as new_token
    FROM appointments
    WHERE clinic_id = p_clinic_id 
      AND doctor_id = p_doctor_id 
      AND booking_date = p_date
  )
  UPDATE appointments a
  SET token = rq.new_token
  FROM reordered_queue rq
  WHERE a.id = rq.id;

  -- 3. Get the final token assigned to our new appointment
  SELECT token INTO v_token FROM appointments WHERE id = v_appt_id;

  RETURN jsonb_build_object('appointment_id', v_appt_id, 'token', v_token, 'patient_id', v_patient_id_serial);
END;
$$;

-- 7. Enable RLS on Patients
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clinic staff can manage their patients" ON patients;
CREATE POLICY "Clinic staff can manage their patients"
ON patients FOR ALL TO authenticated
USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

-- 8. Trigger for Notifications
CREATE OR REPLACE FUNCTION notify_next_patient()
RETURNS trigger AS $$
DECLARE
  next_patient RECORD;
  clinic_url TEXT := 'https://clinicassist-qu4i.onrender.com/webhook/notify-next'; 
  has_net_extension BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') INTO has_net_extension;

  IF (TG_OP = 'UPDATE' AND NEW.status = 'Serving' AND OLD.status != 'Serving') THEN
    SELECT a.phone, a.patient_name, a.doctor_id, a.token, a.clinic_id
    INTO next_patient
    FROM appointments a
    WHERE a.clinic_id = NEW.clinic_id AND a.doctor_id = NEW.doctor_id AND a.booking_date = NEW.booking_date
      AND a.status = 'Pending' AND a.token > NEW.token
    ORDER BY a.token ASC LIMIT 1;

    IF FOUND AND next_patient.phone != 'walk-in' AND has_net_extension THEN
      PERFORM net.http_post(
        url := clinic_url,
        body := jsonb_build_object('phone', next_patient.phone, 'patient_name', next_patient.patient_name, 'doctor_id', next_patient.doctor_id, 'token', next_patient.token, 'clinic_id', next_patient.clinic_id),
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.source = 'walkin' AND NEW.phone != 'walk-in' AND has_net_extension) THEN
      PERFORM net.http_post(
        url := clinic_url || '/confirm-walkin',
        body := jsonb_build_object('phone', NEW.phone, 'patient_name', NEW.patient_name, 'doctor_id', NEW.doctor_id, 'token', NEW.token, 'clinic_id', NEW.clinic_id),
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_appointment_serving ON appointments;
CREATE TRIGGER on_appointment_serving
  AFTER INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_next_patient();
