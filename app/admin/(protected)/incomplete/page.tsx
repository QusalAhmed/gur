import * as React from "react";
import { Metadata } from "next";
import { connection } from "next/server";
import { assertStaffRole } from "@/lib/admin-guard";
import { getIncompleteOrdersAction } from "@/actions/incomplete-ops";
import { IncompleteView } from "@/components/admin/incomplete/incomplete-view";
import AdminLoading from "../../loading";

export const metadata: Metadata = {
  title: "Incomplete Checkouts | Admin Dashboard",
  description: "Recover abandoned checkouts via WhatsApp and phone outreach.",
};

export const instant = false;

async function AdminIncompleteOrdersContent() {
  await connection();
  await assertStaffRole(["owner", "admin", "manager", "support"]);

  const res = await getIncompleteOrdersAction();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <IncompleteView initialOrders={res.data || []} />
    </div>
  );
}

export default function AdminIncompleteOrdersPage() {
  return (
    <React.Suspense fallback={<AdminLoading />}>
      <AdminIncompleteOrdersContent />
    </React.Suspense>
  );
}
