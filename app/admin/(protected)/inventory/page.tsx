import * as React from "react";
import { Metadata } from "next";
import { connection } from "next/server";
import { assertStaffRole } from "@/lib/admin-guard";
import {
  getAdminInventoryAction,
  getAdminBatchesAction,
  getAdminWarehousesAction,
  getAdminStockLedgerAction,
} from "@/actions/inventory";
import { InventoryView } from "@/components/admin/inventory/inventory-view";
import AdminLoading from "../../loading";

export const metadata: Metadata = {
  title: "Inventory & Stock Ledger | Admin Dashboard",
  description: "Monitor stock levels, reorder points, and immutable movements ledger.",
};

export const instant = false;

async function AdminInventoryContent() {
  await connection();
  await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);

  const [invRes, batchesRes, whRes, ledgerRes] = await Promise.all([
    getAdminInventoryAction(),
    getAdminBatchesAction(),
    getAdminWarehousesAction(),
    getAdminStockLedgerAction({ limit: 100 }),
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <InventoryView
        initialInventory={invRes.data.inventory}
        initialKpis={invRes.data.kpis}
        initialBatches={batchesRes.data}
        initialWarehouses={whRes.data}
        initialLedger={ledgerRes.data}
      />
    </div>
  );
}

export default function AdminInventoryPage() {
  return (
    <React.Suspense fallback={<AdminLoading />}>
      <AdminInventoryContent />
    </React.Suspense>
  );
}
