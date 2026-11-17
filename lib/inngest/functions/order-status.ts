import { inngest } from "@/lib/inngest/client";
import { dispatchOrderStatusSms } from "@/lib/sms/smsbangladesh";
import { triggerCapiPurchaseInternal } from "@/lib/capi-service";
import { dispatchPendingNotificationPushes } from "@/lib/push/web-push";
import type { OrderStatusUpdatedEventData } from "@/lib/inngest/events";

export const orderStatusUpdatedFunction = inngest.createFunction(
  {
    id: "order-status-updated-notifications",
    name: "Order Status Updated: Customer SMS & Meta CAPI",
    retries: 3,
    triggers: [{ event: "order.status_updated" }],
  },
  async ({ event, step }) => {
    const data = event.data as OrderStatusUpdatedEventData;
    const {
      orderId,
      orderNumber,
      newStatus,
      customerPhone,
      customerName,
      grandTotal,
      courierName,
      trackingCode,
      trackingUrl,
      triggerMetaCapi = true,
    } = data;

    let smsResult = null;
    let capiResult = null;

    // 1. Send Status SMS Notification if status is supported
    if (["confirmed", "shipped", "delivered", "partially_delivered"].includes(newStatus)) {
      const smsStatus = (
        newStatus === "partially_delivered" ? "delivered" : newStatus
      ) as "confirmed" | "shipped" | "delivered";

      smsResult = await step.run("send-customer-status-sms", async () => {
        try {
          return await dispatchOrderStatusSms({
            orderId,
            orderNumber,
            status: smsStatus,
            customerPhone,
            customerName,
            grandTotal,
            courierName: courierName || "Steadfast Courier",
            trackingCode,
            trackingUrl,
          });
        } catch (err: unknown) {
          console.error(`[Inngest] send-customer-status-sms (${smsStatus}) failed:`, err);
          throw err;
        }
      });
    }

    // 2. Trigger Meta CAPI Purchase Event upon confirmation/delivery
    if (
      triggerMetaCapi &&
      ["confirmed", "processing", "shipped", "delivered", "partially_delivered"].includes(newStatus)
    ) {
      capiResult = await step.run("trigger-meta-capi-purchase", async () => {
        try {
          return await triggerCapiPurchaseInternal(orderNumber || orderId);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.warn("[Inngest] Meta CAPI Purchase trigger error:", errorMessage);
          // CAPI failure shouldn't throw error to fail the entire notification step
          return { success: false, error: errorMessage };
        }
      });
    }

    // 3. Dispatch Admin PWA Web Push for any DB-trigger alerts (e.g. outdated_label_shipped, low_stock)
    const pushResult = await step.run("dispatch-admin-web-push", async () => {
      try {
        return await dispatchPendingNotificationPushes(10);
      } catch (err: unknown) {
        console.warn("[Inngest] dispatch-admin-web-push failed:", err);
        return { processed: 0, totalSent: 0, totalFailed: 0 };
      }
    });

    return {
      orderId,
      orderNumber,
      status: newStatus,
      sms: smsResult,
      capi: capiResult,
      push: pushResult,
    };
  }
);
