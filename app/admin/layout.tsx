import * as React from "react";
import type { Metadata } from "next";
import { AdminLayoutClient } from "@/components/admin/admin-layout-client";
import { getAdminBrandSettings } from "@/lib/admin-brand";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getAdminBrandSettings();

  return {
    title: {
      default: brand.appName,
      template: `%s · ${brand.appName}`,
    },
    manifest: "/admin-manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: brand.shortName,
      statusBarStyle: "black-translucent",
    },
    icons: {
      icon: [
        { url: "/admin-icon/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/admin-icon/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [
        {
          url: "/admin-icon/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={null}>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </React.Suspense>
  );
}
