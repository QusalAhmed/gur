import * as React from "react";
import { Metadata } from "next";
import { connection } from "next/server";
import { assertStaffRole } from "@/lib/admin-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getAdminBatchesAction,
  getAdminSuppliersAction,
} from "@/actions/inventory";
import { BatchesView } from "@/components/admin/batches/batches-view";
import AdminLoading from "../../loading";

export const metadata: Metadata = {
  title: "Lot Tracking & Quality Control | Admin Dashboard",
  description: "Molasses production lots, lab measurements, and QR traceability.",
};

export const instant = false;

async function AdminBatchesContent() {
  await connection();
  await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
  const supabase = getSupabaseAdmin();

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

export default function AdminBatchesPage() {
  return (
    <React.Suspense fallback={<AdminLoading />}>
      <AdminBatchesContent />
    </React.Suspense>
  );
}
