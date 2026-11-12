import * as React from "react";
import { Metadata } from "next";
import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { assertStaffRole } from "@/lib/admin-guard";
import { getQueryClient } from "@/lib/query-client";
import { getSupplierHubDataAction } from "@/actions/supplier-ops";
import { SuppliersHub } from "@/components/admin/suppliers/suppliers-hub";
import AdminLoading from "../../loading";

export const metadata: Metadata = {
  title: "Suppliers & Cash Payments | Admin Dashboard",
  description: "Track supplier purchases, product quantities, unit prices, and cash payments.",
};

export const instant = false;

async function AdminSuppliersContent() {
  await connection();
  await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["admin", "supplier-hub"],
    queryFn: async () => {
      const res = await getSupplierHubDataAction();
      if (!res.success) {
        throw new Error(res.error || "Failed to load supplier ledger");
      }
      return res.data;
    },
  });

  return (
    <div className="p-1.5 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SuppliersHub />
      </HydrationBoundary>
    </div>
  );
}

export default function SuppliersPage() {
  return (
    <React.Suspense fallback={<AdminLoading />}>
      <AdminSuppliersContent />
    </React.Suspense>
  );
}
