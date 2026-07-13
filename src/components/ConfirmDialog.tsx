import { createContext, useContext, useState, ReactNode } from "react";
import { X } from "lucide-react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

// The confirm() signature, for components that receive it as a prop.
export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, options, resolve });
    });
  };

  const handleClose = (confirmed: boolean) => {
    state?.resolve(confirmed);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state?.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => handleClose(false)}
        >
          <div
            className="relative rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-2xl max-w-md w-full mx-4 animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleClose(false)}
              className="absolute top-4 right-4 p-1 hover:text-destructive transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold mb-2 pr-8">{state.options.title}</h2>
            <p className="text-sm text-muted-foreground mb-6">{state.options.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleClose(false)}
                className="flex-1 h-10 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
              >
                {state.options.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`flex-1 h-10 rounded-md text-sm font-medium transition-colors ${
                  state.options.variant === "destructive"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {state.options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
