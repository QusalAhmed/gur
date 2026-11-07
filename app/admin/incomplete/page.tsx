import * as React from "react";
import { Metadata } from "next";
import { assertStaffRole } from "@/lib/admin-guard";
import { getIncompleteOrdersAction } from "@/actions/incomplete-ops";
import { IncompleteView } from "@/components/admin/incomplete/incomplete-view";

export const metadata: Metadata = {
  title: "Incomplete Checkouts | Admin Dashboard",
  description: "Recover abandoned checkouts via WhatsApp and phone outreach.",
};

export const instant = false;

export default async function AdminIncompleteOrdersPage() {
  await assertStaffRole(["owner", "admin", "manager", "support"]);

  const res = await getIncompleteOrdersAction();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <IncompleteView initialOrders={res.data || []} />
    </div>
  );
}
