import * as React from "react";
import { Metadata } from "next";
import { assertStaffRole } from "@/lib/admin-guard";
import { createClient } from "@/lib/supabase/server";
import {
  getAdminBatchesAction,
  getAdminSuppliersAction,
} from "@/actions/inventory";
import { BatchesView } from "@/components/admin/batches/batches-view";

export const metadata: Metadata = {
  title: "Lot Tracking & Quality Control | Admin Dashboard",
  description: "Molasses production lots, lab measurements, and QR traceability.",
};

export const instant = false;

export default async function AdminBatchesPage() {
  await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
  const supabase = await createClient();

  const [batchesRes, suppliersRes, { data: products }] = await Promise.all([
    getAdminBatchesAction(),
    getAdminSuppliersAction(),
    supabase.from("products").select("id, name").order("name", { ascending: true }),
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <BatchesView
        initialBatches={batchesRes.data}
        products={products || []}
        suppliers={suppliersRes.data}
      />
    </div>
  );
}
