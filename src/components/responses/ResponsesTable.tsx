import { Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ResponseSubmission } from "@/lib/responses";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  more_info_required: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  archived: "bg-secondary text-secondary-foreground border-border",
};

export function ResponsesTable({ submissions, selected, onToggleSelect, onSelectAll, onView }: {
  submissions: ResponseSubmission[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onView: (s: ResponseSubmission) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left w-12">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={submissions.length > 0 && submissions.every(s => selected.has(s.id))}
                  onChange={e => onSelectAll(e.target.checked)}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-muted-foreground">
                Reference ID
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-muted-foreground">
                Respondent
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase text-muted-foreground">
                Submitted
              </th>
              <th className="px-4 py-3 text-center font-semibold text-xs uppercase text-muted-foreground w-32">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {submissions.map((s, idx) => (
              <tr key={s.id} className={`hover:bg-secondary/20 transition-colors ${idx % 2 === 0 ? 'bg-card' : 'bg-secondary/5'}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={selected.has(s.id)}
                    onChange={() => onToggleSelect(s.id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono font-semibold text-primary">
                    {s.reference_id}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${STATUS_COLORS[s.status] ?? ""}`}>
                    {s.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[200px]">
                    <div className="font-medium text-foreground truncate">{s.respondent_name ?? "Anonymous"}</div>
                    {s.respondent_email && (
                      <div className="text-xs text-muted-foreground truncate">{s.respondent_email}</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="text-sm">
                    {new Date(s.submitted_at).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground/70">
                    {formatDistanceToNow(new Date(s.submitted_at))} ago
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onView(s)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
