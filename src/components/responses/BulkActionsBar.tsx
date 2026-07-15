import { Loader2 } from "lucide-react";
import { SUBMISSION_STATUSES } from "@/lib/responses";

// Bulk status-change controls, shown only while rows are selected.
export function BulkActionsBar({ count, bulkStatus, applying, onBulkStatus, onApply, onClear }: {
  count: number;
  bulkStatus: string;
  applying: boolean;
  onBulkStatus: (v: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 mb-4 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
      <span className="text-sm font-medium">{count} selected</span>
      <select value={bulkStatus} onChange={e => onBulkStatus(e.target.value)}
        className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
        {SUBMISSION_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
      </select>
      <button onClick={onApply} disabled={applying}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
        {applying && <Loader2 className="h-3 w-3 animate-spin" />} Apply Status
      </button>
      <button onClick={onClear}
        className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary">
        Clear Selection
      </button>
    </div>
  );
}

export function PaginationBar({ page, pageSize, total, shown, onPrev, onNext }: {
  page: number;
  pageSize: number;
  total: number;
  shown: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <button
        onClick={onPrev}
        disabled={page === 0}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Previous
      </button>
      <span className="text-sm text-muted-foreground">
        Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))} · {shown} shown
      </span>
      <button
        onClick={onNext}
        disabled={(page + 1) * pageSize >= total}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
    </div>
  );
}
