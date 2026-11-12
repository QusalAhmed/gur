"use client";

import * as React from "react";
import {
  Globe,
  Search,
  Share2,
  FileText,
  Building2,
  BarChart3,
  ShieldAlert,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSiteUrl } from "@/lib/site-url";

export interface SeoSettingsFormState {
  storeSubtitle: string;
  seoSiteUrl: string;
  seoDefaultTitle: string;
  seoTitleTemplate: string;
  seoDefaultDescription: string;
  seoKeywords: string;
  seoOgImageUrl: string;
  seoTwitterHandle: string;
  seoHomeTitle: string;
  seoHomeDescription: string;
  seoProductsTitle: string;
  seoProductsDescription: string;
  seoContactTitle: string;
  seoContactDescription: string;
  seoPrivacyTitle: string;
  seoPrivacyDescription: string;
  seoBusinessType: string;
  seoBusinessDescription: string;
  seoFacebookUrl: string;
  seoInstagramUrl: string;
  seoYoutubeUrl: string;
  seoGoogleVerification: string;
  seoGa4MeasurementId: string;
  seoAllowIndexing: boolean;
}

interface SeoSettingsTabProps {
  state: SeoSettingsFormState;
  onChange: <K extends keyof SeoSettingsFormState>(
    key: K,
    value: SeoSettingsFormState[K]
  ) => void;
  storeName: string;
  storeNameBn: string;
}

function LengthBadge({
  length,
  idealMax,
}: {
  length: number;
  idealMax: number;
}) {
  const isOver = length > idealMax;
  return (
    <span
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
        isOver
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {length}/{idealMax} chars
    </span>
  );
}

