import { X } from "lucide-react";
import { SUBMISSION_STATUSES } from "@/lib/responses";

// Search + status + submission-date-range controls for the Responses page.
// All filtering is server-side (get_form_responses_tabular) — this bar only
// owns the inputs; the parent owns the state so exports share the filters.
export function ResponsesFilterBar({ search, status, dateFrom, dateTo, onSearch, onStatus, onDateFrom, onDateTo }: {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
}) {
  const hasDates = dateFrom !== "" || dateTo !== "";

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <input
        value={search}
        onChange={e => onSearch(e.target.value)}
        placeholder="Search by name, email, reference ID…"
        className="flex-1 min-w-56 h-10 rounded-lg border border-input bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <select value={status} onChange={e => onStatus(e.target.value)}
        className="h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
        <option value="all">All statuses</option>
        {SUBMISSION_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
      </select>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="resp-date-from">From</label>
        <input
          id="resp-date-from"
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={e => onDateFrom(e.target.value)}
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="text-xs text-muted-foreground" htmlFor="resp-date-to">To</label>
        <input
          id="resp-date-to"
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={e => onDateTo(e.target.value)}
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {hasDates && (
          <button
            onClick={() => { onDateFrom(""); onDateTo(""); }}
            className="flex items-center gap-1 h-10 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Clear date filter"
          >
            <X className="h-3.5 w-3.5" /> Clear dates
          </button>
        )}
      </div>
    </div>
  );
}
