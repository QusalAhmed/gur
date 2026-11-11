import { inngest } from "@/lib/inngest/client";
import { sendAdminOrderNotification } from "@/lib/brevo";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { OrderIncompleteEventData } from "@/lib/inngest/events";

export const orderIncompleteFunction = inngest.createFunction(
  {
    id: "order-incomplete-notification",
    name: "Incomplete/Abandoned Draft Order: Admin Email",
    retries: 3,
    triggers: [{ event: "order.incomplete" }],
  },
  async ({ event, step }) => {
    const data = event.data as OrderIncompleteEventData;
    const { orderId, orderNumber } = data;

    const result = await step.run("send-incomplete-order-email", async () => {
      const supabaseAdmin = getSupabaseAdmin();
      // 1. Verify that order has not already been notified
      const { data: orderRow } = await supabaseAdmin
        .from("orders")
        .select("attribution")
        .eq("id", orderId)
        .maybeSingle();

      const currentAttr = (orderRow?.attribution as Record<string, unknown>) || {};
      if (currentAttr.brevo_incomplete_notified_at) {
        return { skipped: true, reason: "Already notified incomplete order" };
      }

      // 2. Dispatch Brevo Email
      const emailRes = await sendAdminOrderNotification({
        orderId,
        orderNumber,
        customerName: data.customerName || "Customer (Lead)",
        customerPhone: data.customerPhone,
        deliveryZone: data.deliveryZone,
        address: data.address,
        courierName: data.courierName,
        items: data.items || [],
        subtotal: data.subtotal || 0,
        shippingTotal: data.shippingTotal || 0,
        grandTotal: data.grandTotal || 0,
        customerNote: data.customerNote,
        status: "incomplete_order",
        channel: "web",
      });

      // 3. Persist notification timestamp to avoid duplicate notifications
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from("orders")
        .update({
          attribution: {
            ...currentAttr,
            brevo_incomplete_notified_at: nowIso,
          },
        })
        .eq("id", orderId);

      return { success: true, emailRes };
    });

    return result;
  }
);
