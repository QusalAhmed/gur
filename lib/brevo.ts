import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { escapeHtml, sanitizeTelHref } from "@/lib/security";
import { getSiteUrl } from "@/lib/site-url";

export interface BrevoRecipient {
  name?: string;
  email: string;
}

export interface BrevoSendEmailPayload {
  sender?: BrevoRecipient;
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: BrevoRecipient;
  tags?: string[];
}

export interface BrevoOrderNotificationItem {
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
}

export interface BrevoOrderNotificationPayload {
  orderId?: string;
  orderNumber: string;
  customerName?: string;
  customerPhone: string;
  deliveryZone?: "inside_dhaka" | "outside_dhaka" | string;
  address?:
    | {
        address_line?: string;
        district?: string;
        division?: string;
      }
    | string;
  courierName?: string;
  items: BrevoOrderNotificationItem[];
  subtotal: number;
  shippingTotal: number;
  discountTotal?: number;
  grandTotal: number;
  customerNote?: string;
  status?: string;
  paymentMethod?: string;
  channel?: string;
  hasOtherOrders?: boolean;
  otherOrderNumbers?: string[];
  createdAt?: string;
}

export interface BrevoConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  adminEmails: string[];
  enabled: boolean;
  notifyIncomplete?: boolean;
  source: {
    apiKeyFromEnv: boolean;
    adminEmailFromEnv: boolean;
  };
}

export interface BrevoSendResult {
  success: boolean;
  messageId?: string;
  skipped?: boolean;
  error?: string;
}

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Normalizes and splits comma-, semicolon- or whitespace-separated emails into a clean, unique array.
 */
export function parseEmailList(input?: string | null): string[] {
  if (!input || typeof input !== "string") return [];
  const rawList = input.split(/[,;\s]+/);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const set = new Set<string>();

  for (const item of rawList) {
    const clean = item.trim().toLowerCase();
    if (clean && emailRegex.test(clean)) {
      set.add(clean);
    }
  }

  return Array.from(set);
}

/**
 * Resolves Brevo configuration by merging environment variables with public.site_settings.
 * Priority:
 * 1. Environment variables (BREVO_API_KEY, BREVO_ADMIN_EMAIL, etc.)
 * 2. Database site_settings overrides (notifications.brevo_api_key, etc.)
 * 3. Fallbacks (store.email, store.name_bn)
 */
export async function getBrevoConfig(): Promise<BrevoConfig> {
  const envApiKey = (process.env.BREVO_API_KEY || "").trim();
  const envSenderEmail = (process.env.BREVO_SENDER_EMAIL || "").trim();
  const envSenderName = (process.env.BREVO_SENDER_NAME || "").trim();
  const envAdminEmail = (process.env.BREVO_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim();

  let dbEnabled = true;
  let dbNotifyIncomplete = true;
  let dbApiKey = "";
  let dbSenderEmail = "";
  let dbSenderName = "";
  let dbAdminEmail = "";
  let fallbackStoreEmail = "";
  let fallbackStoreName = "";

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: rows } = await supabaseAdmin
        .from("site_settings")
        .select("key, value")
        .in("key", [
          "notifications.brevo_enabled",
          "notifications.brevo_notify_incomplete",
          "notifications.brevo_api_key",
          "notifications.brevo_admin_email",
          "notifications.brevo_sender_email",
          "notifications.brevo_sender_name",
          "store.email",
          "store.name_bn",
          "store.name",
        ]);

    if (rows && rows.length > 0) {
      for (const row of rows) {
        const val = row.value;
        const cleanStr = typeof val === "string" ? val.replace(/^"|"$/g, "").trim() : "";

        switch (row.key) {
          case "notifications.brevo_enabled":
            dbEnabled = val === true || val === "true" || val === 1;
            break;
          case "notifications.brevo_notify_incomplete":
            dbNotifyIncomplete = val === true || val === "true" || val === 1;
            break;
          case "notifications.brevo_api_key":
            dbApiKey = cleanStr;
            break;
          case "notifications.brevo_admin_email":
            dbAdminEmail = cleanStr;
            break;
          case "notifications.brevo_sender_email":
            dbSenderEmail = cleanStr;
            break;
          case "notifications.brevo_sender_name":
            dbSenderName = cleanStr;
            break;
          case "store.email":
            fallbackStoreEmail = cleanStr;
            break;
          case "store.name_bn":
            if (!fallbackStoreName) fallbackStoreName = cleanStr;
            break;
          case "store.name":
            if (!fallbackStoreName) fallbackStoreName = cleanStr;
            break;
        }
      }
    }
  } catch (err) {
    console.warn("[Brevo] Could not fetch site_settings overrides:", err);
  }

  const apiKey = envApiKey || dbApiKey || "";
  const senderEmail =
    envSenderEmail ||
    dbSenderEmail ||
    fallbackStoreEmail ||
    "notifications@gurstore.com";

  const senderName =
    envSenderName ||
    dbSenderName ||
    fallbackStoreName ||
    "খেজুরের খাঁটি গুড়";

  // Merge admin emails from env, db setting, or fallbackStoreEmail
  const combinedAdminRaw = [envAdminEmail, dbAdminEmail, fallbackStoreEmail]
    .filter(Boolean)
    .join(",");
  const adminEmails = parseEmailList(combinedAdminRaw);

  return {
    apiKey,
    senderEmail,
    senderName,
    adminEmails,
    enabled: dbEnabled,
    notifyIncomplete: dbNotifyIncomplete,
    source: {
      apiKeyFromEnv: Boolean(envApiKey),
      adminEmailFromEnv: Boolean(envAdminEmail),
    },
  };
}

