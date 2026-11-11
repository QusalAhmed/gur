"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname } from "next/navigation";
import { trackPageView, getClientFbpAndFbc, sendCapiClientEvent } from "@/lib/facebook-pixel";

function FacebookPixelTrackerInner() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    if (pathname.startsWith("/admin")) {
      lastTrackedPath.current = pathname;
      return;
    }

    // Prevent duplicate firing for identical path in single session
    if (lastTrackedPath.current === pathname) {
      return;
    }

    let cancelled = false;
    const trackedUrl = typeof window !== "undefined" ? window.location.href : undefined;

    const runTracking = () => {
      if (cancelled || lastTrackedPath.current === pathname) {
        return;
      }
      lastTrackedPath.current = pathname;

      const eventId = trackPageView();
      if (eventId) {
        const { fbp, fbc } = getClientFbpAndFbc();
        sendCapiClientEvent("PageView", {
          eventId,
          url: trackedUrl,
          fbp,
          fbc,
        });
      }
    };

    if (
      typeof window !== "undefined" &&
      typeof window.requestIdleCallback === "function"
    ) {
      const idleId = window.requestIdleCallback(runTracking, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(idleId);
      };
    }

    const timerId = setTimeout(runTracking, 300);
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
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
