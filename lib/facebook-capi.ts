import crypto from "crypto";
import { parseBdPhone } from "@/lib/phone";

export const FB_PIXEL_ID =
  process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "1234708877758735";

export interface CapiUserData {
  ph?: string | null; // Raw or normalized phone - will be formatted and SHA-256 hashed
  em?: string | null; // Email - will be trimmed, lowercased, and SHA-256 hashed
  fn?: string | null; // First name - will be trimmed, lowercased, and SHA-256 hashed
  ln?: string | null; // Last name - will be trimmed, lowercased, and SHA-256 hashed
  external_id?: string | null; // Unique customer ID - will be trimmed and SHA-256 hashed
  ct?: string | null; // City - lowercase hashed
  st?: string | null; // State - lowercase hashed
  zp?: string | null; // Zip code - lowercase hashed
  country?: string | null; // Country code (e.g. "bd") - lowercase hashed
  client_ip_address?: string | null;
  client_user_agent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

export interface CapiContentItem {
  id: string;
  quantity: number;
  item_price?: number;
}

export interface CapiCustomData {
  content_name?: string;
  content_ids?: string[];
  content_type?: "product" | "product_group";
  contents?: CapiContentItem[];
  num_items?: number;
  value?: number;
  currency?: string;
  order_id?: string;
  [key: string]: any;
}

export interface CapiEventParams {
  eventName:
    | "PageView"
    | "ViewContent"
    | "AddToCart"
    | "InitiateCheckout"
    | "Purchase"
    | "UserProperties"
    | (string & {});
  eventId: string;
  eventSourceUrl?: string;
  userData: CapiUserData;
  customData?: CapiCustomData;
}

/**
 * Computes lowercase hex SHA-256 hash according to Meta specifications.
 */
export function hashSha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Normalizes phone number according to Meta requirements:
 * Country code + area code + digits (e.g. 8801XXXXXXXXX for Bangladesh) without '+' or punctuation.
 * Returns null if the phone is not a valid Bangladeshi phone.
 */
export function formatPhoneForMeta(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  const parsed = parseBdPhone(rawPhone);
  if (!parsed.isValid) return null;
  // E.164 is '+8801XXXXXXXXX' -> remove '+' to get '8801XXXXXXXXX'
  return parsed.normalized.replace(/^\+/, "");
}

// Server-side in-memory cache to prevent sending duplicate UserProperties events for the same phone
const serverTrackedPhones = new Map<string, number>();
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function isServerPhoneAlreadyTracked(metaPhone: string): boolean {
  const lastTracked = serverTrackedPhones.get(metaPhone);
  if (lastTracked && Date.now() - lastTracked < TWENTY_FOUR_HOURS_MS) {
    return true;
  }
  return false;
}

export function markServerPhoneAsTracked(metaPhone: string): void {
  serverTrackedPhones.set(metaPhone, Date.now());
  if (serverTrackedPhones.size > 10000) {
    const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;
    for (const [key, timestamp] of serverTrackedPhones.entries()) {
      if (timestamp < cutoff) {
        serverTrackedPhones.delete(key);
      }
    }
  }
}

/**
 * Low-level function to send events to Meta Conversions API (Graph API v21.0).
 * Fire-and-forget safe: will not throw uncaught errors.
 */
export async function sendCapiEvents(
  events: CapiEventParams[],
  options?: { testEventCode?: string }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const token = process.env.FACEBOOK_CAPI_ACCESS_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || FB_PIXEL_ID;
  const testEventCode =
    options?.testEventCode?.trim() ||
    process.env.FACEBOOK_CAPI_TEST_EVENT_CODE;

  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[Facebook CAPI] Skipping server event: FACEBOOK_CAPI_ACCESS_TOKEN is not configured in environment variables."
      );
    }
    return {
      success: false,
      error: "FACEBOOK_CAPI_ACCESS_TOKEN is not configured",
    };
  }

  if (!events || events.length === 0) {
    return { success: true };
  }

  // Guard: Filter out duplicate UserProperties events for the same phone number on server
  const activeEvents = events.filter((event) => {
    if (event.eventName === "UserProperties") {
      const metaPhone = formatPhoneForMeta(event.userData?.ph);
      if (metaPhone && isServerPhoneAlreadyTracked(metaPhone)) {
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[Facebook CAPI] Skipping duplicate server UserProperties event for phone: ${metaPhone}`
          );
        }
        return false;
      }
      if (metaPhone) {
        markServerPhoneAsTracked(metaPhone);
      }
    }
    return true;
  });

  if (activeEvents.length === 0) {
    return { success: true };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  const formattedEvents = activeEvents.map((event) => {
    const rawUserData = event.userData || {};
    const formattedUserData: Record<string, any> = {};

    // Phone matching (SHA-256 hashed)
    const metaPhone = formatPhoneForMeta(rawUserData.ph);
    if (metaPhone) {
      formattedUserData.ph = [hashSha256(metaPhone)];
    }

    // Email matching (SHA-256 hashed)
    if (rawUserData.em) {
      formattedUserData.em = [hashSha256(rawUserData.em.trim().toLowerCase())];
    }

    // First name matching (SHA-256 hashed)
    if (rawUserData.fn) {
      formattedUserData.fn = [hashSha256(rawUserData.fn.trim().toLowerCase())];
    }

    // Last name matching (SHA-256 hashed)
    if (rawUserData.ln) {
      formattedUserData.ln = [hashSha256(rawUserData.ln.trim().toLowerCase())];
    }

    // External ID (SHA-256 hashed)
    if (rawUserData.external_id) {
      formattedUserData.external_id = [hashSha256(String(rawUserData.external_id).trim())];
    }

    // City (SHA-256 hashed)
    if (rawUserData.ct) {
      formattedUserData.ct = [hashSha256(rawUserData.ct.trim().toLowerCase())];
    }

    // State (SHA-256 hashed)
    if (rawUserData.st) {
      formattedUserData.st = [hashSha256(rawUserData.st.trim().toLowerCase())];
    }

    // Zip (SHA-256 hashed)
    if (rawUserData.zp) {
      formattedUserData.zp = [hashSha256(rawUserData.zp.trim().toLowerCase())];
    }

    // Country (SHA-256 hashed)
    if (rawUserData.country) {
      formattedUserData.country = [hashSha256(rawUserData.country.trim().toLowerCase())];
    }

    // IP address (unhashed)
    if (rawUserData.client_ip_address) {
      formattedUserData.client_ip_address = rawUserData.client_ip_address;
    }

    // User agent (unhashed)
    if (rawUserData.client_user_agent) {
      formattedUserData.client_user_agent = rawUserData.client_user_agent;
    }

    // Browser ID cookie (_fbp)
    if (rawUserData.fbp) {
      formattedUserData.fbp = rawUserData.fbp;
    }

    // Click ID cookie (_fbc)
    if (rawUserData.fbc) {
      formattedUserData.fbc = rawUserData.fbc;
    }

    const payloadEvent: Record<string, any> = {
      event_name: event.eventName,
      event_time: nowSeconds,
      event_id: event.eventId,
      action_source: "website",
      user_data: formattedUserData,
    };

    if (event.eventSourceUrl) {
      payloadEvent.event_source_url = event.eventSourceUrl;
    }

    if (event.customData) {
      const customData: Record<string, any> = { ...event.customData };

      // Clean & sanitize content_ids: array of non-empty strings (no 'undefined' or 'null')
      if (Array.isArray(customData.content_ids)) {
        customData.content_ids = customData.content_ids
          .map((id: any) => String(id || "").trim())
          .filter((id: string) => id && id !== "undefined" && id !== "null");
      } else if (customData.content_ids) {
        const idStr = String(customData.content_ids).trim();
        customData.content_ids = idStr && idStr !== "undefined" && idStr !== "null" ? [idStr] : [];
      }

      // Clean & sanitize contents array
      if (Array.isArray(customData.contents)) {
        customData.contents = customData.contents
          .map((item: any) => ({
            id: String(item.id || "").trim(),
            quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
            item_price: Math.max(0, Number(item.item_price ?? item.unitPrice ?? item.unit_price) || 0),
          }))
          .filter((item: any) => item.id && item.id !== "undefined" && item.id !== "null");
      }

      if (!customData.content_type && customData.content_ids && customData.content_ids.length > 0) {
        customData.content_type = "product";
      }

      if (customData.currency) {
        customData.currency = String(customData.currency).trim().toUpperCase();
      }

      payloadEvent.custom_data = customData;
    }

    return payloadEvent;
  });

  const requestBody: Record<string, any> = {
    data: formattedEvents,
  };

  if (testEventCode && testEventCode.trim()) {
    requestBody.test_event_code = testEventCode.trim();
  }

  const endpoint = `https://graph.facebook.com/v21.0/${pixelId}/events`;

  try {
    const response = await fetch(`${endpoint}?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      // Server-side fetch should not cache or stall
      cache: "no-store",
    });

    const responseJson = await response.json();

    if (!response.ok) {
      console.error(
        "[Facebook CAPI] Meta API error:",
        response.status,
        JSON.stringify(responseJson)
      );
      return {
        success: false,
        error: responseJson.error?.message || "Meta CAPI request failed",
        data: responseJson,
      };
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `%c[Facebook CAPI] Dispatched ${formattedEvents.length} event(s) successfully:`,
        "background: #0084FF; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
        formattedEvents.map((e) => `${e.event_name} (${e.event_id})`),
        responseJson
      );
    }

    return {
      success: true,
      data: responseJson,
    };
  } catch (err: any) {
    console.error("[Facebook CAPI] Network error while dispatching to Meta:", err);
    return {
      success: false,
      error: err.message || "Network error",
    };
  }
}

