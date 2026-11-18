import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { timingSafeTokenEqual } from "@/lib/server-security";
import { createNotificationInternal } from "@/lib/notifications-service";

const MESSENGER_BURST_WINDOW_MS = 60_000;
const MESSENGER_DEDUP_LOOKBACK_MS = 10 * 60_000;
const SENDER_CACHE_TTL_MS = 30 * 60_000;
const SENDER_CACHE_MAX_SIZE = 500;
const GRAPH_API_TIMEOUT_MS = 2_500;
const FALLBACK_SENDER_NAME = "Facebook Customer";

const senderNameCache = new Map<string, { name: string; expiresAt: number }>();

interface RecentNotificationRow {
  id: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
}

function truncateText(text: string, maxLen = 200): string {
  const clean = text.trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 3)}...`;
}

function buildBusinessSuiteInboxUrl(pageId: string, senderId: string): string {
  if (!pageId) return "https://business.facebook.com/latest/inbox/all";
  const params = new URLSearchParams({ asset_id: pageId });
  if (senderId) {
    params.set("selected_item_id", senderId);
  }
  return `https://business.facebook.com/latest/inbox/all?${params.toString()}`;
}

function describeAttachments(attachments: any[], topLevelStickerId?: unknown): string | null {
  if (topLevelStickerId) return "👍 Sent a sticker";
  if (!Array.isArray(attachments) || attachments.length === 0) return null;

  const first = attachments[0] || {};
  if (first?.payload?.sticker_id) return "👍 Sent a sticker";

  const type = String(first?.type || "").toLowerCase();
  switch (type) {
    case "image":
      return attachments.length > 1
        ? `📷 Sent ${attachments.length} images`
        : "📷 Sent an image";
    case "audio":
      return "🎤 Sent a voice message";
    case "video":
      return "🎥 Sent a video";
    case "file":
      return "📎 Sent a file";
    case "location":
      return "📍 Shared a location";
    case "template":
    case "fallback":
    case "share": {
      const sharedTitle = typeof first?.title === "string" ? first.title.trim() : "";
      return sharedTitle ? `🔗 Shared: ${sharedTitle}` : "🔗 Shared a link";
    }
    default:
      return "📎 Sent an attachment";
  }
}

function extractMessengerEvent(
  event: any,
  pageId: string
): {
  senderId: string;
  messageId: string;
  previewText: string;
  kind: "message" | "postback";
} | null {
  if (!event || typeof event !== "object") return null;

  // Explicitly ignore delivery receipts, read receipts, and emoji reactions
  if (event.delivery || event.read || event.reaction) {
    return null;
  }

  const senderId = String(event.sender?.id || "").trim();
  // Ignore missing sender or events sent by our own Page
  if (!senderId || (pageId && senderId === pageId)) {
    return null;
  }

  // 1. Standard customer message (text, quick reply, sticker, attachments)
  if (event.message && typeof event.message === "object") {
    const msg = event.message;
    // Ignore echoes sent by the Page / Meta Business Suite / automated replies
    if (msg.is_echo === true) {
      return null;
    }

    const text = typeof msg.text === "string" ? msg.text.trim() : "";
    const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
    const attachmentDesc = describeAttachments(attachments, msg.sticker_id);

    let previewText = "";
    if (text && attachmentDesc) {
      previewText = `${text} (${attachmentDesc})`;
    } else if (text) {
      previewText = text;
    } else if (attachmentDesc) {
      previewText = attachmentDesc;
    } else {
      return null;
    }

    const messageId =
      typeof msg.mid === "string" && msg.mid.trim()
        ? msg.mid.trim()
        : `msg_${senderId}_${event.timestamp || Date.now()}`;

    return {
      senderId,
      messageId,
      previewText,
      kind: "message",
    };
  }

  // 2. Postback (Ad click-to-Messenger CTA, Ice Breaker question, Get Started button)
  if (event.postback && typeof event.postback === "object") {
    const pb = event.postback;
    const title = typeof pb.title === "string" ? pb.title.trim() : "";
    const payload = typeof pb.payload === "string" ? pb.payload.trim() : "";
    const label = title || payload;
    const previewText = label ? `Clicked: "${label}"` : "Started a conversation";

    const messageId =
      typeof pb.mid === "string" && pb.mid.trim()
        ? pb.mid.trim()
        : `postback_${senderId}_${event.timestamp || Date.now()}`;

    return {
      senderId,
      messageId,
      previewText,
      kind: "postback",
    };
  }

  return null;
}

