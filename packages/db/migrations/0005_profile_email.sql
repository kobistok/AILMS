-- Store user email on profile for Slack user resolution
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
