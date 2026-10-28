"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  MessageSquare,
  Info,
  X,
} from "lucide-react";

export type ToastType = "success" | "info" | "destructive" | "warning";

export interface ToastData {
  id?: string;
  message: string;
  type: ToastType;
  title?: string;
  duration?: number;
}

interface ToastNotificationPortalProps {
  toast: ToastData | null;
  onDismiss: () => void;
}

/**
 * ToastNotificationPortal
 * Renders high-priority notifications into a React Portal attached directly to document.body.
 * With z-[99999], it is guaranteed to float ABOVE all components, including modals,
 * dialogs, sheets, backdrops, drawers, popovers, and tooltips.
 */
export function ToastNotificationPortal({
  toast,
  onDismiss,
}: ToastNotificationPortalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Ensure our toast notification container NEVER becomes inert,
  // even when a modal dialog or drawer is active in document.body
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const removeInert = () => {
      if (el.hasAttribute("inert")) {
        el.removeAttribute("inert");
      }
      if (el.hasAttribute("data-base-ui-inert")) {
        el.removeAttribute("data-base-ui-inert");
      }
      if (el.hasAttribute("aria-hidden")) {
        el.removeAttribute("aria-hidden");
      }
    };

    removeInert();
    const observer = new MutationObserver(removeInert);
    observer.observe(el, {
      attributes: true,
      attributeFilter: ["inert", "data-base-ui-inert", "aria-hidden"],
    });

    return () => observer.disconnect();
  }, [mounted, toast]);

  // Auto-dismiss timer with pause-on-hover support
  React.useEffect(() => {
    if (!toast || isPaused) return;

    const duration = toast.duration ?? (toast.type === "destructive" ? 5000 : 4000);
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, isPaused, onDismiss]);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={containerRef}
      className="fixed top-4 right-4 sm:top-5 sm:right-5 z-[99999] pointer-events-none flex flex-col items-end gap-2.5 max-w-sm sm:max-w-md w-full px-2 sm:px-0"
      aria-live={toast?.type === "destructive" ? "assertive" : "polite"}
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id || `${toast.type}-${toast.message}`}
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.92, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl p-3.5 sm:p-4 shadow-2xl border-2 backdrop-blur-md w-full transition-shadow duration-200 ${
              toast.type === "success"
                ? "bg-emerald-950/95 text-emerald-100 border-emerald-500/80 shadow-emerald-950/50 ring-2 ring-emerald-500/20"
                : toast.type === "destructive"
                ? "bg-rose-950/95 text-rose-100 border-rose-500/80 shadow-rose-950/50 ring-2 ring-rose-500/20"
                : toast.type === "warning"
                ? "bg-amber-950/95 text-amber-100 border-amber-500/80 shadow-amber-950/50 ring-2 ring-amber-500/20"
                : "bg-zinc-950/95 text-zinc-100 border-zinc-700/80 shadow-black/60 ring-2 ring-zinc-700/20"
            }`}
          >
            {/* Status Icon */}
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" && (
                <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                </div>
              )}
              {toast.type === "destructive" && (
                <div className="h-6 w-6 rounded-full bg-rose-500/20 flex items-center justify-center animate-pulse">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                </div>
              )}
              {toast.type === "warning" && (
                <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                </div>
              )}
              {toast.type === "info" && (
                <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Info className="h-4 w-4 text-blue-400 shrink-0" />
                </div>
              )}
            </div>

            {/* Message Body */}
            <div className="flex-1 min-w-0 pr-1">
              {toast.title && (
                <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5 opacity-90">
                  {toast.title}
                </h4>
              )}
              <p className="text-xs sm:text-sm font-semibold leading-relaxed break-words">
                {toast.message}
              </p>
            </div>

            {/* Manual Dismiss Button */}
            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 rounded-lg p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-white/50 cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}

// ─── CONTEXT & PROVIDER FOR APP-WIDE TOAST USAGE ─────────────────────────────

interface ToastContextType {
  isAvailable: boolean;
  showToast: (
    message: string,
    type?: ToastType,
    options?: { title?: string; duration?: number }
  ) => void;
  dismissToast: () => void;
  toast: ToastData | null;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<ToastData | null>(null);

  const showToast = React.useCallback(
    (
      message: string,
      type: ToastType = "success",
      options?: { title?: string; duration?: number }
    ) => {
      setToast({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        message,
        type,
        title: options?.title,
        duration: options?.duration,
      });
    },
    []
  );

  const dismissToast = React.useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ isAvailable: true, showToast, dismissToast, toast }}>
      {children}
      <ToastNotificationPortal toast={toast} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = React.useContext(ToastContext);
  if (!context) {
    // Graceful fallback if used outside provider
    return {
      isAvailable: false,
      showToast: () => {},
      dismissToast: () => {},
      toast: null,
    };
  }
  return context;
}
