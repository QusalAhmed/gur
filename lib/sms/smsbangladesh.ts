import { supabaseAdmin } from "@/lib/supabase/admin";

export type OrderSmsStatus = "placed" | "confirmed" | "shipped" | "delivered" | "manual" | "test";

export interface SmsBangladeshConfig {
  enabled: boolean;
  gateway: string;
  user: string;
  password: string;
  senderId: string;
  statusToggles: {
    placed: boolean;
    confirmed: boolean;
    shipped: boolean;
    delivered: boolean;
  };
  templates: {
    placed: string;
    confirmed: string;
    shipped: string;
    delivered: string;
  };
  source: {
    userFromEnv: boolean;
    passwordFromEnv: boolean;
    senderIdFromEnv: boolean;
  };
}

export interface SmsSendResult {
  success: boolean;
  message?: string;
  responseCode?: number;
  campaignCost?: number;
  deliveryStatus?: Array<{
    MSISDN: string;
    Status: number;
    StatusText: string;
  }>;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
  rawResponse?: any;
}

export interface SmsBalanceResult {
  success: boolean;
  balance?: number;
  message?: string;
  responseCode?: number;
  error?: string;
  rawResponse?: any;
}

export interface DispatchOrderStatusSmsParams {
  orderId: string;
  orderNumber: string;
  status: "placed" | "confirmed" | "shipped" | "delivered";
  customerPhone: string;
  customerName?: string;
  grandTotal?: number;
  courierName?: string;
  trackingCode?: string;
  trackingUrl?: string;
  force?: boolean;
}

const DEFAULT_TEMPLATES = {
  placed: "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} সফলভাবে গৃহীত হয়েছে। মোট বিল: ৳{amount}। খুব শীঘ্রই আমাদের প্রতিনিধি যোগাযোগ করবেন। ধন্যবাদ!",
  confirmed: "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} কনফার্ম করা হয়েছে। মোট বিল: ৳{amount}। আপনার পার্সেলটি প্যাকিং সম্পন্ন করে দ্রুত পাঠিয়ে দেওয়া হবে। ধন্যবাদ!",
  shipped: "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} {courier_name} কুরিয়ারের মাধ্যমে পাঠানো হয়েছে। ট্র্যাকিং কোড: {tracking_code}। পার্সেল ট্র্যাক করুন: {tracking_url}",
  delivered: "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} সফলভাবে ডেলিভারি সম্পন্ন হয়েছে। খেজুরের খাঁটি গুড়-এর সাথে থাকার জন্য ধন্যবাদ!",
};

/**
 * Normalizes any Bangladeshi phone number input into standard MSISDN (8801XXXXXXXXX).
 * Returns null if the number is invalid or cannot be parsed.
 */
export function normalizeBdPhoneNumber(input?: string | null): string | null {
  if (!input || typeof input !== "string") return null;

  // Extract all digits
  let digits = input.replace(/\D/g, "");

  // If starts with 8801 and is 13 digits long
  if (digits.length === 13 && digits.startsWith("8801")) {
    return digits;
  }

  // If starts with 01 and is 11 digits long
  if (digits.length === 11 && digits.startsWith("01")) {
    return `88${digits}`;
  }

  // If starts with 1 and is 10 digits long (e.g. 1712345678)
  if (digits.length === 10 && digits.startsWith("1")) {
    return `880${digits}`;
  }

  // Check if valid mobile operator: 8801[3-9]XXXXXXXX
  if (digits.length === 13 && /^8801[3-9]\d{8}$/.test(digits)) {
    return digits;
  }

  return null;
}

/**
 * Resolves SMSBangladesh configuration by merging environment variables with public.site_settings.
 */
