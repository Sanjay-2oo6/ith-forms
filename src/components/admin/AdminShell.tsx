import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IthLogo } from "@/lib/ith-brand";
import { useTheme } from "@/lib/use-theme";
import { useAppSettings } from "@/lib/use-app-settings";
import {
  LayoutDashboard, FileText, Folder, Shield,
  Activity, User, Settings, LogOut, Moon, Sun,
} from "lucide-react";
import { adminLogout } from "@/lib/auth";

const NAV = [
  { to: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { to: "/forms",         label: "Forms",         icon: FileText },
  { to: "/files",         label: "Files",         icon: Folder },
  { to: "/audit",         label: "Audit log",     icon: Shield },
  { to: "/system-health", label: "System health", icon: Activity },
  { to: "/profile",       label: "Profile",       icon: User },
  { to: "/settings",      label: "Settings",      icon: Settings },
];

// True once the persistent shell chrome (sidebar) is mounted by the _admin
// layout. Pages still render <AdminShell>, but inside the layout it becomes a
// passthrough — so the sidebar does NOT tear down and rebuild on every tab
// switch. That remount was the root cause of the flicker.
const ShellContext = createContext(false);

export function AdminShell({ children }: { children: ReactNode }) {
  const inShell = useContext(ShellContext);
  // Only this one hook runs before the conditional return — rules-of-hooks safe.
  if (inShell) return <>{children}</>;
  return <ShellChrome>{children}</ShellChrome>;
}

function ShellChrome({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [email, setEmail] = useState<string | null>(null);
  const settings = useAppSettings();
  const { theme, toggle: toggleTheme } = useTheme(settings.default_appearance);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    // Redirect to login if the session expires or is signed out elsewhere.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/admin/login" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleLogout() {
    await adminLogout();
    navigate({ to: "/admin/login" });
  }

  return (
    <ShellContext.Provider value={true}>
      <div className="min-h-screen flex bg-sidebar">
        <aside className="w-56 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
          <div className="p-5 border-b border-sidebar-border">
            <IthLogo size={36} />
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to || location.pathname.startsWith(to + "/");
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-sidebar-border space-y-1">
            {email && (
              <p className="px-3 py-1 text-xs text-sidebar-foreground/50 truncate">{email}</p>
            )}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-full text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-full text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>
        {/* Cream content surface. The animation lives on the panel ITSELF
            (not an inner wrapper), so the panel + its content fade in together
            as one unit — no empty-panel flash / flicker between tabs. Keyed by
            path so it replays on every section. */}
        <main
          className="flex-1 overflow-auto bg-background text-foreground md:my-2 md:mr-2 md:rounded-2xl md:border md:border-border/60"
        >
          {children}
        </main>
      </div>
    </ShellContext.Provider>
  );
}
