import * as webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  AdminRole,
  canRoleAccessPath,
  isValidAdminRole,
} from "@/lib/admin-permissions";
import type { AdminNotification, NotificationType } from "@/types/notification";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface AdminPushPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  url: string;
  notificationId?: string;
  unreadCount?: number;
  orderNumber?: string;
  orderId?: string;
  forceShow?: boolean;
}

interface StoredPushSubscription {
  id: string;
  staff_id: string;
  staff_email: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let vapidConfiguredForKey: string | null = null;

export function getVapidConfig(): {
  publicKey: string;
  privateKey: string;
  subject: string;
  configured: boolean;
} {
  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
  const rawSubject = (
    process.env.VAPID_SUBJECT || "mailto:admin@khatikhejurgur.shop"
  ).trim();
  const subject =
    rawSubject.startsWith("mailto:") || rawSubject.startsWith("https://")
      ? rawSubject
      : `mailto:${rawSubject}`;

  return {
    publicKey,
    privateKey,
    subject,
    configured: Boolean(publicKey && privateKey),
  };
}

function ensureVapidConfigured(): boolean {
  const { publicKey, privateKey, subject, configured } = getVapidConfig();
  if (!configured) return false;

  const cacheKey = `${publicKey}:${subject}`;
  if (vapidConfiguredForKey !== cacheKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfiguredForKey = cacheKey;
  }
  return true;
}

/**
 * Validates that a Web Push subscription endpoint is a strict HTTPS URL.
 */
export function isValidPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string") return false;
  const trimmed = endpoint.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    if (!parsed.hostname || parsed.hostname === "localhost") return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Redacts raw customer phone numbers (BD & international) from lock-screen push text
 * while keeping order numbers, currency amounts, and customer names intact.
 */
export function redactPhoneNumbers(input: string): string {
  if (!input) return "";

  let output = input;

  // 1. Bangladeshi mobile numbers (+8801..., 8801..., 01[3-9]...) with optional separators
  output = output.replace(
    /(?<![A-Za-z0-9#-])(?:\+?880[-\s]?|0)1[3-9](?:[-\s]?\d){8}(?![A-Za-z0-9])/g,
    "[phone hidden]"
  );

  // 2. International formatted numbers (+CC ...)
  output = output.replace(
    /(?<![A-Za-z0-9#-])\+\d{1,3}[-\s]?\d{2,4}(?:[-\s]?\d{2,5}){2,3}(?![A-Za-z0-9])/g,
    "[phone hidden]"
  );

  // 3. Fallback: standalone 10-15 digit phone-like sequences not attached to order codes/currency
  output = output.replace(
    /(?<![A-Za-z0-9#৳$€£-])\d{10,15}(?![A-Za-z0-9])/g,
    "[phone hidden]"
  );

  // Tidy common patterns like "from [phone hidden]" -> "from Customer"
  output = output
    .replace(/\bfrom\s+\[phone hidden\]/gi, "from Customer")
    .replace(/\bCustomer\s+\[phone hidden\]/gi, "A customer")
    .replace(/গ্রাহক\s+\[phone hidden\]/g, "একজন গ্রাহক");

  return output.trim();
}

/**
 * Resolves the canonical internal `/admin/...` route used for RBAC checks.
 */
export function resolveNotificationPermissionPath(
  notification: Pick<AdminNotification, "type" | "data">
): string {
  const data = (notification.data || {}) as Record<string, unknown>;
  const rawLink = typeof data.link === "string" ? data.link.trim() : "";

  if (data.alert_subtype === "incomplete_order_lead" || data.status === "incomplete_order") {
    return "/admin/incomplete";
  }

  switch (notification.type as NotificationType) {
    case "order_created":
    case "order_status_changed":
      return "/admin/orders";
    case "customer_inquiry":
      if (rawLink.startsWith("/admin/orders")) return "/admin/orders";
      return "/admin/messages";
    case "low_stock":
      return "/admin/inventory";
    case "system_alert":
    default: {
      if (data.order_id || data.order_number) {
        return "/admin/orders";
      }
      if (rawLink.startsWith("/admin")) {
        return rawLink.split("?")[0] || "/admin";
      }
      return "/admin";
    }
  }
}

/**
 * Checks whether a staff role is allowed to receive a push notification for this event.
 */
export function canRoleReceiveNotification(
  role: AdminRole,
  notification: Pick<AdminNotification, "type" | "data">
): boolean {
  const permissionPath = resolveNotificationPermissionPath(notification);
  return canRoleAccessPath(role, permissionPath);
}

/**
 * Builds the sanitized, phone-redacted Web Push payload for an AdminNotification.
 */
export function buildPushPayload(
  notification: Pick<AdminNotification, "id" | "type" | "title" | "message" | "data">,
  unreadCount?: number
): AdminPushPayload {
  const data = (notification.data || {}) as Record<string, unknown>;
  const rawLink = typeof data.link === "string" ? data.link.trim() : "";
  const orderNumber =
    typeof data.order_number === "string" ? data.order_number : undefined;
  const orderId = typeof data.order_id === "string" ? data.order_id : undefined;

  const targetUrl =
    rawLink ||
    (orderNumber
      ? `/admin/orders?search=${encodeURIComponent(orderNumber)}`
      : resolveNotificationPermissionPath(notification));

  const title = redactPhoneNumbers(notification.title || "Gur Admin");
  const body = redactPhoneNumbers(notification.message || "");

  return {
    title: title.slice(0, 120),
    body: body.slice(0, 220),
    icon: "/icons/admin-icon-192.png",
    badge: "/icons/admin-badge-96.png",
    tag: `gur-notif-${notification.id}`,
    url: targetUrl,
    notificationId: notification.id,
    unreadCount,
    orderNumber,
    orderId,
  };
}

async function resolveLiveRolesForStaffIds(
  staffIds: string[]
): Promise<Map<string, AdminRole>> {
  const roleMap = new Map<string, AdminRole>();
  const uuids: string[] = [];

  const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  for (const staffId of staffIds) {
    if (staffId === "admin-root") {
      if (envAdminEmail) {
        roleMap.set("admin-root", "owner");
      }
    } else if (UUID_REGEX.test(staffId)) {
      uuids.push(staffId);
    }
  }

  if (uuids.length > 0) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("staff_members")
      .select("user_id, role")
      .in("user_id", uuids);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row.user_id && isValidAdminRole(row.role)) {
          roleMap.set(row.user_id, row.role);
        }
      }
    }
  }

  return roleMap;
}

async function getUnreadNotificationCount(): Promise<number> {
  try {
    const supabase = getSupabaseAdmin();
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Fans out a Web Push payload to all subscribed staff devices whose live role permits this notification.
 * Automatically deletes expired (404/410) or revoked-staff subscriptions.
 */
export async function sendWebPushForNotification(
  notification: AdminNotification
): Promise<{
  sent: number;
  failed: number;
  skippedRole: number;
  cleaned: number;
  configured: boolean;
}> {
  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0, skippedRole: 0, cleaned: 0, configured: false };
  }

  const supabase = getSupabaseAdmin();
  const { data: subscriptions, error } = await supabase
    .from("admin_push_subscriptions")
    .select("id, staff_id, staff_email, endpoint, p256dh, auth");

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, skippedRole: 0, cleaned: 0, configured: true };
  }

  const rows = subscriptions as StoredPushSubscription[];
  const uniqueStaffIds = Array.from(new Set(rows.map((r) => r.staff_id)));
  const liveRoles = await resolveLiveRolesForStaffIds(uniqueStaffIds);
  const unreadCount = await getUnreadNotificationCount();
  const payload = buildPushPayload(notification, unreadCount);
  const serializedPayload = JSON.stringify(payload);

  const staleIds: string[] = [];
  const eligibleRows: StoredPushSubscription[] = [];
  let skippedRole = 0;

  for (const row of rows) {
    const role = liveRoles.get(row.staff_id);
    if (!role) {
      // Staff member was removed or env admin-root disabled; clean up subscription
      staleIds.push(row.id);
      continue;
    }

    if (!canRoleReceiveNotification(role, notification)) {
      skippedRole += 1;
      continue;
    }

    eligibleRows.push(row);
  }

  let sent = 0;
  let failed = 0;
  const succeededIds: string[] = [];

  await Promise.all(
    eligibleRows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          serializedPayload,
          { TTL: 60 * 60 * 6 } // 6-hour delivery window
        );
        sent += 1;
        succeededIds.push(sub.id);
      } catch (err: unknown) {
        const statusCode =
          typeof err === "object" && err !== null && "statusCode" in err
            ? Number((err as { statusCode?: unknown }).statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          failed += 1;
          console.warn(
            `[WebPush] Failed to deliver notification ${notification.id} (status ${statusCode || "unknown"}):`,
            err instanceof Error ? err.message : String(err)
          );
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await supabase
      .from("admin_push_subscriptions")
      .delete()
      .in("id", staleIds);
  }

  if (succeededIds.length > 0) {
    await supabase
      .from("admin_push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .in("id", succeededIds);
  }

  return {
    sent,
    failed,
    skippedRole,
    cleaned: staleIds.length,
    configured: true,
  };
}

/**
 * Atomically claims a notification row by ID and dispatches Web Push once (idempotent).
 */
export async function dispatchPushForNotificationId(notificationId: string): Promise<{
  claimed: boolean;
  sent: number;
  failed: number;
  skippedRole: number;
  cleaned: number;
  configured: boolean;
}> {
  if (!UUID_REGEX.test(notificationId)) {
    return {
      claimed: false,
      sent: 0,
      failed: 0,
      skippedRole: 0,
      cleaned: 0,
      configured: getVapidConfig().configured,
    };
  }

  const supabase = getSupabaseAdmin();
  const { data: claimed, error } = await supabase
    .from("notifications")
    .update({ push_dispatched_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("push_dispatched_at", null)
    .select("*")
    .maybeSingle();

  if (error || !claimed) {
    return {
      claimed: false,
      sent: 0,
      failed: 0,
      skippedRole: 0,
      cleaned: 0,
      configured: getVapidConfig().configured,
    };
  }

  const result = await sendWebPushForNotification(claimed as AdminNotification);
  return { claimed: true, ...result };
}

/**
 * Atomically claims and dispatches any recent undispatched notifications
 * (captures DB-trigger notifications such as order_created, low_stock, outdated_label_shipped).
 */
export async function dispatchPendingNotificationPushes(limit = 15): Promise<{
  processed: number;
  totalSent: number;
  totalFailed: number;
}> {
  if (!getVapidConfig().configured) {
    return { processed: 0, totalSent: 0, totalFailed: 0 };
  }

  const supabase = getSupabaseAdmin();
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const cutoffIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: pendingRows, error } = await supabase
    .from("notifications")
    .select("id")
    .is("push_dispatched_at", null)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (error || !pendingRows || pendingRows.length === 0) {
    return { processed: 0, totalSent: 0, totalFailed: 0 };
  }

  let processed = 0;
  let totalSent = 0;
  let totalFailed = 0;

  for (const row of pendingRows) {
    const res = await dispatchPushForNotificationId(row.id);
    if (res.claimed) {
      processed += 1;
      totalSent += res.sent;
      totalFailed += res.failed;
    }
  }

  return { processed, totalSent, totalFailed };
}

/**
 * Sends a direct test push notification to one specific subscription owned by the signed-in staff user.
 */
export async function sendTestPushToSubscription(
  staffId: string,
  endpoint: string,
  staffName?: string
): Promise<{ success: boolean; error?: string; expired?: boolean }> {
  if (!ensureVapidConfigured()) {
    return {
      success: false,
      error: "Web Push VAPID keys are not configured on the server.",
    };
  }

  const supabase = getSupabaseAdmin();
  const { data: sub, error } = await supabase
    .from("admin_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("staff_id", staffId)
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (error || !sub) {
    return {
      success: false,
      error: "This device is not currently subscribed. Toggle Push Notifications on first.",
    };
  }

  const unreadCount = await getUnreadNotificationCount();
  const payload: AdminPushPayload = {
    title: "Gur Admin Push Active",
    body: `Test alert for ${staffName || "Admin Staff"} — live order & message notifications are ready on this device.`,
    icon: "/icons/admin-icon-192.png",
    badge: "/icons/admin-badge-96.png",
    tag: `gur-test-${Date.now()}`,
    url: "/admin/orders",
    unreadCount,
    forceShow: true,
  };

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 60 }
    );

    await supabase
      .from("admin_push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", sub.id);

    return { success: true };
  } catch (err: unknown) {
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? Number((err as { statusCode?: unknown }).statusCode)
        : 0;

    if (statusCode === 404 || statusCode === 410) {
      await supabase
        .from("admin_push_subscriptions")
        .delete()
        .eq("id", sub.id);
      return {
        success: false,
        expired: true,
        error: "Push subscription expired. Please re-enable notifications on this device.",
      };
    }

    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send test push notification.",
    };
  }
}
