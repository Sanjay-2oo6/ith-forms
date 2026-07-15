import type { CSSProperties } from "react";

export type FormTheme = {
  preset: string;
  primary_color: string | null;
  background_color: string | null;
  card_color: string | null;
  font_family: string | null;
  border_radius: string | null;
  form_width: string | null;
  bg_image_path: string | null;
  bg_overlay_opacity: number | null;
};

export function isLightColor(hex: string): boolean {
  const m = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return false;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}

export function rgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return `rgba(11, 11, 22, ${alpha})`;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Tailwind v4 utilities resolve through var(--primary), var(--background), etc.
// (see @theme inline in styles.css), so overriding those custom properties on a
// container re-themes every descendant utility class. Foreground/border tokens
// are derived from the chosen background's luminance so light presets stay
// readable on an app whose defaults are dark.
export function themeContainerStyle(
  t: FormTheme | null,
  bgImageUrl?: string | null
): CSSProperties {
  if (!t) return {};
  const s: Record<string, string> = {};

  if (t.primary_color) {
    s["--primary"] = t.primary_color;
    s["--ring"] = t.primary_color;
    s["--accent"] = t.primary_color;
    s["--primary-foreground"] = isLightColor(t.primary_color) ? "#0f172a" : "#ffffff";
  }
  if (t.background_color) {
    const light = isLightColor(t.background_color);
    s["--background"] = t.background_color;
    s["--foreground"] = light ? "#0f172a" : "#f8fafc";
    s["--muted-foreground"] = light ? "#475569" : "#94a3b8";
    s["--border"] = light ? "#cbd5e1" : "#334155";
    s["--input"] = light ? "#cbd5e1" : "#334155";
    s["--secondary"] = light ? "#e2e8f0" : "#1e293b";
    s["--secondary-foreground"] = light ? "#0f172a" : "#f8fafc";
  }
  if (t.card_color) {
    s["--card"] = t.card_color;
    s["--card-foreground"] = isLightColor(t.card_color) ? "#0f172a" : "#f8fafc";
  }
  if (t.border_radius) s["--radius"] = t.border_radius;

  const style = s as CSSProperties;
  if (t.font_family) style.fontFamily = t.font_family;
  if (bgImageUrl) {
    // Sanitize URL: escape `)`, `"`, `'`, `\` to prevent CSS injection
    const safeBgUrl = bgImageUrl.replace(/[)"'\\]/g, (m) => 
      '%' + m.charCodeAt(0).toString(16).padStart(2, '0')
    );
    // Glassmorphism-friendly: lighter overlay so image shows through glass effect
    // Use 60% overlay (40% image visible) for better glassmorphism effect
    const rawOverlay = t.bg_overlay_opacity ?? 0.60;
    const overlayOpacity = Math.min(0.75, Math.max(0.40, rawOverlay));
    const overlay = rgba(t.background_color ?? "#0b0b16", overlayOpacity);
    style.backgroundImage = `linear-gradient(${overlay}, ${overlay}), url("${safeBgUrl}")`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
    style.backgroundAttachment = "fixed";
  }
  return style;
}
