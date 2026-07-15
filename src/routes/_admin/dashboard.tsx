import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Plus, RefreshCw, Calendar, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_admin/dashboard")({
  ssr: false,
  component: Dashboard,
});

type EnhancedStats = {
  total_forms: number;
  published_forms: number;
  draft_forms: number;
  closed_forms: number;
  archived_forms: number;
  total_submissions: number;
  total_submissions_all_time: number;
  active_forms: number;
  new_submissions: number;
  under_review: number;
  approved: number;
  rejected: number;
  today_submissions: number;
  period_days: number;
  period_start: string | null;
};

type RecentSub = {
  id: string;
  reference_id: string;
  respondent_name: string | null;
  submitted_at: string;
  form_id: string;
};

type TrendPoint = { day: string; count: number };

type TrendRow = { day?: string; day_label?: string; count?: number | string };

function trendDayLabel(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function buildTrendSeries(days: number, counts: Map<string, number>): TrendPoint[] {
  const series: TrendPoint[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const label = trendDayLabel(d);
    series.push({ day: label, count: counts.get(label) ?? 0 });
  }

  return series;
}

function normalizeTrendRows(rows: TrendRow[]): TrendPoint[] {
  return rows.map(row => ({
    day: String(row.day_label ?? row.day ?? ""),
    count: Number(row.count ?? 0),
  }));
}

async function fetchDailyTrend(trendDays: number): Promise<TrendPoint[]> {
  const days = Math.max(1, Math.min(trendDays, 90));

  const modern = await supabase.rpc("get_daily_submission_trend", { p_days: days });
  if (!modern.error && modern.data) {
    const points = normalizeTrendRows(modern.data as TrendRow[]);
    if (points.length > 0) return points;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const legacy = await supabase.rpc("get_daily_submission_trend", {
    p_start_date: start.toISOString(),
  });
  if (!legacy.error && legacy.data) {
    const counts = new Map<string, number>();
    for (const row of legacy.data as TrendRow[]) {
      const rawDay = String(row.day ?? row.day_label ?? "");
      const parsed = rawDay.includes("/")
        ? rawDay
        : trendDayLabel(new Date(`${rawDay}T00:00:00`));
      counts.set(parsed, Number(row.count ?? 0));
    }
    return buildTrendSeries(days, counts);
  }

  const formsRes = await supabase.from("forms").select("id").is("deleted_at", null);
  if (formsRes.error) throw new Error(formsRes.error.message);
  const liveIds = (formsRes.data ?? []).map(f => f.id);
  if (liveIds.length === 0) return buildTrendSeries(days, new Map());

  const subsRes = await supabase
    .from("submissions")
    .select("submitted_at")
    .in("form_id", liveIds)
    .gte("submitted_at", start.toISOString());
  if (subsRes.error) throw new Error(subsRes.error.message);

  const counts = new Map<string, number>();
  for (const row of subsRes.data ?? []) {
    const label = trendDayLabel(new Date(row.submitted_at));
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return buildTrendSeries(days, counts);
}

async function fetchDashboardStats(period: "all" | 7 | 30): Promise<EnhancedStats> {
  const pDays = period === "all" ? 0 : period;
  const statsRes = await supabase.rpc("get_dashboard_stats", { p_days: pDays });
  if (!statsRes.error && statsRes.data) {
    return statsRes.data as EnhancedStats;
  }

  const legacyDays = period === "all" ? 36500 : period;
  const legacyRes = await supabase.rpc("get_dashboard_stats", { p_days: legacyDays });
  if (legacyRes.error) throw new Error(legacyRes.error.message);
  return legacyRes.data as EnhancedStats;
}

async function fetchDashboard(period: "all" | 7 | 30): Promise<{ stats: EnhancedStats; recent: RecentSub[]; trend: TrendPoint[] }> {
  const trendDays = period === 7 ? 7 : 30;

  const formsRes = await supabase.from("forms").select("id").is("deleted_at", null);
  if (formsRes.error) throw new Error(formsRes.error.message);
  const liveIds = (formsRes.data ?? []).map(f => f.id);

  const [stats, trend, recentRes] = await Promise.all([
    fetchDashboardStats(period),
    fetchDailyTrend(trendDays),
    liveIds.length > 0
      ? supabase.from("submissions")
          .select("id,reference_id,respondent_name,submitted_at,form_id")
          .in("form_id", liveIds)
          .order("submitted_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
  ]);

  return {
    stats,
    recent: (recentRes.data ?? []) as RecentSub[],
    trend,
  };
}

function Dashboard() {
  const [period, setPeriod] = useState<'all' | 7 | 30>('all');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", period],
    queryFn: () => fetchDashboard(period),
    staleTime: 30_000,
  });

  const stats = data?.stats ?? null;
  const recent = data?.recent ?? [];
  const trend = data?.trend ?? [];

  return (
    <AdminShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Live overview of ITH-FORMS activity.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-border bg-card">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() => setPeriod('all')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  period === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setPeriod(7)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  period === 7
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Last Week
              </button>
              <button
                onClick={() => setPeriod(30)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  period === 30
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Last Month
              </button>
            </div>

            <button onClick={() => refetch()} disabled={isFetching}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </button>

            <Link
              to="/forms/new"
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New form
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center animate-fade-up">
            <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">Couldn't load dashboard data</p>
            <p className="text-xs text-muted-foreground mb-4">{(error as Error)?.message}</p>
            <button onClick={() => refetch()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              Try again
            </button>
          </div>
        ) : stats ? (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <StatCard label="TOTAL FORMS" value={stats.total_forms} variant="primary" />
              <StatCard label="PUBLISHED" value={stats.published_forms} variant="success" />
              <StatCard label="CLOSED" value={stats.closed_forms} variant="warning" />
              <StatCard label="ARCHIVED" value={stats.archived_forms} variant="muted" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <StatCard
                label={
                  period === 'all' ? "ALL SUBMISSIONS" :
                  period === 7 ? "SUBMISSIONS (7D)" :
                  "SUBMISSIONS (30D)"
                }
                value={stats.total_submissions}
                variant="primary"
              />
              <StatCard label="ACTIVE FORMS" value={stats.active_forms} variant="success"
                subtitle={
                  period === 'all' ? "Received responses in period" :
                  period === 7 ? "Received responses in 7 days" :
                  "Received responses in 30 days"
                } />
              <StatCard label="TODAY" value={stats.today_submissions} variant="info" />
              <StatCard label="PENDING REVIEW" value={stats.new_submissions + stats.under_review} variant="warning" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2 mb-6">
              <div className="rounded-xl border border-border/60 bg-card p-5">
                <h2 className="text-sm font-semibold mb-4">
                  Submission Trend
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    ({period === 'all' ? 'Last 30 days' : period === 7 ? 'Last 7 days' : 'Last 30 days'})
                  </span>
                </h2>
                <TrendChart data={trend} />
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-5">
                <h2 className="text-sm font-semibold mb-4">
                  Submission Status
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    ({period === 'all' ? 'All time' : period === 7 ? 'Last 7 days' : 'Last 30 days'})
                  </span>
                </h2>
                <StatusBreakdown stats={stats} />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <h2 className="text-sm font-semibold mb-4">Recent Submissions</h2>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No submissions yet.</p>
              ) : (
                <div className="space-y-0 divide-y divide-border/40">
                  {recent.map(s => (
                    <Link
                      key={s.id}
                      to="/forms/$formId/responses/$submissionId"
                      params={{ formId: s.form_id, submissionId: s.id }}
                      className="flex items-center justify-between py-3 hover:text-primary transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-mono font-semibold group-hover:text-primary transition-colors">
                          {s.reference_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.respondent_name ?? "Anonymous"}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.submitted_at).toLocaleDateString()} {new Date(s.submitted_at).toLocaleTimeString()}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  variant = 'default',
  subtitle
}: {
  label: string;
  value: number;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info' | 'muted';
  subtitle?: string;
}) {
  const variantClasses = {
    default: 'border-border/60',
    primary: 'border-primary/40 bg-primary/5',
    success: 'border-green-500/40 bg-green-500/5',
    warning: 'border-yellow-500/40 bg-yellow-500/5',
    info: 'border-blue-500/40 bg-blue-500/5',
    muted: 'border-border/40',
  };

  return (
    <div className={`rounded-xl border ${variantClasses[variant]} bg-card p-5`}>
      <p className="text-[11px] font-semibold text-muted-foreground tracking-wide mb-2">{label}</p>
      <p className="text-4xl font-bold mb-1">{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const peak = Math.max(0, ...data.map(d => d.count));
  const max = Math.max(1, peak);
  const W = 600, H = 120, gap = 4;
  const bw = data.length > 0 ? (W - gap * (data.length - 1)) / data.length : W;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" role="img" aria-label="Submissions per day">
        {data.map((d, i) => {
          const h = d.count === 0 ? 2 : Math.max(4, (d.count / max) * (H - 12));
          return (
            <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={2}
              fill={d.count === 0 ? "#D9D2C5" : "#8C3514"}>
              <title>{`${d.day}: ${d.count} submission${d.count !== 1 ? "s" : ""}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{data[0]?.day ?? ""}</span>
        <span>Peak: {peak}/day</span>
        <span>{data[data.length - 1]?.day ?? ""}</span>
      </div>
    </div>
  );
}

function StatusBreakdown({ stats }: { stats: EnhancedStats }) {
  const items = [
    { label: "New", count: stats.new_submissions, color: "#336B8E" },
    { label: "Under Review", count: stats.under_review, color: "#D39A20" },
    { label: "Approved", count: stats.approved, color: "#3E7B3C" },
    { label: "Rejected", count: stats.rejected, color: "#B93A32" },
  ];

  const total = items.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">No submissions in this period.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const percentage = total > 0 ? (item.count / total) * 100 : 0;
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{item.count}</span>
                <span className="text-xs text-muted-foreground">({percentage.toFixed(0)}%)</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${percentage}%`,
                  background: item.color
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
