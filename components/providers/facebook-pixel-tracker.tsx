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

    lastTrackedPath.current = pathname;
    const trackedUrl = typeof window !== "undefined" ? window.location.href : undefined;

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
