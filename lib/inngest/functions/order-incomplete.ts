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
    cancelOn: [
      {
        event: "order.created",
        if: "async.data.orderId == event.data.orderId || async.data.customerPhone == event.data.customerPhone",
      },
    ],
  },
  async ({ event, step }) => {
    const data = event.data as OrderIncompleteEventData;
    const { orderId, orderNumber } = data;

    // 1. Hold in queue for 5 minutes (grace period).
    // If order.created matching orderId or customerPhone arrives during this time,
    // Inngest automatically cancels and deletes this run from the queue.
    await step.sleep("wait-for-order-completion-grace-period", "5m");

    // 2. Defensive check & notification dispatch
    const result = await step.run("send-incomplete-order-email", async () => {
      const supabaseAdmin = getSupabaseAdmin();

      // Check current status in DB in case of external/manual updates
      const { data: orderRow } = await supabaseAdmin
        .from("orders")
        .select("status, attribution")
        .eq("id", orderId)
        .maybeSingle();

      // Skip if already submitted or no longer an incomplete order
      if (!orderRow || orderRow.status !== "incomplete_order") {
        return {
          skipped: true,
          reason: `Order status is "${orderRow?.status || "missing"}", not incomplete_order`,
        };
      }

      const currentAttr = (orderRow.attribution as Record<string, unknown>) || {};
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
