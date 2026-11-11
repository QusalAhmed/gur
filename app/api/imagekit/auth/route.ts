import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getImageKitServer, isImageKitConfigured } from "@/lib/imagekit/server";
import { getStaffSession } from "@/lib/admin-guard";
import { ROLE_CAPABILITIES } from "@/lib/admin-permissions";
import { safePublicErrorMessage } from "@/lib/security";

export async function GET() {
  await connection();
  try {
    // 1. Verify authenticated staff member and content management capability
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Staff session required" },
        { status: 401 }
      );
    }

    if (!ROLE_CAPABILITIES[session.role]?.canManageContent) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Insufficient permissions to upload media" },
        { status: 403 }
      );
    }

    // 2. Ensure ImageKit credentials are configured
    if (!isImageKitConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "Image media upload service is not configured.",
        },
        { status: 503 }
      );
    }

    // 3. Generate secure upload parameters (token, expire timestamp, HMAC-SHA1 signature)
    const ik = getImageKitServer();
    const authParams = ik.getAuthenticationParameters();

    return NextResponse.json(
      {
        success: true,
        token: authParams.token,
        expire: authParams.expire,
        signature: authParams.signature,
        publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
        urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("ImageKit auth generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: safePublicErrorMessage("Failed to generate ImageKit auth parameters"),
      },
      { status: 500 }
    );
  }
}

