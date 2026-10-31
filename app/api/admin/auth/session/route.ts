import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ success: true, user: null });
    }

    const user = await verifySessionToken(token);
    if (!user) {
      return NextResponse.json({ success: true, user: null });
    }

    // Refresh persistent profile photo from DB if available
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    if (isUuid) {
      try {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, avatar_path")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          if (profile.avatar_path !== undefined && profile.avatar_path !== null) {
            user.avatarUrl = profile.avatar_path;
          }
          if (profile.full_name) {
            user.name = profile.full_name;
            user.initials = profile.full_name.slice(0, 2).toUpperCase();
          }
        }
      } catch (err) {
        console.warn("Could not query profiles in session route:", err);
      }
    } else if (user.id === "admin-root") {
      try {
        const { data: rootSetting } = await supabaseAdmin
          .from("site_settings")
          .select("key, value")
          .in("key", ["admin.root_avatar_url", "admin.root_name"]);

        if (rootSetting) {
          for (const s of rootSetting) {
            if (s.key === "admin.root_avatar_url" && s.value) {
              const cleaned = typeof s.value === "string" ? s.value.replace(/^"|"$/g, "") : s.value;
              if (cleaned) user.avatarUrl = cleaned;
            }
            if (s.key === "admin.root_name" && s.value) {
              const cleaned = typeof s.value === "string" ? s.value.replace(/^"|"$/g, "") : s.value;
              if (cleaned) {
                user.name = cleaned;
                user.initials = cleaned.slice(0, 2).toUpperCase();
              }
            }
          }
        }
      } catch (err) {}
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to retrieve session" },
      { status: 500 }
    );
  }
}