async function resolveMessengerSenderName(psid: string): Promise<string> {
  const pageAccessToken = (
    process.env.META_PAGE_ACCESS_TOKEN ||
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN ||
    ""
  ).trim();

  if (!pageAccessToken || !psid) {
    return FALLBACK_SENDER_NAME;
  }

  const now = Date.now();
  const useCache = !process.env.VITEST;
  const cacheKey = `${pageAccessToken.slice(-8)}:${psid}`;
  if (useCache) {
    const cached = senderNameCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.name;
    }
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(psid)}?fields=first_name,last_name,name&access_token=${encodeURIComponent(pageAccessToken)}`;
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(GRAPH_API_TIMEOUT_MS),
    });

    if (!res.ok) {
      return FALLBACK_SENDER_NAME;
    }

    const profile = await res.json();
    const fullName = (
      (typeof profile?.name === "string" && profile.name.trim()) ||
      [profile?.first_name, profile?.last_name]
        .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
        .join(" ")
        .trim()
    );

    if (!fullName) {
      return FALLBACK_SENDER_NAME;
    }

    if (useCache) {
      if (senderNameCache.size >= SENDER_CACHE_MAX_SIZE) {
        const oldestKey = senderNameCache.keys().next().value;
        if (oldestKey) senderNameCache.delete(oldestKey);
      }
      senderNameCache.set(cacheKey, {
        name: fullName,
        expiresAt: now + SENDER_CACHE_TTL_MS,
      });
    }

    return fullName;
  } catch {
    return FALLBACK_SENDER_NAME;
  }
}

function isDuplicateMessageId(rows: RecentNotificationRow[], messageId: string): boolean {
  return rows.some((row) => {
    const data = row.data || {};
    if (data.platform !== "facebook" || data.alert_subtype !== "facebook_message") {
      return false;
    }
    if (data.message_id === messageId) return true;
    if (Array.isArray(data.message_ids) && data.message_ids.includes(messageId)) {
      return true;
    }
    return false;
  });
}

function findActiveBurstNotification(
  rows: RecentNotificationRow[],
  senderId: string,
  nowMs: number
): RecentNotificationRow | undefined {
  return rows.find((row) => {
    if (row.is_read) return false;
    const data = row.data || {};
    if (data.platform !== "facebook" || data.alert_subtype !== "facebook_message") {
      return false;
    }
    if (String(data.sender_id || "") !== senderId) {
      return false;
    }
    const lastTs = Date.parse(String(data.last_message_at || row.created_at || ""));
    if (!Number.isFinite(lastTs)) return false;
    return nowMs - lastTs <= MESSENGER_BURST_WINDOW_MS;
  });
}

async function fetchRecentMessengerNotifications(): Promise<RecentNotificationRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const sinceIso = new Date(Date.now() - MESSENGER_DEDUP_LOOKBACK_MS).toISOString();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, data, is_read, created_at")
      .eq("type", "customer_inquiry")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error || !Array.isArray(data)) {
      return [];
    }
    return data as RecentNotificationRow[];
  } catch {
    return [];
  }
}

async function handleMessengerEvents(pageId: string, messagingEvents: any[]): Promise<void> {
  const parsedEvents = messagingEvents
    .map((event) => extractMessengerEvent(event, pageId))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (parsedEvents.length === 0) return;

  const recentRows = await fetchRecentMessengerNotifications();
  const supabase = getSupabaseAdmin();

  for (const item of parsedEvents) {
    // 1. Deduplicate exact Meta webhook retries by message ID
    if (isDuplicateMessageId(recentRows, item.messageId)) {
      continue;
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const inboxUrl = buildBusinessSuiteInboxUrl(pageId, item.senderId);

    // 2. Check for an unread notification from the same sender within the 60s burst window
    const existingBurst = findActiveBurstNotification(recentRows, item.senderId, nowMs);

    if (existingBurst) {
      const existingData = existingBurst.data || {};
      const existingName =
        typeof existingData.sender_name === "string" && existingData.sender_name.trim()
          ? existingData.sender_name.trim()
          : FALLBACK_SENDER_NAME;

      const prevCount = Number(existingData.message_count) || 1;
      const nextCount = prevCount + 1;

      const prevIds: string[] = Array.isArray(existingData.message_ids)
        ? existingData.message_ids.filter((v: unknown): v is string => typeof v === "string")
        : typeof existingData.message_id === "string"
        ? [existingData.message_id]
        : [];
      const nextIds = [...prevIds, item.messageId].slice(-25);

      const prevSnippets: string[] = Array.isArray(existingData.recent_messages)
        ? existingData.recent_messages.filter((v: unknown): v is string => typeof v === "string")
        : [String(existingData.full_message || existingBurst.message || "")].filter(Boolean);
      const nextSnippets = [...prevSnippets, item.previewText].slice(-5);

      const mergedTitle = `📩 FB Message from ${existingName} (${nextCount})`;
      const mergedMessage = truncateText(nextSnippets.join(" · "), 200);
      const updatedData = {
        ...existingData,
        platform: "facebook",
        alert_subtype: "facebook_message",
        page_id: pageId || existingData.page_id,
        sender_id: item.senderId,
        sender_name: existingName,
        message_id: item.messageId,
        message_ids: nextIds,
        message_count: nextCount,
        recent_messages: nextSnippets,
        full_message: item.previewText,
        last_message_at: nowIso,
        link: existingData.link || inboxUrl,
      };

      const { error } = await supabase
        .from("notifications")
        .update({
          title: mergedTitle,
          message: mergedMessage,
          data: updatedData,
        })
        .eq("id", existingBurst.id);

      if (!error) {
        // Keep local snapshot synced in case another message arrives in the same POST batch
        existingBurst.title = mergedTitle;
        existingBurst.message = mergedMessage;
        existingBurst.data = updatedData;
      }
      continue;
    }

    // 3. New conversation or >60s since last unread message: resolve name & fire full alert + Web Push
    const senderName = await resolveMessengerSenderName(item.senderId);
    const title = `📩 FB Message from ${senderName}`;
    const message = truncateText(item.previewText, 200);
    const data = {
      platform: "facebook",
      alert_subtype: "facebook_message",
      event_kind: item.kind,
      page_id: pageId,
      sender_id: item.senderId,
      sender_name: senderName,
      message_id: item.messageId,
      message_ids: [item.messageId],
      message_count: 1,
      recent_messages: [item.previewText],
      full_message: item.previewText,
      last_message_at: nowIso,
      link: inboxUrl,
    };

    const created = await createNotificationInternal({
      type: "customer_inquiry",
      title,
      message,
      data,
    });

    if (created.success && created.data) {
      recentRows.unshift({
        id: created.data.id,
        title: created.data.title,
        message: created.data.message,
        data: created.data.data,
        is_read: created.data.is_read,
        created_at: created.data.created_at,
      });
    }
  }
}

/**
 * Optional HMAC-SHA256 verification when META_APP_SECRET is configured.
 * Remains compatible when META_APP_SECRET is not set.
 */
function verifyMetaSignatureIfConfigured(rawBody: string, req: NextRequest): boolean {
  const appSecret = (
    process.env.META_APP_SECRET ||
    process.env.FACEBOOK_APP_SECRET ||
    ""
  ).trim();
  if (!appSecret) return true;

  const signatureHeader = (req.headers.get("x-hub-signature-256") || "").trim();
  if (!signatureHeader) return false;

  const expectedSignature = `sha256=${createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex")}`;

  return timingSafeTokenEqual(signatureHeader, expectedSignature);
}

