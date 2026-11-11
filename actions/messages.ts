"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";

export interface MessageItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  channel: string;
  status: "new" | "read" | "replied" | "spam";
  time: string;
}

export async function getAdminMessagesAction(): Promise<{
  success: boolean;
  data: MessageItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabaseAdmin = getSupabaseAdmin();
    const { data: rawMessages, error } = await supabaseAdmin
      .from("contact_messages")
      .select("id, name, phone, email, subject, message, status, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const messages: MessageItem[] = (rawMessages || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      phone: m.phone || "N/A",
      email: m.email || "No email",
      subject: m.subject || "Customer Inquiry",
      message: m.message,
      channel: "Web Contact Form",
      status: (m.status as any) || "new",
      time: m.created_at,
    }));

    return { success: true, data: messages };
  } catch (error: any) {
    console.error("getAdminMessagesAction error:", error);
    return { success: false, error: error.message || "Failed to load messages", data: [] };
  }
}

export async function updateMessageStatusAction(payload: {
  id: string;
  status: "new" | "read" | "replied" | "spam";
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    if (!isValidUuid(payload.id)) {
      return { success: false, error: "Invalid message ID" };
    }
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("contact_messages")
      .update({
        status: payload.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update message status" };
  }
}

export async function deleteMessageAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    if (!isValidUuid(id)) {
      return { success: false, error: "Invalid message ID" };
    }
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from("contact_messages").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete message" };
  }
}

