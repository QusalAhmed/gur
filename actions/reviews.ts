"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertStaffRole } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";

export interface ReviewItem {
  id: string;
  productId: string;
  product: string;
  customer: string;
  rating: number;
  title: string;
  body: string;
  isVerified: boolean;
  status: "approved" | "pending" | "rejected";
  date: string;
}

export interface AdminReviewsData {
  reviews: ReviewItem[];
  kpis: {
    averageRating: number;
    totalReviews: number;
    pendingCount: number;
    verifiedPercentage: number;
    recommendationRate: number;
  };
}

export async function getAdminReviewsAction(): Promise<{
  success: boolean;
  data: AdminReviewsData;
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    const { data: rawReviews, error } = await supabase
      .from("product_reviews")
      .select(
        `
        id,
        product_id,
        reviewer_name,
        rating,
        title,
        body,
        status,
        is_verified_purchase,
        created_at,
        products:product_id (
          name
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const reviews: ReviewItem[] = (rawReviews || []).map((r: any) => {
      const prod = Array.isArray(r.products) ? r.products[0] : r.products;
      const productName = prod?.name || "Pure Molasses";

      return {
        id: r.id,
        productId: r.product_id,
        product: productName,
        customer: r.reviewer_name || "Verified Customer",
        rating: Number(r.rating || 5),
        title: r.title || "Customer Review",
        body: r.body || "",
        isVerified: Boolean(r.is_verified_purchase),
        status: (r.status as any) || "pending",
        date: r.created_at,
      };
    });

    // Calculate metrics
    const totalReviews = reviews.length;
    const pendingCount = reviews.filter((r) => r.status === "pending").length;
    const verifiedCount = reviews.filter((r) => r.isVerified).length;
    const highRatings = reviews.filter((r) => r.rating >= 4).length;

    const avgRating =
      totalReviews > 0
        ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(2))
        : 5.0;

    const verifiedPercentage = totalReviews > 0 ? Math.round((verifiedCount / totalReviews) * 100) : 0;
    const recommendationRate = totalReviews > 0 ? Math.round((highRatings / totalReviews) * 100) : 100;

    return {
      success: true,
      data: {
        reviews,
        kpis: {
          averageRating: avgRating,
          totalReviews,
          pendingCount,
          verifiedPercentage,
          recommendationRate,
        },
      },
    };
  } catch (error: any) {
    const friendly = mapDatabaseError(error);
    return {
      success: false,
      error: friendly.message,
      data: {
        reviews: [],
        kpis: {
          averageRating: 5.0,
          totalReviews: 0,
          pendingCount: 0,
          verifiedPercentage: 0,
          recommendationRate: 100,
        },
      },
    };
  }
}

export async function updateReviewStatusAction(payload: {
  id: string;
  status: "approved" | "pending" | "rejected";
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const supabase = await createClient();

    const { error } = await supabase
      .from("product_reviews")
      .update({
        status: payload.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.id);

    if (error) {
      const friendly = mapDatabaseError(error);
      return { success: false, error: friendly.message };
    }

    revalidatePath("/admin/reviews");
    return { success: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, error: friendly.message };
  }
}

export async function deleteReviewAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    const supabase = await createClient();

    const { error } = await supabase.from("product_reviews").delete().eq("id", id);
    if (error) {
      const friendly = mapDatabaseError(error);
      return { success: false, error: friendly.message };
    }

    revalidatePath("/admin/reviews");
    return { success: true };
  } catch (err: any) {
    const friendly = mapDatabaseError(err);
    return { success: false, error: friendly.message };
  }
}
