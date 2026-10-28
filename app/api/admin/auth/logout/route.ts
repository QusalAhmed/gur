import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth";
import { getSupabaseClient } from "@/lib/supabase/client";

async function performLogout() {
  try {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore if client was not authenticated
  }
}

export async function POST(req: NextRequest) {
  try {
    await performLogout();

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    response.cookies.delete(ADMIN_COOKIE_NAME);
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: "",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to logout" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  await performLogout();

  const loginUrl = new URL("/admin/login", req.url);
  const response = NextResponse.redirect(loginUrl);

  response.cookies.delete(ADMIN_COOKIE_NAME);
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return response;
}
