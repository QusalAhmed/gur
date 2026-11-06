"use server";

import {
  getSmsConfig,
  checkSmsBangladeshBalance,
  sendSmsBangladesh,
  dispatchOrderStatusSms,
  renderSmsTemplate,
  normalizeBdPhoneNumber,
  SmsBangladeshConfig,
  SmsSendResult,
  SmsBalanceResult,
} from "@/lib/sms/smsbangladesh";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateSiteSettingsAction } from "@/actions/settings";

export interface SmsLogItem {
  id: string;
  order_id?: string | null;
  order_number?: string | null;
  recipient_phone: string;
  status_event: string;
  message_text: string;
  gateway?: string;
  sender_id?: string;
  is_success: boolean;
  response_code?: number | null;
  campaign_cost?: number;
  api_response?: any;
  error_message?: string | null;
  created_at: string;
}

/**
 * Server Action: Fetches the resolved SMS configuration and templates.
 */
export async function getSmsConfigAction(): Promise<{
  success: boolean;
  config?: SmsBangladeshConfig;
  error?: string;
}> {
  try {
    const config = await getSmsConfig();
    return { success: true, config };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to load SMS configuration." };
  }
}

/**
 * Server Action: Updates SMS configuration and templates in site_settings.
 */
export async function updateSmsConfigAction(payload: {
  enabled?: boolean;
  gateway?: string;
  user?: string;
  password?: string;
  senderId?: string;
  statusToggles?: {
    placed?: boolean;
    confirmed?: boolean;
    shipped?: boolean;
    delivered?: boolean;
  };
  templates?: {
    placed?: string;
    confirmed?: string;
    shipped?: string;
    delivered?: string;
  };
}): Promise<{ success: boolean; error?: string }> {
  try {
    const settingsPayload: Record<string, any> = {};

    if (payload.enabled !== undefined) {
      settingsPayload["notifications.sms_enabled"] = payload.enabled;
    }
    if (payload.gateway !== undefined) {
      settingsPayload["notifications.sms_gateway"] = payload.gateway;
    }
    if (payload.user !== undefined) {
      settingsPayload["notifications.smsbangladesh_user"] = payload.user.trim();
    }
    if (payload.password !== undefined) {
      settingsPayload["notifications.smsbangladesh_password"] = payload.password.trim();
    }
    if (payload.senderId !== undefined) {
      settingsPayload["notifications.smsbangladesh_from"] = payload.senderId.trim();
    }

    if (payload.statusToggles) {
      if (payload.statusToggles.placed !== undefined) {
        settingsPayload["notifications.sms_placed_enabled"] = payload.statusToggles.placed;
      }
      if (payload.statusToggles.confirmed !== undefined) {
        settingsPayload["notifications.sms_confirmed_enabled"] = payload.statusToggles.confirmed;
      }
      if (payload.statusToggles.shipped !== undefined) {
        settingsPayload["notifications.sms_shipped_enabled"] = payload.statusToggles.shipped;
      }
      if (payload.statusToggles.delivered !== undefined) {
        settingsPayload["notifications.sms_delivered_enabled"] = payload.statusToggles.delivered;
      }
    }

    if (payload.templates) {
      if (payload.templates.placed !== undefined) {
        settingsPayload["notifications.sms_template_placed"] = payload.templates.placed.trim();
      }
      if (payload.templates.confirmed !== undefined) {
        settingsPayload["notifications.sms_template_confirmed"] = payload.templates.confirmed.trim();
      }
      if (payload.templates.shipped !== undefined) {
        settingsPayload["notifications.sms_template_shipped"] = payload.templates.shipped.trim();
      }
      if (payload.templates.delivered !== undefined) {
        settingsPayload["notifications.sms_template_delivered"] = payload.templates.delivered.trim();
      }
    }

    return await updateSiteSettingsAction(settingsPayload);
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to save SMS settings." };
  }
}

/**
 * Server Action: Queries live SMS balance from SMSBangladesh gateway.
 */
export async function checkSmsBalanceAction(): Promise<SmsBalanceResult> {
  try {
    return await checkSmsBangladeshBalance();
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to query SMS gateway balance.",
    };
  }
}

/**
 * Server Action: Sends a test SMS to verify gateway connectivity and credentials.
 */
