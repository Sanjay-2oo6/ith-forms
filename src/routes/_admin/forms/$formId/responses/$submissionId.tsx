import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildOptionMap } from "@/lib/responses";
import { AdminShell } from "@/components/admin/AdminShell";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { displayAnswer } from "@/lib/export-utils";

export const Route = createFileRoute("/_admin/forms/$formId/responses/$submissionId")({
  ssr: false,
  component: SubmissionDetail,
});

type Submission = {
  id: string; reference_id: string; status: string;
  respondent_name: string | null; respondent_email: string | null;
  submitted_at: string;
};
type Answer = { 
  id: string; 
  question_id: string; 
  value: string | null; 
  question_label: string;
  question_type: string;
};
type Note = { id: string; body: string; created_at: string };
type History = { id: string; from_status: string | null; to_status: string; changed_at: string; note: string | null };

const STATUSES = ["new","under_review","approved","rejected","more_info_required","archived"] as const;
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400",
  under_review: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
  more_info_required: "bg-orange-500/20 text-orange-400",
  archived: "bg-secondary text-secondary-foreground",
};

type SubmissionDetailData = {
  submission: Submission;
  answers: Answer[];
  notes: Note[];
  history: History[];
};

function SubmissionDetail() {
  const { formId, submissionId } = Route.useParams();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  // F1: value→label map for choice answers. Shares the query cache with the
  // responses list page (same key), so navigating between them never refetches.
  const { data: optionMap = {} } = useQuery({
    queryKey: ["option-map", formId],
    queryFn: async () => {
      const { data, error } = await supabase.from("form_questions").select("id,options").eq("form_id", formId);
      if (error) throw new Error(error.message);
      return buildOptionMap((data ?? []) as { id: string; options: { label: string; value: string }[] | null }[]);
    },
    staleTime: 60_000,
  });

  // One RPC call fetches submission + answers + notes + history; cached per
  // submission so re-opening the same detail doesn't re-query (N+1 fix).
  const { data: detail, isLoading: loading } = useQuery<SubmissionDetailData | null>({
    queryKey: ["submission-detail", submissionId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_submission_detail", {
        p_submission_id: submissionId,
      });
      if (error) {
        console.error("Failed to load submission:", error);
        toast.error(error.message);
        throw new Error(error.message);
      }
      return (data as SubmissionDetailData) ?? null;
    },
    staleTime: 30_000,
  });

  const sub = detail?.submission ?? null;
  const answers = detail?.answers ?? [];
  const notes = detail?.notes ?? [];
  const history = detail?.history ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["submission-detail", submissionId] });

  async function changeStatus(newStatus: string) {
    if (!sub || newStatus === sub.status) return;
    setChangingStatus(true);
    const { error } = await supabase.from("submissions").update({ status: newStatus as never }).eq("id", submissionId);
    if (error) { toast.error(error.message); setChangingStatus(false); return; }
    const actorEmail = (await supabase.auth.getUser()).data.user?.email ?? null;
    await supabase.from("submission_status_history").insert({
      submission_id: submissionId,
      form_id: formId,
      from_status: sub.status,
      to_status: newStatus,
    });
    supabase.from("audit_logs").insert({
      action: "submission.status_changed",
      entity: "submission",
      entity_id: submissionId,
      actor_email: actorEmail,
      metadata: { from: sub.status, to: newStatus },
    }).then(({ error }) => {
      if (error) console.error("[audit] insert failed:", error.code, error.message);
    });
    toast.success(`Status changed to "${newStatus.replace(/_/g," ")}"`);
    setChangingStatus(false);
    // The list shows statuses too — refresh both caches.
    queryClient.invalidateQueries({ queryKey: ["responses-tabular", formId] });
    invalidate();
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setAddingNote(true);
    const { error } = await supabase.from("submission_notes").insert({
      submission_id: submissionId,
      form_id: formId,
      body: newNote.trim(),
    });
    if (error) { toast.error(error.message); setAddingNote(false); return; }
    setNewNote("");
    setAddingNote(false);
    invalidate();
  }

  if (loading) return <AdminShell><div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div></AdminShell>;
  if (!sub) return <AdminShell><div className="p-6 text-muted-foreground">Submission not found.</div></AdminShell>;

  return (
    <AdminShell>
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/forms/$formId/responses" params={{ formId }}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors" aria-label="Back to responses list">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono">{sub.reference_id}</h1>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sub.status] ?? ""}`}>
                {sub.status.replace(/_/g," ")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {sub.respondent_name ?? "Anonymous"}{sub.respondent_email ? ` · ${sub.respondent_email}` : ""}
              {" · submitted "}{format(new Date(sub.submitted_at), "d MMM yyyy, HH:mm")}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main: Answers */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
              <h2 className="font-semibold text-sm">Answers</h2>
              {answers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No answers recorded.</p>
              ) : answers.map(a => (
                <div key={a.id}>
                  <p className="text-xs text-muted-foreground mb-0.5">{a.question_label ?? "Question"}</p>
                  <p className="text-sm">{a.value ? displayAnswer(a.value, a.question_type, optionMap[a.question_id]) : <span className="text-muted-foreground italic">—</span>}</p>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
              <h2 className="font-semibold text-sm">Internal Notes</h2>
              {notes.map(n => (
                <div key={n.id} className="border-l-2 border-primary/40 pl-3">
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{format(new Date(n.created_at), "d MMM yyyy, HH:mm")}</p>
                </div>
              ))}
              <form onSubmit={addNote} className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  rows={2}
                  placeholder="Add internal note…"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <button type="submit" disabled={addingNote || !newNote.trim()}
                  className="self-end px-3 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-60">
                  {addingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar: Status + History */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Change Status</h2>
              <div className="space-y-1.5">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    disabled={changingStatus || s === sub.status}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                      s === sub.status ? STATUS_COLORS[s] + " font-medium" : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                    } disabled:opacity-60`}
                  >
                    {s.replace(/_/g," ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Status History</h2>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No transitions yet.</p>
              ) : history.map(h => (
                <div key={h.id} className="text-xs">
                  <p className="text-foreground">
                    {h.from_status ? `${h.from_status.replace(/_/g," ")} → ` : ""}{h.to_status.replace(/_/g," ")}
                  </p>
                  <p className="text-muted-foreground">{format(new Date(h.changed_at), "d MMM, HH:mm")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
