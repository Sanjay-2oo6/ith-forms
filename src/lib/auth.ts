import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Shared admin logout with audit logging. */
export async function adminLogout(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await supabase.from("audit_logs").insert({
      action: "admin.logout",
      entity: "auth",
      entity_id: user.id,
      metadata: { email: user.email },
    });
  }

  await supabase.auth.signOut();
  toast.success("Signed out");
}
