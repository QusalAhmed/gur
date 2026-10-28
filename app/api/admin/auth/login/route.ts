import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createSessionToken,
  AdminUser,
  AdminRole,
} from "@/lib/admin-auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, rememberMe } = body as {
      email?: string;
      password?: string;
      rememberMe?: boolean;
    };

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    let authenticatedUser: AdminUser | null = null;

    // 1. Check environment-level root admin credentials (if configured)
    const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const envAdminPassword = process.env.ADMIN_PASSWORD;

    if (
      envAdminEmail &&
      envAdminPassword &&
      trimmedEmail === envAdminEmail &&
      password === envAdminPassword
    ) {
      authenticatedUser = {
        id: "admin-root",
        name: "Administrator",
        email: envAdminEmail,
        role: "owner",
        initials: "AD",
      };
    }

    // 2. Authenticate through Supabase Auth
    if (!authenticatedUser) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error || !data?.user) {
        return NextResponse.json(
          {
            success: false,
            error: error?.message || "Invalid email or password.",
          },
          { status: 401 }
        );
      }

      // Determine staff role from Supabase
      let userRole: AdminRole = "admin";
      const userMeta = data.user.user_metadata || {};
      const appMeta = data.user.app_metadata || {};

      // Check staff_members table using authenticated session token
      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        "https://hcfuqyidcxsqyjzmwxiw.supabase.co";
      const supabaseAnonKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        "";

      if (data.session?.access_token && supabaseUrl && supabaseAnonKey) {
        try {
          const authUserClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
              headers: {
                Authorization: `Bearer ${data.session.access_token}`,
              },
            },
          });

          const { data: staffRecord } = await authUserClient
            .from("staff_members")
            .select("role")
            .eq("user_id", data.user.id)
            .maybeSingle();

          if (staffRecord?.role) {
            userRole = staffRecord.role as AdminRole;
          } else if (appMeta.role || userMeta.role) {
            userRole = (appMeta.role || userMeta.role) as AdminRole;
          }
        } catch (dbErr) {
          console.warn("Could not query staff_members table:", dbErr);
          if (appMeta.role || userMeta.role) {
            userRole = (appMeta.role || userMeta.role) as AdminRole;
          }
        }
      }

      const fullName =
        userMeta.full_name ||
        userMeta.name ||
        data.user.email?.split("@")[0] ||
        "Staff Member";

      const initials =
        fullName
          .split(" ")
          .filter(Boolean)
          .map((n: string) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "SM";

      authenticatedUser = {
        id: data.user.id,
        name: fullName,
        email: data.user.email || trimmedEmail,
        role: userRole,
        phone: data.user.phone || undefined,
        initials,
        twoFactor: Boolean(userMeta.twoFactor),
      };
    }

    if (!authenticatedUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Invalid staff credentials.",
        },
        { status: 401 }
      );
    }

    const durationSeconds = rememberMe
      ? 60 * 60 * 24 * 30 // 30 days
      : 60 * 60 * 24 * 7; // 7 days

    const token = await createSessionToken(authenticatedUser, durationSeconds);

    const response = NextResponse.json({
      success: true,
      user: authenticatedUser,
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: durationSeconds,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
