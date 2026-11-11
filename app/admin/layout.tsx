import * as React from "react";
import type { Metadata } from "next";
import { AdminLayoutClient } from "@/components/admin/admin-layout-client";

export const instant = false;

export const metadata: Metadata = {
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
