import { Link } from "@tanstack/react-router";
import { IthLogo, BRAND_POWERED } from "@/lib/ith-brand";
import { AlertTriangle, SearchX, RotateCcw } from "lucide-react";

function StateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center"><IthLogo size={48} /></div>
        <div className="rounded-2xl border border-border/60 bg-card p-8">{children}</div>
        <p className="mt-6 text-[11px] text-muted-foreground">{BRAND_POWERED}</p>
      </div>
    </div>
  );
}

// Route-level error boundary — replaces the white screen / bare 500.
export function AppErrorFallback({ error }: { error: Error }) {
  return (
    <StateShell>
      <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
      <h1 className="text-lg font-bold mb-1">Something went wrong</h1>
      <p className="text-sm text-muted-foreground mb-4">
        An unexpected error occurred. Reloading usually fixes it — if it keeps
        happening, contact the administrator.
      </p>
      <p className="text-[11px] font-mono text-muted-foreground/70 mb-5 break-all">
        {error?.message ?? "Unknown error"}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
      >
        <RotateCcw className="h-4 w-4" /> Reload page
      </button>
    </StateShell>
  );
}

export function NotFoundPage() {
  return (
    <StateShell>
      <SearchX className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
      <h1 className="text-lg font-bold mb-1">Page not found</h1>
      <p className="text-sm text-muted-foreground mb-5">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link
        to="/"
        className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
      >
        Go to home
      </Link>
    </StateShell>
  );
}
