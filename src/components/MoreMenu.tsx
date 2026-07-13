import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MoreMenuItem =
  | { type?: "item"; label: string; icon?: LucideIcon; destructive?: boolean; disabled?: boolean; onSelect: () => void }
  | { type: "separator" };

/**
 * Accessible "⋮" dropdown for row actions.
 * - Portaled to <body> with viewport coordinates (immune to transformed /
 *   overflow ancestors — same lesson as the question-type picker).
 * - Outside click + Escape close; focus returns to the trigger.
 * - ArrowUp/Down/Home/End roving focus; Enter/Space activates.
 * - ARIA menu/menuitem semantics; flips upward near the bottom edge.
 */
export function MoreMenu({ items, label = "More actions" }: { items: MoreMenuItem[]; label?: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = rect !== null;

  function close(returnFocus = true) {
    setRect(null);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    // Focus the first enabled item when the menu opens.
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();
    });
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const focusables = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])];
    const idx = focusables.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); focusables[(idx + 1) % focusables.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusables[(idx - 1 + focusables.length) % focusables.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); focusables[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); focusables[focusables.length - 1]?.focus(); }
    else if (e.key === "Tab") { close(false); }
  }

  const MENU_W = 208;
  const style: React.CSSProperties = rect
    ? (() => {
        const estH = 44 * items.filter(i => i.type !== "separator").length + 16;
        const openUp = window.innerHeight - rect.bottom - 8 < estH;
        return {
          position: "fixed",
          ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
          left: Math.max(8, Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - 8)),
          width: MENU_W,
          zIndex: 60,
        };
      })()
    : {};

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          setRect(prev => (prev ? null : r));
        }}
        className="flex items-center justify-center h-[26px] w-8 rounded-md text-xs border border-border hover:bg-secondary transition-colors"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          style={style}
          className="rounded-xl border border-border bg-card shadow-xl p-1.5 space-y-0.5"
        >
          {items.map((item, i) =>
            item.type === "separator" ? (
              <div key={i} role="separator" className="my-1 h-px bg-border/60" />
            ) : (
              <button
                key={i}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => { close(false); item.onSelect(); }}
                className={`flex w-full items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors disabled:opacity-50 ${
                  item.destructive
                    ? "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10"
                    : "hover:bg-secondary focus-visible:bg-secondary"
                } outline-none`}
              >
                {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0" />}
                {item.label}
              </button>
            )
          )}
        </div>,
        document.body
      )}
    </>
  );
}
