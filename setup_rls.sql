-- 1. Create Clinics Table
CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY, -- The phone_number_id from Meta
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create Profiles Table (links Supabase Auth users to clinics)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  clinic_id TEXT REFERENCES clinics(id),
  role TEXT CHECK (role IN ('admin', 'staff', 'doctor')),
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enable RLS on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 4. Policies for 'appointments' table
-- Staff can only see/edit appointments for their own clinic
CREATE POLICY "Clinic staff can manage their appointments" 
ON appointments
FOR ALL 
TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM profiles WHERE id = auth.uid()
  )
);

-- 5. Policies for 'clinics' table
CREATE POLICY "Clinic staff can view their own clinic info" 
ON clinics
FOR SELECT 
TO authenticated
USING (
  id IN (
    SELECT clinic_id FROM profiles WHERE id = auth.uid()
  )
);

-- 6. Policies for 'profiles' table
CREATE POLICY "Users can view their own profile" 
ON profiles
FOR SELECT 
TO authenticated
USING (id = auth.uid());
