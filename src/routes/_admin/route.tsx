import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";

const ADMIN_GUARD_CACHE_MS = 60_000;
let verifiedAdmin: { user: User; expiresAt: number } | null = null;

export const Route = createFileRoute("/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      verifiedAdmin = null;
      await supabase.auth.signOut();
      throw redirect({ to: "/admin/login" });
    }
    if (verifiedAdmin?.user.id === data.user.id && verifiedAdmin.expiresAt > Date.now()) {
      return { user: verifiedAdmin.user };
    }
    // Verify active admin record
    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", data.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!admin) {
      verifiedAdmin = null;
      await supabase.auth.signOut();
      throw redirect({ to: "/admin/login" });
    }
    verifiedAdmin = { user: data.user, expiresAt: Date.now() + ADMIN_GUARD_CACHE_MS };
    return { user: data.user };
  },
  component: AdminLayout,
});

// The shell chrome (sidebar) mounts ONCE here and stays mounted while you move
// between admin pages — only the <Outlet/> content swaps and animates. Pages
// still wrap themselves in <AdminShell>, which becomes a passthrough inside
// this layout (see AdminShell's ShellContext).
function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
