"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname } from "next/navigation";
import {
  trackPageView,
  waitForClientFbpAndFbc,
  sendCapiClientEvent,
  isPixelAdminHostOrPath,
} from "@/lib/facebook-pixel";

function FacebookPixelTrackerInner() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    if (isPixelAdminHostOrPath(hostname, pathname)) {
      lastTrackedPath.current = pathname;
      return;
    }

    // Prevent duplicate firing for identical path in single session
    if (lastTrackedPath.current === pathname) {
      return;
    }

    lastTrackedPath.current = pathname;
    const trackedUrl = typeof window !== "undefined" ? window.location.href : undefined;

    const eventId = trackPageView();
    if (eventId) {
      waitForClientFbpAndFbc(1500).then(({ fbp, fbc }) => {
        sendCapiClientEvent("PageView", {
          eventId,
          url: trackedUrl,
          fbp,
          fbc,
        });
      });
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
