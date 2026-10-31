"use client";

import * as React from "react";
import { useSiteSettings } from "@/hooks/use-site-settings";

export function BrandFavicon() {
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

