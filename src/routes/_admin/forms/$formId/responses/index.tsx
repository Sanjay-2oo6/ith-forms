import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { SubmissionDetailModal } from "@/components/SubmissionDetailModal";
import { Loader2, ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  fetchTabular, exportResponsesXlsx, buildOptionMap,
  DateFilterUnsupportedError, PAGE_SIZE,
  type ResponseSubmission, type TabularData, type ResponseFilters,
} from "@/lib/responses";
import { ResponsesFilterBar } from "@/components/responses/ResponsesFilterBar";
import { ResponsesTable } from "@/components/responses/ResponsesTable";
import { BulkActionsBar, PaginationBar } from "@/components/responses/BulkActionsBar";

export const Route = createFileRoute("/_admin/forms/$formId/responses/")({
  ssr: false,
  component: ResponsesList,
});

function ResponsesList() {
  const { confirm } = useConfirm();
  const { formId } = Route.useParams();
  const queryClient = useQueryClient();

  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("under_review");
  const [applying, setApplying] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<ResponseSubmission | null>(null);
  // Warn about an unapplied 021 migration only once per page visit.
  const dateWarningShown = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filter, dateFrom, dateTo]);

  const filters: ResponseFilters = { search: debouncedSearch, status: filter, dateFrom, dateTo };

  // Form title/slug and the choice value→label map change rarely — cache them
  // per form so reopening the page or the detail modal doesn't refetch (N+1 fix).
  const { data: form } = useQuery({
    queryKey: ["form-meta", formId],
    queryFn: async () => {
      const { data, error } = await supabase.from("forms").select("title,slug").eq("id", formId).single();
      if (error) throw new Error(error.message);
      return data as { title: string; slug: string };
    },
    staleTime: 60_000,
  });

  const { data: optionMap = {} } = useQuery({
    queryKey: ["option-map", formId],
    queryFn: async () => {
      const { data, error } = await supabase.from("form_questions").select("id,options").eq("form_id", formId);
      if (error) throw new Error(error.message);
      return buildOptionMap((data ?? []) as { id: string; options: { label: string; value: string }[] | null }[]);
    },
    staleTime: 60_000,
  });

  const { data, isLoading: loading, refetch } = useQuery<TabularData>({
    queryKey: ["responses-tabular", formId, page, debouncedSearch, filter, dateFrom, dateTo],
    queryFn: async () => {
      try {
        return await fetchTabular(formId, { limit: PAGE_SIZE, offset: page * PAGE_SIZE, ...filters });
      } catch (err) {
        if (err instanceof DateFilterUnsupportedError) {
          if (!dateWarningShown.current) {
            dateWarningShown.current = true;
            toast.warning(err.message);
          }
          return err.fallbackData;
        }
        toast.error(err instanceof Error ? err.message : "Failed to load responses");
        throw err;
      }
    },
    staleTime: 15_000,
    placeholderData: prev => prev, // keep the table while a new page/filter loads
  });

  // Selection is cleared whenever the visible result set changes.
  useEffect(() => { setSelected(new Set()); }, [data]);

  const load = () => {
    queryClient.invalidateQueries({ queryKey: ["responses-tabular", formId] });
    refetch();
  };

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function applyBulk() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const label = bulkStatus.replace(/_/g, " ");
    const confirmed = await confirm({
      title: "Change Submission Status",
      message: `Change status of ${ids.length} submission(s) to "${label}"?`,
      confirmLabel: "Change Status",
      variant: "default",
    });
    if (!confirmed) return;
    setApplying(true);
    try {
      const actorEmail = (await supabase.auth.getUser()).data.user?.email ?? null;
      const subs = data?.submissions ?? [];
      const targets = subs.filter(s => ids.includes(s.id) && s.status !== bulkStatus);
      if (targets.length > 0) {
        const { error } = await supabase.from("submissions")
          .update({ status: bulkStatus as never })
          .in("id", targets.map(t => t.id));
        if (error) { toast.error(error.message); return; }

        await supabase.from("submission_status_history").insert(
          targets.map(t => ({
            submission_id: t.id,
            form_id: formId,
            from_status: t.status,
            to_status: bulkStatus,
          }))
        );

        await supabase.from("audit_logs").insert(
          targets.map(t => ({
            action: "submission.status_changed",
            entity: "submission",
            entity_id: t.id,
            actor_email: actorEmail,
            metadata: { from: t.status, to: bulkStatus, bulk: true },
          }))
        );
      }
      toast.success(`${targets.length} submission(s) moved to "${label}"`);
      load();
    } finally {
      setApplying(false);
    }
  }

  async function handleStatusChange(submissionId: string, newStatus: string) {
    const submission = data?.submissions.find(s => s.id === submissionId);
    if (!submission) return;

    const actorEmail = (await supabase.auth.getUser()).data.user?.email ?? null;
    const { error } = await supabase.from("submissions")
      .update({ status: newStatus as never })
      .eq("id", submissionId);

    if (error) {
      toast.error(error.message);
      return;
    }

    await supabase.from("submission_status_history").insert({
      submission_id: submissionId,
      form_id: formId,
      from_status: submission.status,
      to_status: newStatus,
    });

    await supabase.from("audit_logs").insert({
      action: "submission.status_changed",
      entity: "submission",
      entity_id: submissionId,
      actor_email: actorEmail,
      metadata: { from: submission.status, to: newStatus },
    });

    toast.success("Status updated");
    load();
  }

  const subs = data?.submissions ?? [];
  const questions = data?.questions ?? [];
  const total = data?.total_count ?? 0;

  async function exportExcel() {
    setExporting(true);
    try {
      const count = await exportResponsesXlsx({
        formId,
        slug: form?.slug ?? null,
        filters,
        questions,
        optionMap,
      });
      if (count === 0) {
        toast.error("No responses to export");
        return;
      }
      toast.success(`Exported ${count} response${count !== 1 ? "s" : ""}`);
    } catch (err) {
      if (err instanceof DateFilterUnsupportedError) {
        toast.warning(err.message);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const hasFilters = debouncedSearch.trim() !== "" || filter !== "all" || dateFrom !== "" || dateTo !== "";

  return (
    <AdminShell>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/forms"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:bg-secondary transition-colors shrink-0" aria-label="Back to forms">
            <ArrowLeft className="h-4 w-4" /> Forms
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{form?.title ?? "Responses"}</h1>
            <p className="text-xs text-muted-foreground">
              {total} matching submission{total !== 1 ? "s" : ""}
              {hasFilters ? " (filtered)" : ""}
            </p>
          </div>
          <button
            onClick={exportExcel}
            disabled={exporting || total === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export {hasFilters ? "Filtered" : "All"} ({total})
          </button>
        </div>

        <ResponsesFilterBar
          search={search}
          status={filter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onSearch={setSearch}
          onStatus={setFilter}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
        />

        <BulkActionsBar
          count={selected.size}
          bulkStatus={bulkStatus}
          applying={applying}
          onBulkStatus={setBulkStatus}
          onApply={applyBulk}
          onClear={() => setSelected(new Set())}
        />

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : subs.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-12 text-center text-muted-foreground text-sm">
            {hasFilters ? "No submissions match your filters." : "No submissions yet."}
          </div>
        ) : (
          <>
            <ResponsesTable
              submissions={subs}
              selected={selected}
              onToggleSelect={toggleSelect}
              onSelectAll={checked => setSelected(checked ? new Set(subs.map(s => s.id)) : new Set())}
              onView={setSelectedSubmission}
            />

            <PaginationBar
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              shown={subs.length}
              onPrev={() => setPage(p => Math.max(0, p - 1))}
              onNext={() => setPage(p => p + 1)}
            />
          </>
        )}
      </div>

      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          questions={questions}
          optionMap={optionMap}
          onClose={() => setSelectedSubmission(null)}
          onStatusChange={(newStatus) => {
            handleStatusChange(selectedSubmission.id, newStatus);
            setSelectedSubmission(null);
          }}
        />
      )}
    </AdminShell>
  );
}