/**
 * Meta Webhook verification handshake (GET)
 * Meta will send hub.mode, hub.verify_token, and hub.challenge
 */
export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = (
    process.env.META_WEBHOOK_VERIFY_TOKEN ||
    process.env.FB_WEBHOOK_VERIFY_TOKEN ||
    "gur_fb_webhook_verify_2026"
  ).trim();

  if (mode === "subscribe" && timingSafeTokenEqual(token, expectedToken)) {
    console.log("[Meta Webhook] GET handshake verified successfully.");
    return new Response(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[Meta Webhook] GET handshake verification failed with invalid token.");
  return new Response("Verification token mismatch", { status: 403 });
}

/**
 * Meta Webhook event receiver (POST)
 * Receives Page feed updates (comments) and Messenger inbox events (customer messages)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.text();

    if (!verifyMetaSignatureIfConfigured(rawBody, req)) {
      console.warn("[Meta Webhook] Invalid x-hub-signature-256 signature.");
      return NextResponse.json({ status: "INVALID_SIGNATURE" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    if (payload?.object === "page") {
      const entries = Array.isArray(payload.entry) ? payload.entry : [];

      for (const entry of entries) {
        const pageId = String(entry.id || "");

        // A. Page Feed Comments (entry.changes)
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          if (change?.field === "feed") {
            const val = change.value;

            if (val && val.item === "comment" && (val.verb === "add" || !val.verb)) {
              const senderId = String(val.from?.id || "");
              const senderName = val.from?.name || "Customer";

              // Ignore comments made by the Page itself to prevent notification loops
              if (senderId && pageId && senderId === pageId) {
                continue;
              }

              const commentId = val.comment_id;
              const postId = val.post_id;
              const commentText = (val.message || "").trim() || "Left a comment on your post";
              const commentUrl = commentId
                ? `https://facebook.com/${commentId}`
                : postId
                ? `https://facebook.com/${postId}`
                : "https://facebook.com";

              await createNotificationInternal({
                type: "customer_inquiry",
                title: `💬 FB Comment from ${senderName}`,
                message: truncateText(commentText, 200),
                data: {
                  platform: "facebook",
                  alert_subtype: "facebook_comment",
                  page_id: pageId,
                  post_id: postId,
                  comment_id: commentId,
                  sender_id: senderId,
                  sender_name: senderName,
                  full_comment: commentText,
                  link: commentUrl,
                },
              });
            }
          }
        }

        // B. Page Messenger Customer Messages (entry.messaging)
        const messagingEvents = Array.isArray(entry.messaging) ? entry.messaging : [];
        if (messagingEvents.length > 0) {
          await handleMessengerEvents(pageId, messagingEvents);
        }
      }
    }

    // Always acknowledge receipt with 200 OK so Meta doesn't disable the subscription
    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (error: any) {
    console.error("[Meta Webhook] Error processing incoming event:", error);
    // Return 200 to acknowledge payload even on parse edge-cases
    return NextResponse.json({ status: "ERROR_RECORDED" }, { status: 200 });
  }
}
