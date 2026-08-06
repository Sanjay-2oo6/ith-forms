import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Application-wide settings (single app_settings row, migration 024).
// Every consumer falls back to these built-in defaults while loading, on
// error, or when migration 024 hasn't been applied yet — so branding never
// flashes empty and older databases keep working unchanged.

export type AppearanceDefault = "light" | "dark" | "system";

export type AppSettings = {
  app_name: string;
  org_name: string;
  powered_by: string;
  default_appearance: AppearanceDefault;
  default_confirmation_message: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  app_name: "ITH-FORMS",
  org_name: "InnoTech-Hub",
  powered_by: "Powered by InnoTech-Hub",
  default_appearance: "dark",
  default_confirmation_message: "Your response has been submitted successfully.",
};

export async function fetchAppSettings(): Promise<AppSettings> {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("app_name,org_name,powered_by,default_appearance,default_confirmation_message")
      .eq("id", 1)
      .maybeSingle();
    // Missing table (pre-024) or missing row → defaults, never an error state.
    if (error || !data) return DEFAULT_APP_SETTINGS;
    return { ...DEFAULT_APP_SETTINGS, ...(data as Partial<AppSettings>) };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

// Cached app settings; readable by anon (public form branding) and admins.
export function useAppSettings(): AppSettings {
  const { data } = useQuery({
    queryKey: ["app-settings"],
    queryFn: fetchAppSettings,
    staleTime: 5 * 60_000,
  });
  return data ?? DEFAULT_APP_SETTINGS;
}
