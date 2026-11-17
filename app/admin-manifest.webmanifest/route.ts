import { NextRequest, NextResponse } from "next/server";
import { getAdminBrandSettings } from "@/lib/admin-brand";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() || "";
  const hostname = host.split(":")[0];
  const isAdminSubdomain =
    hostname === "admin.khatikhejurgur.shop" || hostname.startsWith("admin.");

  const brand = await getAdminBrandSettings();
  const startUrl = isAdminSubdomain ? "/" : "/admin";
  const scope = isAdminSubdomain ? "/" : "/admin";

  const manifest = {
    id: isAdminSubdomain ? "gur-admin-pwa" : "gur-admin-pwa-local",
    name: brand.appName,
    short_name: brand.shortName,
    description: `${brand.appName} admin operations panel for orders, shipments, inventory, and messages.`,
    start_url: startUrl,
    scope,
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#1c0b02",
    theme_color: "#451a03",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/admin-icon/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/admin-icon/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/admin-icon/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Orders",
        short_name: "Orders",
        url: isAdminSubdomain ? "/orders" : "/admin/orders",
        icons: [{ src: "/admin-icon/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Messages",
        short_name: "Messages",
        url: isAdminSubdomain ? "/messages" : "/admin/messages",
        icons: [{ src: "/admin-icon/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Inventory",
        short_name: "Inventory",
        url: isAdminSubdomain ? "/inventory" : "/admin/inventory",
        icons: [{ src: "/admin-icon/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
