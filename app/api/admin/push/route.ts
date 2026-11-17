import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffSession } from "@/lib/admin-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getVapidConfig, isValidPushEndpoint } from "@/lib/push/web-push";

const subscribeSchema = z.object({
  endpoint: z.string().min(10).max(2048),
  keys: z.object({
    p256dh: z.string().min(16).max(512),
    auth: z.string().min(8).max(256),
  }),
  deviceLabel: z.string().max(120).optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().min(10).max(2048),
});

function inferDeviceLabel(userAgent: string): string {
  const ua = userAgent || "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Browser";
}

export async function GET() {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { configured, publicKey } = getVapidConfig();
  const supabase = getSupabaseAdmin();
  const { count } = await supabase
    .from("admin_push_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("staff_id", session.user.id);

  return NextResponse.json(
    {
      success: true,
      configured,
      vapidPublicKey: configured ? publicKey : null,
      subscribedDevicesCount: count ?? 0,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { configured } = getVapidConfig();
  if (!configured) {
    return NextResponse.json(
      { success: false, error: "Push notifications are not configured on the server." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid push subscription payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { endpoint, keys, deviceLabel } = parsed.data;
  if (!isValidPushEndpoint(endpoint)) {
    return NextResponse.json(
      { success: false, error: "Push subscription endpoint must be a valid HTTPS URL" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const userAgent = (request.headers.get("user-agent") || "").slice(0, 500);
  const resolvedLabel = (deviceLabel || "").trim() || inferDeviceLabel(userAgent);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("admin_push_subscriptions")
    .upsert(
      {
        staff_id: session.user.id,
        staff_email: session.user.email || null,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent,
        device_label: resolvedLabel,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.error("[POST /api/admin/push] Upsert error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save push subscription" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid unsubscribe payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("admin_push_subscriptions")
    .delete()
    .eq("staff_id", session.user.id)
    .eq("endpoint", parsed.data.endpoint);

  if (error) {
    console.error("[DELETE /api/admin/push] Delete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove push subscription" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
