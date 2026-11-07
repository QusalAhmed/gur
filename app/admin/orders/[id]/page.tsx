import { notFound } from "next/navigation";
import { requireStaffMember } from "@/lib/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { OrderDetailView } from "@/components/admin/orders/order-detail-view";

interface OrderPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderDetailPage({ params }: OrderPageProps) {
  const { id } = await params;
  const session = await requireStaffMember(`/admin/orders/${id}`);
  const supabase = await createClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // 1. Fetch order with all relational embeds
  let orderQuery = supabase
    .from("orders")
    .select(`
      *,
      order_items (*),
      order_events (*),
      staff_notes (*),
      payments (*),
      shipments (
        *,
        shipment_items (
          *,
          batches (*)
        )
      )
    `);

  if (isUuid) {
    orderQuery = orderQuery.eq("id", id);
  } else {
    orderQuery = orderQuery.eq("order_number", id);
  }

  const { data: order, error: orderErr } = await orderQuery.maybeSingle();

  if (orderErr || !order) {
    notFound();
  }

  // 2. Fetch available released lots from admin_batch_stock
  const { data: availableLots } = await supabase
    .from("admin_batch_stock")
    .select("*")
    .eq("batch_status", "released")
    .gt("remaining_quantity", 0);

  // 3. Fetch active warehouses
  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, name, is_default, is_active")
    .eq("is_active", true);

  return (
    <OrderDetailView
      order={order}
      availableLots={availableLots || []}
      warehouses={warehouses || []}
      currentRole={session.role}
    />
  );
}
