import { inngest } from "@/lib/inngest/client";
import { sendAdminOrderNotification } from "@/lib/brevo";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createNotificationInternal } from "@/lib/notifications-service";
import type { OrderIncompleteEventData } from "@/lib/inngest/events";

export const orderIncompleteFunction = inngest.createFunction(
  {
    id: "order-incomplete-notification",
    name: "Incomplete/Abandoned Draft Order: Admin Email & In-App Alert",
    retries: 3,
    triggers: [{ event: "order.incomplete" }],
    // 5-minute inactivity debounce: every new draft autosave pushes the timer back by 5 minutes.
    // The function executes ONLY when the visitor has been completely inactive for 5 minutes.
    debounce: {
      key: "event.data.orderId",
      period: "5m",
    },
    // If order.created matching orderId or customerPhone arrives during this time,
    // Inngest automatically cancels and deletes this scheduled run from the queue.
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

    // Dispatch notifications after the 5-minute inactivity window
    const result = await step.run("send-incomplete-order-notifications", async () => {
      const supabaseAdmin = getSupabaseAdmin();

      // 1. Defensive check: verify the order in DB is still 'incomplete_order'
      const { data: orderRow } = await supabaseAdmin
        .from("orders")
        .select("status, attribution, customer_phone, customer_name, grand_total, order_number")
        .eq("id", orderId)
        .maybeSingle();

      // Skip if already submitted, converted to pending, or missing
      if (!orderRow || orderRow.status !== "incomplete_order") {
        return {
          skipped: true,
          reason: `Order status is "${orderRow?.status || "missing"}", not incomplete_order`,
        };
      }

      const currentAttr = (orderRow.attribution as Record<string, unknown>) || {};
      if (currentAttr.incomplete_notified_at || currentAttr.brevo_incomplete_notified_at) {
        return { skipped: true, reason: "Already notified incomplete order" };
      }

      const phone = data.customerPhone || orderRow.customer_phone || "";
      const displayOrderNumber = orderNumber || orderRow.order_number || "Draft";
      const grandTotal = data.grandTotal ?? Number(orderRow.grand_total) ?? 0;

      // 2. Dispatch Brevo Admin Email
      let emailRes = null;
      try {
        emailRes = await sendAdminOrderNotification({
          orderId,
          orderNumber: displayOrderNumber,
          customerName: data.customerName || orderRow.customer_name || "Customer (Lead)",
          customerPhone: phone,
          deliveryZone: data.deliveryZone,
          address: data.address,
          courierName: data.courierName,
          items: data.items || [],
          subtotal: data.subtotal || 0,
          shippingTotal: data.shippingTotal || 0,
          grandTotal: grandTotal,
          customerNote: data.customerNote,
          status: "incomplete_order",
          channel: "web",
        });
      } catch (emailErr) {
        console.warn("[orderIncompleteFunction] Brevo email dispatch error:", emailErr);
      }

      // 3. Create In-App Admin Notification (bell badge & audio chime)
      let inAppNotifRes = null;
      try {
        inAppNotifRes = await createNotificationInternal({
          type: "system_alert",
          title: "অসম্পূর্ণ অর্ডার (Incomplete Order)",
          message: `গ্রাহক ${phone} চেকআউট শুরু করেছিলেন কিন্তু সম্পন্ন করেননি (মোট ৳${grandTotal})।`,
          data: {
            order_id: orderId,
            order_number: displayOrderNumber,
            phone: phone,
            status: "incomplete_order",
            alert_subtype: "incomplete_order_lead",
            link: `/admin/orders?search=${displayOrderNumber}`,
          },
        });
      } catch (notifErr) {
        console.warn("[orderIncompleteFunction] In-app notification creation error:", notifErr);
      }

      // 4. Persist notification timestamp to prevent duplicate notifications
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from("orders")
        .update({
          attribution: {
            ...currentAttr,
            incomplete_notified_at: nowIso,
            brevo_incomplete_notified_at: nowIso,
            in_app_notification_id: inAppNotifRes?.data?.id || null,
          },
        })
        .eq("id", orderId);

      return {
        success: true,
        emailRes,
        inAppNotification: inAppNotifRes?.data || null,
      };
    });

    return result;
  }
);
