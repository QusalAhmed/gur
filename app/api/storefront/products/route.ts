import { NextResponse } from "next/server";
import { getStorefrontProductsAction } from "@/actions/storefront-products";

export async function GET() {
  try {
    const data = await getStorefrontProductsAction();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}
