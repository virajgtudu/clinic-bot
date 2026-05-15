-- Migration: Add qualifications and experience to doctors table
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS qualifications TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS experience TEXT;
