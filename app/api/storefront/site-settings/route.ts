import { NextResponse } from "next/server";
import { getCachedPublicSiteSettings } from "@/lib/storefront-cache";
import { safePublicErrorMessage } from "@/lib/security";

export async function GET() {
  try {
    const data = await getCachedPublicSiteSettings();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[Storefront Site Settings API] Error:", err);
    return NextResponse.json(
      { error: safePublicErrorMessage("Failed to fetch site settings") },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
