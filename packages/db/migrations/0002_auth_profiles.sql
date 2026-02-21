-- Profiles table extends auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  org_name TEXT,
  industry TEXT,
  employee_count TEXT,  -- '1-10', '11-50', '51-200', '201-1000', '1000+'
  role TEXT NOT NULL DEFAULT 'member',  -- 'admin' | 'member'
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invitations table (admin emails a signup link; invitee logs in with Google)
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  org_name TEXT,   -- pre-filled from inviter's profile
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: authenticated users can read/update own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service role full access profiles" ON profiles USING (auth.role() = 'service_role');
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access invitations" ON invitations USING (auth.role() = 'service_role');
CREATE POLICY "Admins can manage invitations" ON invitations USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
