import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { getImageKitServer, isImageKitConfigured } from "@/lib/imagekit/server";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  await connection();
  try {
    // 1. Verify admin authentication
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin session required" },
        { status: 401 }
      );
    }

    const adminUser = await verifySessionToken(token);
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid admin session" },
        { status: 401 }
      );
    }

    // 2. Ensure ImageKit credentials are valid
    if (!isImageKitConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ImageKit is not fully configured. Please set NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT in .env",
        },
        { status: 503 }
      );
    }

    // 3. Generate secure upload parameters (token, expire timestamp, HMAC-SHA1 signature)
    const ik = getImageKitServer();
    const authParams = ik.getAuthenticationParameters();

    return NextResponse.json({
      success: true,
      token: authParams.token,
      expire: authParams.expire,
      signature: authParams.signature,
      publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
    });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("ImageKit auth generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate ImageKit auth parameters",
      },
      { status: 500 }
    );
  }
}

