import * as React from "react";
import { Metadata } from "next";
import { assertStaffRole } from "@/lib/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { NewOrderView } from "@/components/admin/orders/new-order-view";

export const metadata: Metadata = {
  title: "New Order Intake | Admin Dashboard",
  description: "Create phone, WhatsApp, and walk-in customer orders with price overrides.",
};

export const instant = false;

export default async function AdminNewOrderPage() {
  await assertStaffRole(["owner", "admin", "manager", "support"]);
  const supabase = await createClient();

  const [
    { data: variants },
    { data: shippingMethods },
    { data: districts },
  ] = await Promise.all([
    supabase
      .from("product_variants")
      .select(
        `
        id,
        name,
        sku,
        price,
        net_unit,
        products:product_id (
          name
        )
      `
      )
      .eq("is_active", true)
      .order("sku", { ascending: true }),

    supabase
      .from("shipping_methods")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),

    supabase
      .from("geo_districts")
      .select("id, name, name_bn")
      .order("name", { ascending: true }),
  ]);

  const catalogVariants = (variants || []).map((v) => {
    const prod = Array.isArray(v.products) ? v.products[0] : v.products;
    return {
      id: v.id,
      title: v.name,
      sku: v.sku,
      price: Number(v.price),
      uom: v.net_unit,
      productName: prod?.name || "Molasses Item",
    };
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <NewOrderView
        catalogVariants={catalogVariants}
        shippingMethods={shippingMethods || []}
        districts={districts || []}
      />
    </div>
  );
}
