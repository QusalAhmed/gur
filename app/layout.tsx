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
import { getSiteUrl } from "@/lib/site-url";

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

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "খেজুরের খাটি গুড় | Pure Cane & Date Palm Molasses",
    template: "%s | খেজুরের খাটি গুড়",
  },
  description:
    "Pure sugarcane and date palm molasses (ঝোলা গুড়, পাটালি গুড়) manufacturing, retail, and B2B wholesale distribution platform in Bangladesh.",
};

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
            <Toaster position="top-right" richColors closeButton />
          </QueryProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
