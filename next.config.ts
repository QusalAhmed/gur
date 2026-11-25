import os from "node:os";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { buildCspHeader } from "./lib/security";

// Force config reload for updated CSP allowances (YouTube, Vimeo, Clarity: tag.clarity.ms)

const imagekitHost = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT
  ? (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT).hostname;
      } catch {
        return undefined;
      }
    })()
  : undefined;

const isProd = process.env.NODE_ENV === "production";

/**
 * Collects local loopback and host network interface IPv4 addresses for `allowedDevOrigins`
 * so cross-origin requests from LAN/loopback URLs (e.g. mobile testing) work in `next dev` only.
 */
function getAllowedDevOrigins(): string[] {
  const origins = new Set<string>(["127.0.0.1", "[::1]"]);

  for (const entries of Object.values(os.networkInterfaces())) {
    if (!entries) continue;
    for (const entry of entries) {
      if (
        entry.family === "IPv4" &&
        entry.address &&
        !entry.address.startsWith("169.254.")
      ) {
        origins.add(entry.address);
      }
    }
  }

  return Array.from(origins);
}

function resolveCspHeader(): string {
  return buildCspHeader({
    nodeEnv: process.env.NODE_ENV,
    imagekitUrlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    facebookPixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "1234708877758735",
    metaPixelConnectOrigins: process.env.NEXT_PUBLIC_META_PIXEL_CONNECT_ORIGINS,
  });
}

export default function createNextConfig(phase: string): NextConfig {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    /* config options here */
    poweredByHeader: false,
    cacheComponents: true,
    partialPrefetching: true,
    ...(isDevServer ? { allowedDevOrigins: getAllowedDevOrigins() } : {}),
    turbopack: {
        rules: {
            "*.css": {
                loaders: ["@tailwindcss/turbopack"],
                as: "*.css",
            },
        },
    },
    images: {
        formats: ["image/avif", "image/webp"],
        remotePatterns: [
            {
                protocol: "https",
                hostname: "images.unsplash.com",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "ik.imagekit.io",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "img.youtube.com",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "i.ytimg.com",
                pathname: "/**",
            },
            ...(imagekitHost && imagekitHost !== "ik.imagekit.io"
                ? [
                    {
                        protocol: "https" as const,
                        hostname: imagekitHost,
                        pathname: "/**",
                    },
                ]
                : []),
        ],
    },
    experimental: {
        agentUpgrade: "security",
    },
    async headers() {
      const cspHeader = resolveCspHeader();
      return [
        {
          source: "/(.*)",
          headers: [
            {
              key: "Content-Security-Policy",
              value: cspHeader,
            },
            {
              key: "X-Content-Type-Options",
              value: "nosniff",
            },
            {
              key: "X-Frame-Options",
              value: "SAMEORIGIN",
            },
            {
              key: "Referrer-Policy",
              value: "strict-origin-when-cross-origin",
            },
            {
              key: "Permissions-Policy",
              value: "camera=(), microphone=(), geolocation=()",
            },
            {
              key: "X-DNS-Prefetch-Control",
              value: "off",
            },
            ...(isProd
              ? [
                  {
                    key: "Strict-Transport-Security",
                    value: "max-age=31536000; includeSubDomains",
                  },
                ]
              : []),
          ],
        },
        {
          source: "/sw.js",
          headers: [
            {
              key: "Content-Type",
              value: "application/javascript; charset=utf-8",
            },
            {
              key: "Cache-Control",
              value: "no-cache, no-store, must-revalidate",
            },
            {
              key: "Content-Security-Policy",
              value: "default-src 'self'; script-src 'self'",
            },
            {
              key: "Service-Worker-Allowed",
              value: "/",
            },
          ],
        },
        {
          source: "/admin-manifest.webmanifest",
          headers: [
            {
              key: "Content-Type",
              value: "application/manifest+json; charset=utf-8",
            },
            {
              key: "Cache-Control",
              value: "public, max-age=3600",
            },
          ],
        },
      ];
    },
    async redirects() {
      return [
        {
          source: "/admin/orders/new",
          destination: "/admin/orders?create=true",
          permanent: false,
        },
      ];
    },
  };
}
