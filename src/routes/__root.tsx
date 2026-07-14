import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { ConfigError } from "@/components/ConfigError";
import { supabaseConfigError } from "@/integrations/supabase/client";
import "../styles.css";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ITH-FORMS — Powered by InnoTech-Hub" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Missing build-time config (e.g. Supabase env vars) would otherwise crash
  // on first client use with a cryptic error. Surface a clear screen instead —
  // this covers every route (login, admin, public forms) with one guard.
  if (supabaseConfigError) {
    return <ConfigError message={supabaseConfigError} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {/* ConfirmProvider must sit ABOVE the routes: route components call
          useConfirm() before rendering AdminShell, so a provider inside
          AdminShell can never reach them. */}
      <ConfirmProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </ConfirmProvider>
    </QueryClientProvider>
  );
}
