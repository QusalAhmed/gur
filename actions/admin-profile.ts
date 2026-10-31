"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ADMIN_COOKIE_NAME,
  verifySessionToken,
  createSessionToken,
  AdminUser,
} from "@/lib/admin-auth";

export interface UpdateProfileParams {
  name: string;
  avatarUrl: string;
  phone?: string;
}

export interface UpdateProfileResult {
  success: boolean;
  user?: AdminUser;
  error?: string;
  message?: string;
}

/**
 * Saves and updates the admin user's profile photo and details in the database (public.profiles & auth metadata)
 * and refreshes their signed session cookie.
 */
export async function updateAdminProfileAction(
  params: UpdateProfileParams
): Promise<UpdateProfileResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

    if (!token) {
      return { success: false, error: "Authentication session not found." };
    }

    const currentUser = await verifySessionToken(token);
    if (!currentUser) {
      return { success: false, error: "Invalid or expired admin session." };
    }

    const trimmedName = params.name.trim() || currentUser.name || "Administrator";
    const avatarUrl = params.avatarUrl ? params.avatarUrl.trim() : "";
    const phone = params.phone ? params.phone.trim() : currentUser.phone;
    const initials =
      trimmedName
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "AD";

    const now = new Date().toISOString();

    // 1. Supabase User with UUID (created via auth.users)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      currentUser.id
    );

    if (isUuid) {
      // Upsert into public.profiles
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
        {
          id: currentUser.id,
          full_name: trimmedName,
          avatar_path: avatarUrl,
          phone: phone || null,
          updated_at: now,
        },
        { onConflict: "id" }
      );

      if (profileError) {
        console.error("Error upserting public.profiles:", profileError);
        return { success: false, error: `Failed to update profile record: ${profileError.message}` };
      }

      // Synchronize with Supabase Auth metadata
      try {
        await supabaseAdmin.auth.admin.updateUserById(currentUser.id, {
          user_metadata: {
            full_name: trimmedName,
            name: trimmedName,
            avatar_url: avatarUrl,
            avatarUrl: avatarUrl,
          },
        });
      } catch (authErr) {
        console.warn("Could not sync auth metadata (non-fatal):", authErr);
      }
    } else {
      // 2. Root Admin or custom non-UUID user - persist in public.site_settings
      const settingsPayload = [
        {
          key: "admin.root_avatar_url",
          value: avatarUrl,
          description: "Root Administrator Profile Photo URL",
          is_public: false,
          updated_at: now,
        },
        {
          key: "admin.root_name",
          value: trimmedName,
          description: "Root Administrator Display Name",
          is_public: false,
          updated_at: now,
        },
      ];

      const { error: settingsError } = await supabaseAdmin
        .from("site_settings")
        .upsert(settingsPayload, { onConflict: "key" });

      if (settingsError) {
        console.error("Error saving root admin settings:", settingsError);
        return { success: false, error: `Failed to save root admin profile: ${settingsError.message}` };
      }
    }

    // 3. Build updated user payload
    const updatedUser: AdminUser = {
      ...currentUser,
      name: trimmedName,
      avatarUrl: avatarUrl,
      initials,
      phone: phone || undefined,
    };

    // 4. Re-sign session token and update cookie
    const newToken = await createSessionToken(updatedUser);
    cookieStore.set(ADMIN_COOKIE_NAME, newToken, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secure: process.env.NODE_ENV === "production",
    });

    // 5. Revalidate relevant admin paths
    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/staff");

    return {
      success: true,
      user: updatedUser,
      message: "Profile photo and information saved successfully to database.",
    };
  } catch (err: any) {
    console.error("Error in updateAdminProfileAction:", err);
    return {
      success: false,
      error: err?.message || "An unexpected error occurred while saving profile.",
    };
  }
}

/**
 * Saves staff member profile photo and details to database.
 */
export async function saveStaffMemberAction(staff: {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staff.id);
    const now = new Date().toISOString();

    if (isUuid) {
      await supabaseAdmin.from("profiles").upsert(
        {
          id: staff.id,
          full_name: staff.name,
          phone: staff.phone || null,
          avatar_path: staff.avatarUrl || null,
          updated_at: now,
        },
        { onConflict: "id" }
      );
    }

    // Persist to site_settings staff directory cache
    const { data: currentCustom } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "staff.directory_custom")
      .maybeSingle();

    let list: any[] = [];
    if (currentCustom?.value) {
      try {
        list = typeof currentCustom.value === "string" ? JSON.parse(currentCustom.value) : currentCustom.value;
      } catch {}
    }

    const existingIndex = list.findIndex((item: any) => item.id === staff.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...staff };
    } else {
      list.push(staff);
    }

    await supabaseAdmin.from("site_settings").upsert(
      {
        key: "staff.directory_custom",
        value: list,
        description: "Custom staff members and avatars directory",
        is_public: false,
        updated_at: now,
      },
      { onConflict: "key" }
    );

    revalidatePath("/admin/staff");
    return { success: true };
  } catch (err: any) {
    console.error("Error saving staff member:", err);
    return { success: false, error: err?.message || "Failed to save staff member" };
  }
}

/**
 * Loads staff members with avatars from database.
 */
export async function getStaffDirectoryAction(): Promise<{ success: boolean; staff: any[] }> {
  try {
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "staff.directory_custom")
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      if (Array.isArray(parsed)) {
        return { success: true, staff: parsed };
      }
    }
    return { success: true, staff: [] };
  } catch {
    return { success: false, staff: [] };
  }
}

