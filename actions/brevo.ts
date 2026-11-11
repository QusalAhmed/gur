"use server";

import {
  getBrevoConfig,
  testBrevoConnection,
  sendAdminOrderNotification,
  BrevoOrderNotificationPayload,
  BrevoSendResult,
} from "@/lib/brevo";
import { getOrderAction } from "@/actions/orders";
import { assertStaffRole } from "@/lib/admin-guard";

export interface BrevoStatusResult {
  success: boolean;
  configured: boolean;
  enabled: boolean;
  hasApiKey: boolean;
  senderEmail: string;
  senderName: string;
  adminEmails: string[];
  apiKeyFromEnv: boolean;
  adminEmailFromEnv: boolean;
}

/**
 * Server Action: Inspects Brevo credentials and configuration status.
 */
export async function getBrevoStatusAction(): Promise<BrevoStatusResult> {
  try {
    await assertStaffRole(["owner", "admin"]);
    const config = await getBrevoConfig();
    return {
      success: true,
      configured: Boolean(config.apiKey && config.adminEmails.length > 0),
      enabled: config.enabled,
      hasApiKey: Boolean(config.apiKey),
      senderEmail: config.senderEmail,
      senderName: config.senderName,
      adminEmails: config.adminEmails,
      apiKeyFromEnv: config.source.apiKeyFromEnv,
      adminEmailFromEnv: config.source.adminEmailFromEnv,
    };
  } catch {
    return {
      success: false,
      configured: false,
      enabled: false,
      hasApiKey: false,
      senderEmail: "",
      senderName: "",
      adminEmails: [],
      apiKeyFromEnv: false,
      adminEmailFromEnv: false,
    };
  }
}

/**
 * Server Action: Tests Brevo connectivity by dispatching a test email.
 */
export async function testBrevoConnectionAction(
  recipientEmail?: string
): Promise<BrevoSendResult> {
  try {
    await assertStaffRole(["owner", "admin"]);
    return await testBrevoConnection(recipientEmail);
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to test Brevo connection",
    };
  }
}

/**
 * Server Action: Resends or manually sends an admin order notification email for an existing order.
 */
export async function resendAdminOrderNotificationAction(
  orderIdOrNumber: string
): Promise<BrevoSendResult> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const order = await getOrderAction(orderIdOrNumber);
    if (!order) {
      return {
        success: false,
        error: `Order '${orderIdOrNumber}' not found.`,
      };
    }

    const payload: BrevoOrderNotificationPayload = {
      orderId: order.id,
      orderNumber: order.order_number || order.id,
      customerName: order.customer,
      customerPhone: order.phone,
      deliveryZone:
        order.shipping_total === 70
          ? "inside_dhaka"
          : order.shipping_total === 130
          ? "outside_dhaka"
          : "standard",
      address: order.address,
      courierName: order.courier_name,
      items: (order.items || []).map((i) => ({
        productName: i.product_name,
        variantName: i.variant_name,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        lineTotal: i.line_total,
      })),
      subtotal: order.subtotal,
      shippingTotal: order.shipping_total,
      discountTotal: order.discount_total,
      grandTotal: order.grand_total,
      customerNote: order.customer_note,
      status: order.status,
      paymentMethod: order.method,
      channel: order.channel,
      createdAt: order.date,
    };

    return await sendAdminOrderNotification(payload);
  } catch (err: any) {
    console.error("[Brevo Action] Resend error:", err);
    return {
      success: false,
      error: err?.message || "Failed to resend admin order notification",
    };
  }
}
