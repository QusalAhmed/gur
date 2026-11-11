"use client";

import * as React from "react";
import { useSiteSettings } from "@/hooks/use-site-settings";

function BrandFaviconInner() {
  const { faviconUrl } = useSiteSettings();

  React.useEffect(() => {
    if (!faviconUrl) return;

    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }, [faviconUrl]);

  return null;
}

export function BrandFavicon() {
  return (
    <React.Suspense fallback={null}>
      <BrandFaviconInner />
    </React.Suspense>
  );
}

