"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname } from "next/navigation";
import { trackPageView, getClientFbpAndFbc, sendCapiClientEvent } from "@/lib/facebook-pixel";

function FacebookPixelTrackerInner() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) {
      return;
    }

    // Prevent duplicate firing for identical path in single session
    if (lastTrackedPath.current === pathname) {
      return;
    }
    lastTrackedPath.current = pathname;

    const runTracking = () => {
      const eventId = trackPageView();
      if (eventId) {
        const { fbp, fbc } = getClientFbpAndFbc();
        const currentUrl = typeof window !== "undefined" ? window.location.href : undefined;
        sendCapiClientEvent("PageView", {
          eventId,
          url: currentUrl,
          fbp,
          fbc,
        });
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (window as any).requestIdleCallback(runTracking, { timeout: 2500 });
    } else {
      setTimeout(runTracking, 1000);
    }
  }, [pathname]);

  return null;
}

export function FacebookPixelTracker() {
  return (
    <Suspense fallback={null}>
      <FacebookPixelTrackerInner />
    </Suspense>
  );
}
