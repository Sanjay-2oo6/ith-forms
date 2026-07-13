import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Monitor, Smartphone, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { BuilderPreviewDraft } from "./types";

// Drop pending media data-URLs (base64 of files up to 25 MB) from a draft.
// Keeps kind + any already-saved path so the preview shows the last saved
// media instead of the unsaved one.
function stripPendingMedia(draft: BuilderPreviewDraft): BuilderPreviewDraft {
  return {
    ...draft,
    questions: draft.questions.map(q => {
      const media = q.config?.media;
      if (!media?.pendingDataUrl) return q;
      return {
        ...q,
        config: {
          ...q.config,
          media: media.oldPath || media.path
            ? { kind: media.kind, path: media.path ?? media.oldPath }
            : undefined,
        },
      };
    }),
  };
}

type PreviewModalProps = {
  slug: string;
  draft: BuilderPreviewDraft;
  onClose: () => void;
};

/**
 * Live form preview: renders the real public form route in an iframe, with a
 * same-tab draft so unsaved builder edits are visible without persistence.
 */
export function PreviewModal({ slug, draft, onClose }: PreviewModalProps) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const draftKey = useMemo(() => `ith-preview-${draft.form.id}-${draft.createdAt}`, [draft.form.id, draft.createdAt]);
  const encodedKey = encodeURIComponent(draftKey);
  const src = `/forms/${slug}?preview=1&draft=${encodedKey}`;

  useEffect(() => {
    // sessionStorage has a ~5 MB quota; a draft carrying pending media
    // data-URLs (up to 25 MB base64) makes setItem THROW QuotaExceededError.
    // Thrown inside an effect that would crash the whole edit page into the
    // error boundary — the "dark overlay but no preview" failure. Degrade
    // instead: retry without the pending payloads, and if even that fails,
    // let the iframe fall back to the last saved state.
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify(stripPendingMedia(draft)));
        toast.info("Unsaved media files are too large for the live preview — showing the last saved media instead.");
      } catch {
        sessionStorage.removeItem(draftKey);
        toast.info("This draft is too large for the live preview — showing the last saved version instead.");
      }
    }
    return () => sessionStorage.removeItem(draftKey);
  }, [draft, draftKey]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] overflow-y-auto bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Form preview"
    >
      <div className="min-h-full flex items-start justify-center px-3 py-5 sm:p-6">
        <div
          className="w-full max-w-[1120px] flex flex-col items-center"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors ${
                device === "mobile"
                  ? "border-primary bg-card text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="h-4 w-4" /> Mobile
            </button>
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors ${
                device === "desktop"
                  ? "border-primary bg-card text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="h-4 w-4" /> Desktop
            </button>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> Open in tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-sm text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" /> Close
            </button>
          </div>

          <div
            className="bg-card border-4 border-border shadow-2xl overflow-hidden transition-all duration-300"
            style={
              device === "mobile"
                ? {
                    width: "min(390px, calc(100vw - 1.5rem))",
                    height: "min(844px, calc(100vh - 8.5rem))",
                    minHeight: 420,
                    borderRadius: "2rem",
                  }
                : {
                    width: "min(1100px, calc(100vw - 1.5rem))",
                    height: "min(820px, calc(100vh - 8.5rem))",
                    minHeight: 420,
                    borderRadius: "0.75rem",
                  }
            }
          >
            <iframe
              key={src}
              src={src}
              title="Form preview"
              className="w-full h-full border-0 bg-background"
            />
          </div>

          <p className="mt-3 text-center text-xs text-white/80">
            Preview mode - submissions are disabled. Unsaved edits are shown here without saving.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