export async function getSmsConfig(): Promise<SmsBangladeshConfig> {
  const envUser = (process.env.SMSBANGLADESH_USER || "").trim();
  const envPass = (process.env.SMSBANGLADESH_PASSWORD || "").trim();
  const envSender = (
    process.env.SMSBANGLADESH_SENDER_ID ||
    process.env.SMSBANGLADESH_FROM ||
    ""
  ).trim();

  let dbEnabled = true;
  let dbGateway = "smsbangladesh";
  let dbUser = "";
  let dbPass = "";
  let dbSender = "";

  let togglePlaced = true;
  let toggleConfirmed = true;
  let toggleShipped = true;
  let toggleDelivered = true;

  let templatePlaced = DEFAULT_TEMPLATES.placed;
  let templateConfirmed = DEFAULT_TEMPLATES.confirmed;
  let templateShipped = DEFAULT_TEMPLATES.shipped;
  let templateDelivered = DEFAULT_TEMPLATES.delivered;

  try {
    if (supabaseAdmin) {
      const { data: rows } = await supabaseAdmin
        .from("site_settings")
        .select("key, value")
        .in("key", [
          "notifications.sms_enabled",
          "notifications.sms_gateway",
          "notifications.smsbangladesh_user",
          "notifications.smsbangladesh_password",
          "notifications.smsbangladesh_from",
          "notifications.sms_placed_enabled",
          "notifications.sms_confirmed_enabled",
          "notifications.sms_shipped_enabled",
          "notifications.sms_delivered_enabled",
          "notifications.sms_template_placed",
          "notifications.sms_template_confirmed",
          "notifications.sms_template_shipped",
          "notifications.sms_template_delivered",
        ]);

      if (rows && rows.length > 0) {
        const dict = new Map<string, any>();
        rows.forEach((r) => dict.set(r.key, r.value));

        if (dict.has("notifications.sms_enabled")) {
          const v = dict.get("notifications.sms_enabled");
          dbEnabled = typeof v === "boolean" ? v : String(v) !== "false";
        }
        if (dict.has("notifications.sms_gateway")) {
          dbGateway = String(dict.get("notifications.sms_gateway") || "").replace(/^"|"$/g, "").trim() || "smsbangladesh";
        }
        if (dict.has("notifications.smsbangladesh_user")) {
          dbUser = String(dict.get("notifications.smsbangladesh_user") || "").replace(/^"|"$/g, "").trim();
        }
        if (dict.has("notifications.smsbangladesh_password")) {
          dbPass = String(dict.get("notifications.smsbangladesh_password") || "").replace(/^"|"$/g, "").trim();
        }
        if (dict.has("notifications.smsbangladesh_from")) {
          dbSender = String(dict.get("notifications.smsbangladesh_from") || "").replace(/^"|"$/g, "").trim();
        }

        if (dict.has("notifications.sms_placed_enabled")) {
          const v = dict.get("notifications.sms_placed_enabled");
          togglePlaced = typeof v === "boolean" ? v : String(v) !== "false";
        }
        if (dict.has("notifications.sms_confirmed_enabled")) {
          const v = dict.get("notifications.sms_confirmed_enabled");
          toggleConfirmed = typeof v === "boolean" ? v : String(v) !== "false";
        }
        if (dict.has("notifications.sms_shipped_enabled")) {
          const v = dict.get("notifications.sms_shipped_enabled");
          toggleShipped = typeof v === "boolean" ? v : String(v) !== "false";
        }
        if (dict.has("notifications.sms_delivered_enabled")) {
          const v = dict.get("notifications.sms_delivered_enabled");
          toggleDelivered = typeof v === "boolean" ? v : String(v) !== "false";
        }

        if (dict.has("notifications.sms_template_placed")) {
          const t = String(dict.get("notifications.sms_template_placed") || "").replace(/^"|"$/g, "").trim();
          if (t) templatePlaced = t;
        }
        if (dict.has("notifications.sms_template_confirmed")) {
          const t = String(dict.get("notifications.sms_template_confirmed") || "").replace(/^"|"$/g, "").trim();
          if (t) templateConfirmed = t;
        }
        if (dict.has("notifications.sms_template_shipped")) {
          const t = String(dict.get("notifications.sms_template_shipped") || "").replace(/^"|"$/g, "").trim();
          if (t) templateShipped = t;
        }
        if (dict.has("notifications.sms_template_delivered")) {
          const t = String(dict.get("notifications.sms_template_delivered") || "").replace(/^"|"$/g, "").trim();
          if (t) templateDelivered = t;
        }
      }
    }
  } catch (err) {
    console.warn("[SMS Config] Failed to read settings from Supabase site_settings:", err);
  }

  const finalUser = dbUser || envUser;
  const finalPass = dbPass || envPass;
  const finalSender = dbSender || envSender || "";

  return {
    enabled: dbEnabled,
    gateway: dbGateway,
    user: finalUser,
    password: finalPass,
    senderId: finalSender,
    statusToggles: {
      placed: togglePlaced,
      confirmed: toggleConfirmed,
      shipped: toggleShipped,
      delivered: toggleDelivered,
    },
    templates: {
      placed: templatePlaced,
      confirmed: templateConfirmed,
      shipped: templateShipped,
      delivered: templateDelivered,
    },
    source: {
      userFromEnv: !dbUser && Boolean(envUser),
      passwordFromEnv: !dbPass && Boolean(envPass),
      senderIdFromEnv: !dbSender && Boolean(envSender),
    },
  };
}

