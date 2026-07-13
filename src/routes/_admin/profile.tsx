import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_admin/profile")({
  ssr: false,
  component: Profile,
});

function Profile() {
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      setEmail(user?.email ?? null);
      setLastSignIn(user?.last_sign_in_at ?? null);
      if (user) {
        // Real display name only — never invent one from the email.
        const { data: admin } = await supabase
          .from("admin_users")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        const name = (admin?.display_name ?? "").trim();
        setDisplayName(name || null);
      }
      setLoading(false);
    })();
  }, []);

  const initials = (displayName || email || "A")[0].toUpperCase();

  return (
    <AdminShell>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">Administrator account details.</p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-border/60 bg-card p-6 max-w-md flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading profile…</span>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card p-6 max-w-md">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                {/* With a real name: name + email. Without: email shown ONCE. */}
                {displayName ? (
                  <>
                    <p className="font-semibold truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{email ?? "—"}</p>
                  </>
                ) : (
                  <p className="font-semibold truncate">{email ?? "—"}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <p><span className="text-muted-foreground">Role: </span><span className="font-semibold">Administrator</span></p>
              {lastSignIn && (
                <p><span className="text-muted-foreground">Last sign-in: </span>{new Date(lastSignIn).toLocaleString()}</p>
              )}
              <p><span className="text-muted-foreground">Session: </span><span className="font-semibold text-green-400">Active</span></p>
            </div>
            {/* Sign out lives in the sidebar — no duplicate button here. */}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
