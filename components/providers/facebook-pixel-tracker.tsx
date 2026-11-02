"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/facebook-pixel";

function FacebookPixelTrackerInner() {
  const pathname = usePathname();
  const isFirstLoad = useRef(true);

  useEffect(() => {
    // The base inline script in layout.tsx already executes PageView on initial page load.
    // We only trigger PageView on subsequent client-side route transitions.
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    if (pathname && !pathname.startsWith("/admin")) {
      trackPageView();
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
