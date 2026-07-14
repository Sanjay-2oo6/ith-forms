import { AlertTriangle } from "lucide-react";
import { BRAND_NAME, BRAND_POWERED } from "@/lib/ith-brand";

/**
 * Shown app-wide when required build-time configuration is missing (e.g. the
 * Supabase env vars weren't present in the deployment's build). Renders
 * instead of the app so misconfiguration is obvious and actionable rather
 * than surfacing as a cryptic runtime crash on first Supabase use.
 *
 * Uses static branding constants (not the settings-driven hook) because that
 * hook itself depends on Supabase, which is exactly what's unavailable here.
 */
export function ConfigError({ message }: { message: string }) {
  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground px-4">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-destructive/10 border border-destructive/30">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Configuration required</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {BRAND_NAME} can’t start because it’s missing required settings.
        </p>

        <div className="rounded-xl border border-border/60 bg-card p-5 text-left space-y-3">
          <p className="text-sm font-medium text-destructive">{message}</p>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>To fix this on Netlify:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open <span className="font-medium text-foreground">Site settings → Environment variables</span>.</li>
              <li>
                Add <code className="px-1 rounded bg-secondary">VITE_SUPABASE_URL</code> and{" "}
                <code className="px-1 rounded bg-secondary">VITE_SUPABASE_ANON_KEY</code>
                {" "}with the scope set to include <span className="font-medium text-foreground">Builds</span>.
              </li>
              <li>Trigger a redeploy with <span className="font-medium text-foreground">Clear cache and deploy site</span>.</li>
            </ol>
            <p className="pt-1">
              The values come from your Supabase project’s API settings. The anon key is public by
              design (row-level security governs access); never use the service-role key here.
            </p>
          </div>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground">{BRAND_POWERED}</p>
      </div>
    </div>
  );
}
