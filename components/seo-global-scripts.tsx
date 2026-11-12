import Script from "next/script";
import { cacheLife, cacheTag } from "next/cache";
import {
  buildOrganizationJsonLd,
  getCachedSeoSettings,
} from "@/lib/seo-settings";

export async function SeoGlobalScripts() {
  "use cache";
  cacheTag("site-settings", "storefront-products");
  cacheLife({
    stale: 300,
    revalidate: 300,
    expire: 3600,
  });

  const seo = await getCachedSeoSettings();
  const orgJsonLd = buildOrganizationJsonLd(seo);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(orgJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {seo.ga4MeasurementId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
              seo.ga4MeasurementId
            )}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', ${JSON.stringify(seo.ga4MeasurementId)});
              `,
            }}
          />
        </>
      )}
    </>
  );
}
