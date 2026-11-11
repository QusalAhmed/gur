import * as React from "react";
import { connection } from "next/server";
import { headers } from "next/headers";
import { requireStaffMember } from "@/lib/admin-guard";
import AdminLoading from "../loading";

export const instant = false;

async function AdminProtectedGate({ children }: { children: React.ReactNode }) {
  await connection();
  const hdrs = await headers();
  const pathname = hdrs.get("x-admin-pathname") || "/admin";
  await requireStaffMember(pathname);
  return <>{children}</>;
}

export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={<AdminLoading />}>
      <AdminProtectedGate>{children}</AdminProtectedGate>
    </React.Suspense>
  );
}
