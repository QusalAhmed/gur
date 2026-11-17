"use client";

import * as React from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminPwa } from "@/components/admin/admin-pwa-provider";

const DISMISS_STORAGE_KEY = "gur_admin_pwa_banner_dismissed_until";
const DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function AdminPwaInstallBanner() {
  const { isStandalone, isIOS, canInstall, promptInstall } = useAdminPwa();
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const until = Number(localStorage.getItem(DISMISS_STORAGE_KEY) || "0");
      setDismissed(Number.isFinite(until) && until > Date.now());
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed || isStandalone || (!canInstall && !isIOS)) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(
        DISMISS_STORAGE_KEY,
        String(Date.now() + DISMISS_DURATION_MS)
      );
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div className="fixed bottom-3 inset-x-3 z-40 sm:hidden">
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-md">
        <img
          src="/icons/admin-icon-192.png"
          alt="Gur Admin"
          className="h-9 w-9 shrink-0 rounded-lg border border-amber-500/30"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">
            Install Gur Admin
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {isIOS
              ? "Add to Home Screen for instant push alerts"
              : "Quick launch & live order notifications"}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => void promptInstall()}
          className="h-7 shrink-0 gap-1 bg-amber-500 px-2.5 text-xs font-semibold text-black hover:bg-amber-400"
        >
          <Download className="h-3.5 w-3.5" />
          Install
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss install banner"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
