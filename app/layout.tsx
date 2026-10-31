import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { StoreProvider } from "@/components/providers/store-provider";
import { BrandFavicon } from "@/components/brand-favicon";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#451a03",
};

export const metadata: Metadata = {
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
  return (
    <html
      lang="bn"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden selection:bg-amber-200 selection:text-amber-900">
        <StoreProvider>
          <QueryProvider>
            <BrandFavicon />
            {children}
          </QueryProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
