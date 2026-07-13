-- ==================================================================
-- 024_app_settings.sql
-- Application-wide editable settings (Settings page redesign).
-- Single-row table: branding text, default appearance, and the default
-- confirmation message applied to NEWLY created forms only.
--
-- RLS:
--   • SELECT for anon + authenticated — branding renders on PUBLIC pages
--     (form header/footer), so the row must be readable with the anon key.
--     It contains no sensitive data by design.
--   • UPDATE only for active admins (is_admin()).
--   • No INSERT/DELETE policies: the single row is seeded here; the app
--     falls back to built-in defaults if it is ever missing.
--
-- Forward-only and idempotent — safe to re-run.
-- ==================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id                           integer PRIMARY KEY CHECK (id = 1),
  app_name                     text NOT NULL DEFAULT 'ITH-FORMS',
  org_name                     text NOT NULL DEFAULT 'InnoTech-Hub',
  powered_by                   text NOT NULL DEFAULT 'Powered by InnoTech-Hub',
  default_appearance           text NOT NULL DEFAULT 'dark'
                                 CHECK (default_appearance IN ('light','dark','system')),
  default_confirmation_message text NOT NULL DEFAULT 'Your response has been submitted successfully.',
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_app_settings" ON public.app_settings;
CREATE POLICY "public_read_app_settings" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_app_settings" ON public.app_settings;
CREATE POLICY "admin_update_app_settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Reuse the shared updated_at trigger function from 001.
DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
