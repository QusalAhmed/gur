"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole, getStaffSession } from "@/lib/admin-guard";
import { canAssignRole, isValidAdminRole } from "@/lib/admin-permissions";
import { isValidUuid } from "@/lib/security";
import {
  ADMIN_COOKIE_NAME,
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
    const session = await getStaffSession();
    if (!session) {
      return { success: false, error: "Authentication session not found or expired." };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const trimmedName = params.name.trim() || session.user.name || "Administrator";
    const avatarUrl = params.avatarUrl ? params.avatarUrl.trim() : "";
    const phone = params.phone ? params.phone.trim() : undefined;
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
    const isUuid = isValidUuid(session.user.id);

    if (isUuid) {
      // Upsert into public.profiles
      const profileUpdate: Record<string, any> = {
        id: session.user.id,
        full_name: trimmedName,
        avatar_path: avatarUrl,
        updated_at: now,
      };
      if (phone !== undefined) {
        profileUpdate.phone = phone || null;
      }

      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
        profileUpdate,
        { onConflict: "id" }
      );

      if (profileError) {
        console.error("Error upserting public.profiles:", profileError);
        return { success: false, error: `Failed to update profile record: ${profileError.message}` };
      }

      // Synchronize with Supabase Auth metadata
      try {
        await supabaseAdmin.auth.admin.updateUserById(session.user.id, {
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
    } else if (session.user.id === "admin-root" && session.role === "owner") {
      // 2. Root Admin - persist in public.site_settings
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
      id: session.user.id,
      email: session.user.email,
      name: trimmedName,
      role: session.role,
      avatarUrl: avatarUrl,
      initials,
      phone: phone || undefined,
    };

    // 4. Re-sign session token and update HttpOnly cookie
    const cookieStore = await cookies();
    const newToken = await createSessionToken(updatedUser);
    cookieStore.set(ADMIN_COOKIE_NAME, newToken, {
      path: "/",
      httpOnly: true,
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
    const session = await assertStaffRole(["owner", "admin"]);
    const staffId = String(staff.id || "").trim();
    if (!staffId || staffId.length > 100) {
      return { success: false, error: "Invalid staff identifier." };
    }
    if (!isValidAdminRole(staff.role)) {
      return { success: false, error: "Invalid staff role specified." };
    }
    if (!canAssignRole(session.role, staff.role)) {
      return {
        success: false,
        error: "Permission denied: you are not authorized to assign this role.",
      };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const isUuid = isValidUuid(staffId);
    const now = new Date().toISOString();

    if (isUuid) {
      await supabaseAdmin.from("profiles").upsert(
        {
          id: staffId,
          full_name: staff.name.trim(),
          phone: staff.phone?.trim() || null,
          avatar_path: staff.avatarUrl?.trim() || null,
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

    const sanitizedEntry = {
      id: staffId,
      name: staff.name.trim(),
      email: staff.email.trim(),
      phone: staff.phone?.trim() || undefined,
      role: staff.role,
      department: staff.department?.trim() || undefined,
      avatarUrl: staff.avatarUrl?.trim() || undefined,
    };

    const existingIndex = list.findIndex((item: any) => item.id === staffId);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...sanitizedEntry };
    } else {
      list.push(sanitizedEntry);
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
export async function getStaffDirectoryAction(): Promise<{ success: boolean; staff: any[]; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Get staff from site_settings custom list
    const { data: customData } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "staff.directory_custom")
      .maybeSingle();

    let customList: any[] = [];
    if (customData?.value) {
      const parsed = typeof customData.value === "string" ? JSON.parse(customData.value) : customData.value;
      if (Array.isArray(parsed)) {
        customList = parsed;
      }
    }

    // 2. Also fetch any admin/super_admin profiles from public.profiles
    const { data: dbProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, avatar_path, role, is_active, created_at, updated_at")
      .in("role", ["admin", "super_admin"]);

    const staffMap = new Map<string, any>();

    // Add DB profiles first
    (dbProfiles || []).forEach((p) => {
      const name = p.full_name || "Admin User";
      const initials = name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      staffMap.set(p.id, {
        id: p.id,
        name,
        initials,
        email: `${p.role}@molassesstore.com`,
        phone: p.phone || "+8801700000000",
        role: p.role === "super_admin" ? "owner" : "admin",
        department: "System Administration",
        assignedWarehouse: "All Depots",
        twoFactor: true,
        status: p.is_active ? "active" : "inactive",
        lastLogin: "Active Now",
        avatarUrl: p.avatar_path || undefined,
      });
    });

    // Merge custom staff list
    customList.forEach((s) => {
      staffMap.set(s.id, { ...(staffMap.get(s.id) || {}), ...s });
    });

    return { success: true, staff: Array.from(staffMap.values()) };
  } catch (err: any) {
    console.error("getStaffDirectoryAction error:", err);
    return { success: false, staff: [], error: err?.message || "Unauthorized" };
  }
}

/**
 * Deletes a staff member from the database custom list.
 */
export async function deleteStaffMemberAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin"]);
    const targetId = String(id || "").trim();
    if (!targetId) {
      return { success: false, error: "Invalid staff identifier." };
    }
    if (targetId === session.user.id) {
      return { success: false, error: "You cannot delete your own account." };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: currentCustom } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "staff.directory_custom")
      .maybeSingle();

    if (currentCustom?.value) {
      let list: any[] = [];
      try {
        list = typeof currentCustom.value === "string" ? JSON.parse(currentCustom.value) : currentCustom.value;
      } catch {}
      const targetEntry = list.find((item: any) => item.id === targetId);
      if (targetEntry?.role === "owner" && session.role !== "owner") {
        return { success: false, error: "Only an Owner can remove another Owner." };
      }
      const updated = list.filter((item: any) => item.id !== targetId);
      await supabaseAdmin.from("site_settings").upsert(
        {
          key: "staff.directory_custom",
          value: updated,
          description: "Custom staff members and avatars directory",
          is_public: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    }
    revalidatePath("/admin/staff");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete staff member" };
  }
}


