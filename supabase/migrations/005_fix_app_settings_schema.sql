-- ============================================================
-- FIX: Correct app_settings table schema
-- ============================================================
-- The initial schema had app_settings.id as uuid, but migration 024
-- expects it as integer PRIMARY KEY with CHECK (id = 1).
-- This migration fixes the schema conflict.

-- Drop the old table (if it exists with wrong schema)
DROP TABLE IF EXISTS public.app_settings CASCADE;

-- Create the correct schema
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                          integer PRIMARY KEY CHECK (id = 1),
  app_name                    text DEFAULT 'ITH Forms',
  org_name                    text DEFAULT 'InnoTech Hub',
  powered_by                  text DEFAULT 'Powered by ITH Forms',
  default_appearance          text DEFAULT 'system',
  default_confirmation_message text DEFAULT 'Your response has been received.',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Seed the single row
INSERT INTO public.app_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "public_read_app_settings" ON public.app_settings;
CREATE POLICY "public_read_app_settings" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_app_settings" ON public.app_settings;
CREATE POLICY "admin_update_app_settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Create updated_at trigger
DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- DONE - app_settings schema is now correct
-- ============================================================
