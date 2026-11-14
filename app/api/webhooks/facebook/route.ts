import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { timingSafeTokenEqual } from "@/lib/server-security";

export const dynamic = "force-dynamic";

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
 * Receives page feed updates (comments, reactions, posts)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const payload = await req.json();

    if (payload?.object === "page") {
      const supabase = getSupabaseAdmin();
      const entries = Array.isArray(payload.entry) ? payload.entry : [];

      for (const entry of entries) {
        const pageId = String(entry.id || "");
        const changes = Array.isArray(entry.changes) ? entry.changes : [];

        for (const change of changes) {
          // Listen for feed changes
          if (change?.field === "feed") {
            const val = change.value;
            
            // Check if this event is a comment creation
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

              const notificationMessage =
                commentText.length > 200
                  ? `${commentText.slice(0, 197)}...`
                  : commentText;

              await supabase.from("notifications").insert({
                type: "customer_inquiry",
                title: `💬 FB Comment from ${senderName}`,
                message: notificationMessage,
                data: {
                  platform: "facebook",
                  page_id: pageId,
                  post_id: postId,
                  comment_id: commentId,
                  sender_id: senderId,
                  sender_name: senderName,
                  full_comment: commentText,
                  link: commentUrl,
                },
                is_read: false,
              });
            }
          }
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
