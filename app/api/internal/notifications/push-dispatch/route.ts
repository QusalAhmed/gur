import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  dispatchPendingNotificationPushes,
  dispatchPushForNotificationId,
} from "@/lib/push/web-push";

function verifyInternalSecret(request: NextRequest): boolean {
  const expected =
    process.env.PUSH_WEBHOOK_SECRET?.trim() ||
    process.env.ADMIN_AUTH_SECRET?.trim();
  if (!expected) return false;

  const authHeader = request.headers.get("authorization") || "";
  const headerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : request.headers.get("x-internal-secret")?.trim() || "";

  if (!headerToken) return false;

  const a = Buffer.from(headerToken, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!verifyInternalSecret(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Supports direct `{ notificationId }` or Supabase Database Webhook `{ record: { id } }`
  const record =
    typeof body.record === "object" && body.record !== null
      ? (body.record as Record<string, unknown>)
      : null;

  const notificationId =
    (typeof body.notificationId === "string" ? body.notificationId : null) ||
    (typeof record?.id === "string" ? record.id : null);

  const result = notificationId
    ? await dispatchPushForNotificationId(notificationId)
    : await dispatchPendingNotificationPushes(15);

  return NextResponse.json(
    { success: true, result },
    { headers: { "Cache-Control": "no-store" } }
  );
}
