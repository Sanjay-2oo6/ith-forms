import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Plus, Copy, CopyPlus, ExternalLink, Pencil, Trash2, BookOpen, Eye, EyeOff, Share2, X, Mail, MessageCircle, Send, Download, Check } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { duplicateForm } from "@/lib/duplicate-form";
import { MoreMenu, type MoreMenuItem } from "@/components/MoreMenu";

export const Route = createFileRoute("/_admin/forms/")({
  ssr: false,
  component: FormsList,
});

type Form = {
  id: string; slug: string; title: string; status: string;
  response_count: number; max_responses: number | null; created_at: string;
  deleted_at?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-secondary text-secondary-foreground",
  published: "bg-green-500/20 text-green-400",
  closed:    "bg-yellow-500/20 text-yellow-400",
  archived:  "bg-muted text-muted-foreground",
};

function ShareModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      const cvs = canvasRef.current;
      import("qrcode").then((mod) => {
        mod.default.toCanvas(cvs, url, {
          width: 220, margin: 2,
          color: { dark: "#1A1A1A", light: "#FCFAF5" },
        });
      });
    }
  }, [url]);

  // The admin's optional note is prepended to the shared text.
  const shareText = message.trim()
    ? `${message.trim()}\n\n${title}\n${url}`
    : `${title}\n${url}`;
  const enc = encodeURIComponent;

  const apps: { key: string; label: string; icon: typeof Mail; color: string; href: string }[] = [
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "#25D366",
      href: `https://wa.me/?text=${enc(shareText)}` },
    { key: "gmail", label: "Gmail", icon: Mail, color: "#EA4335",
      href: `https://mail.google.com/mail/?view=cm&fs=1&su=${enc(title)}&body=${enc(shareText)}` },
    { key: "email", label: "Email", icon: Mail, color: "#5E5E5E",
      href: `mailto:?subject=${enc(title)}&body=${enc(shareText)}` },
    { key: "telegram", label: "Telegram", icon: Send, color: "#229ED9",
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(message.trim() || title)}` },
    { key: "twitter", label: "X", icon: Share2, color: "#1A1A1A",
      href: `https://twitter.com/intent/tweet?text=${enc(message.trim() || title)}&url=${enc(url)}` },
    { key: "linkedin", label: "LinkedIn", icon: Share2, color: "#0A66C2",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
  ];

  function copyLink() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadQr() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `qr-${title.toLowerCase().replace(/\s+/g, "-")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  async function nativeShare() {
    if (navigator.share) {
      try { await navigator.share({ title, text: message.trim() || title, url }); } catch { /* cancelled */ }
    } else {
      copyLink();
      toast.success("Link copied — paste it anywhere to share");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="relative rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-2xl animate-fade-up w-full max-w-md my-8" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:text-destructive transition-colors" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-semibold mb-1 pr-6">Share form</h2>
        <p className="text-xs text-muted-foreground mb-4 truncate">{title}</p>

        {/* QR code */}
        <div className="flex justify-center mb-4">
          <div className="rounded-xl border border-border p-2 bg-card">
            <canvas ref={canvasRef} className="block" />
          </div>
        </div>

        {/* Link + copy + download QR */}
        <div className="flex items-center gap-2 mb-4">
          <input readOnly value={url}
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs font-mono truncate focus:outline-none" />
          <button onClick={copyLink} title="Copy link"
            className="h-9 px-3 rounded-md border border-border text-xs hover:bg-secondary transition-colors flex items-center gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={downloadQr} title="Download QR code"
            className="h-9 px-2.5 rounded-md border border-border text-xs hover:bg-secondary transition-colors">
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Message / description — feeds into the shared text */}
        <div className="mb-4">
          <label className="text-xs font-medium mb-1.5 block">Add a message (optional)</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={2}
            placeholder="e.g. Please register for our workshop by Friday…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Share targets */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {apps.map(app => (
            <a key={app.key} href={app.href} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-secondary transition-colors">
              <span className="h-10 w-10 rounded-full grid place-items-center text-white shrink-0" style={{ background: app.color }}>
                <app.icon className="h-5 w-5" />
              </span>
              <span className="text-[10px] text-muted-foreground">{app.label}</span>
            </a>
          ))}
        </div>

        <button onClick={nativeShare}
          className="w-full h-10 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
          <Share2 className="h-4 w-4" /> More share options
        </button>
      </div>
    </div>
  );
}

function FormsList() {
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showTrash, setShowTrash] = useState(false);
  const [shareForm, setShareForm] = useState<Form | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const { data: forms = [], isLoading: loading, refetch } = useQuery({
    queryKey: ["forms-list", showTrash],
    queryFn: async () => {
      let q = supabase
        .from("forms")
        .select("id,slug,title,status,response_count,max_responses,created_at,deleted_at")
        .order("created_at", { ascending: false });
      if (showTrash) {
        q = q.not("deleted_at", "is", null);
      } else {
        q = q.is("deleted_at", null);
      }
      const { data } = await q;
      return (data ?? []) as Form[];
    },
    staleTime: 15_000,
  });
  const load = () => refetch();

  const filtered = forms.filter(f => {
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return f.title.toLowerCase().includes(q) || f.slug.toLowerCase().includes(q);
    }
    return true;
  });

  async function softDelete(id: string) {
    const confirmed = await confirm({
      title: "Delete Form",
      message: "Are you sure you want to move this form to deleted?",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!confirmed) return;
    
    const form = forms.find(f => f.id === id);
    const { error } = await supabase.from("forms")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    
    // Log to audit
    await supabase.from("audit_logs").insert({
      action: "form.deleted",
      entity: "form",
      entity_id: id,
      metadata: { title: form?.title || 'Unknown' },
    });
    
    toast.success("Form deleted");
    load();
  }

  async function restoreForm(id: string) {
    const form = forms.find(f => f.id === id);
    const { error } = await supabase.from("forms")
      .update({ status: "draft", deleted_at: null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }

    await supabase.from("audit_logs").insert({
      action: "form.restored",
      entity: "form",
      entity_id: id,
      metadata: { title: form?.title || "Unknown" },
    });

    toast.success("Form restored");
    load();
  }

  async function togglePublish(f: Form) {
    if (f.status === "published") {
      const { error } = await supabase.from("forms")
        .update({ status: "draft", published_at: null })
        .eq("id", f.id);
      if (error) { toast.error(error.message); return; }
      
      // Log unpublish
      await supabase.from("audit_logs").insert({
        action: "form.unpublished",
        entity: "form",
        entity_id: f.id,
        metadata: { title: f.title },
      });
      
      toast.success("Form unpublished");
    } else {
      const [{ data: sections }, { data: qs }] = await Promise.all([
        supabase.from("form_sections").select("id").eq("form_id", f.id),
        supabase.from("form_questions").select("type").eq("form_id", f.id),
      ]);
      if (!sections?.length) {
        toast.error("Add at least one section before publishing this form.");
        return;
      }
      const realQuestions = (qs ?? []).filter(
        q => !["section_heading", "information_paragraph", "hidden"].includes(q.type as string)
      );
      if (realQuestions.length === 0) {
        toast.error("Add at least one question before publishing this form.");
        return;
      }

      const { error } = await supabase.from("forms")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", f.id);
      if (error) { toast.error(error.message); return; }

      // Log publish
      await supabase.from("audit_logs").insert({
        action: "form.published",
        entity: "form",
        entity_id: f.id,
        metadata: { title: f.title },
      });

      toast.success("Form published");
    }
    load();
  }

  // The standalone Copy-link button was folded into Share (the ShareModal has
  // its own Copy button, verified working) — one less action per row.
  async function handleDuplicate(f: Form) {
    const confirmed = await confirm({
      title: "Duplicate Form",
      message: `Create a draft copy of "${f.title}" with all sections, questions, and theme? Responses are not copied.`,
      confirmLabel: "Duplicate",
      variant: "default",
    });
    if (!confirmed) return;
    setDuplicatingId(f.id);
    try {
      const newId = await duplicateForm(f.id);
      toast.success("Form duplicated — opening the copy");
      navigate({ to: "/forms/$formId/edit", params: { formId: newId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate form");
    } finally {
      setDuplicatingId(null);
    }
  }

  return (
    <AdminShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Forms</h1>
            <p className="text-sm text-muted-foreground">Create, publish, and manage every form.</p>
          </div>
          <Link to="/forms/new" className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New form
          </Link>
        </div>

        <div className="flex gap-3 mb-5">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title or slug"
            className="flex-1 h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={() => setShowTrash(v => !v)}
            className={`h-9 px-3 rounded-md border text-sm transition-colors ${
              showTrash ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
            }`}
          >
            {showTrash ? "Back to forms" : "Trash"}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-12 text-center">
            <p className="text-muted-foreground mb-4">
              {showTrash ? "Trash is empty." : forms.length === 0 ? "No forms yet." : "No forms match your filters."}
            </p>
            {!showTrash && forms.length === 0 && (
              <Link to="/forms/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Create your first form
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(f => (
              <div key={f.id} className="flex items-center gap-4 rounded-xl border border-border/60 bg-card px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold truncate">{f.title}</p>
                    <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${STATUS_COLORS[f.status] ?? ""}`}>
                      {f.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    /forms/{f.slug} ·{" "}
                    <Link
                      to="/forms/$formId/responses"
                      params={{ formId: f.id }}
                      className="hover:text-primary hover:underline transition-colors"
                      title="View responses"
                    >
                      {f.response_count} response{f.response_count !== 1 ? "s" : ""}{f.max_responses ? ` / ${f.max_responses}` : ""}
                    </Link>
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  {!showTrash ? (
                    <>
                      <Link to="/forms/$formId/responses" params={{ formId: f.id }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors">
                        <BookOpen className="h-3.5 w-3.5" /> Responses
                      </Link>
                      <Link to="/forms/$formId/edit" params={{ formId: f.id }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Link>
                      {/* Share/Open only make sense once a public URL exists. */}
                      {f.status === "published" && (
                        <>
                          <button onClick={() => setShareForm(f)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors">
                            <Share2 className="h-3.5 w-3.5" /> Share
                          </button>
                          <a href={`/forms/${f.slug}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors">
                            <ExternalLink className="h-3.5 w-3.5" /> Open
                          </a>
                        </>
                      )}
                      <MoreMenu
                        label={`More actions for ${f.title}`}
                        items={[
                          {
                            label: duplicatingId === f.id ? "Duplicating…" : "Duplicate",
                            icon: CopyPlus,
                            disabled: duplicatingId !== null,
                            onSelect: () => handleDuplicate(f),
                          },
                          f.status === "published"
                            ? { label: "Unpublish", icon: EyeOff, onSelect: () => togglePublish(f) }
                            : { label: "Publish", icon: Eye, onSelect: () => togglePublish(f) },
                          { type: "separator" },
                          { label: "Delete", icon: Trash2, destructive: true, onSelect: () => softDelete(f.id) },
                        ] satisfies MoreMenuItem[]}
                      />
                    </>
                  ) : (
                    <button onClick={() => restoreForm(f.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border text-primary hover:bg-primary/10 transition-colors">
                        Restore
                      </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {shareForm && (
        <ShareModal
          url={`${window.location.origin}/forms/${shareForm.slug}`}
          title={shareForm.title}
          onClose={() => setShareForm(null)}
        />
      )}
    </AdminShell>
  );
}
