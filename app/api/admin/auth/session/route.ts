import { NextResponse, connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { AdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/admin-guard";

export async function GET() {
  await connection();
  try {
    const staffSession = await getStaffSession();

    if (!staffSession) {
      return NextResponse.json(
        { success: true, user: null },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const adminClient = getSupabaseAdmin();
    const initials =
      staffSession.user.name
        .split(" ")
        .filter(Boolean)
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "ST";

    const user: AdminUser = {
      id: staffSession.user.id,
      name: staffSession.user.name,
      email: staffSession.user.email,
      role: staffSession.role,
      initials,
      avatarUrl: staffSession.user.avatarUrl,
    };

    // Refresh persistent profile photo from DB if available
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    if (isUuid) {
      try {
        const { data: profile } = await adminClient
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
        const { data: rootSetting } = await adminClient
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
      } catch {}
    }

    return NextResponse.json(
      {
        success: true,
        user,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    unstable_rethrow(err);
    console.error("Error in admin session route:", err);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve session." },
      { status: 500 }
    );
  }
}

