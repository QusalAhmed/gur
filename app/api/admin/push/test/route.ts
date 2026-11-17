import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStaffSession } from "@/lib/admin-guard";
import {
  isValidPushEndpoint,
  sendTestPushToSubscription,
} from "@/lib/push/web-push";

const testPushSchema = z.object({
  endpoint: z.string().min(10).max(2048),
});

export async function POST(request: NextRequest) {
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

  const parsed = testPushSchema.safeParse(body);
  if (!parsed.success || !isValidPushEndpoint(parsed.data.endpoint)) {
    return NextResponse.json(
      { success: false, error: "Valid subscription endpoint required" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const result = await sendTestPushToSubscription(
    session.user.id,
    parsed.data.endpoint,
    session.user.name
  );

  if (!result.success) {
    return NextResponse.json(result, {
      status: result.expired ? 410 : 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
