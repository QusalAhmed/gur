"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";
import { revalidatePath } from "next/cache";

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  questionBn: string;
  answer: string;
  displayOrder: number;
  status: "active" | "draft";
}

export async function getAdminFaqsAction(): Promise<{
  success: boolean;
  data: FaqItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    const supabaseAdmin = getSupabaseAdmin();
    const { data: rawFaqs, error } = await supabaseAdmin
      .from("faqs")
      .select("id, question, question_bn, answer, topic, sort_order, is_active")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const faqs: FaqItem[] = (rawFaqs || []).map((f: any, i: number) => ({
      id: f.id,
      category: f.topic ? f.topic.charAt(0).toUpperCase() + f.topic.slice(1) : "General",
      question: f.question,
      questionBn: f.question_bn || "",
      answer: f.answer,
      displayOrder: f.sort_order || i + 1,
      status: f.is_active ? "active" : "draft",
    }));

    return { success: true, data: faqs };
  } catch (error: any) {
    console.error("getAdminFaqsAction error:", error);
    return { success: false, error: error.message || "Failed to load FAQs", data: [] };
  }
}

export async function createFaqAction(payload: {
  question: string;
  questionBn?: string;
  answer: string;
  category: string;
  displayOrder?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from("faqs").insert({
      question: payload.question,
      question_bn: payload.questionBn || null,
      answer: payload.answer,
      topic: payload.category.toLowerCase(),
      sort_order: payload.displayOrder || 1,
      is_active: true,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/faqs");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create FAQ" };
  }
}

export async function deleteFaqAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    if (!isValidUuid(id)) {
      return { success: false, error: "Invalid FAQ ID" };
    }
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from("faqs").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/faqs");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete FAQ" };
  }
}

