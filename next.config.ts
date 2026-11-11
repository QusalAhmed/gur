import type { NextConfig } from "next";
import { buildCspHeader } from "./lib/security";

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

const cspHeader = buildCspHeader({
  nodeEnv: process.env.NODE_ENV,
  imagekitUrlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  facebookPixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "1234708877758735",
  metaPixelConnectOrigins: process.env.NEXT_PUBLIC_META_PIXEL_CONNECT_ORIGINS,
});

const nextConfig: NextConfig = {
    /* config options here */
    poweredByHeader: false,
    cacheComponents: true,
    partialPrefetching: true,
    turbopack: {
        rules: {
            "*.css": {
                loaders: ["@tailwindcss/turbopack"],
                as: "*.css",
            },
        },
    },
    images: {
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
    experimental: {},
    async headers() {
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

export default nextConfig;
