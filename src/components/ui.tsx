import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * Shared UI primitives — the handful of Tailwind utility combinations that
 * were copy-pasted across nearly every admin route. Centralising them keeps
 * the visual design identical while giving future changes a single home.
 *
 * These are class-string constants (not styled components) on purpose: the
 * codebase composes utilities inline everywhere, so constants slot into the
 * existing idiom without forcing a component API onto every call site.
 */

// ── Form controls ────────────────────────────────────────────────────────────
export const inputCls =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export const textareaCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none";

export const selectCls =
  "h-10 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

// ── Buttons ──────────────────────────────────────────────────────────────────
export const btnPrimaryCls =
  "flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors";

export const btnOutlineCls =
  "flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors";

// Small icon+label action chips used in list rows (Forms list, headers).
export const btnChipCls =
  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors";

export const btnChipDestructiveCls =
  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border text-destructive hover:bg-destructive/10 transition-colors";

// ── Field wrapper ────────────────────────────────────────────────────────────
// Label + control + optional hint/error. Used by form-creation and settings
// panels; the error slot renders in destructive red and links to the control
// visually (the caller decides aria wiring where needed).
export function Field({ label, hint, error, children }: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error
        ? <p className="text-xs text-destructive" role="alert">{error}</p>
        : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Primary button with a built-in loading spinner state.
export function LoadingButton({ loading, children, className, ...props }: {
  loading?: boolean;
  children: ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={className ?? btnPrimaryCls}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
