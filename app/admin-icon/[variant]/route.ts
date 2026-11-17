import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { getAdminBrandSettings } from "@/lib/admin-brand";

interface VariantSpec {
  size: number;
  paddedInner?: number;
  opaqueBg: boolean;
  fallbackFile: string;
}

const VARIANTS: Record<string, VariantSpec> = {
  "icon-192.png": {
    size: 192,
    opaqueBg: false,
    fallbackFile: "admin-icon-192.png",
  },
  "icon-512.png": {
    size: 512,
    opaqueBg: false,
    fallbackFile: "admin-icon-512.png",
  },
  "maskable-512.png": {
    size: 512,
    paddedInner: 368,
    opaqueBg: true,
    fallbackFile: "admin-icon-maskable-512.png",
  },
  "apple-touch-icon.png": {
    size: 180,
    paddedInner: 152,
    opaqueBg: true,
    fallbackFile: "apple-touch-icon.png",
  },
};

async function renderPngFromLogo(
  logoUrl: string,
  spec: VariantSpec
): Promise<Buffer | null> {
  try {
    const parsed = new URL(logoUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(logoUrl, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const inputBuffer = Buffer.from(await res.arrayBuffer());
    if (inputBuffer.length === 0) return null;

    if (!spec.opaqueBg) {
      return await sharp(inputBuffer)
        .resize(spec.size, spec.size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toBuffer();
    }

    const meta = await sharp(inputBuffer).metadata();
    let bgColor = { r: 255, g: 255, b: 255, alpha: 1 };
    if (!meta.hasAlpha) {
      const sample = await sharp(inputBuffer).resize(1, 1).raw().toBuffer();
      if (sample.length >= 3) {
        bgColor = { r: sample[0], g: sample[1], b: sample[2], alpha: 1 };
      }
    }

    const innerSize = spec.paddedInner || Math.round(spec.size * 0.8);
    const innerPng = await sharp(inputBuffer)
      .resize(innerSize, innerSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    return await sharp({
      create: {
        width: spec.size,
        height: spec.size,
        channels: 4,
        background: bgColor,
      },
    })
      .composite([{ input: innerPng, gravity: "center" }])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ variant: string }> }
) {
  const { variant } = await context.params;
  const spec = VARIANTS[variant];
  if (!spec) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const brand = await getAdminBrandSettings();
  let pngBuffer: Buffer | null = null;

  if (brand.logoUrl) {
    pngBuffer = await renderPngFromLogo(brand.logoUrl, spec);
  }

  if (!pngBuffer) {
    try {
      const fallbackPath = path.join(
        process.cwd(),
        "public",
        "icons",
        spec.fallbackFile
      );
      pngBuffer = await fs.readFile(fallbackPath);
    } catch {
      return new NextResponse("Icon unavailable", { status: 404 });
    }
  }

  return new NextResponse(new Uint8Array(pngBuffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
