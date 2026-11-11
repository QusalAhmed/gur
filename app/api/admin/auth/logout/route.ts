import { NextRequest, NextResponse, connection } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

async function performLogout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore if client was not authenticated
  }
}

function clearAuthCookies(req: NextRequest, response: NextResponse) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });

  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      response.cookies.set({
        name: cookie.name,
        value: "",
        path: "/",
        maxAge: 0,
        secure: process.env.NODE_ENV === "production",
      });
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    await performLogout();

    const response = NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { headers: { "Cache-Control": "no-store" } }
    );

    clearAuthCookies(req, response);

    return response;
  } catch (err) {
    console.error("Admin logout error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to logout." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  await connection();
  await performLogout();

  const loginUrl = new URL("/admin/login", req.url);
  const response = NextResponse.redirect(loginUrl);

  clearAuthCookies(req, response);

  return response;
}
