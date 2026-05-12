-- SQL for Supabase appointments table
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  patient_name TEXT,
  phone TEXT,
  booking_date DATE NOT NULL,
  booking_time TEXT,
  source TEXT CHECK (source IN ('whatsapp','walkin','call')),
  token INTEGER,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Atomic token generation function
CREATE OR REPLACE FUNCTION create_appointment(
  p_clinic_id TEXT,
  p_doctor_id TEXT,
  p_name TEXT,
  p_phone TEXT,
  p_date DATE,
  p_time TEXT,
  p_source TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_token INTEGER;
BEGIN
  -- Generate new token by incrementing the max existing token for this doctor/date
  INSERT INTO appointments (
    clinic_id, doctor_id, patient_name, phone,
    booking_date, booking_time, source, token
  )
  SELECT 
    p_clinic_id, p_doctor_id, p_name, p_phone,
    p_date, p_time, p_source,
    COALESCE((SELECT MAX(token) FROM appointments WHERE clinic_id = p_clinic_id AND doctor_id = p_doctor_id AND booking_date = p_date), 0) + 1
  RETURNING token INTO new_token;

  RETURN new_token;
END;
$$;
