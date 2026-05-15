-- Medication, Test, and Follow-up Reminders System

-- 1. Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    patient_phone TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('medication', 'test', 'follow_up')),
    item_name TEXT NOT NULL,
    frequency TEXT,
    duration_days INTEGER,
    start_date DATE NOT NULL,
    end_date DATE,
    times TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Cancelled', 'Completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- 2. Reminder Logs (Compliance Tracking)
CREATE TABLE IF NOT EXISTS reminder_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_id UUID REFERENCES reminders(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Taken', 'Skipped')),
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    clinic_id TEXT NOT NULL -- Redundant for RLS performance
);

-- 3. Enable RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Reminders
DROP POLICY IF EXISTS "Clinics can manage their own reminders" ON reminders;
CREATE POLICY "Clinics can manage their own reminders" ON reminders
    FOR ALL
    USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

-- 5. RLS Policies for Reminder Logs
DROP POLICY IF EXISTS "Clinics can manage their own reminder logs" ON reminder_logs;
CREATE POLICY "Clinics can manage their own reminder logs" ON reminder_logs
    FOR ALL
    USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reminders_clinic_id ON reminders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_reminders_patient_phone ON reminders(patient_phone);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_reminder_id ON reminder_logs(reminder_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_clinic_id ON reminder_logs(clinic_id);
