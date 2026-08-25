import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    async function handleRedirect() {
      // Check if user is authenticated
      const { data, error } = await supabase.auth.getUser();
      
      if (error || !data.user) {
        // Not authenticated, redirect to login
        window.location.href = "/admin/login";
        return;
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
        window.location.href = "/dashboard";
      } else {
        // Not admin, redirect to login
        window.location.href = "/admin/login";
      }
    }

    handleRedirect();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
      </div>
    </div>
  );
}
