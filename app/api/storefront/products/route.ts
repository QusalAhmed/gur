import { NextResponse } from "next/server";
import { getStorefrontProductsAction } from "@/actions/storefront-products";
import { safePublicErrorMessage } from "@/lib/security";

export async function GET() {
  try {
    const data = await getStorefrontProductsAction();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (err: any) {
    console.error("[Storefront Products API] Error:", err);
    return NextResponse.json(
      { error: safePublicErrorMessage("Failed to fetch products") },
      { status: 500 }
    );
  }
}
