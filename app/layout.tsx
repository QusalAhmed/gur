import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Hind_Siliguri } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { StoreProvider } from "@/components/providers/store-provider";
import { Toaster } from "sonner";
import { BrandFavicon } from "@/components/brand-favicon";
import { FacebookPixelTracker } from "@/components/providers/facebook-pixel-tracker";
import { FB_PIXEL_ID } from "@/lib/facebook-pixel";
import { getCachedSeoSettings } from "@/lib/seo-settings";
import { SeoGlobalScripts } from "@/components/seo-global-scripts";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind-siliguri",
  subsets: ["bengali"],
  weight: ["400", "600"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#451a03",
};

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoSettings();
  const ogImages = seo.ogImageUrl
    ? [{ url: seo.ogImageUrl, width: 1200, height: 630, alt: seo.storeName }]
    : undefined;

  return {
    metadataBase: new URL(seo.siteUrl),
    title: {
      default: seo.defaultTitle,
      template: seo.titleTemplate,
    },
    description: seo.defaultDescription,
    ...(seo.keywords.length > 0 ? { keywords: seo.keywords } : {}),
    robots: {
      index: seo.allowIndexing,
      follow: seo.allowIndexing,
    },
    ...(seo.googleVerification
      ? { verification: { google: seo.googleVerification } }
      : {}),
    openGraph: {
      type: "website",
      locale: "bn_BD",
      siteName: seo.storeName,
      title: seo.defaultTitle,
      description: seo.defaultDescription,
      url: seo.siteUrl,
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: ogImages ? "summary_large_image" : "summary",
      title: seo.defaultTitle,
      description: seo.defaultDescription,
      ...(seo.twitterHandle ? { site: seo.twitterHandle } : {}),
      ...(ogImages ? { images: [seo.ogImageUrl] } : {}),
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const safeFbPixelId = /^\d{5,32}$/.test(String(FB_PIXEL_ID || "").trim())
    ? String(FB_PIXEL_ID).trim()
    : null;

  return (
    <html
      lang="bn"
      className={`${geistSans.variable} ${hindSiliguri.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden selection:bg-amber-200 selection:text-amber-900">
        <Suspense fallback={null}>
          <SeoGlobalScripts />
        </Suspense>
        {safeFbPixelId && (
          <>
            <Script
              id="fb-pixel"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  !function(f,b,e,v,n,t,s)
                  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                  n.queue=[];t=b.createElement(e);t.async=!0;
                  t.src=v;s=b.getElementsByTagName(e)[0];
                  s.parentNode.insertBefore(t,s)}(window, document,'script',
                  'https://connect.facebook.net/en_US/fbevents.js');
                  fbq.disablePushState = true;
                  fbq.allowDuplicatePageViews = true;
                  fbq('init', ${JSON.stringify(safeFbPixelId)});
                  if (window._fbqQueue && window._fbqQueue.length) {
                    while (window._fbqQueue.length) {
                      var qItem = window._fbqQueue.shift();
                      fbq.apply(null, qItem);
                    }
                  }
                `,
              }}
            />
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${encodeURIComponent(safeFbPixelId)}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
        <StoreProvider>
          <QueryProvider>
            <BrandFavicon />
            <FacebookPixelTracker />
            {children}
            <SpeedInsights />
            <Toaster position="top-right" richColors closeButton />
          </QueryProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
