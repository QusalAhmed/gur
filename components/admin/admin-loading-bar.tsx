"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import NProgress from "nprogress";

export function AdminLoadingBar() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track active TanStack Query requests
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const hasActiveQueries = isFetching > 0 || isMutating > 0;
  const hasActiveQueriesRef = React.useRef(hasActiveQueries);
  hasActiveQueriesRef.current = hasActiveQueries;

  // Track route transition state
  const isNavigatingRef = React.useRef(false);

  // Initialize NProgress pinned to our container element attached to the header
  React.useEffect(() => {
    if (!containerRef.current) return;

    NProgress.configure({
      showSpinner: false,
      trickle: true,
      trickleSpeed: 200,
      minimum: 0.08,
      speed: 250,
      parent: "#admin-header-progress",
    });

    const handleAnchorClick = (e: MouseEvent) => {
      try {
        const anchor = (e.target as Element | null)?.closest?.("a") as HTMLAnchorElement | null;
        if (!anchor || !anchor.href) return;
        if (anchor.target && anchor.target !== "_self") return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

        const targetUrl = new URL(anchor.href, window.location.href);
        if (targetUrl.origin !== window.location.origin) return;
        if (!targetUrl.pathname.startsWith("/admin")) return;

        const currentUrl = new URL(window.location.href);
        const isSamePage =
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search;

        if (isSamePage) return;

        isNavigatingRef.current = true;
        if (!NProgress.isStarted()) {
          NProgress.start();
        }
      } catch {
        // Ignore invalid URLs or clicks on non-standard links
      }
    };

    const handleNavigationComplete = () => {
      isNavigatingRef.current = false;
      if (!hasActiveQueriesRef.current) {
        NProgress.done();
      }
    };

    document.addEventListener("click", handleAnchorClick, true);
    window.addEventListener("popstate", handleNavigationComplete);

    return () => {
      document.removeEventListener("click", handleAnchorClick, true);
      window.removeEventListener("popstate", handleNavigationComplete);
      try {
        NProgress.done(true);
        NProgress.remove();
        NProgress.configure({ parent: "body" });
      } catch {
        // Safe cleanup
      }
    };
  }, []);

  // When pathname or search params change, route navigation has finished
  React.useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      if (!hasActiveQueries) {
        NProgress.done();
      }
    }
  }, [pathname, searchParams, hasActiveQueries]);

  // Synchronize TanStack Query loading state
  React.useEffect(() => {
    if (hasActiveQueries) {
      if (!NProgress.isStarted()) {
        NProgress.start();
      }
    } else if (!isNavigatingRef.current) {
      NProgress.done();
    }
  }, [hasActiveQueries]);

  return (
    <>
      <style>{`
        #admin-header-progress {
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 3px;
          pointer-events: none;
          overflow: hidden;
          z-index: 50;
        }
        #admin-header-progress.nprogress-custom-parent {
          overflow: hidden !important;
          position: absolute !important;
        }
        #admin-header-progress #nprogress {
          pointer-events: none;
        }
        #admin-header-progress #nprogress .bar {
          background: #f59e0b !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 50 !important;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.8), 0 0 4px rgba(245, 158, 11, 0.5) !important;
          transition: all 200ms ease;
        }
        #admin-header-progress #nprogress .peg {
          display: block !important;
          position: absolute !important;
          right: 0px !important;
          width: 100px !important;
          height: 100% !important;
          box-shadow: 0 0 14px #f59e0b, 0 0 8px #f59e0b !important;
          opacity: 1 !important;
          transform: rotate(3deg) translate(0px, -4px) !important;
        }
        /* Ensure no global rogue nprogress bar at top of window */
        body > #nprogress {
          display: none !important;
        }
      `}</style>
      <div
        id="admin-header-progress"
        ref={containerRef}
        aria-hidden="true"
      />
    </>
  );
}
