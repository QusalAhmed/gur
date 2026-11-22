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
