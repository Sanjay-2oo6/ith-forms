import { useAppSettings, DEFAULT_APP_SETTINGS } from "@/lib/use-app-settings";

// Static fallbacks — kept exported for use as loading/error defaults.
// Live values come from useAppSettings() (app_settings row, editable in
// Settings), so rebranding needs no code change.
export const BRAND_NAME = DEFAULT_APP_SETTINGS.app_name;
export const BRAND_POWERED = DEFAULT_APP_SETTINGS.powered_by;

// Dynamic branding for React components. Falls back to the constants above
// while settings load (or when migration 024 isn't applied).
export function useBranding() {
  const settings = useAppSettings();
  return {
    appName: settings.app_name,
    orgName: settings.org_name,
    poweredBy: settings.powered_by,
  };
}

// Logo with the branding name and powered-by text (settings-driven).
export function IthLogo({ size = 40, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  const { appName, poweredBy } = useBranding();
  return (
    <div className="flex items-center gap-3">
      {/* Logo image */}
      <img
        src="/ith-logo.svg"
        alt={`${appName} logo`}
        style={{ width: size, height: size }}
        className="shrink-0"
        onError={(e) => {
          // Fallback to PNG if SVG not found
          (e.target as HTMLImageElement).src = '/ith-logo.png';
        }}
      />
      {withWordmark && (
        <div className="leading-none">
          <p className="font-bold leading-none tracking-tight">{appName}</p>
          <p className="text-[10px] opacity-60 mt-0.5">{poweredBy}</p>
        </div>
      )}
    </div>
  );
}
