-- Add custom branding support to the clinics table
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS branding_json JSONB DEFAULT '{
  "logo_url": "",
  "primary_color": "#0ea5e9",
  "signature": "",
  "marquee_text": ""
}';

-- Add subscription tier column (Essential vs Professional package)
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Essential';