/**
 * Replaces placeholders like {customer_name}, {order_number}, {amount}, {courier_name}, etc.
 */
export function renderSmsTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, "g");
    const replacement = value !== undefined && value !== null ? String(value) : "";
    rendered = rendered.replace(regex, replacement);
  }
  return rendered.trim();
}

/**
 * Sends a single SMS via SMSBangladesh GET API.
 */
export async function sendSmsBangladesh(params: {
  to: string;
  message: string;
  senderId?: string;
}): Promise<SmsSendResult> {
  const config = await getSmsConfig();

  if (!config.enabled) {
    return {
      success: false,
      skipped: true,
      skipReason: "Customer SMS notifications are disabled in site settings.",
    };
  }

  if (!config.user || !config.password) {
    return {
      success: false,
      skipped: true,
      skipReason: "SMSBangladesh credentials (user/password) are missing.",
      error: "SMS credentials not configured.",
    };
  }

  const normalizedTo = normalizeBdPhoneNumber(params.to);
  if (!normalizedTo) {
    return {
      success: false,
      error: `Invalid Bangladeshi mobile phone number: "${params.to}"`,
    };
  }

  const sender = (params.senderId || config.senderId || "").trim();
  const text = (params.message || "").trim();

  if (!text) {
    return {
      success: false,
      error: "SMS message text cannot be empty.",
    };
  }

  const url = new URL("http://panel.smsbangladesh.com/api");
  url.searchParams.set("user", config.user);
  url.searchParams.set("password", config.password);
  if (sender) {
    url.searchParams.set("from", sender);
  }
  url.searchParams.set("to", normalizedTo);
  url.searchParams.set("text", text);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      // Timeout after 15 seconds
      signal: AbortSignal.timeout(15000),
    });

    const rawText = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(rawText);
    } catch {
      // Sometimes APIs return text or XML
      json = { raw: rawText };
    }

    const success = json && (json.success === 1 || json.response_code === 100);
    const responseCode = json?.response_code ? Number(json.response_code) : undefined;
    const campaignCost = json?.campaign_cost != null ? Number(json.campaign_cost) : 0;
    const deliveryStatus = Array.isArray(json?.delivery_status) ? json.delivery_status : undefined;
    const message = json?.message || rawText;

    return {
      success: Boolean(success),
      message: String(message),
      responseCode,
      campaignCost,
      deliveryStatus,
      rawResponse: json,
      error: !success ? String(message || `API error code ${responseCode}`) : undefined,
    };
  } catch (err: any) {
    console.error("[SMSBangladesh] HTTP dispatch error:", err);
    return {
      success: false,
      error: err?.message || "Failed to reach SMSBangladesh API gateway.",
    };
  }
}

/**
 * Checks SMSBangladesh user credit balance.
 */
export async function checkSmsBangladeshBalance(): Promise<SmsBalanceResult> {
  const config = await getSmsConfig();

  if (!config.user || !config.password) {
    return {
      success: false,
      error: "SMSBangladesh credentials (user and password) are not configured.",
    };
  }

  const url = new URL("http://panel.smsbangladesh.com/balance");
  url.searchParams.set("user", config.user);
  url.searchParams.set("password", config.password);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    const rawText = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(rawText);
    } catch {
      json = { raw: rawText };
    }

    // Response format: { "message": "Active Balance Available", "response_code": 110, "AVAILABLE BALANCE =": "502.56559" }
    const balanceKey = Object.keys(json || {}).find(
      (k) => k.toLowerCase().includes("balance") && k.toLowerCase() !== "message"
    );
    const balanceVal = balanceKey ? parseFloat(json[balanceKey]) : undefined;
    const isSuccess = json?.response_code === 110 || (balanceVal !== undefined && !isNaN(balanceVal));

    return {
      success: isSuccess,
      balance: balanceVal,
      message: json?.message || "Balance retrieved successfully",
      responseCode: json?.response_code ? Number(json.response_code) : undefined,
      rawResponse: json,
      error: !isSuccess ? json?.message || "Failed to retrieve balance" : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to check SMSBangladesh balance.",
    };
  }
}

/**
 * Automated Order Status SMS Dispatcher with Deduplication, Logging, and Timeline Recording.
 */
