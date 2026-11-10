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

const nextConfig: NextConfig = {
    /* config options here */
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
