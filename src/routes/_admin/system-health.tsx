import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Loader2, RefreshCw, Database, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/system-health")({
  ssr: false,
  component: SystemHealth,
});

type Check = { label: string; status: "ok" | "error" | "checking"; detail?: string };

// Labels are admin-facing; the underlying checks still probe the real
// buckets (submission-files / form-assets) — names and logic unchanged.
const INITIAL: Check[] = [
  { label: "Database connection",    status: "checking" },
  { label: "Response file storage",  status: "checking" },
  { label: "Form asset storage",     status: "checking" },
  { label: "Admin session",          status: "checking" },
];

function SystemHealth() {
  const [checks, setChecks] = useState<Check[]>(INITIAL);
  const [running, setRunning] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => { runChecks(); }, []);

  async function runChecks() {
    setRunning(true);
    setChecks(INITIAL.map(c => ({ ...c, status: "checking" })));

    const results = await Promise.allSettled([
      supabase.from("forms").select("id").limit(1),
      supabase.storage.from("submission-files").list("", { limit: 1 }),
      supabase.storage.from("form-assets").list("", { limit: 1 }),
      supabase.auth.getUser(),
    ]);

    function ok(i: number): boolean {
      const r = results[i];
      if (r.status !== "fulfilled") return false;
      return !(r.value as { error?: unknown }).error;
    }

    const sessionOk =
      results[3].status === "fulfilled" &&
      !!(results[3].value as { data?: { user?: unknown } }).data?.user;

    setChecks([
      { label: "Database connection",    status: ok(0) ? "ok" : "error" },
      { label: "Response file storage",  status: ok(1) ? "ok" : "error" },
      { label: "Form asset storage",     status: ok(2) ? "ok" : "error" },
      { label: "Admin session",          status: sessionOk ? "ok" : "error" },
    ]);
    setRunning(false);
  }

  async function reconcileResponseCounts() {
    setReconciling(true);
    try {
      const { error } = await supabase.rpc("reconcile_response_counts");
      if (error) {
        toast.error(`Reconciliation failed: ${error.message}`);
        console.error("Reconcile error:", error);
      } else {
        toast.success("Response counts reconciled successfully");
      }
    } catch (err) {
      toast.error("Failed to reconcile response counts");
      console.error("Reconcile exception:", err);
    } finally {
      setReconciling(false);
    }
  }

  return (
    <AdminShell>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">System Health & Tools</h1>
            <p className="text-sm text-muted-foreground">Monitor platform status and run maintenance tasks.</p>
          </div>
          <button
            onClick={runChecks}
            disabled={running}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Health Checks */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Health Checks
          </h2>
          <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40">
            {checks.map(c => (
              <div key={c.label} className="flex items-center justify-between px-5 py-4">
                <span className="text-sm font-medium">{c.label}</span>
                {c.status === "checking" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : c.status === "ok" ? (
                  <span className="text-sm font-semibold text-green-400">OK</span>
                ) : (
                  <span className="text-sm font-semibold text-destructive">ERROR</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance Tools */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Database className="h-4 w-4" />
            Maintenance Tools
          </h2>
          <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40">
            {/* Reconcile Response Counts */}
            <div className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium mb-1">Reconcile Response Counts</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Recalculates form.response_count from actual submission records. 
                    Run this if counts appear incorrect or after bulk deletions.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertCircle className="h-3 w-3" />
                    <span>May take 10-30 seconds for large datasets</span>
                  </div>
                </div>
                <button
                  onClick={reconcileResponseCounts}
                  disabled={reconciling}
                  className="ml-4 flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 shrink-0"
                >
                  {reconciling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" />
                      Run Reconciliation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