export async function dispatchOrderStatusSms(
  params: DispatchOrderStatusSmsParams
): Promise<SmsSendResult> {
  const {
    orderId,
    orderNumber,
    status,
    customerPhone,
    customerName,
    grandTotal,
    courierName,
    trackingCode,
    trackingUrl,
    force = false,
  } = params;

  if (!supabaseAdmin) {
    console.warn("[dispatchOrderStatusSms] Supabase Admin client unavailable.");
  }

  const config = await getSmsConfig();

  // 1. Check if master toggle is on
  if (!config.enabled) {
    return {
      success: false,
      skipped: true,
      skipReason: "Master SMS notifications are disabled.",
    };
  }

  // 2. Check if this specific status toggle is enabled
  if (!config.statusToggles[status] && !force) {
    return {
      success: false,
      skipped: true,
      skipReason: `SMS for status '${status}' is disabled in settings.`,
    };
  }

  // 3. Deduplication Check (unless forced)
  let orderRow: any = null;
  if (supabaseAdmin) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
      let query = supabaseAdmin
        .from("orders")
        .select("id, order_number, attribution");

      if (isUuid) {
        query = query.or(`id.eq.${orderId},order_number.eq.${orderNumber || orderId}`);
      } else {
        query = query.eq("order_number", orderNumber || orderId);
      }

      const { data } = await query.maybeSingle();

      orderRow = data;
      const sentAttr = orderRow?.attribution?.sms_sent || {};
      if (!force && sentAttr[status]) {
        return {
          success: true,
          skipped: true,
          skipReason: `SMS for status '${status}' was already sent on ${sentAttr[status]}.`,
        };
      }
    } catch (e) {
      console.warn("[dispatchOrderStatusSms] Error checking attribution deduplication:", e);
    }
  }

  // 4. Render Message from Template
  const template = config.templates[status] || DEFAULT_TEMPLATES[status];
  const renderedMessage = renderSmsTemplate(template, {
    customer_name: customerName || "সম্মানিত গ্রাহক",
    order_number: orderNumber,
    order_id: orderNumber,
    amount: grandTotal != null ? Math.round(Number(grandTotal)) : "",
    courier_name: courierName || "Steadfast Courier",
    tracking_code: trackingCode || "N/A",
    tracking_url: trackingUrl || "https://steadfast.com.bd/t/" + (trackingCode || ""),
    support_phone: "+880 1700-000001",
    store_name: "খেজুরের খাঁটি গুড়",
  });

  // 5. Send via SMSBangladesh Gateway
  const sendResult = await sendSmsBangladesh({
    to: customerPhone,
    message: renderedMessage,
    senderId: config.senderId,
  });

  const nowIso = new Date().toISOString();
  const normalizedPhone = normalizeBdPhoneNumber(customerPhone) || customerPhone;

  // 6. Record in public.sms_logs
  if (supabaseAdmin) {
    const finalOrderUuid =
      orderRow?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderRow.id)
        ? orderRow.id
        : (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)
          ? orderId
          : null);

    try {
      await supabaseAdmin.from("sms_logs").insert({
        order_id: finalOrderUuid,
        order_number: orderNumber,
        recipient_phone: normalizedPhone,
        status_event: status,
        message_text: renderedMessage,
        gateway: "smsbangladesh",
        sender_id: config.senderId,
        is_success: sendResult.success,
        response_code: sendResult.responseCode || null,
        campaign_cost: sendResult.campaignCost || 0,
        api_response: sendResult.rawResponse || null,
        error_message: sendResult.error || null,
        created_at: nowIso,
      });
    } catch (logErr) {
      console.warn("[dispatchOrderStatusSms] Failed to insert into sms_logs:", logErr);
    }

    // 7. Record Order Event and Update Deduplication Attribution
    if (finalOrderUuid) {
      try {
        const eventMsg = sendResult.success
          ? `SMS Notification sent (${status.toUpperCase()}): "${renderedMessage.slice(0, 80)}..."`
          : `SMS Notification failed (${status.toUpperCase()}): ${sendResult.error || "Gateway error"}`;

        await supabaseAdmin.from("order_events").insert({
          order_id: finalOrderUuid,
          event_type: "sms_sent",
          to_value: status,
          message: eventMsg,
          actor_id: null,
        });

        if (sendResult.success) {
          const currentAttr = (orderRow?.attribution && typeof orderRow.attribution === "object")
            ? orderRow.attribution
            : {};
          const currentSmsSent = currentAttr.sms_sent || {};

          await supabaseAdmin
            .from("orders")
            .update({
              attribution: {
                ...currentAttr,
                sms_sent: {
                  ...currentSmsSent,
                  [status]: nowIso,
                },
              },
            })
            .eq("id", finalOrderUuid);
        }
      } catch (eventErr) {
        console.warn("[dispatchOrderStatusSms] Failed to update order timeline/attribution:", eventErr);
      }
    }
  }

  return sendResult;
}
