"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  claritySetTag,
  initClarity,
  shouldLoadClarity,
} from "@/lib/clarity";
import { detectInAppBrowser } from "@/lib/in-app-browser";

interface MicrosoftClarityProps {
  projectId: string;
}

function MicrosoftClarityInner({ projectId }: MicrosoftClarityProps) {
  const pathname = usePathname();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (typeof window === "undefined") return;

    const currentPath = pathname || window.location.pathname;
    if (
      !shouldLoadClarity({
        projectId,
        hostname: window.location.hostname,
        pathname: currentPath,
      })
    ) {
      return;
    }

    const startClarity = () => {
      if (initializedRef.current) return;
      const loaded = initClarity(projectId);
      if (!loaded) return;

      initializedRef.current = true;

      const iab = detectInAppBrowser();
      claritySetTag(
        "in_app_browser",
        iab.isInApp ? iab.browserType || "true" : "false"
      );

      const docLang = document.documentElement.lang?.toLowerCase();
      claritySetTag("lang", docLang === "en" ? "en" : "bn");
    };

    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const onUserInteraction = () => {
      cleanup();
      startClarity();
    };

    const cleanup = () => {
      window.removeEventListener("scroll", onUserInteraction);
      window.removeEventListener("pointerdown", onUserInteraction);
      window.removeEventListener("touchstart", onUserInteraction);
      window.removeEventListener("keydown", onUserInteraction);
    };

    window.addEventListener("scroll", onUserInteraction, { passive: true, once: true });
    window.addEventListener("pointerdown", onUserInteraction, { passive: true, once: true });
    window.addEventListener("touchstart", onUserInteraction, { passive: true, once: true });
    window.addEventListener("keydown", onUserInteraction, { passive: true, once: true });

    if ("requestIdleCallback" in window) {
      idleId = (
        window as unknown as {
          requestIdleCallback: (
            cb: () => void,
            opts?: { timeout: number }
          ) => number;
        }
      ).requestIdleCallback(
        () => {
          cleanup();
          startClarity();
        },
        { timeout: 3500 }
      );
    } else {
      timerId = setTimeout(() => {
        cleanup();
        startClarity();
      }, 2500);
    }

    return () => {
      cleanup();
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        (
          window as unknown as {
            cancelIdleCallback: (id: number) => void;
          }
        ).cancelIdleCallback(idleId);
      }
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    };
  }, [projectId, pathname]);

  return null;
}

export function MicrosoftClarity({ projectId }: MicrosoftClarityProps) {
  if (!projectId) return null;

  return (
    <Suspense fallback={null}>
      <MicrosoftClarityInner projectId={projectId} />
    </Suspense>
  );
}
