import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { getImageKitServer, isImageKitConfigured } from "@/lib/imagekit/server";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  await connection();
  try {
    // 1. Verify admin session
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

    if (!isImageKitConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ImageKit is not fully configured. Please set NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT in .env",
          files: [],
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const folder = searchParams.get("folder") || "/";
    const searchQuery = searchParams.get("search") || "";
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);

    const ik = getImageKitServer();

    // Prepare path filter: ensure leading slash if specified
    const normalizedPath =
      folder === "all" || folder === "/" || !folder
        ? "/"
        : folder.startsWith("/")
        ? folder
        : `/${folder}`;

    const listOptions: Record<string, unknown> = {
      fileType: "image",
      limit,
      sort: "DESC_CREATED",
    };

    if (normalizedPath !== "/") {
      listOptions.path = normalizedPath;
    }

    if (searchQuery.trim()) {
      listOptions.searchQuery = `name : "${searchQuery.trim().replace(/"/g, "")}"`;
    }

    const files = await ik.listFiles(listOptions as any);

    const formattedAssets = (Array.isArray(files) ? files : []).map((file: any) => ({
      id: file.fileId,
      name: file.name,
      path: file.filePath,
      publicUrl: file.url,
      thumbnailUrl: file.thumbnailUrl || file.url,
      size: file.size,
      width: file.width,
      height: file.height,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      folder: normalizedPath,
      count: formattedAssets.length,
      files: formattedAssets,
    });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("ImageKit file listing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list files from ImageKit",
        files: [],
      },
      { status: 500 }
    );
  }
}