/**
 * Checks whether Brevo is fully configured and ready to dispatch emails.
 */
export async function isBrevoConfigured(): Promise<boolean> {
  const config = await getBrevoConfig();
  return Boolean(config.enabled && config.apiKey && config.adminEmails.length > 0);
}

/**
 * Low-level function to send a transactional email via the Brevo API v3.
 */
export async function sendBrevoEmail(
  payload: BrevoSendEmailPayload,
  overrideConfig?: Partial<BrevoConfig>
): Promise<BrevoSendResult> {
  const config = { ...(await getBrevoConfig()), ...overrideConfig };

  if (!config.enabled) {
    return {
      success: false,
      skipped: true,
      error: "Brevo notifications are disabled in site settings.",
    };
  }

  if (!config.apiKey) {
    return {
      success: false,
      skipped: true,
      error: "BREVO_API_KEY is not configured in environment or site settings.",
    };
  }

  if (!payload.to || payload.to.length === 0) {
    return {
      success: false,
      error: "No recipient email addresses provided.",
    };
  }

  const sender = payload.sender || {
    name: config.senderName,
    email: config.senderEmail,
  };

  const bodyData = {
    sender,
    to: payload.to,
    subject: payload.subject,
    htmlContent: payload.htmlContent,
    textContent: payload.textContent || undefined,
    replyTo: payload.replyTo || undefined,
    tags: payload.tags || ["order-notification", "admin-alert"],
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second timeout

    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": config.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(bodyData),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await res.text();
    let responseData: any = {};
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { message: responseText };
    }

    if (!res.ok) {
      const errMsg =
        responseData.message ||
        responseData.code ||
        `Brevo API HTTP ${res.status}: ${res.statusText}`;
      console.error("[Brevo] API Error:", errMsg, responseData);
      return {
        success: false,
        error: errMsg,
      };
    }

    const messageId = responseData.messageId || "sent";
    return {
      success: true,
      messageId,
    };
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    const errorMessage = isTimeout
      ? "Brevo request timed out after 12 seconds"
      : err?.message || "Failed to communicate with Brevo API";
    console.error("[Brevo] Request Exception:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

function getBaseAppUrl(): string {
  return getSiteUrl();
}

function formatCurrency(amount: number): string {
  return `৳${Math.round(amount).toLocaleString("en-US")}`;
}

function formatDhakaDateTime(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dhaka",
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true,
    }).format(date);
  } catch {
    return date.toISOString().replace("T", " ").slice(0, 16);
  }
}

