import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createSessionToken,
  AdminUser,
} from "@/lib/admin-auth";
import { isValidAdminRole } from "@/lib/admin-permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// In-memory sliding window rate limiter for login brute-force protection
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP_EMAIL = 8;
const MAX_ATTEMPTS_PER_IP = 25;
const failedLoginBuckets = new Map<string, number[]>();

function isRateLimited(key: string, maxAttempts: number): number | null {
  const now = Date.now();
  const recent = (failedLoginBuckets.get(key) || []).filter(
    (ts) => now - ts < LOGIN_WINDOW_MS
  );
  failedLoginBuckets.set(key, recent);
  if (recent.length >= maxAttempts && recent.length > 0) {
    return Math.ceil((LOGIN_WINDOW_MS - (now - recent[0])) / 1000);
  }
  return null;
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const recent = (failedLoginBuckets.get(key) || []).filter(
    (ts) => now - ts < LOGIN_WINDOW_MS
  );
  recent.push(now);
  failedLoginBuckets.set(key, recent);
}

function clearAttempts(key: string) {
  failedLoginBuckets.delete(key);
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd;
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

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
    const clientIp = getClientIp(req);
    const ipBucketKey = `ip:${clientIp}`;
    const pairBucketKey = `pair:${clientIp}:${trimmedEmail}`;

    const retrySeconds =
      isRateLimited(pairBucketKey, MAX_ATTEMPTS_PER_IP_EMAIL) ??
      isRateLimited(ipBucketKey, MAX_ATTEMPTS_PER_IP);
    if (retrySeconds !== null) {
      return NextResponse.json(
        { success: false, error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retrySeconds) } }
      );
    }

    const adminClient = getSupabaseAdmin();
    let authenticatedUser: AdminUser | null = null;

    // 1. Check environment-level root admin credentials (if configured)
    const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const envAdminPassword = process.env.ADMIN_PASSWORD;

    if (
      envAdminEmail &&
      envAdminPassword &&
      constantTimeStringEqual(trimmedEmail, envAdminEmail) &&
      constantTimeStringEqual(password, envAdminPassword)
    ) {
      let rootAvatar: string | undefined;
      let rootName = "Administrator";
      try {
        const { data: rootSetting } = await adminClient
          .from("site_settings")
          .select("key, value")
          .in("key", ["admin.root_avatar_url", "admin.root_name"]);
        if (rootSetting) {
          for (const s of rootSetting) {
            if (s.key === "admin.root_avatar_url" && s.value) {
              rootAvatar = typeof s.value === "string" ? s.value.replace(/^"|"$/g, "") : s.value;
            }
            if (s.key === "admin.root_name" && s.value) {
              rootName = typeof s.value === "string" ? s.value.replace(/^"|"$/g, "") : s.value;
            }
          }
        }
      } catch {}

      authenticatedUser = {
        id: "admin-root",
        name: rootName,
        email: envAdminEmail,
        role: "owner",
        initials: rootName.slice(0, 2).toUpperCase(),
        avatarUrl: rootAvatar,
      };
    }

    // 2. Authenticate through Supabase Auth using @supabase/ssr so session cookies persist
    if (!authenticatedUser) {
      const cookieStore = await cookies();
      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        "https://hcfuqyidcxsqyjzmwxiw.supabase.co";
      const supabaseAnonKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        "";

      const ssrSupabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      });

      const { data, error } = await ssrSupabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error || !data?.user) {
        recordFailedAttempt(pairBucketKey);
        recordFailedAttempt(ipBucketKey);
        return NextResponse.json(
          {
            success: false,
            error: "Invalid email or password.",
          },
          { status: 401 }
        );
      }

      // Strictly require an assigned staff_members role; never fall back to user_metadata or default "admin"
      const { data: staffRecord, error: staffErr } = await adminClient
        .from("staff_members")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (staffErr || !staffRecord?.role || !isValidAdminRole(staffRecord.role)) {
        try {
          await ssrSupabase.auth.signOut();
        } catch {}
        recordFailedAttempt(pairBucketKey);
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden: Staff permissions have not been assigned to this account.",
          },
          { status: 403 }
        );
      }

      const userRole = staffRecord.role;
      const userMeta = data.user.user_metadata || {};

      // Fetch persistent profile photo & full name from public.profiles
      let profileAvatarUrl: string | undefined = userMeta.avatar_url || userMeta.avatarUrl;
      let profileFullName: string | undefined = userMeta.full_name || userMeta.name;

      try {
        const { data: profileRecord } = await adminClient
          .from("profiles")
          .select("full_name, avatar_path, phone")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profileRecord) {
          if (profileRecord.avatar_path) profileAvatarUrl = profileRecord.avatar_path;
          if (profileRecord.full_name) profileFullName = profileRecord.full_name;
        }
      } catch (profErr) {
        console.warn("Could not query profiles table:", profErr);
      }

      const fullName =
        profileFullName ||
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
        avatarUrl: profileAvatarUrl,
      };
    }

    if (!authenticatedUser) {
      recordFailedAttempt(pairBucketKey);
      recordFailedAttempt(ipBucketKey);
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Invalid staff credentials.",
        },
        { status: 401 }
      );
    }

    clearAttempts(pairBucketKey);

    const durationSeconds = rememberMe
      ? 60 * 60 * 24 * 30 // 30 days
      : 60 * 60 * 24 * 7; // 7 days

    const token = await createSessionToken(authenticatedUser, durationSeconds);

    const response = NextResponse.json(
      {
        success: true,
        user: authenticatedUser,
      },
      { headers: { "Cache-Control": "no-store" } }
    );

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: durationSeconds,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication service error." },
      { status: 500 }
    );
  }
}
