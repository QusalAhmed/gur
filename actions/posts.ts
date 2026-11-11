"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";
import { revalidatePath } from "next/cache";

export interface PostItem {
  id: string;
  title: string;
  titleBn: string;
  slug: string;
  category: string;
  author: string;
  views: number;
  status: "published" | "draft" | "archived";
  publishedDate: string;
  tags: string[];
}

export async function getAdminPostsAction(): Promise<{
  success: boolean;
  data: PostItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    const supabaseAdmin = getSupabaseAdmin();
    const { data: rawPosts, error } = await supabaseAdmin
      .from("posts")
      .select("id, title, title_bn, slug, tags, status, published_at, author_name, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const posts: PostItem[] = (rawPosts || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      titleBn: p.title_bn || "",
      slug: p.slug,
      category: "Technical Guide",
      author: p.author_name || "Editorial Team",
      views: 0,
      status: (p.status as PostItem["status"]) || "draft",
      publishedDate: p.published_at ? new Date(p.published_at).toLocaleDateString("en-GB") : "–",
      tags: p.tags || ["Molasses", "Industry"],
    }));

    return { success: true, data: posts };
  } catch (error: any) {
    console.error("getAdminPostsAction error:", error);
    return { success: false, error: error.message || "Failed to load posts", data: [] };
  }
}

export async function updatePostStatusAction(payload: {
  id: string;
  status: "published" | "draft" | "archived";
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    if (!isValidUuid(payload.id)) {
      return { success: false, error: "Invalid post ID" };
    }
    const supabaseAdmin = getSupabaseAdmin();
    const updateData: any = {
      status: payload.status,
      updated_at: new Date().toISOString(),
    };
    if (payload.status === "published") {
      updateData.published_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from("posts")
      .update(updateData)
      .eq("id", payload.id);

    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/posts");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update post status" };
  }
}

export async function deletePostAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor"]);
    if (!isValidUuid(id)) {
      return { success: false, error: "Invalid post ID" };
    }
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from("posts").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/posts");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete post" };
  }
}