export async function sendTestSmsAction(
  recipientPhone: string,
  customMessage?: string
): Promise<SmsSendResult> {
  try {
    const normalizedPhone = normalizeBdPhoneNumber(recipientPhone);
    if (!normalizedPhone) {
      return {
        success: false,
        error: "Invalid Bangladeshi phone number. Please enter a valid 11-digit mobile number.",
      };
    }

    const config = await getSmsConfig();
    const testText =
      customMessage?.trim() ||
      "খেজুরের খাঁটি গুড় টেস্ট মেসেজ: SMSBangladesh গেটওয়ে সফলভাবে কানেক্ট হয়েছে।";

    const result = await sendSmsBangladesh({
      to: normalizedPhone,
      message: testText,
      senderId: config.senderId,
    });

    // Log the test SMS to public.sms_logs
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from("sms_logs").insert({
          recipient_phone: normalizedPhone,
          status_event: "test",
          message_text: testText,
          gateway: "smsbangladesh",
          sender_id: config.senderId,
          is_success: result.success,
          response_code: result.responseCode || null,
          campaign_cost: result.campaignCost || 0,
          api_response: result.rawResponse || null,
          error_message: result.error || null,
          created_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn("[sendTestSmsAction] Failed to log test SMS:", logErr);
      }
    }

    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to dispatch test SMS.",
    };
  }
}

/**
 * Server Action: Retrieves past SMS logs for a given order number or UUID.
 */
export async function getOrderSmsHistoryAction(
  orderNumberOrId: string
): Promise<{ success: boolean; logs: SmsLogItem[]; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, logs: [], error: "Database client unavailable." };
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      orderNumberOrId
    );

    let query = supabaseAdmin
      .from("sms_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (isUuid) {
      query = query.or(`order_id.eq.${orderNumberOrId},order_number.eq.${orderNumberOrId}`);
    } else {
      query = query.eq("order_number", orderNumberOrId);
    }

    const { data, error } = await query.limit(50);
    if (error) {
      return { success: false, logs: [], error: error.message };
    }

    return { success: true, logs: (data as SmsLogItem[]) || [] };
  } catch (err: any) {
    return { success: false, logs: [], error: err?.message || "Failed to load SMS history." };
  }
}

/**
 * Server Action: Manually triggers an SMS for an order (staff manual action from Order Sheet).
 */
export async function sendManualOrderSmsAction(params: {
  orderId: string;
  orderNumber: string;
  statusEvent: "placed" | "confirmed" | "shipped" | "delivered" | "manual";
  customerPhone: string;
  customerName?: string;
  grandTotal?: number;
  courierName?: string;
  trackingCode?: string;
  trackingUrl?: string;
  customMessage?: string;
}): Promise<SmsSendResult> {
  try {
    if (params.statusEvent !== "manual") {
      // Use existing template for this status, but force send (bypass deduplication)
      return await dispatchOrderStatusSms({
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        status: params.statusEvent,
        customerPhone: params.customerPhone,
        customerName: params.customerName,
        grandTotal: params.grandTotal,
        courierName: params.courierName,
        trackingCode: params.trackingCode,
        trackingUrl: params.trackingUrl,
        force: true,
      });
    }

    // Manual custom text
    const config = await getSmsConfig();
    const renderedText = renderSmsTemplate(params.customMessage || "", {
      customer_name: params.customerName || "সম্মানিত গ্রাহক",
      order_number: params.orderNumber,
      order_id: params.orderNumber,
      amount: params.grandTotal != null ? Math.round(Number(params.grandTotal)) : "",
      courier_name: params.courierName || "Steadfast Courier",
      tracking_code: params.trackingCode || "N/A",
      tracking_url: params.trackingUrl || "",
      support_phone: "+880 1700-000001",
      store_name: "খেজুরের খাঁটি গুড়",
    });

    const sendRes = await sendSmsBangladesh({
      to: params.customerPhone,
      message: renderedText,
      senderId: config.senderId,
    });

    const nowIso = new Date().toISOString();
    const normalizedPhone = normalizeBdPhoneNumber(params.customerPhone) || params.customerPhone;

    if (supabaseAdmin) {
      await supabaseAdmin.from("sms_logs").insert({
        order_id: params.orderId.includes("-") && params.orderId.length === 36 ? params.orderId : null,
        order_number: params.orderNumber,
        recipient_phone: normalizedPhone,
        status_event: "manual",
        message_text: renderedText,
        gateway: "smsbangladesh",
        sender_id: config.senderId,
        is_success: sendRes.success,
        response_code: sendRes.responseCode || null,
        campaign_cost: sendRes.campaignCost || 0,
        api_response: sendRes.rawResponse || null,
        error_message: sendRes.error || null,
        created_at: nowIso,
      });

      if (params.orderId) {
        await supabaseAdmin.from("order_events").insert({
          order_id: params.orderId,
          event_type: "sms_sent",
          to_value: "manual",
          message: sendRes.success
            ? `Manual SMS sent to customer: "${renderedText.slice(0, 80)}..."`
            : `Manual SMS failed: ${sendRes.error || "Gateway error"}`,
          actor_id: null,
        });
      }
    }

    return sendRes;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to send manual SMS.",
    };
  }
}
