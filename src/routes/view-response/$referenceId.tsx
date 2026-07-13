import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IthLogo, useBranding } from "@/lib/ith-brand";
import { Loader2, AlertCircle, FileText } from "lucide-react";

export const Route = createFileRoute("/view-response/$referenceId")({
  ssr: false,
  component: ViewResponse,
});

type SubmissionData = {
  found: boolean;
  submission?: {
    id: string;
    reference_id: string;
    status: string;
    respondent_name: string | null;
    respondent_email: string | null;
    submitted_at: string;
  };
  form?: {
    title: string;
    description: string | null;
  };
  answers?: Array<{
    question_id: string;
    question_label: string;
    question_type: string;
    question_position: number;
    section_title: string;
    value: string;
  }>;
  files?: Array<{
    question_id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
  }>;
};

function ViewResponse() {
  const { referenceId } = Route.useParams();
  const branding = useBranding();
  const [data, setData] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubmission();
  }, [referenceId]);

  async function loadSubmission() {
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        "get_submission_by_reference",
        { p_reference_id: referenceId }
      );

      if (rpcError) {
        throw rpcError;
      }

      setData(result as SubmissionData);
    } catch (err) {
      console.error("Error loading submission:", err);
      setError((err as Error).message || "Failed to load submission");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your submission...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Error Loading Submission</h1>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data?.found || !data.submission) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Submission Not Found</h1>
          <p className="text-sm text-muted-foreground mb-2">
            We couldn't find a submission with reference ID:
          </p>
          <p className="font-mono font-semibold text-lg mb-4">{referenceId}</p>
          <p className="text-xs text-muted-foreground">
            Please check the reference ID and try again. Reference IDs are case-sensitive.
          </p>
        </div>
      </div>
    );
  }

  const { submission, form, answers, files } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <IthLogo size={28} />
          <span className="text-sm font-semibold">{branding.appName}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-border/60 bg-card p-8">
          {/* Header Section */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Your Submission</h1>
            {form && (
              <>
                <p className="text-lg font-semibold text-muted-foreground mb-1">{form.title}</p>
                {form.description && (
                  <p className="text-sm text-muted-foreground">{form.description}</p>
                )}
              </>
            )}
          </div>

          {/* Reference ID */}
          <div className="mb-8 p-4 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reference ID</p>
                <p className="text-xl font-mono font-bold text-primary">{submission.reference_id}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Submitted</p>
                <p className="text-sm font-medium">
                  {new Date(submission.submitted_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(submission.submitted_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
            {submission.respondent_name && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Respondent</p>
                <p className="text-sm font-medium">{submission.respondent_name}</p>
                {submission.respondent_email && (
                  <p className="text-xs text-muted-foreground">{submission.respondent_email}</p>
                )}
              </div>
            )}
          </div>

          {/* Answers */}
          <div>
            <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-border">
              Your Answers
            </h2>
            <div className="space-y-6">
              {answers && answers.length > 0 ? (
                answers.map((answer, idx) => {
                  // Group files by question
                  const questionFiles = files?.filter(f => f.question_id === answer.question_id) || [];
                  
                  return (
                    <div key={answer.question_id} className="pb-6 border-b border-border/40 last:border-0">
                      {/* Section title (only show when it changes) */}
                      {(idx === 0 || answers[idx - 1].section_title !== answer.section_title) && (
                        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                          {answer.section_title}
                        </p>
                      )}
                      
                      {/* Question */}
                      <p className="font-semibold text-base mb-2 text-foreground">
                        {answer.question_label}
                      </p>
                      
                      {/* Answer */}
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {answer.value || <span className="italic">(No answer provided)</span>}
                      </p>
                      
                      {/* Files */}
                      {questionFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Attached files:</p>
                          {questionFiles.map((file) => (
                            <div
                              key={file.file_path}
                              className="flex items-center gap-2 text-sm p-2 rounded-lg bg-secondary/30"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="flex-1 truncate">{file.file_name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {(file.file_size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No answers recorded for this submission.
                </p>
              )}
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              This is a read-only view of your submission. If you need to make changes,
              please contact the form administrator.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        {branding.poweredBy}
      </footer>
    </div>
  );
}