export function SeoSettingsTab({
  state,
  onChange,
  storeName,
  storeNameBn,
}: SeoSettingsTabProps) {
  const ogImageValue = React.useMemo(
    () => (state.seoOgImageUrl ? [state.seoOgImageUrl] : []),
    [state.seoOgImageUrl]
  );

  const previewOrigin =
    state.seoSiteUrl.trim().replace(/\/+$/, "") || getSiteUrl();
  const previewTitle =
    state.seoHomeTitle.trim() ||
    state.seoDefaultTitle.trim() ||
    `${storeNameBn || storeName}`;
  const previewDesc =
    state.seoHomeDescription.trim() ||
    state.seoDefaultDescription.trim() ||
    state.storeSubtitle.trim();

  return (
    <div className="space-y-6">
      {/* Live Google Search Snippet Preview */}
      <Card className="border-amber-200/80 bg-gradient-to-b from-white to-amber-50/20 dark:from-card dark:to-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4 text-amber-600" />
              Google Search Snippet Preview (Homepage)
            </CardTitle>
            <div className="flex items-center gap-2">
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-amber-700 hover:underline inline-flex items-center gap-1"
              >
                sitemap.xml <ExternalLink className="h-3 w-3" />
              </a>
              <span className="text-muted-foreground text-xs">•</span>
              <a
                href="/robots.txt"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-amber-700 hover:underline inline-flex items-center gap-1"
              >
                robots.txt <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <CardDescription>
            Approximate preview of how your homepage appears in Google search results. Per-product SEO is configured per item in Products → Edit → Specs &amp; SEO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-white dark:bg-stone-950 p-4 space-y-1 shadow-2xs max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                {(storeNameBn || storeName || "G").slice(0, 1)}
              </span>
              <span className="truncate font-medium text-stone-800 dark:text-stone-200">
                {storeNameBn || storeName}
              </span>
              <span className="text-stone-400">›</span>
              <span className="truncate font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                {previewOrigin}
              </span>
            </div>
            <p className="text-base sm:text-lg font-semibold text-[#1a0dab] dark:text-blue-400 leading-snug line-clamp-1">
              {previewTitle}
            </p>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-2">
              {previewDesc}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 1. Global Search Metadata & Store Tagline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-amber-600" />
            Global Search Metadata &amp; Store Tagline
          </CardTitle>
          <CardDescription>
            Controls your site-wide default title, title template, meta description, canonical URL, and storefront tagline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="seo-site-url" className="text-xs font-semibold">
                Canonical Site URL (Domain)
              </label>
              <Input
                id="seo-site-url"
                value={state.seoSiteUrl}
                onChange={(e) => onChange("seoSiteUrl", e.target.value)}
                placeholder={getSiteUrl()}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Used for canonical tags, Open Graph URLs, <code>sitemap.xml</code>, and <code>robots.txt</code>. Leave blank to use <code>NEXT_PUBLIC_SITE_URL</code>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="seo-store-subtitle" className="text-xs font-semibold">
                Store Subtitle / Tagline
              </label>
              <Input
                id="seo-store-subtitle"
                value={state.storeSubtitle}
                onChange={(e) => onChange("storeSubtitle", e.target.value)}
                placeholder="গাছিদের তৈরি তাজা ও নির্ভেজাল ঐতিহ্যবাহী গুড়"
              />
              <p className="text-[11px] text-muted-foreground">
                Shown in the storefront header and used as fallback page description.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="seo-default-title" className="text-xs font-semibold">
                  Default Meta Title
                </label>
                <LengthBadge length={state.seoDefaultTitle.length} idealMax={60} />
              </div>
              <Input
                id="seo-default-title"
                value={state.seoDefaultTitle}
                onChange={(e) => onChange("seoDefaultTitle", e.target.value)}
                placeholder="খেজুরের খাঁটি গুড় | Pure Date Palm Molasses"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="seo-title-template" className="text-xs font-semibold">
                Page Title Template
              </label>
              <Input
                id="seo-title-template"
                value={state.seoTitleTemplate}
                onChange={(e) => onChange("seoTitleTemplate", e.target.value)}
                placeholder="%s | খেজুরের খাঁটি গুড়"
              />
              <p className="text-[11px] text-muted-foreground">
                Use <code>%s</code> where each page or product title should appear.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="seo-default-description" className="text-xs font-semibold">
                Default Meta Description
              </label>
              <LengthBadge
                length={state.seoDefaultDescription.length}
                idealMax={160}
              />
            </div>
            <Textarea
              id="seo-default-description"
              value={state.seoDefaultDescription}
              onChange={(e) => onChange("seoDefaultDescription", e.target.value)}
              rows={2}
              placeholder="Pure sugarcane and date palm molasses (ঝোলা গুড়, পাটালি গুড়)..."
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="seo-keywords" className="text-xs font-semibold">
              Meta Keywords (comma-separated)
            </label>
            <Input
              id="seo-keywords"
              value={state.seoKeywords}
              onChange={(e) => onChange("seoKeywords", e.target.value)}
              placeholder="খেজুরের গুড়, পাটালি গুড়, ঝোলা গুড়, নলেন গুড়, pure date palm jaggery, Rajshahi gur"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Social Sharing (Open Graph & Twitter) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4 text-amber-600" />
            Social Sharing (Open Graph &amp; Twitter / X)
          </CardTitle>
          <CardDescription>
            Default image and handle shown when links are shared on Facebook, WhatsApp, Messenger, or X
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2 items-start">
            <div className="space-y-2">
              <span className="text-xs font-semibold block">
                Default Open Graph Share Image (1200×630 recommended)
              </span>
              <ImageUploader
                value={ogImageValue}
                onChange={(items) => {
                  if (items.length === 0) {
                    onChange("seoOgImageUrl", "");
                    return;
                  }
                  const first = items[0];
                  if (!first) return;
                  if (
                    first.status === "uploading" ||
                    first.status === "compressing" ||
                    first.status === "hashing" ||
                    first.status === "error"
                  ) {
                    return;
                  }
                  const candidate = (first.url || first.path || "").trim();
                  if (!candidate || candidate.startsWith("blob:")) {
                    return;
                  }
                  onChange("seoOgImageUrl", candidate);
                }}
                onRemove={() => onChange("seoOgImageUrl", "")}
                multiple={false}
                folder="branding/seo"
                label="Upload Default OG Image"
                description="Recommended 1200×630 JPG/PNG/WebP for Facebook & WhatsApp link previews"
                aspectRatio="auto"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="seo-twitter-handle" className="text-xs font-semibold">
                Twitter / X Handle (Optional)
              </label>
              <Input
                id="seo-twitter-handle"
                value={state.seoTwitterHandle}
                onChange={(e) => onChange("seoTwitterHandle", e.target.value)}
                placeholder="@yourbrand"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Included in <code>twitter:site</code> meta tags across storefront pages.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Per-Page Metadata Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" />
            Per-Page SEO Overrides
          </CardTitle>
          <CardDescription>
            Customize search titles and meta descriptions for each core storefront route
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Homepage */}
          <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Homepage</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                /
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="seo-home-title" className="text-[11px] font-medium">
                    Custom Title (leave blank to use Default Meta Title)
                  </label>
                  <LengthBadge length={state.seoHomeTitle.length} idealMax={60} />
                </div>
                <Input
                  id="seo-home-title"
                  value={state.seoHomeTitle}
                  onChange={(e) => onChange("seoHomeTitle", e.target.value)}
                  placeholder="Optional custom homepage title"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="seo-home-description" className="text-[11px] font-medium">
                    Custom Description
                  </label>
                  <LengthBadge length={state.seoHomeDescription.length} idealMax={160} />
                </div>
                <Input
                  id="seo-home-description"
                  value={state.seoHomeDescription}
                  onChange={(e) => onChange("seoHomeDescription", e.target.value)}
                  placeholder="Optional custom homepage description"
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Products Catalog */}
          <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Products Catalog Page</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                /products
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="seo-products-title" className="text-[11px] font-medium">
                    Catalog Title
                  </label>
                  <LengthBadge length={state.seoProductsTitle.length} idealMax={60} />
                </div>
                <Input
                  id="seo-products-title"
                  value={state.seoProductsTitle}
                  onChange={(e) => onChange("seoProductsTitle", e.target.value)}
                  placeholder="সকল খাঁটি গুড়ের পণ্যসমূহ"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="seo-products-description" className="text-[11px] font-medium">
                    Catalog Description
                  </label>
                  <LengthBadge length={state.seoProductsDescription.length} idealMax={160} />
                </div>
                <Input
                  id="seo-products-description"
                  value={state.seoProductsDescription}
                  onChange={(e) => onChange("seoProductsDescription", e.target.value)}
                  placeholder="আসল ঝোলা গুড়, দানাদার পাটালি ও নলেন গুড়ের সংগ্রহ..."
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Contact Page */}
          <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Contact &amp; Direct Order Page</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                /contact
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="seo-contact-title" className="text-[11px] font-medium">
                    Contact Title
                  </label>
                  <LengthBadge length={state.seoContactTitle.length} idealMax={60} />
                </div>
                <Input
                  id="seo-contact-title"
                  value={state.seoContactTitle}
                  onChange={(e) => onChange("seoContactTitle", e.target.value)}
                  placeholder="যোগাযোগ ও সরাসরি অর্ডার"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="seo-contact-description" className="text-[11px] font-medium">
                    Contact Description
                  </label>
                  <LengthBadge length={state.seoContactDescription.length} idealMax={160} />
                </div>
                <Input
                  id="seo-contact-description"
                  value={state.seoContactDescription}
                  onChange={(e) => onChange("seoContactDescription", e.target.value)}
                  placeholder="সরাসরি ফোন, হোয়াটসঅ্যাপ বা মেসেঞ্জারে যোগাযোগ করুন..."
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Privacy Policy Page */}
          <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Privacy Policy Page</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                /privacy-policy
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="seo-privacy-title" className="text-[11px] font-medium">
                    Privacy Title
                  </label>
                  <LengthBadge length={state.seoPrivacyTitle.length} idealMax={60} />
                </div>
                <Input
                  id="seo-privacy-title"
                  value={state.seoPrivacyTitle}
                  onChange={(e) => onChange("seoPrivacyTitle", e.target.value)}
                  placeholder="গোপনীয়তা নীতি (Privacy Policy)"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="seo-privacy-description" className="text-[11px] font-medium">
                    Privacy Description
                  </label>
                  <LengthBadge length={state.seoPrivacyDescription.length} idealMax={160} />
                </div>
                <Input
                  id="seo-privacy-description"
                  value={state.seoPrivacyDescription}
                  onChange={(e) => onChange("seoPrivacyDescription", e.target.value)}
                  placeholder="আমাদের প্ল্যাটফর্মে গ্রাহকদের ব্যক্তিগত তথ্যের সুরক্ষা..."
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Business Structured Data (JSON-LD) & Social Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-600" />
            Business Schema (JSON-LD) &amp; Social Profiles
          </CardTitle>
          <CardDescription>
            Automatically generates Schema.org structured data using your Store Profile name, phone, email, address, logo, and the social links below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="seo-business-type" className="text-xs font-semibold">
                Schema.org Business Type
              </label>
              <Select
                value={state.seoBusinessType}
                onValueChange={(val) => onChange("seoBusinessType", val || "Store")}
              >
                <SelectTrigger id="seo-business-type" className="w-full">
                  <SelectValue placeholder="Select schema type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Store">Store (E-commerce / Retail Shop)</SelectItem>
                  <SelectItem value="FoodEstablishment">FoodEstablishment (Artisanal Food)</SelectItem>
                  <SelectItem value="LocalBusiness">LocalBusiness</SelectItem>
                  <SelectItem value="Organization">Organization</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="seo-facebook-url" className="text-xs font-semibold">
                Facebook Page URL
              </label>
              <Input
                id="seo-facebook-url"
                value={state.seoFacebookUrl}
                onChange={(e) => onChange("seoFacebookUrl", e.target.value)}
                placeholder="https://facebook.com/yourpage"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="seo-instagram-url" className="text-xs font-semibold">
                Instagram Profile URL
              </label>
              <Input
                id="seo-instagram-url"
                value={state.seoInstagramUrl}
                onChange={(e) => onChange("seoInstagramUrl", e.target.value)}
                placeholder="https://instagram.com/yourhandle"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="seo-youtube-url" className="text-xs font-semibold">
                YouTube Channel URL
              </label>
              <Input
                id="seo-youtube-url"
                value={state.seoYoutubeUrl}
                onChange={(e) => onChange("seoYoutubeUrl", e.target.value)}
                placeholder="https://youtube.com/@yourchannel"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="seo-business-description" className="text-xs font-semibold">
              Business Schema Description (Optional)
            </label>
            <Textarea
              id="seo-business-description"
              value={state.seoBusinessDescription}
              onChange={(e) => onChange("seoBusinessDescription", e.target.value)}
              rows={2}
              placeholder="Describes your store in Google's Knowledge Graph / Organization schema (defaults to Default Meta Description)."
            />
          </div>
        </CardContent>
      </Card>

      {/* 5. Verification, GA4 Analytics & Search Indexing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-600" />
            Search Console, GA4 Analytics &amp; Indexing
          </CardTitle>
          <CardDescription>
            Verify site ownership in Google Search Console, connect Google Analytics 4, and control search engine crawling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="seo-google-verification" className="text-xs font-semibold">
                Google Search Console Verification Code
              </label>
              <Input
                id="seo-google-verification"
                value={state.seoGoogleVerification}
                onChange={(e) => onChange("seoGoogleVerification", e.target.value)}
                placeholder="e.g. abc123XYZ... (meta content token)"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Outputs <code>&lt;meta name=&quot;google-site-verification&quot; ... /&gt;</code> in your site <code>&lt;head&gt;</code>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="seo-ga4-measurement-id" className="text-xs font-semibold">
                Google Analytics 4 (GA4) Measurement ID
              </label>
              <Input
                id="seo-ga4-measurement-id"
                value={state.seoGa4MeasurementId}
                onChange={(e) => onChange("seoGa4MeasurementId", e.target.value)}
                placeholder="e.g. G-XXXXXXXXXX"
                className="font-mono text-xs uppercase"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave empty to disable GA4 script injection. Only valid <code>G-...</code> or <code>GT-...</code> IDs are injected.
              </p>
            </div>
          </div>

          <div
            className={`flex items-start gap-3 p-3.5 rounded-lg border transition-colors ${
              state.seoAllowIndexing
                ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900"
                : "bg-rose-50/70 border-rose-300 dark:bg-rose-950/30 dark:border-rose-900"
            }`}
          >
            <Checkbox
              id="seo-allow-indexing"
              checked={state.seoAllowIndexing}
              onCheckedChange={(checked) =>
                onChange("seoAllowIndexing", Boolean(checked))
              }
              className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
            />
            <div className="space-y-1">
              <label
                htmlFor="seo-allow-indexing"
                className="text-sm font-semibold cursor-pointer select-none flex items-center gap-2"
              >
                <span>Allow Search Engines to Index This Website</span>
                {state.seoAllowIndexing ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-100/70"
                  >
                    <Sparkles className="h-2.5 w-2.5 mr-1" />
                    index, follow
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-rose-300 text-rose-700 bg-rose-100/70"
                  >
                    <ShieldAlert className="h-2.5 w-2.5 mr-1" />
                    noindex (Blocked)
                  </Badge>
                )}
              </label>
              <p className="text-xs text-muted-foreground">
                Keep enabled for live production stores. Turning this off emits <code>noindex, nofollow</code> meta tags while keeping public pages crawlable so search engines can process the <code>noindex</code> directive.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
