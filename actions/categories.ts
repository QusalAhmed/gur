"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";
import { resolveCdnImageUrl } from "@/lib/imagekit/url";
import type { DbCategory } from "@/lib/supabase/types";
import type { UiCategoryItem } from "@/lib/supabase/api";

export type { UiCategoryItem };

export async function fetchCategoriesAction(): Promise<UiCategoryItem[]> {
  await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
  const client = getSupabaseAdmin();

  const { data: categories, error } = await client
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to fetch categories.");
  }
  if (!categories) {
    return [];
  }

  const { data: products } = await client.from("products").select("category_id");
  const countMap = new Map<string, number>();
  if (products) {
    for (const p of products) {
      if (p.category_id) {
        countMap.set(p.category_id, (countMap.get(p.category_id) || 0) + 1);
      }
    }
  }

  const categoryNameMap = new Map<string, string>();
  categories.forEach((c) => categoryNameMap.set(c.id, c.name));

  return categories.map((c, idx) => {
    const imageUrl = c.image_path ? resolveCdnImageUrl(c.image_path) : null;

    return {
      id: c.id,
      name: c.name,
      nameBn: c.name_bn || "",
      slug: c.slug,
      parentId: c.parent_id,
      parent: c.parent_id ? categoryNameMap.get(c.parent_id) || "Top Level" : "None (Top Level)",
      description: c.description || null,
      descriptionBn: c.description_bn || null,
      imagePath: c.image_path || null,
      imageUrl,
      productsCount: countMap.get(c.id) || 0,
      displayOrder: c.sort_order ?? idx + 1,
      status: c.is_active ? "active" : "draft",
      isActive: c.is_active ?? true,
      seoTitle: c.seo_title || null,
      seoDescription: c.seo_description || null,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  });
}

export async function fetchCategoryByIdAction(id: string): Promise<DbCategory | null> {
  await assertStaffRole(["owner", "admin", "manager", "editor"]);
  if (!isValidUuid(id)) {
    return null;
  }

  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data;
}

export async function fetchCategoriesListAction(): Promise<
  { id: string; name: string; name_bn?: string | null; slug: string }[]
> {
  await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
  const client = getSupabaseAdmin();

  const { data, error } = await client
    .from("categories")
    .select("id, name, name_bn, slug")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to fetch categories list.");
  }
  return data || [];
}

export async function createCategoryAction(payload: {
  name: string;
  nameBn?: string;
  slug: string;
  parent_id?: string | null;
  description?: string | null;
  descriptionBn?: string | null;
  image_path?: string | null;
  sort_order?: number;
  is_active?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
}): Promise<DbCategory> {
  await assertStaffRole(["owner", "admin", "manager", "editor"]);

  if (!payload.name?.trim() || !payload.slug?.trim()) {
    throw new Error("Category name and slug are required.");
  }
  if (payload.parent_id && !isValidUuid(payload.parent_id)) {
    throw new Error("Invalid parent category ID.");
  }

  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("categories")
    .insert([
      {
        name: payload.name.trim(),
        name_bn: payload.nameBn?.trim() || null,
        slug: payload.slug.trim(),
        parent_id: payload.parent_id || null,
        description: payload.description?.trim() || null,
        description_bn: payload.descriptionBn?.trim() || null,
        image_path: payload.image_path || null,
        sort_order: typeof payload.sort_order === "number" ? payload.sort_order : 0,
        is_active: payload.is_active ?? true,
        seo_title: payload.seo_title?.trim() || null,
        seo_description: payload.seo_description?.trim() || null,
      },
    ])
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create category.");
  }

  try {
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");
    revalidatePath("/");
    revalidateTag("storefront-products", "max");
  } catch {
    // Ignore outside request lifecycle
  }

  return data;
}

export async function updateCategoryAction(
  id: string,
  updates: Partial<DbCategory>
): Promise<DbCategory> {
  await assertStaffRole(["owner", "admin", "manager", "editor"]);

  if (!isValidUuid(id)) {
    throw new Error("Invalid category ID.");
  }
  if (updates.parent_id !== undefined && updates.parent_id !== null) {
    if (!isValidUuid(updates.parent_id)) {
      throw new Error("Invalid parent category ID.");
    }
    if (updates.parent_id === id) {
      throw new Error("Category cannot be its own parent.");
    }
  }

  const sanitizedUpdates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) sanitizedUpdates.name = String(updates.name).trim();
  if (updates.name_bn !== undefined) sanitizedUpdates.name_bn = updates.name_bn ? String(updates.name_bn).trim() : null;
  if (updates.slug !== undefined) sanitizedUpdates.slug = String(updates.slug).trim();
  if (updates.parent_id !== undefined) sanitizedUpdates.parent_id = updates.parent_id || null;
  if (updates.description !== undefined) sanitizedUpdates.description = updates.description ? String(updates.description).trim() : null;
  if (updates.description_bn !== undefined) sanitizedUpdates.description_bn = updates.description_bn ? String(updates.description_bn).trim() : null;
  if (updates.image_path !== undefined) sanitizedUpdates.image_path = updates.image_path || null;
  if (updates.sort_order !== undefined) sanitizedUpdates.sort_order = Number(updates.sort_order) || 0;
  if (updates.is_active !== undefined) sanitizedUpdates.is_active = Boolean(updates.is_active);
  if (updates.seo_title !== undefined) sanitizedUpdates.seo_title = updates.seo_title ? String(updates.seo_title).trim() : null;
  if (updates.seo_description !== undefined) sanitizedUpdates.seo_description = updates.seo_description ? String(updates.seo_description).trim() : null;

  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("categories")
    .update(sanitizedUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update category.");
  }

  try {
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");
    revalidatePath("/");
    revalidateTag("storefront-products", "max");
  } catch {
    // Ignore outside request lifecycle
  }

  return data;
}

export async function deleteCategorySafeAction(id: string): Promise<{
  success: boolean;
  archived: boolean;
  message: string;
}> {
  await assertStaffRole(["owner", "admin", "manager", "editor"]);

  if (!isValidUuid(id)) {
    throw new Error("Invalid category ID.");
  }

  const client = getSupabaseAdmin();

  // 1. Check if products map to this category
  const { count: productCount } = await client
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if ((productCount || 0) > 0) {
    await updateCategoryAction(id, { is_active: false });
    return {
      success: true,
      archived: true,
      message: `Category is assigned to ${productCount} products, so it has been deactivated (draft) instead of deleted to preserve product associations.`,
    };
  }

  // 2. Unlink child subcategories if any
  await client
    .from("categories")
    .update({ parent_id: null })
    .eq("parent_id", id);

  // 3. Delete category row
  const { error: delErr } = await client
    .from("categories")
    .delete()
    .eq("id", id);

  if (delErr) {
    throw new Error(delErr.message || "Failed to delete category.");
  }

  try {
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");
    revalidatePath("/");
    revalidateTag("storefront-products", "max");
  } catch {
    // Ignore outside request lifecycle
  }

  return {
    success: true,
    archived: false,
    message: "Category deleted successfully.",
  };
}
