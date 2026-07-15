import { useState } from "react";
import { X, Calendar, User, Mail, FileText, Download, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayAnswer } from "@/lib/export-utils";
import { toast } from "sonner";

type Answer = {
  value: string;
  question_label: string;
  question_type: string;
  question_position: number;
};

type FileInfo = {
  question_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
};

type Submission = {
  id: string;
  reference_id: string;
  status: string;
  respondent_name: string | null;
  respondent_email: string | null;
  submitted_at: string;
  answers: Record<string, Answer> | null;
  files: FileInfo[] | null;
};

type Question = {
  id: string;
  label: string;
  type: string;
  position: number;
  section_title: string | null;
};

interface SubmissionDetailModalProps {
  submission: Submission;
  questions: Question[];
  optionMap?: Record<string, Record<string, string>>;
  onClose: () => void;
  onStatusChange?: (newStatus: string) => void;
}

const STATUSES = ["new", "under_review", "approved", "rejected", "more_info_required", "archived"];
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  more_info_required: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  archived: "bg-secondary text-secondary-foreground border-border",
};

export function SubmissionDetailModal({
  submission,
  questions,
  optionMap,
  onClose,
  onStatusChange,
}: SubmissionDetailModalProps) {
  // file_path of the file whose signed URL is being generated ("open:…" /
  // "dl:…" so the two buttons show independent spinners).
  const [fileBusy, setFileBusy] = useState<string | null>(null);

  async function handleStatusChange(newStatus: string) {
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
  }

  // submission-files is PRIVATE — both actions go through short-lived signed
  // URLs (storage RLS: admin only). Open views in a new tab; Download asks
  // Supabase to add Content-Disposition: attachment with the ORIGINAL
  // filename, so the browser saves instead of navigating.
  async function openFile(file: FileInfo) {
    setFileBusy(`open:${file.file_path}`);
    try {
      const { data, error } = await supabase.storage
        .from("submission-files")
        .createSignedUrl(file.file_path, 3600);
      if (error || !data?.signedUrl) {
        toast.error("Could not create a link to open this file.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setFileBusy(null);
    }
  }

  async function downloadFile(file: FileInfo) {
    setFileBusy(`dl:${file.file_path}`);
    try {
      const { data, error } = await supabase.storage
        .from("submission-files")
        .createSignedUrl(file.file_path, 3600, { download: file.file_name });
      if (error || !data?.signedUrl) {
        toast.error("Could not create a download link.");
        return;
      }
      // Anchor click (not window.open): with Content-Disposition attachment
      // the browser downloads in place — no blank tab left behind.
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setFileBusy(null);
    }
  }

  // Sort questions by position
  const sortedQuestions = [...questions].sort((a, b) => a.position - b.position);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-card rounded-xl border border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div>
            <h2 className="text-xl font-bold">Submission Details</h2>
            <p className="text-sm text-muted-foreground font-mono mt-1">{submission.reference_id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Submission Info Card */}
          <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{submission.respondent_name || "Anonymous"}</span>
                </div>
                {submission.respondent_email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span>{submission.respondent_email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    {new Date(submission.submitted_at).toLocaleDateString()}{" "}
                    {new Date(submission.submitted_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              
              {/* Status Selector */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Status</label>
                <select
                  value={submission.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                    STATUS_COLORS[submission.status] || "bg-secondary"
                  } cursor-pointer`}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Answers */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Responses
            </h3>
            <div className="space-y-6">
              {sortedQuestions.map((question, idx) => {
                const answer = submission.answers?.[question.id];
                const questionFiles = submission.files?.filter(f => f.question_id === question.id) || [];
                
                // Skip display-only question types
                if (['section_heading', 'information_paragraph', 'hidden'].includes(question.type)) {
                  return null;
                }

                // Show section title when it changes
                const showSectionTitle = idx === 0 || 
                  sortedQuestions[idx - 1]?.section_title !== question.section_title;

                return (
                  <div key={question.id} className="pb-6 border-b border-border/40 last:border-0">
                    {showSectionTitle && question.section_title && (
                      <div className="mb-3 pb-2 border-b border-border/20">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                          {question.section_title}
                        </p>
                      </div>
                    )}
                    
                    {/* Question */}
                    <div className="mb-2">
                      <p className="font-semibold text-base text-foreground">
                        {question.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Type: {question.type.replace(/_/g, " ")}
                      </p>
                    </div>

                    {/* Answer — choice values mapped to labels (F1/F6) */}
                    <div className="mt-2">
                      {answer ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-secondary/30 rounded-lg p-3 border border-border/40">
                          {displayAnswer(answer.value, question.type, optionMap?.[question.id])}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No answer provided</p>
                      )}
                    </div>

                    {/* Files */}
                    {questionFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Attached files:</p>
                        {questionFiles.map((file) => (
                          <div
                            key={file.file_path}
                            className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/40"
                          >
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.file_size / 1024).toFixed(1)} KB · {file.mime_type}
                              </p>
                            </div>
                            <button
                              onClick={() => openFile(file)}
                              disabled={fileBusy !== null}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors disabled:opacity-50"
                              aria-label={`Open ${file.file_name} in a new tab`}
                            >
                              {fileBusy === `open:${file.file_path}`
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <ExternalLink className="h-3.5 w-3.5" />} Open
                            </button>
                            <button
                              onClick={() => downloadFile(file)}
                              disabled={fileBusy !== null}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors disabled:opacity-50"
                              aria-label={`Download ${file.file_name}`}
                            >
                              {fileBusy === `dl:${file.file_path}`
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Download className="h-3.5 w-3.5" />} Download
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
