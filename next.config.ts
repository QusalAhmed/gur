import type { NextConfig } from "next";

const imagekitHost = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT
  ? (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT).hostname;
      } catch {
        return undefined;
      }
    })()
  : undefined;

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
      } catch {
        return undefined;
      }
    })()
  : undefined;

const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

const imgSources = [
  "'self'",
  "data:",
  "blob:",
  "https://images.unsplash.com",
  "https://ik.imagekit.io",
  "https://www.facebook.com",
  "https://*.supabase.co",
  ...(imagekitHost && imagekitHost !== "ik.imagekit.io" ? [`https://${imagekitHost}`] : []),
  ...(supabaseHost ? [`https://${supabaseHost}`] : []),
];

const connectSources = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://upload.imagekit.io",
  "https://ik.imagekit.io",
  "https://www.facebook.com",
  "https://connect.facebook.net",
  ...(imagekitHost && imagekitHost !== "ik.imagekit.io" ? [`https://${imagekitHost}`] : []),
  ...(supabaseHost ? [`https://${supabaseHost}`, `wss://${supabaseHost}`] : []),
  ...(isDev ? ["ws:", "http://localhost:*", "http://127.0.0.1:*"] : []),
];

const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://connect.facebook.net`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src ${imgSources.join(" ")}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src ${connectSources.join(" ")}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'self' https://www.facebook.com",
  "form-action 'self' https://www.facebook.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

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
