-- Migration: Advanced Patient Tracking & Notifications

-- 1. Create a sequence for Patient IDs if not already there
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
  UNIQUE(clinic_id, name, phone, age) -- Identification Rule
);

-- 3. Update Appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES patients(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS age INTEGER; -- Denormalized for convenience

-- 4. Update the Atomic Token Generation & Patient Matching Function
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
BEGIN
  -- 1. Find or Create Patient
  SELECT id, patient_id_serial INTO v_patient_id, v_patient_id_serial
  FROM patients 
  WHERE clinic_id = p_clinic_id 
    AND name = p_name 
    AND phone = p_phone 
    AND age = p_age;

  IF v_patient_id IS NULL THEN
    v_patient_id_serial := 'PID-' || nextval('patient_id_seq');
    INSERT INTO patients (clinic_id, patient_id_serial, name, phone, age)
    VALUES (p_clinic_id, v_patient_id_serial, p_name, p_phone, p_age)
    RETURNING id INTO v_patient_id;
  END IF;

  -- 2. Generate Token (sequential per doctor/date)
  SELECT COALESCE(MAX(token), 0) + 1 INTO v_token
  FROM appointments 
  WHERE clinic_id = p_clinic_id 
    AND doctor_id = p_doctor_id 
    AND booking_date = p_date;

  -- 3. Insert Appointment
  INSERT INTO appointments (
    clinic_id, doctor_id, patient_id, patient_name, phone, age,
    booking_date, booking_time, source, token, status
  )
  VALUES (
    p_clinic_id, p_doctor_id, v_patient_id, p_name, p_phone, p_age,
    p_date, p_time, p_source, v_token, 'Pending'
  )
  RETURNING id INTO v_appt_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appt_id,
    'token', v_token,
    'patient_id', v_patient_id_serial
  );
END;
$$;

-- Enable RLS on Patients
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Policy: Clinic staff can manage their own patients
DROP POLICY IF EXISTS "Clinic staff can manage their patients" ON patients;
CREATE POLICY "Clinic staff can manage their patients"
ON patients FOR ALL TO authenticated
USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

-- 5. Trigger for "Next in Queue" Notifications
-- Note: This requires the 'http' extension in Supabase to be enabled.
-- Run: CREATE EXTENSION IF NOT EXISTS http;

CREATE OR REPLACE FUNCTION notify_next_patient()
RETURNS trigger AS $$
DECLARE
  next_patient RECORD;
  -- IMPORTANT: Replace with your actual deployed Flask app URL or ngrok URL
  clinic_url TEXT := 'https://clinicassist-qu4i.onrender.com/webhook/notify-next'; 
BEGIN
  -- 1. Notify the NEXT patient when current one moves to 'Serving'
  IF (TG_OP = 'UPDATE' AND NEW.status = 'Serving' AND OLD.status != 'Serving') THEN
    SELECT a.phone, a.patient_name, a.doctor_id, a.token, a.clinic_id
    INTO next_patient
    FROM appointments a
    WHERE a.clinic_id = NEW.clinic_id
      AND a.doctor_id = NEW.doctor_id
      AND a.booking_date = NEW.booking_date
      AND a.status = 'Pending'
      AND a.token > NEW.token
    ORDER BY a.token ASC
    LIMIT 1;

    IF FOUND AND next_patient.phone != 'walk-in' THEN
      -- Use Supabase built-in http extension to ping the backend
      PERFORM net.http_post(
        url := clinic_url,
        body := jsonb_build_object(
          'phone', next_patient.phone,
          'patient_name', next_patient.patient_name,
          'doctor_id', next_patient.doctor_id,
          'token', next_patient.token,
          'clinic_id', next_patient.clinic_id
        )::text,
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    END IF;
  END IF;

  -- 2. Notify NEW walk-in patients immediately
  IF (TG_OP = 'INSERT' AND NEW.source = 'walkin' AND NEW.phone != 'walk-in') THEN
      PERFORM net.http_post(
        url := clinic_url || '/confirm-walkin',
        body := jsonb_build_object(
          'phone', NEW.phone,
          'patient_name', NEW.patient_name,
          'doctor_id', NEW.doctor_id,
          'token', NEW.token,
          'clinic_id', NEW.clinic_id
        )::text,
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Use SECURITY DEFINER to bypass RLS for the trigger itself if needed

DROP TRIGGER IF EXISTS on_appointment_serving ON appointments;
CREATE TRIGGER on_appointment_serving
  AFTER INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_next_patient();
