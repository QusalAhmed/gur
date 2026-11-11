"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  Printer,
  ArrowLeft,
  Loader2,
  FileText,
  Check,
  Copy,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Scissors,
  Phone,
  Globe,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Package,
  Layers,
  Truck,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Order } from "@/types/order";
import { getOrdersByIdsAction, markOrdersAsPrintedAction } from "@/actions/orders";
import { assignInvoiceNumberAction } from "@/actions/invoice-ops";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { getSiteUrl } from "@/lib/site-url";

type PaperFormat = "2inch" | "58mm" | "a4";

interface StoreConfig {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  website: string;
  logoUrl?: string;
}

const DEFAULT_SITE_URL = getSiteUrl();

const DEFAULT_STORE: StoreConfig = {
  name: "খেজুরের খাটি গুড়",
  tagline: "Heritage Artisanal Molasses & Natural Sweeteners",
  address: "Bagha, Rajshahi",
  phone: "0184-355389",
  website: DEFAULT_SITE_URL,
};

const PRODUCT_NAME_BN_MAP: Record<string, string> = {
  "patali gur": "পাটালি গুড়",
  "liquid gur": "পাতলা ঝোলা গুড়",
  "grainy liquid gur": "দানাদার ঝোলা গুড়",
  "first cut patali": "প্রথম কাটের পাটালি",
  "nut jaggery": "বাদাম গুড়",
  "coconut jaggery": "নারিকেল গুড়",
  "chocolate gur": "সন্দেশ গুড় / চকলেট গুড়",
  "sandesh gur": "সন্দেশ গুড় / চকলেট গুড়",
  "jhola gur": "ঝোলা গুড়",
  "date palm molasses": "খেজুরের খাঁটি গুড়",
  "date palm liquid": "পাতলা ঝোলা গুড়",
  "date palm patali": "পাটালি গুড়",
  "organic sugarcane": "আখের গুড়",
  "sugarcane": "আখের গুড়",
};

function resolveItemBanglaName(it: any): string {
  if (it.product_name_bn && String(it.product_name_bn).trim()) {
    return String(it.product_name_bn).trim();
  }
  const name = it.product_name || "";
  if (!name || /[\u0980-\u09FF]/.test(name)) {
    return name;
  }
  const lower = name.toLowerCase().trim();
  if (!lower) {
    return name;
  }

  // 1. Exact match first (check own properties to avoid inherited Object prototype properties)
  if (Object.prototype.hasOwnProperty.call(PRODUCT_NAME_BN_MAP, lower)) {
    return PRODUCT_NAME_BN_MAP[lower];
  }

  // 2. Select longest map key contained in normalized name (prefer more-specific over shorter partial matches)
  let bestKey = "";
  for (const en of Object.keys(PRODUCT_NAME_BN_MAP)) {
    if (lower.includes(en) && en.length > bestKey.length) {
      bestKey = en;
    }
  }
  if (bestKey) {
    return PRODUCT_NAME_BN_MAP[bestKey];
  }

  return name;
}

function resolveItemBanglaVariant(it: any): string {
  if (it.variant_name_bn && String(it.variant_name_bn).trim()) {
    return String(it.variant_name_bn).trim();
  }
  const vname = it.variant_name || "";
  if (!vname) return "";
  if (/[\u0980-\u09FF]/.test(vname)) {
    return vname;
  }
  const lower = vname.toLowerCase().trim();

  // Check 0.5 kg / 500g before 1 kg, using numeric boundaries so that:
  // - 0.5 kg matches neither 10.5 kg nor other numeric prefixes
  // - 500g does not match 1500g
  // - 1 kg matches neither 1.5 kg nor 21 kg nor other numeric prefixes
  if (/(?<![\d.])(?:0\.5\s*kg|500\s*g)(?![\d.])/i.test(lower)) {
    return "স্ট্যান্ডার্ড প্যাক (০.৫ কেজি)";
  }
  if (/(?<![\d.])1\s*kg(?![\d.])/i.test(lower)) {
    return "স্ট্যান্ডার্ড প্যাক (১ কেজি)";
  }
  if (/(?<![\d.])1\s*pack(?![\d.])/i.test(lower)) return "১ প্যাক";
  if (/(?<![\d.])2\s*pack(?![\d.])/i.test(lower)) return "২ প্যাক";
  if (/(?<![\d.])3\s*pack(?![\d.])/i.test(lower)) return "৩ প্যাক";
  return vname;
}

function PrintContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { storeName, storeNameBn, address, supportPhone, currencySymbol, logoUrl } = useSiteSettings();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");

  const storeConfig: StoreConfig = React.useMemo(() => ({
    name: storeNameBn || storeName || DEFAULT_STORE.name,
    tagline: DEFAULT_STORE.tagline,
    address: address || DEFAULT_STORE.address,
    phone: supportPhone || DEFAULT_STORE.phone,
    website: siteUrl,
    logoUrl,
  }), [storeName, storeNameBn, address, supportPhone, siteUrl, logoUrl]);

  const idsParam = searchParams.get("ids") || searchParams.get("orderId") || "";
  const isInvoiceType = searchParams.get("type") === "invoice";
  const initialFormat = (searchParams.get("format") as PaperFormat) || (isInvoiceType ? "a4" : "58mm");

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Print controls & preferences
  const [paperFormat, setPaperFormat] = React.useState<PaperFormat>(initialFormat);
  const [zoomLevel, setZoomLevel] = React.useState<number>(100);
  const [showQrCode, setShowQrCode] = React.useState<boolean>(true);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // QR Code Data URL Cache: map of url -> PNG data URL
  const [qrDataUrls, setQrDataUrls] = React.useState<Record<string, string>>({});

  // 1. Fetch Orders
  React.useEffect(() => {
    async function loadOrders() {
      if (!idsParam.trim()) {
        setLoading(false);
        setError("No order IDs provided to print.");
        return;
      }

      const idList = idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (idList.length === 0) {
        setLoading(false);
        setError("No valid order IDs provided.");
        return;
      }

      try {
        setLoading(true);
        const data = await getOrdersByIdsAction(idList);
        setOrders(data);

        // Assign invoice numbers idempotently if printing invoices
        if (data.length > 0) {
          data.forEach(async (ord: any) => {
            if (!ord.invoice_number) {
              const res = await assignInvoiceNumberAction(ord.id);
              if (res.ok && res.invoiceNumber) {
                ord.invoice_number = res.invoiceNumber;
                setOrders((prev) => [...prev]);
              }
            }
          });

          const numbers = data.map((o) => o.id);
          markOrdersAsPrintedAction(numbers).catch((err) => {
            console.warn("Could not record print snapshot:", err);
          });
        }
      } catch (err: any) {
        console.error("Failed to load orders for print:", err);
        setError(err.message || "Failed to load order invoices");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, [idsParam]);

  // 2. Pre-generate Data URL QR Code for fixed store website (avoids HTML/SVG injection)
  React.useEffect(() => {
    async function generateQrs() {
      const cache: Record<string, string> = {};

      try {
        const generalDataUrl = await QRCode.toDataURL(storeConfig.website, {
          margin: 1,
          width: 144,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        cache[storeConfig.website] = generalDataUrl;
      } catch (e) {
        console.error("Failed to generate store QR code:", e);
      }

      setQrDataUrls(cache);
    }

    generateQrs();
  }, [storeConfig.website]);

  const handlePrint = React.useCallback(() => {
    if (orders.length > 0) {
      markOrdersAsPrintedAction(orders.map((o) => o.id)).catch(() => {});
    }
    window.print();
  }, [orders]);

  // Keyboard shortcut Ctrl+P / Cmd+P
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrint]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-800">
        <Loader2 className="h-9 w-9 animate-spin text-amber-600 mb-3" />
        <h2 className="text-sm font-bold tracking-tight">Preparing invoice...</h2>
        <p className="text-xs text-slate-500 mt-1">
          Loading order line items and generating vector QR codes...
        </p>
      </div>
    );
  }

  if (error || orders.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-full border border-rose-200 mb-3">
          <FileText className="h-8 w-8" />
        </div>
        <h2 className="text-base font-bold text-slate-900">No Invoices to Print</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          {error || "Could not find any order records matching the provided IDs."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/admin/orders")}
          className="mt-4 gap-1.5 text-xs bg-white text-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Orders List
        </Button>
      </div>
    );
  }

  // Dimension classes for preview based on format
  const getContainerWidth = () => {
    if (paperFormat === "58mm") return "w-[340px]"; // 58mm roll preview (Default)
    if (paperFormat === "2inch") return "w-[300px]"; // 2 inch (50.8mm) preview
    return "w-[800px]"; // A4 preview
  };

  return (
    <div className="min-h-screen bg-slate-200 text-slate-900 print:bg-white print:text-black">
      {/* ─────────────────────────────────────────────────────────────────────────────
          PRINT STYLESHEET (Configured specifically for 58mm thermal sticker paper rolls)
      ───────────────────────────────────────────────────────────────────────────── */}
      <style jsx global>{`
        @media print {
          @page {
            /* 58mm roll = 58mm width, continuous auto height */
            size: ${paperFormat === "58mm"
                ? "58mm auto"
                : paperFormat === "2inch"
                ? "50.8mm auto"
                : "A4 portrait"};
            margin: 0mm !important;
          }

          *,
          *:before,
          *:after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html,
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: ${paperFormat === "a4" ? "100%" : paperFormat === "58mm" ? "58mm" : "50.8mm"} !important;
            font-family: var(--font-hind-siliguri), "Hind Siliguri", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans Bengali", sans-serif !important;
          }

          /* Hide UI Chrome */
          .print-control-bar,
          .tear-guide-screen {
            display: none !important;
          }

          /* Thermal Sticker Container for Print */
          .thermal-sticker-page {
            width: ${paperFormat === "58mm"
              ? "54mm"
              : paperFormat === "2inch"
              ? "48mm"
              : "100%"} !important;
            max-width: ${paperFormat === "58mm"
              ? "54mm"
              : paperFormat === "2inch"
              ? "48mm"
              : "100%"} !important;
            margin: 0 auto !important;
            padding: 1.5mm 0.8mm 2mm 0.8mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          .thermal-tear-line {
            display: block !important;
            border-bottom: 1.5px dotted #000000 !important;
            margin: 1.5mm 0 1mm 0 !important;
            padding-bottom: 0.8mm !important;
            text-align: center !important;
            font-size: 7.5px !important;
            font-family: monospace !important;
            color: #000000 !important;
          }

          .a4-page-layout {
            page-break-after: always !important;
            break-after: page !important;
            padding: 10mm !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* ─────────────────────────────────────────────────────────────────────────────
          TOP CONTROL BAR (Hidden on Print)
      ───────────────────────────────────────────────────────────────────────────── */}
      <header className="print-control-bar sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-300 shadow-sm px-4 py-2.5">
        <div className="w-full max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Navigation & Info */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/orders")}
              className="gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-300 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Orders
            </Button>
            <div className="h-4 w-px bg-slate-300 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-slate-900">
                  58mm Thermal Sticker Invoice & Packing Slip
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                  58mm Roll
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {orders.length} order{orders.length > 1 ? "s" : ""} selected for direct thermal sticker printing
              </p>
            </div>
          </div>

          {/* Center: Format & Zoom controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Format selector */}
            <div className="flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPaperFormat("58mm")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  paperFormat === "58mm"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="58mm continuous adhesive sticker and POS receipt roll (Default)"
              >
                58mm Roll
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat("2inch")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  paperFormat === "2inch"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="2 inch (50.8mm) continuous adhesive sticker roll"
              >
                2&quot; Roll (50.8mm)
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat("a4")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  paperFormat === "a4"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Standard A4 sheet for traditional packing slip"
              >
                A4 Standard
              </button>
            </div>

            {/* Zoom controls (Only affects on-screen preview) */}
            <div className="hidden md:flex items-center border border-slate-300 rounded-lg bg-white px-1 text-xs">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(75, z - 15))}
                className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                title="Zoom out preview"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1 text-slate-700 min-w-[40px] text-center font-semibold">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(150, z + 15))}
                className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                title="Zoom in preview"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="p-1.5 text-slate-400 hover:text-slate-700 border-l border-slate-200 cursor-pointer"
                title="Reset zoom to 100%"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>

            {/* Toggles */}
            <label className="hidden lg:flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showQrCode}
                onChange={(e) => setShowQrCode(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Web QR</span>
            </label>
          </div>

          {/* Right: Print Action */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-amber-700 hover:bg-amber-800 text-white font-bold gap-1.5 text-xs shadow-md cursor-pointer px-4"
            >
              <Printer className="h-4 w-4" /> Print Stickers ({orders.length})
            </Button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────────────────
          PREVIEW CANVAS / THERMAL ROLL HOLDER
      ───────────────────────────────────────────────────────────────────────────── */}
      <main className="py-8 px-4 flex flex-col items-center justify-start min-h-[calc(100vh-65px)]">
        {/* Physical Paper Size Spec Banner (Screen only) */}
        <div className="print-control-bar mb-6 text-center text-xs text-slate-600 max-w-md bg-white/90 border border-slate-300/80 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-center gap-2 text-slate-800 font-bold mb-1">
            <Package className="h-4 w-4 text-amber-700" />
            <span>Thermal Roll Output: 58mm Thermal Sticker Roll</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Layout is calibrated for 58mm direct thermal sticker & POS receipt printers (Xprinter, Rongta, Munbyn, Dymo, generic POS). High contrast monochrome typography with 100% full-width phone banners.
          </p>
        </div>

        {/* Scaled Preview Wrapper */}
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: "top center",
            transition: "transform 0.15s ease",
          }}
          className={`space-y-8 print:space-y-0 print:transform-none ${getContainerWidth()}`}
        >
          {orders.map((order, orderIdx) => {
            const orderKey = order.order_number || order.id;
            const courierConsignmentId =
              order.courier_consignment_id ||
              order.printed_courier_snapshot?.consignment_id ||
              order.courier_payload_snapshot?.consignment_id;
            const formattedConsignmentId = courierConsignmentId
              ? String(courierConsignmentId)
                  .replace(/^#+/, "")
                  .replace(/\s+/g, "")
                  .match(/.{1,3}/g)
                  ?.join(" ") || String(courierConsignmentId).replace(/^#+/, "")
              : null;
            const qrDataUrl = qrDataUrls[storeConfig.website] || "";

            return (
              <div key={order.id} className="relative">
                {/* ─────────────────────────────────────────────────────────────────
                    2-INCH / 58MM THERMAL STICKER TICKET
                ───────────────────────────────────────────────────────────────── */}
                <article
                  className="thermal-sticker-page bg-white text-black font-sans shadow-lg rounded-sm border border-slate-300 p-1.5 sm:p-2 print:p-0 print:border-none print:shadow-none print:rounded-none select-text"
                  style={{
                    width: paperFormat === "58mm" ? "54mm" : paperFormat === "2inch" ? "48mm" : "100%",
                    minWidth: paperFormat === "a4" ? "auto" : undefined,
                  }}
                >
                  {/* ============================================================= */}
                  {/* 1. BUSINESS NAME AND ADDRESS */}
                  {/* ============================================================= */}
                  <header className={storeConfig.logoUrl ? "flex items-center justify-center gap-2 text-left" : "text-center"}>
                    {storeConfig.logoUrl && (
                      <div className="shrink-0 flex items-center justify-center">
                        <img
                          src={storeConfig.logoUrl}
                          alt={storeConfig.name}
                          className="h-9 sm:h-10 w-auto max-w-[70px] object-contain"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      {/* Brand Crown / Emblem */}
                      <div className="font-black text-[12px] sm:text-[12.5px] tracking-tight uppercase text-black leading-tight">
                        {storeConfig.name}
                      </div>

                      {/* Physical Address */}
                      <p className="text-[8.5px] font-light text-black leading-tight pt-0.5">
                        {storeConfig.address}
                      </p>
                    </div>
                  </header>

                  {/* ============================================================= */}
                  {/* SUPPORT / HELPLINE NUMBER (SPAN FULL WIDTH OF PAGE)           */}
                  {/* ============================================================= */}
                  <section
                    className="w-full bg-black text-white text-center py-0.5 px-1 my-1 rounded-xs select-all"
                    title="Store Support Helpline"
                  >
                    <div className="text-[8px] font-bold tracking-widest uppercase opacity-90 leading-none mb-0.5 flex items-center justify-center gap-1">
                      <Phone className="h-2 w-2 inline" />
                      <span>HELPLINE</span>
                    </div>
                    <div className="font-mono font-black text-[13px] sm:text-[13.5px] tracking-wider leading-none whitespace-nowrap py-0.5">
                      {storeConfig.phone}
                    </div>
                  </section>

                  {/* ============================================================= */}
                  {/* ORDER NUMBER & INVOICE NUMBER                                 */}
                  {/* ============================================================= */}
                  <section className="my-0.5 space-y-0.5 font-mono text-black">
                    <div className="flex items-center justify-between gap-1 leading-tight">
                      <span className="text-[9px] font-black uppercase tracking-wider">
                        ORDER NO:
                      </span>
                      <span className="font-black text-[12.5px] sm:text-[13px] tracking-tight select-all leading-tight">
                        {String(order.order_number || order.id).replace(/^#+/, "")}
                      </span>
                    </div>

                    {formattedConsignmentId && (
                      <div
                        className="text-center font-black text-[16px] sm:text-[17px] tracking-wider select-all py-0.5 border-t border-black/40 leading-none my-0.5"
                        title="Courier Consignment ID"
                      >
                        #{formattedConsignmentId}
                      </div>
                    )}

                    {(order as any).invoice_number && (
                      <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-black/40 leading-tight">
                        <span className="text-[8.5px] font-bold uppercase tracking-wider">
                          INVOICE NO:
                        </span>
                        <span className="font-bold text-[11px] select-all leading-tight">
                          {(order as any).invoice_number}
                        </span>
                      </div>
                    )}

                    {(order as any).payment_method === "credit_terms" && (order as any).payment_due_date && (
                      <div className="flex items-center justify-between gap-1 text-[8.5px] font-bold px-1 py-0.5 bg-black/5 border border-black rounded-xs my-0.5">
                        <span>CREDIT DUE DATE:</span>
                        <span>{String((order as any).payment_due_date)}</span>
                      </div>
                    )}
                  </section>

                  {/* Delivery Note for delivery man */}
                  {order.notes && order.notes.filter((n) => n.type === "delivery").length > 0 && (
                    <div className="p-1 my-1 bg-black/5 border border-black text-[8.5px] rounded-xs">
                      <span className="font-black uppercase text-[8px] flex items-center gap-1 font-mono">
                        <Truck className="h-2.5 w-2.5 shrink-0 inline text-black" />
                        <span>DELIVERY INSTRUCTIONS (FOR DELIVERY MAN):</span>
                      </span>
                      <div className="space-y-0.5 mt-0.5">
                        {order.notes.filter((n) => n.type === "delivery").map((n) => (
                          <p key={n.id} className="text-black font-bold leading-tight">
                            • {n.text}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ============================================================= */}
                  {/* 3. ORDER ITEM NAME AND QUANTITY                                */}
                  {/* ============================================================= */}
                  <section className="mt-0.5 mb-0 pb-0 pt-0.5">
                    <div className="flex items-center justify-between text-[8.5px] font-black uppercase tracking-wider pb-0.5 border-b border-black">
                      <span>ORDER ITEMS</span>
                      <span className="text-right">QTY</span>
                    </div>

                    <div className="divide-y divide-dashed divide-black/40">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((it, idx) => {
                          const banglaName = resolveItemBanglaName(it);
                          const banglaVariant = resolveItemBanglaVariant(it);

                          return (
                            <div key={it.id || idx} className="py-0.5 space-y-0">
                              {/* Product Name & Quantity Badge */}
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-bold text-[10px] sm:text-[10.5px] leading-tight text-black break-words flex-1">
                                  {idx + 1}. {banglaName}
                                </span>
                                <span className="font-mono font-black bg-black text-white px-1 py-0.2 rounded-xs text-[9px] shrink-0 leading-tight">
                                  {it.quantity}
                                </span>
                              </div>

                              {/* Variant / Pack description if present */}
                              {banglaVariant && (
                                <div className="text-[8.5px] text-black/80 font-medium pl-2.5 leading-tight">
                                  প্যাক: {banglaVariant}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-[9.5px] italic text-center py-1 text-black/70">
                          No line items found.
                        </p>
                      )}
                    </div>
                  </section>

                  {/* ============================================================= */}
                  {/* 4. CONTACT INFORMATION (WEB ADDRESS, QR CODE OF WEB ADDRESS)   */}
                  {/* ============================================================= */}
                  <footer className="text-center space-y-0.5 mt-0.5">
                    {/* QR Code */}
                    {showQrCode && qrDataUrl && (
                      <div className="flex flex-col items-center justify-center pt-0">
                        <img
                          src={qrDataUrl}
                          alt="Store QR Code"
                          className="w-[72px] h-[72px] border border-black p-0.5 bg-white inline-block object-contain"
                          title={`Scan to visit ${storeConfig.website}`}
                        />
                        <p className="text-[7.5px] font-bold uppercase tracking-wider text-black pt-0.5 leading-tight flex items-center justify-center gap-1">
                          <Globe className="h-2 w-2 inline" />
                          <span>SCAN TO VISIT OUR STORE</span>
                        </p>
                        <p className="font-mono text-[8px] font-bold text-black tracking-tight leading-tight select-all">
                          {storeConfig.website.replace(/^https?:\/\//, "").replace(/\/+$/, "")}
                        </p>
                      </div>
                    )}
                  </footer>

                  {/* Perforation / Tear Marker for Roll Printers */}
                  <div className="thermal-tear-line text-[8px] font-mono tracking-widest text-center py-0.5 border-b border-dotted border-black select-none flex items-center justify-center gap-1 text-black my-1">
                    <span className="tracking-widest">• • •</span>
                    <Scissors className="h-2 w-2 inline rotate-90" />
                    <span className="font-bold">TEAR HERE</span>
                    <Scissors className="h-2 w-2 inline -rotate-90" />
                    <span className="tracking-widest">• • •</span>
                  </div>

                  {/* ============================================================= */}
                  {/* PACKAGING NOTE (BELOW TEAR HERE AND DOTS)                     */}
                  {/* ============================================================= */}
                  {(() => {
                    const packagingNotes = (order.notes || []).filter(
                      (n) => n.type === "packaging" || n.type === "packaging_note"
                    );
                    if (packagingNotes.length === 0) return null;

                    return (
                      <div className="pt-0.5 pb-0.5 text-[8.5px] text-black">
                        <div className="flex items-center justify-between font-black uppercase text-[8px] font-mono border-b border-black pb-0.5 mb-0.5">
                          <span className="flex items-center gap-1">
                            <Package className="h-2 w-2 shrink-0 inline text-black" />
                            <span>PACKAGING NOTE</span>
                          </span>
                          <span className="text-[7.5px] font-mono">
                            {String(order.order_number || order.id).replace(/^#+/, "")}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {packagingNotes.map((n) => (
                            <p key={n.id} className="text-black font-medium leading-tight flex items-start gap-1">
                              <Square className="h-2 w-2 shrink-0 mt-0.5 text-black" />
                              <span>{n.text}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </article>

                {/* On-screen quick copy / action bar underneath each sticker */}
                <div className="tear-guide-screen flex items-center justify-between px-2 pt-2 text-[11px] text-slate-500">
                  <span className="font-mono text-xs">Sticker #{orderIdx + 1} of {orders.length}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyId(order.order_number || order.id)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-amber-700 cursor-pointer font-medium"
                  >
                    {copiedId === (order.order_number || order.id) ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy #{order.order_number || order.id}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default function PrintOrdersPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-2" />
          <span className="text-xs text-slate-500 ml-2">Loading Invoices...</span>
        </div>
      }
    >
      <PrintContent />
    </React.Suspense>
  );
}
