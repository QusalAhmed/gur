import * as React from "react";
import type { Metadata } from "next";
import { AdminLayoutClient } from "@/components/admin/admin-layout-client";

export const instant = false;

export const metadata: Metadata = {
  title: {
    default: "Gur Admin",
    template: "%s · Gur Admin",
  },
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Gur Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/admin-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/admin-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  robots: {
    index: false,
    follow: false,
  },
};

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
