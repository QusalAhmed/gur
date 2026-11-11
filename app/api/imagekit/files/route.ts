import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { getImageKitServer, isImageKitConfigured } from "@/lib/imagekit/server";
import { getStaffSession } from "@/lib/admin-guard";
import { ROLE_CAPABILITIES } from "@/lib/admin-permissions";
import { clampInt, safePublicErrorMessage, sanitizeImageKitFolder } from "@/lib/security";

export async function GET(req: NextRequest) {
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
        { success: false, error: "Forbidden: Insufficient permissions to browse media" },
        { status: 403 }
      );
    }

    if (!isImageKitConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "Image media storage service is not configured.",
          files: [],
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawFolder = searchParams.get("folder");
    const normalizedPath = sanitizeImageKitFolder(rawFolder);
    if (normalizedPath === null) {
      return NextResponse.json(
        { success: false, error: "Invalid folder path", files: [] },
        { status: 400 }
      );
    }

    const searchQuery = searchParams.get("search") || "";
    const limit = clampInt(searchParams.get("limit"), 100, 1, 200);

    const ik = getImageKitServer();

    const listOptions: Record<string, unknown> = {
      fileType: "image",
      limit,
      sort: "DESC_CREATED",
    };

    if (normalizedPath !== "/") {
      listOptions.path = normalizedPath;
    }

    const cleanSearch = searchQuery.trim().replace(/["\\\x00-\x1f\x7f]/g, "").slice(0, 100);
    if (cleanSearch) {
      listOptions.searchQuery = `name : "${cleanSearch}"`;
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

    return NextResponse.json(
      {
        success: true,
        folder: normalizedPath,
        count: formattedAssets.length,
        files: formattedAssets,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("ImageKit file listing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: safePublicErrorMessage("Failed to list files from ImageKit"),
        files: [],
      },
      { status: 500 }
    );
  }
}

