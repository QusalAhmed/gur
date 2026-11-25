import { NextResponse } from "next/server";
import { getCachedPublicLiveStockStats } from "@/lib/storefront-cache";
import { safePublicErrorMessage } from "@/lib/security";

export async function GET() {
  try {
    const data = await getCachedPublicLiveStockStats();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[Storefront Live Stock API] Error:", err);
    return NextResponse.json(
      { error: safePublicErrorMessage("Failed to fetch live stock stats") },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