/**
 * Builds a mobile-responsive, email-client compatible HTML template for Admin Order Notifications.
 */
export function renderAdminOrderEmailHtml(
  data: BrevoOrderNotificationPayload,
  config: BrevoConfig
): string {
  const baseUrl = getBaseAppUrl();
  const orderAdminUrl = escapeHtml(
    `${baseUrl}/admin/orders?search=${encodeURIComponent(data.orderNumber)}`
  );
  const formattedDate = escapeHtml(formatDhakaDateTime(data.createdAt));
  const isIncomplete = data.status === "incomplete_order";

  const deliveryZoneText =
    data.deliveryZone === "inside_dhaka"
      ? "ঢাকা সিটির ভেতরে (৳৭০)"
      : data.deliveryZone === "outside_dhaka"
      ? "ঢাকা সিটির বাইরে (৳১৩০)"
      : data.deliveryZone || "ডেলিভারি চার্জ প্রযোজ্য";

  const addressText =
    typeof data.address === "string"
      ? data.address
      : [
          data.address?.address_line,
          data.address?.district,
          data.address?.division,
        ]
          .filter(Boolean)
          .join(", ") || "ঠিকানা প্রদান করা হয়নি";

  const customerName = data.customerName || (isIncomplete ? "ড্রাফট ভিজিটর" : "Customer (গ্রাহক)");
  const cleanPhone = (data.customerPhone || "").trim();
  const safeTel = sanitizeTelHref(cleanPhone);
  const safeTelHref = safeTel ? `tel:${escapeHtml(safeTel)}` : "#";
  const escapedPhone = escapeHtml(cleanPhone);
  const escapedCustomerName = escapeHtml(customerName);
  const escapedAddress = escapeHtml(addressText);
  const escapedDeliveryZone = escapeHtml(deliveryZoneText);
  const escapedCourierName = data.courierName ? escapeHtml(data.courierName) : "";
  const escapedCustomerNote = data.customerNote ? escapeHtml(data.customerNote) : "";
  const escapedOrderNumber = escapeHtml(data.orderNumber);
  const escapedOrderIdOrNumber = escapeHtml(data.orderId || data.orderNumber);
  const escapedSenderName = escapeHtml(config.senderName);
  const rawDigits = cleanPhone.replace(/\D/g, "");
  const waNumber = rawDigits.startsWith("880")
    ? rawDigits
    : rawDigits.startsWith("0")
    ? `88${rawDigits}`
    : `880${rawDigits}`;
  const waLink = `https://wa.me/${encodeURIComponent(waNumber)}`;

  // Generate table rows for items
  const itemsHtml = (data.items || [])
    .map((item, idx) => {
      const lineTotal =
        item.lineTotal !== undefined
          ? item.lineTotal
          : item.quantity * item.unitPrice;
      const isEven = idx % 2 === 0;
      const safeQty = Math.max(0, Number(item.quantity) || 0);
      return `
        <tr style="background-color: ${isEven ? "#ffffff" : "#fdf8f4"};">
          <td style="padding: 12px 14px; border-bottom: 1px solid #fed7aa; vertical-align: top;">
            <div style="font-weight: 600; color: #431407; font-size: 14px; line-height: 1.3;">
              ${escapeHtml(item.productName)}
            </div>
            ${
              item.variantName
                ? `<div style="font-size: 12px; color: #9a3412; margin-top: 3px;">প্যাক: ${escapeHtml(item.variantName)}</div>`
                : ""
            }
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #fed7aa; text-align: center; font-size: 14px; color: #431407; font-weight: 600;">
            ${safeQty}
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #fed7aa; text-align: right; font-size: 13px; color: #78350f;">
            ${escapeHtml(formatCurrency(item.unitPrice))}
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #fed7aa; text-align: right; font-size: 14px; color: #9a3412; font-weight: 700;">
            ${escapeHtml(formatCurrency(lineTotal))}
          </td>
        </tr>
      `;
    })
    .join("");

  const headerGradient = isIncomplete
    ? "linear-gradient(135deg, #7c2d12 0%, #c2410c 60%, #ea580c 100%)"
    : "linear-gradient(135deg, #78350f 0%, #b45309 60%, #d97706 100%)";

  const badgeText = isIncomplete
    ? "⚠️ Abandoned Checkout / ড্রাফট লিড"
    : "🔔 New Store Order";

  const bannerSubtitle = isIncomplete
    ? "গ্রাহক চেকআউট শুরু করেছিলেন কিন্তু এখনো সাবমিট করেননি — এখনই যোগাযোগ করুন!"
    : "ওয়েবসাইট থেকে একটি নতুন অর্ডার গ্রহণ করা হয়েছে";

  const statusPillHtml = isIncomplete
    ? `<div style="display: inline-block; padding: 4px 10px; background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca; border-radius: 6px; font-size: 11px; font-weight: 800; margin-top: 4px;">
        ⚠️ Incomplete Draft Lead
       </div>`
    : `<div style="display: inline-block; padding: 3px 8px; background-color: #fef08a; color: #854d0e; border-radius: 6px; font-size: 11px; font-weight: 700; margin-top: 4px;">
        Cash On Delivery
       </div>`;

  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isIncomplete ? "অসম্পূর্ণ অর্ডার (ড্রাফট)" : "নতুন অর্ডার"}: ${escapedOrderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="background-color: #f8fafc; padding: 24px 12px;">
    <!-- Container -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      
      <!-- Header Banner -->
      <tr>
        <td style="background: ${headerGradient}; padding: 28px 24px; text-align: center; color: #ffffff;">
          <div style="display: inline-block; padding: 4px 12px; background-color: rgba(255,255,255,0.2); border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
            ${badgeText}
          </div>
          <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
            ${escapedSenderName}
          </h1>
          <p style="margin: 0; font-size: 14px; color: #fef3c7; opacity: 0.95;">
            ${bannerSubtitle}
          </p>
        </td>
      </tr>

      <!-- Order Highlight Bar -->
      <tr>
        <td style="padding: 20px 24px; background-color: ${isIncomplete ? "#fff7ed" : "#fffbeb"}; border-bottom: 1px solid ${isIncomplete ? "#ffedd5" : "#fef3c7"};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
            <tr>
              <td>
                <div style="font-size: 12px; text-transform: uppercase; color: #92400e; font-weight: 700; letter-spacing: 0.5px;">
                  ${isIncomplete ? "ড্রাফট অর্ডার নম্বর" : "অর্ডার নম্বর"}
                </div>
                <div style="font-size: 18px; font-weight: 800; color: #78350f; font-family: monospace; margin-top: 2px;">
                  #${escapedOrderNumber}
                </div>
                <div style="font-size: 12px; color: #b45309; margin-top: 4px;">
                  ${formattedDate} (বাংলাদেশ সময়)
                </div>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <div style="font-size: 12px; text-transform: uppercase; color: #92400e; font-weight: 700; letter-spacing: 0.5px;">
                  ${isIncomplete ? "কার্ট আইটেম মূল্য" : "সর্বমোট প্রদেয় বিল"}
                </div>
                <div style="font-size: 24px; font-weight: 900; color: #9a3412; margin-top: 2px;">
                  ${escapeHtml(formatCurrency(data.grandTotal))}
                </div>
                ${statusPillHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Quick Action CTA -->
      ${
        isIncomplete
          ? `
      <tr>
        <td style="padding: 16px 20px; background-color: #fef2f2; border-bottom: 1px solid #fee2e2; text-align: center;">
          <div style="font-size: 13px; font-weight: 700; color: #991b1b; margin-bottom: 10px;">
            💡 এটি একটি অসম্পূর্ণ ড্রাফট লিড — দ্রুত কল করে বা মেসেজ দিয়ে অর্ডার নিশ্চিত করতে পারেন:
          </div>
          <div>
            <a href="${safeTelHref}" style="display: inline-block; padding: 10px 18px; margin: 4px; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 6px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
              📞 সরাসরি কল করুন (${escapedPhone})
            </a>
            <a href="${waLink}" target="_blank" style="display: inline-block; padding: 10px 18px; margin: 4px; background-color: #16a34a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 6px; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.25);">
              💬 হোয়াটসঅ্যাপে মেসেজ
            </a>
            <a href="${orderAdminUrl}" style="display: inline-block; padding: 10px 18px; margin: 4px; background-color: #9a3412; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 6px;">
              অর্ডারটি এডমিনে দেখুন &rarr;
            </a>
          </div>
        </td>
      </tr>
      `
          : `
      <tr>
        <td style="padding: 18px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
          <a href="${orderAdminUrl}" style="display: inline-block; padding: 12px 28px; background-color: #9a3412; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 8px; box-shadow: 0 2px 6px rgba(154, 52, 18, 0.35);">
            অর্ডারটি এডমিন প্যানেলে দেখুন &rarr;
          </a>
        </td>
      </tr>
      `
      }

      <!-- Customer Info Section -->
      <tr>
        <td style="padding: 24px;">
          <h2 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ea580c; display: inline-block; padding-bottom: 4px;">
            👤 গ্রাহকের তথ্য ও ঠিকানা
          </h2>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
            <tr>
              <td style="padding: 12px 16px; width: 35%; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">
                গ্রাহকের নাম:
              </td>
              <td style="padding: 12px 16px; font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                ${escapedCustomerName}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">
                মোবাইল নম্বর:
              </td>
              <td style="padding: 12px 16px; font-size: 15px; font-weight: 800; color: #0284c7; border-bottom: 1px solid #e2e8f0;">
                <a href="${safeTelHref}" style="color: #0284c7; text-decoration: underline;">
                  ${escapedPhone}
                </a>
                <span style="font-size: 11px; font-weight: 500; color: #64748b; margin-left: 8px;">(কল করতে চাপুন)</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">
                ডেলিভারি ঠিকানা:
              </td>
              <td style="padding: 12px 16px; font-size: 13px; color: #1e293b; line-height: 1.4; border-bottom: 1px solid #e2e8f0;">
                ${escapedAddress}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b;">
                ডেলিভারি এরিয়া / কুরিয়ার:
              </td>
              <td style="padding: 12px 16px; font-size: 13px; color: #1e293b; font-weight: 600;">
                ${escapedDeliveryZone} ${escapedCourierName ? `(${escapedCourierName})` : ""}
              </td>
            </tr>
          </table>

          ${
            escapedCustomerNote
              ? `
          <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px; border-radius: 4px; margin-bottom: 18px;">
            <div style="font-size: 12px; font-weight: 700; color: #c2410c; text-transform: uppercase;">
              📝 গ্রাহকের বিশেষ নোট / নির্দেশনা:
            </div>
            <div style="font-size: 13px; color: #7c2d12; margin-top: 4px; font-style: italic;">
              "${escapedCustomerNote}"
            </div>
          </div>
          `
              : ""
          }

          ${
            data.hasOtherOrders
              ? `
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 14px; border-radius: 4px; margin-bottom: 18px; font-size: 12px; color: #1e40af;">
            ℹ️ <strong>পূর্ববর্তী কাস্টমার:</strong> এই নম্বরে আগে অন্যান্য অর্ডার রয়েছে (${(data.otherOrderNumbers || []).map((n) => escapeHtml(n)).join(", ")})
          </div>
          `
              : ""
          }

          <!-- Order Items Section -->
          <h2 style="margin: 18px 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ea580c; display: inline-block; padding-bottom: 4px;">
            📦 অর্ডারের পণ্যসমূহ
          </h2>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border: 1px solid #fed7aa; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
            <thead>
              <tr style="background-color: #ffedd5; color: #9a3412;">
                <th style="padding: 10px 14px; text-align: left; font-size: 12px; text-transform: uppercase; font-weight: 700;">পণ্য</th>
                <th style="padding: 10px 14px; text-align: center; font-size: 12px; text-transform: uppercase; font-weight: 700;">পরিমাণ</th>
                <th style="padding: 10px 14px; text-align: right; font-size: 12px; text-transform: uppercase; font-weight: 700;">দর</th>
                <th style="padding: 10px 14px; text-align: right; font-size: 12px; text-transform: uppercase; font-weight: 700;">মোট</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Bill Summary Calculation -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 280px; margin-left: auto; margin-bottom: 18px;">
            <tr>
              <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">সাবটোটাল:</td>
              <td style="padding: 4px 8px; font-size: 14px; font-weight: 600; color: #0f172a; text-align: right;">${escapeHtml(formatCurrency(data.subtotal))}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">ডেলিভারি চার্জ:</td>
              <td style="padding: 4px 8px; font-size: 14px; font-weight: 600; color: #0f172a; text-align: right;">${escapeHtml(formatCurrency(data.shippingTotal))}</td>
            </tr>
            ${
              data.discountTotal && data.discountTotal > 0
                ? `
            <tr>
              <td style="padding: 4px 8px; font-size: 13px; color: #16a34a;">ডিসকাউন্ট:</td>
              <td style="padding: 4px 8px; font-size: 14px; font-weight: 600; color: #16a34a; text-align: right;">-${escapeHtml(formatCurrency(data.discountTotal))}</td>
            </tr>`
                : ""
            }
            <tr style="border-top: 2px solid #fed7aa;">
              <td style="padding: 8px 8px; font-size: 15px; font-weight: 800; color: #9a3412;">মোট প্রদেয়:</td>
              <td style="padding: 8px 8px; font-size: 18px; font-weight: 900; color: #9a3412; text-align: right;">${escapeHtml(formatCurrency(data.grandTotal))}</td>
            </tr>
          </table>

          <!-- Admin Quick Action Box -->
          <div style="text-align: center; margin-top: 24px; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
            <div style="font-size: 13px; color: #475569; margin-bottom: 12px;">
              গ্রাহকের সাথে কথা বলে দ্রুত অর্ডারটি কনফার্ম করুন:
            </div>
            <a href="${orderAdminUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0f766e; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 6px;">
              অর্ডার ভিউ ও কনফার্ম করুন
            </a>
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background-color: #f1f5f9; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
          <div>
            এই নোটিফিকেশনটি <strong>${escapedSenderName}</strong> এর Brevo Transactional Email গেটওয়ে দ্বারা স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।
          </div>
          <div style="margin-top: 6px; color: #94a3b8; font-size: 11px;">
            সময়: ${formattedDate} · Order ID: ${escapedOrderIdOrNumber}
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Builds plain-text fallback version for high deliverability.
 */
export function renderAdminOrderEmailText(
  data: BrevoOrderNotificationPayload,
  config: BrevoConfig
): string {
  const baseUrl = getBaseAppUrl();
  const orderAdminUrl = `${baseUrl}/admin/orders?search=${encodeURIComponent(data.orderNumber)}`;
  const formattedDate = formatDhakaDateTime(data.createdAt);
  const isIncomplete = data.status === "incomplete_order";

  const addressText =
    typeof data.address === "string"
      ? data.address
      : [
          data.address?.address_line,
          data.address?.district,
          data.address?.division,
        ]
          .filter(Boolean)
          .join(", ") || "ঠিকানা প্রদান করা হয়নি";

  const itemsText = (data.items || [])
    .map(
      (item) =>
        `- ${item.productName}${item.variantName ? ` (${item.variantName})` : ""} x ${item.quantity} = ${formatCurrency(
          item.lineTotal || item.quantity * item.unitPrice
        )}`
    )
    .join("\n");

  if (isIncomplete) {
    return `
==================================================
⚠️ অসম্পূর্ণ অর্ডার (ড্রাফট লিড) - ${config.senderName}
==================================================

গ্রাহক চেকআউট শুরু করেছিলেন কিন্তু এখনো অর্ডার নিশ্চিত করেননি।
অবিলম্বে কল বা মেসেজ দিয়ে অর্ডারটি নিশ্চিত করতে পারেন।

ড্রাফট নম্বর: #${data.orderNumber}
তারিখ: ${formattedDate} (বাংলাদেশ সময়)
কার্ট পণ্যের মূল্য: ${formatCurrency(data.grandTotal)}

--------------------------------------------------
👤 গ্রাহকের বিবরণ:
--------------------------------------------------
নাম: ${data.customerName || "ড্রাফট ভিজিটর"}
ফোন: ${data.customerPhone} (কল করতে চাপুন)
ঠিকানা: ${addressText}
ডেলিভারি জোন: ${data.deliveryZone || "N/A"}
${data.customerNote ? `গ্রাহকের নোট: "${data.customerNote}"\n` : ""}
--------------------------------------------------
📦 কার্টে থাকা পণ্যসমূহ:
--------------------------------------------------
${itemsText}

সাবটোটাল: ${formatCurrency(data.subtotal)}
ডেলিভারি চার্জ: ${formatCurrency(data.shippingTotal)}
সর্বমোট: ${formatCurrency(data.grandTotal)}

--------------------------------------------------
👉 এডমিন প্যানেলে ড্রাফট লিড দেখতে নিচের লিংকে যান:
${orderAdminUrl}
==================================================
    `.trim();
  }

  return `
==================================================
🔔 নতুন অর্ডার গৃহীত হয়েছে - ${config.senderName}
==================================================

অর্ডার নম্বর: #${data.orderNumber}
তারিখ: ${formattedDate} (বাংলাদেশ সময়)
মোট প্রদেয়: ${formatCurrency(data.grandTotal)} (Cash on Delivery)

--------------------------------------------------
👤 গ্রাহকের বিবরণ:
--------------------------------------------------
নাম: ${data.customerName || "Customer"}
ফোন: ${data.customerPhone}
ঠিকানা: ${addressText}
ডেলিভারি জোন: ${data.deliveryZone || "N/A"}
${data.customerNote ? `গ্রাহকের নোট: "${data.customerNote}"\n` : ""}
--------------------------------------------------
📦 পণ্য তালিকা:
--------------------------------------------------
${itemsText}

সাবটোটাল: ${formatCurrency(data.subtotal)}
ডেলিভারি চার্জ: ${formatCurrency(data.shippingTotal)}
সর্বমোট: ${formatCurrency(data.grandTotal)}

--------------------------------------------------
👉 এডমিন প্যানেলে অর্ডারটি দেখতে নিচের লিংকে যান:
${orderAdminUrl}
==================================================
  `.trim();
}

/**
 * Dispatches an admin order notification email via Brevo to all configured admin recipients.
 */
export async function sendAdminOrderNotification(
  payload: BrevoOrderNotificationPayload
): Promise<BrevoSendResult> {
  try {
    const config = await getBrevoConfig();

    if (!config.enabled) {
      console.log("[Brevo] Admin notifications are disabled in site settings.");
      return {
        success: false,
        skipped: true,
        error: "Brevo notifications disabled in site settings",
      };
    }

    if (!config.apiKey) {
      console.warn(
        "[Brevo] BREVO_API_KEY is not configured. Admin email notification skipped."
      );
      return {
        success: false,
        skipped: true,
        error: "BREVO_API_KEY not configured",
      };
    }

    const isIncomplete = payload.status === "incomplete_order";

    if (isIncomplete && config.notifyIncomplete === false) {
      console.info(
        "[Brevo] Incomplete order notification is disabled in site_settings. Notification skipped."
      );
      return {
        success: false,
        skipped: true,
        error: "Incomplete draft lead notification disabled in site settings",
      };
    }

    if (config.adminEmails.length === 0) {
      console.warn(
        "[Brevo] No admin email address found in BREVO_ADMIN_EMAIL, ADMIN_EMAIL, or site_settings. Notification skipped."
      );
      return {
        success: false,
        skipped: true,
        error: "No admin notification email addresses configured",
      };
    }

    const recipients: BrevoRecipient[] = config.adminEmails.map((email) => ({
      email,
      name: "Store Administrator",
    }));

    const subject = isIncomplete
      ? `⚠️ [ড্রাফট লিড] অসম্পূর্ণ অর্ডার #${payload.orderNumber} (${formatCurrency(payload.grandTotal)}) - ${payload.customerPhone}${payload.customerName ? ` (${payload.customerName})` : ""}`
      : `🔔 নতুন অর্ডার #${payload.orderNumber} (${formatCurrency(payload.grandTotal)}) - ${payload.customerName || payload.customerPhone}`;

    const htmlContent = renderAdminOrderEmailHtml(payload, config);
    const textContent = renderAdminOrderEmailText(payload, config);
    const tags = isIncomplete
      ? ["incomplete-order", "abandoned-lead", "admin-alert"]
      : ["order-notification", "admin-alert"];

    const result = await sendBrevoEmail(
      {
        to: recipients,
        subject,
        htmlContent,
        textContent,
        tags,
      },
      config
    );

    if (result.success) {
      console.log(
        `[Brevo] Admin ${isIncomplete ? "incomplete order lead" : "order"} notification email sent successfully for #${payload.orderNumber} to ${config.adminEmails.join(", ")} (Message ID: ${result.messageId})`
      );
    } else {
      console.error(
        `[Brevo] Failed to send admin order notification for #${payload.orderNumber}:`,
        result.error
      );
    }

    return result;
  } catch (err: any) {
    console.error("[Brevo] Unexpected error in sendAdminOrderNotification:", err);
    return {
      success: false,
      error: err?.message || "Unexpected Brevo notification error",
    };
  }
}

/**
 * Sends a test email to verify that the Brevo API key and credentials work properly.
 */
export async function testBrevoConnection(
  recipientEmail?: string
): Promise<BrevoSendResult> {
  const config = await getBrevoConfig();

  if (!config.apiKey) {
    return {
      success: false,
      error:
        "BREVO_API_KEY is not configured. Please add it to .env or update site settings.",
    };
  }

  const targetEmail = recipientEmail
    ? recipientEmail.trim().toLowerCase()
    : config.adminEmails[0];

  if (!targetEmail) {
    return {
      success: false,
      error:
        "No test recipient email address specified. Please provide an admin email address.",
    };
  }

  const mockPayload: BrevoOrderNotificationPayload = {
    orderNumber: "TEST-" + Math.floor(1000 + Math.random() * 9000),
    customerName: "মো: রহিম আহমেদ (টেস্ট গ্রাহক)",
    customerPhone: "01712345678",
    deliveryZone: "inside_dhaka",
    address: {
      address_line: "বাড়ি ১২, রোড ৫, ধানমন্ডি",
      district: "ঢাকা",
      division: "ঢাকা",
    },
    courierName: "Steadfast Courier",
    items: [
      {
        productName: "খাঁটি দানাদার খেজুরের গুড় (প্রিমিয়াম)",
        variantName: "১ কেজি বক্স",
        quantity: 2,
        unitPrice: 650,
        lineTotal: 1300,
      },
    ],
    subtotal: 1300,
    shippingTotal: 70,
    grandTotal: 1370,
    customerNote: "এটি একটি টেস্ট নোটিফিকেশন ইমেইল।",
    status: "pending",
  };

  const subject = `[Test Notification] Brevo Email Gateway Verified - #${mockPayload.orderNumber}`;
  const htmlContent = `
    <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 6px 0; color: #065f46; font-size: 18px;">✅ Brevo Connection Successful!</h2>
        <p style="margin: 0; color: #047857; font-size: 14px;">
          আপনার Brevo API Key এবং ট্রানজেকশনাল ইমেইল সফলভাবে সংযুক্ত হয়েছে।
        </p>
      </div>
      <p style="font-size: 14px; color: #475569;">
        নিচে একটি স্যাম্পল অর্ডার নোটিফিকেশন প্রদর্শন করা হলো যাতে দেখতে পারেন নতুন অর্ডার আসলে ইমেইলটি কেমন দেখাবে:
      </p>
    </div>
    ${renderAdminOrderEmailHtml(mockPayload, config)}
  `;

  return await sendBrevoEmail(
    {
      to: [{ email: targetEmail, name: "Admin" }],
      subject,
      htmlContent,
      textContent: `[Test] Brevo Email Gateway Verified successfully for ${config.senderName}.`,
      tags: ["test-notification", "brevo-verify"],
    },
    config
  );
}
