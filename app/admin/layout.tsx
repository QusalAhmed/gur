import * as React from "react";
import { AdminLayoutClient } from "@/components/admin/admin-layout-client";

export const instant = false;

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
