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
DROP POLICY IF EXISTS "Clinic staff can view their own clinic info" ON clinics;
DROP POLICY IF EXISTS "Authenticated users can view clinics" ON clinics;
DROP POLICY IF EXISTS "Authenticated users can create clinics" ON clinics;
DROP POLICY IF EXISTS "Allow clinic claiming" ON clinics;
DROP POLICY IF EXISTS "Clinic staff can update their own clinic info" ON clinics;

-- Allow all authenticated users to see clinic names/IDs
CREATE POLICY "Enable read access for authenticated users" 
ON clinics FOR SELECT 
TO authenticated 
USING (true);

-- Allow all authenticated users to insert new clinics
CREATE POLICY "Enable insert access for authenticated users" 
ON clinics FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow users to update a clinic if they are linked to it OR if it's not linked to anyone
CREATE POLICY "Enable update access for clinic admins" 
ON clinics FOR UPDATE 
TO authenticated 
USING (
  id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())
  OR 
  id NOT IN (SELECT clinic_id FROM profiles WHERE clinic_id IS NOT NULL)
);

-- 6. Policies for 'profiles' table
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Enable read for own profile" 
ON profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Enable update for own profile" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow insertion of profile (though trigger usually handles this)
CREATE POLICY "Enable insert for own profile" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);
