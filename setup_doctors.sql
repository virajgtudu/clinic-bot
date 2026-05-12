-- Create Doctors Table
CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id TEXT REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT,
  availability_json JSONB DEFAULT '{"monday": {"enabled": true, "slots": ["09:00 AM", "10:00 AM"]}, "tuesday": {"enabled": true, "slots": ["09:00 AM", "10:00 AM"]}}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on Doctors
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

-- Policy: Clinic staff can manage their own doctors
DROP POLICY IF EXISTS "Clinic staff can manage their doctors" ON doctors;
CREATE POLICY "Clinic staff can manage their doctors" 
ON doctors FOR ALL TO authenticated
USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

-- Policy: Allow public read for the bot (using service_role usually, but for direct RPC if needed)
-- Note: The bot uses service_role, so it bypasses this anyway.
