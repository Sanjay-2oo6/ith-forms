import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    // Check if user is authenticated
    const { data, error } = await supabase.auth.getUser();
    
    if (error || !data.user) {
      // Not authenticated, redirect to login
      throw redirect({ to: "/admin/login" });
    }
    
    // Check if user is an admin
    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", data.user.id)
      .eq("is_active", true)
      .maybeSingle();
    
    if (admin) {
      // Is admin, redirect to dashboard
      throw redirect({ to: "/admin/dashboard" });
    } else {
      // Not admin, redirect to login
      throw redirect({ to: "/admin/login" });
    }
  },
  component: RootComponent,
});

function RootComponent() {
  return <div>Loading...</div>;
}
