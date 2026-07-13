import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Loader2, RefreshCw } from "lucide-react";
import { auditActionLabel } from "@/lib/audit-labels";

export const Route = createFileRoute("/_admin/audit")({
  ssr: false,
  component: AuditLog,
});

type Log = {
  id: string; action: string; entity: string | null; entity_id: string | null;
  actor_email: string | null; created_at: string;
};

function AuditLog() {
  const [logs, setLogs] = useState<Log[]>([]);
  // entity_id → display name (form titles, submission reference IDs),
  // resolved with ONE batched .in() query per entity type per page — no N+1.
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const PAGE_SIZE = 50;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, actionFilter]);

  useEffect(() => { load(); }, [page, debouncedSearch, actionFilter]);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("audit_logs")
      .select("id,action,entity,entity_id,actor_email,created_at")
      .order("created_at", { ascending: false });

    if (actionFilter !== "all") {
      q = q.ilike("action", `${actionFilter}%`);
    }
    if (debouncedSearch.trim()) {
      const term = `%${debouncedSearch.trim()}%`;
      q = q.or(`action.ilike.${term},actor_email.ilike.${term},entity.ilike.${term}`);
    }

    const { data } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const rows = (data ?? []) as Log[];
    setLogs(rows);
    setLoading(false);
    resolveEntityNames(rows);
  }

  // Batched lookups: at most two extra queries per page, regardless of rows.
  // UUID guard: legacy audit rows stored non-uuid entity_ids (e.g. "spoof"
  // test rows) which would make the .in() filter error out.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  async function resolveEntityNames(rows: Log[]) {
    const formIds = [...new Set(rows.filter(r => r.entity === "form" && r.entity_id && UUID_RE.test(r.entity_id)).map(r => r.entity_id!))];
    const subIds = [...new Set(rows.filter(r => r.entity === "submission" && r.entity_id && UUID_RE.test(r.entity_id)).map(r => r.entity_id!))];

    const [formsRes, subsRes] = await Promise.all([
      formIds.length
        ? supabase.from("forms").select("id,title").in("id", formIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      subIds.length
        ? supabase.from("submissions").select("id,reference_id").in("id", subIds)
        : Promise.resolve({ data: [] as { id: string; reference_id: string }[] }),
    ]);

    const names: Record<string, string> = {};
    for (const f of (formsRes.data ?? []) as { id: string; title: string }[]) names[f.id] = f.title;
    for (const s of (subsRes.data ?? []) as { id: string; reference_id: string }[]) names[s.id] = s.reference_id;
    setEntityNames(names);
  }

  function entityDisplay(log: Log): string {
    if (!log.entity) return "—";
    if (log.entity_id && entityNames[log.entity_id]) return `${log.entity} · ${entityNames[log.entity_id]}`;
    // Fallback: shortened id (hard-deleted entities, auth events, legacy rows).
    return log.entity_id ? `${log.entity} · ${log.entity_id.slice(0, 8)}` : log.entity;
  }

  return (
    <AdminShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Audit log</h1>
            <p className="text-sm text-muted-foreground">Every administrator action is recorded for accountability.</p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search action, actor, entity…"
            className="flex-1 h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All actions</option>
            <option value="admin.">Auth</option>
            <option value="form.">Forms</option>
            <option value="submission.">Submissions</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-12 text-center text-muted-foreground text-sm">
            No audit log entries match your filters.
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-secondary/30">
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground">WHEN</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground">ACTOR</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground">ACTION</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground">ENTITY</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} className={`border-b border-border/30 ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{log.actor_email ?? "—"}</td>
                    {/* Readable label; the raw stored action stays available on hover. */}
                    <td className="px-4 py-2.5 text-xs font-semibold" title={log.action}>
                      {auditActionLabel(log.action)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {entityDisplay(log)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1 rounded text-sm border border-border hover:bg-secondary disabled:opacity-40">← Prev</button>
              <span className="text-xs text-muted-foreground">Page {page + 1}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE}
                className="px-3 py-1 rounded text-sm border border-border hover:bg-secondary disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
