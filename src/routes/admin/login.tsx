import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IthLogo, useBranding } from "@/lib/ith-brand";
import { useTheme } from "@/lib/use-theme";
import { useAppSettings } from "@/lib/use-app-settings";
import { Loader2, Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { poweredBy } = useBranding();
  const settings = useAppSettings();
  const { theme, toggle: toggleTheme } = useTheme(settings.default_appearance);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Check lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setError(`Too many failed attempts. Please try again in ${remaining} seconds.`);
      return;
    }
    
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        
        // Exponential backoff: 3 attempts = 5s, 4 = 10s, 5 = 20s, 6 = 40s...
        if (nextAttempts >= 3) {
          const delay = Math.pow(2, nextAttempts - 3) * 5000;
          setLockoutUntil(Date.now() + delay);
        }
        
        setError("Invalid credentials. Please try again.");
        return;
      }
      
      // Success: reset attempts
      setAttempts(0);
      setLockoutUntil(null);
      
      // Verify admin record
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: admin } = await supabase
          .from("admin_users")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        if (!admin) {
          await supabase.auth.signOut();
          setError("Invalid credentials. Please try again.");
          return;
        }
        
        // Log successful login to audit log
        await supabase.from("audit_logs").insert({
          action: "admin.login",
          entity: "auth",
          entity_id: user.id,
          metadata: { email: user.email },
        });
      }
      navigate({ to: "/dashboard" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-sidebar text-sidebar-foreground px-4">
      {/* Light / dark toggle */}
      <button
        onClick={toggleTheme}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        aria-label="Toggle theme"
        className="fixed top-4 right-4 h-9 w-9 grid place-items-center rounded-full border border-sidebar-border text-sidebar-foreground/80 hover:bg-white/5 hover:text-sidebar-foreground transition-colors"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex justify-center">
          <IthLogo size={56} />
        </div>

        <div className="rounded-2xl border border-border/60 bg-card text-card-foreground p-8 shadow-2xl shadow-black/20">
          <h1 className="text-2xl font-semibold text-center mb-1">Administrator Login</h1>
          <p className="text-xs text-muted-foreground text-center mb-6">ITH-FORMS Control Panel</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@innotech-hub.org"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-secondary transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">{poweredBy}</p>
      </div>
    </div>
  );
}
