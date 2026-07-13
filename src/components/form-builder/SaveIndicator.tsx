import { Loader2, Check, AlertCircle } from "lucide-react";
import type { SaveState } from "./types";

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Saving...</span>;
  }
  if (state === "dirty") {
    return <span className="flex items-center gap-1 text-xs text-amber-500"><AlertCircle className="h-3 w-3" />Unsaved changes</span>;
  }
  if (state === "error") {
    return <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />Save failed</span>;
  }
  return <span className="flex items-center gap-1 text-xs text-green-400"><Check className="h-3 w-3" />Saved</span>;
}
