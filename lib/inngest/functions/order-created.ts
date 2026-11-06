import { inngest } from "@/lib/inngest/client";
import { sendAdminOrderNotification } from "@/lib/brevo";
import { dispatchOrderStatusSms } from "@/lib/sms/smsbangladesh";
import type { OrderCreatedEventData } from "@/lib/inngest/events";

export const orderCreatedFunction = inngest.createFunction(
  {
    id: "order-created-notifications",
    name: "Order Created: Admin Email & Customer SMS",
    retries: 3,
    triggers: [{ event: "order.created" }],
  },
  async ({ event, step }) => {
    const data = event.data as OrderCreatedEventData;

    // 1. Send Admin Email Notification (Idempotent step)
    const emailResult = await step.run("send-admin-order-email", async () => {
      try {
        const res = await sendAdminOrderNotification({
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          deliveryZone: data.deliveryZone,
          address: data.address,
          courierName: data.courierName,
          items: data.items,
          subtotal: data.subtotal,
          shippingTotal: data.shippingTotal,
          discountTotal: data.discountTotal,
          grandTotal: data.grandTotal,
          customerNote: data.customerNote,
          status: data.status,
          channel: data.channel,
          hasOtherOrders: data.hasOtherOrders,
          otherOrderNumbers: data.otherOrderNumbers,
          createdAt: data.createdAt,
        });
        return res;
      } catch (err: unknown) {
        console.error("[Inngest] send-admin-order-email failed:", err);
        throw err;
      }
    });

    // 2. Send Customer Order Placed SMS (Idempotent step)
    const smsResult = await step.run("send-customer-placed-sms", async () => {
      try {
        const res = await dispatchOrderStatusSms({
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          status: "placed",
          customerPhone: data.customerPhone,
          customerName: data.customerName,
          grandTotal: data.grandTotal,
          courierName: data.courierName,
        });
        return res;
      } catch (err: unknown) {
        console.error("[Inngest] send-customer-placed-sms failed:", err);
        throw err;
      }
    });

    return {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      email: emailResult,
      sms: smsResult,
    };
  }
);
