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
  Flame,
  PauseCircle,
  CalendarClock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Order } from "@/types/order";
import {
  getOrdersByIdsAction,
  getPrintQueueOrdersAction,
  markOrdersAsPrintedAction,
} from "@/actions/orders";
import { assignInvoiceNumberAction } from "@/actions/invoice-ops";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { getSiteUrl } from "@/lib/site-url";
import { isOrderReprintRequired } from "@/lib/order-reprint";
import {
  SendingDateFilterMode,
  formatSendingDateDisplay,
  getDhakaTodayIsoDate,
  getOrderDispatchHoldState,
  matchesPrintSendingDateFilter,
  normalizeSendingDate,
  sortOrdersForPrint,
  toDhakaDateKey,
} from "@/lib/order-dispatch";

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
  name: "Gramayon",
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

const BN_TO_EN_DIGITS: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

function normalizeBengaliDigits(text = ""): string {
  return text.replace(/[০-৯]/g, (d) => BN_TO_EN_DIGITS[d] ?? d);
}

function parseWeightFromText(rawText = ""): number | null {
  if (!rawText || typeof rawText !== "string") return null;
  const text = normalizeBengaliDigits(rawText.toLowerCase());

  // 1. Matches like 0.5 kg, 1kg, 2.5 kg, 1 কেজি, 2 কিলো
  const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|k\.g|kgs|কেজি|কিলো)/i);
  if (kgMatch) return parseFloat(kgMatch[1]);

  // 2. Matches like 500g, 250 gm, 200 g, 500 গ্রাম, 200গ্রা
  const gMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:gm|gms|gram|grams|g|গ্রাম|গ্রা)(?![a-z])/i);
  if (gMatch) return parseFloat(gMatch[1]) / 1000;

  // 3. Matches like 1L, 1.5 ltr, 1 liter, 1 লিটার
  const lMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:liter|liters|ltr|l|লিটার)/i);
  if (lMatch) return parseFloat(lMatch[1]);

  // 4. Matches like 500ml, 250 ml, 250 মিলি
  const mlMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:ml|মিলি)/i);
  if (mlMatch) return parseFloat(mlMatch[1]) / 1000;

  return null;
}

export function resolveOrderTotalWeightKg(order: Order): number | null {
  if (typeof order.total_weight_kg === "number" && order.total_weight_kg > 0) {
    return order.total_weight_kg;
  }

  // Fallback calculation across items
  if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
    return null;
  }

  let totalKg = 0;
  for (const item of order.items) {
    const qty = Number(item.quantity) || 1;
    // Check if combo with components
    if (Array.isArray(item.combo_components) && item.combo_components.length > 0) {
      for (const comp of item.combo_components) {
        const compQty = (Number(comp.quantity) || 1) * qty;
        if (comp.weight_grams && comp.weight_grams > 0) {
          totalKg += (comp.weight_grams / 1000) * compQty;
        } else {
          const parsed = parseWeightFromText(comp.variant_name || "") ?? parseWeightFromText(comp.product_name || "");
          if (parsed && parsed > 0) {
            totalKg += parsed * compQty;
          }
        }
      }
    } else {
      if (item.weight_grams && item.weight_grams > 0) {
        totalKg += (item.weight_grams / 1000) * qty;
      } else if (item.weight_kg && item.weight_kg > 0) {
        totalKg += item.weight_kg * qty;
      } else {
        const parsed = parseWeightFromText(item.variant_name || "") ?? parseWeightFromText(item.product_name || "");
        if (parsed && parsed > 0) {
          totalKg += parsed * qty;
        }
      }
    }
  }

  return totalKg > 0 ? Math.round(totalKg * 1000) / 1000 : null;
}

export function formatWeightDisplay(kg: number): string {
  // Clean dynamic decimal without trailing zeros (e.g. 1 kg, 1.5 kg, 2.25 kg)
  const formatted = Number.isInteger(kg) ? kg.toString() : kg.toFixed(2).replace(/\.?0+$/, "");
  return `WEIGHT: ${formatted} kg`;
}

function PrintContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { storeName, address, supportPhone, currencySymbol, logoUrl } = useSiteSettings();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");

  const storeConfig: StoreConfig = React.useMemo(() => ({
    name: storeName || DEFAULT_STORE.name,
    tagline: DEFAULT_STORE.tagline,
    address: address || DEFAULT_STORE.address,
    phone: supportPhone || DEFAULT_STORE.phone,
    website: siteUrl,
    logoUrl: logoUrl || "/admin-icon/icon-192.png",
  }), [storeName, address, supportPhone, siteUrl, logoUrl]);

  const idsParam = searchParams.get("ids") || searchParams.get("orderId") || "";
  const isQueueMode = !idsParam.trim();
  const isInvoiceType = searchParams.get("type") === "invoice";
  const initialFormat = (searchParams.get("format") as PaperFormat) || (isInvoiceType ? "a4" : "58mm");
  const defaultToday = React.useMemo(() => getDhakaTodayIsoDate(), []);

  const initialSendingDate = normalizeSendingDate(searchParams.get("sendingDate")) || defaultToday;
  const rawModeParam = searchParams.get("mode");
  const initialMode: SendingDateFilterMode =
    rawModeParam === "exact_date" || rawModeParam === "all" || rawModeParam === "due_on_or_before"
      ? rawModeParam
      : "due_on_or_before";
  const rawStatusParam = searchParams.get("status");
  const initialStatusFilter: "all_active" | "pending" | "confirmed" | "processing" =
    rawStatusParam === "pending" || rawStatusParam === "confirmed" || rawStatusParam === "processing"
      ? rawStatusParam
      : "all_active";
  const rawPriorityParam = searchParams.get("priority");
  const initialPriorityFilter: "all" | "urgent" | "normal" =
    rawPriorityParam === "urgent" || rawPriorityParam === "normal" ? rawPriorityParam : "all";
  const rawPrintStateParam = searchParams.get("printState");
  const initialPrintStateFilter: "all" | "unprinted" | "printed" =
    rawPrintStateParam === "unprinted" || rawPrintStateParam === "printed"
      ? rawPrintStateParam
      : "all";

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Print queue filters (Sending Date defaults to Today Asia/Dhaka, Urgent first -> Oldest first)
  const [sendingDate, setSendingDate] = React.useState<string>(initialSendingDate);
  const [dateFilterMode, setDateFilterMode] = React.useState<SendingDateFilterMode>(initialMode);
  const [statusFilter, setStatusFilter] = React.useState<"all_active" | "pending" | "confirmed" | "processing">(
    initialStatusFilter
  );
  const [priorityFilter, setPriorityFilter] = React.useState<"all" | "urgent" | "normal">(
    initialPriorityFilter
  );
  const [printStateFilter, setPrintStateFilter] = React.useState<"all" | "unprinted" | "printed">(
    initialPrintStateFilter
  );
  const [includeHeld, setIncludeHeld] = React.useState<boolean>(false);

  // Print controls & preferences
  const [paperFormat, setPaperFormat] = React.useState<PaperFormat>(initialFormat);
  const [zoomLevel, setZoomLevel] = React.useState<number>(100);
  const [showQrCode, setShowQrCode] = React.useState<boolean>(true);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [sessionPrintedCount, setSessionPrintedCount] = React.useState<number | null>(null);

  // QR Code Data URL Cache: map of url -> PNG data URL
  const [qrDataUrls, setQrDataUrls] = React.useState<Record<string, string>>({});
  const requestedInvoiceIdsRef = React.useRef<Set<string>>(new Set());

  // 1. Fetch Orders (Selected ?ids= mode OR full active Print Queue mode)
  const loadOrders = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let data: Order[];
      if (idsParam.trim()) {
        const idList = idsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (idList.length === 0) {
          setOrders([]);
          setError("No valid order IDs provided.");
          return;
        }
        data = await getOrdersByIdsAction(idList);
      } else {
        data = await getPrintQueueOrdersAction();
      }

      setOrders(data);
    } catch (err: any) {
      console.error("Failed to load orders for print:", err);
      setError(err.message || "Failed to load orders for printing");
    } finally {
      setLoading(false);
    }
  }, [idsParam]);

  React.useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Compute filtered & sorted orders:
  // 1) Status / Priority / Print-State filters
  // 2) Sending Date & Hold filter
  // 3) Urgent parcels first (oldest first), then Normal parcels (oldest first)
  const { printableOrders, heldHiddenCount, urgentCount, normalCount } = React.useMemo(() => {
    const baseFiltered = orders.filter((order) => {
      if (isQueueMode) {
        if (
          order.status !== "pending" &&
          order.status !== "confirmed" &&
          order.status !== "processing"
        ) {
          return false;
        }
        if (statusFilter !== "all_active" && order.status !== statusFilter) {
          return false;
        }
      }

      if (priorityFilter === "urgent" && !order.is_urgent) return false;
      if (priorityFilter === "normal" && order.is_urgent) return false;

      if (printStateFilter === "unprinted") {
        if (order.printed_at && !isOrderReprintRequired(order)) return false;
      } else if (printStateFilter === "printed") {
        if (!order.printed_at || isOrderReprintRequired(order)) return false;
      }

      return true;
    });

    const dateFiltered: Order[] = [];
    let hiddenHeld = 0;

    for (const order of baseFiltered) {
      const passes = matchesPrintSendingDateFilter(order, {
        targetDate: sendingDate,
        mode: dateFilterMode,
        includeHeld,
      });

      if (passes) {
        dateFiltered.push(order);
      } else if (!includeHeld && getOrderDispatchHoldState(order, sendingDate).held) {
        hiddenHeld += 1;
      }
    }

    const sorted = sortOrdersForPrint(dateFiltered);
    const urgentTotal = sorted.filter((o) => Boolean(o.is_urgent)).length;

    return {
      printableOrders: sorted,
      heldHiddenCount: hiddenHeld,
      urgentCount: urgentTotal,
      normalCount: sorted.length - urgentTotal,
    };
  }, [
    orders,
    isQueueMode,
    statusFilter,
    priorityFilter,
    printStateFilter,
    sendingDate,
    dateFilterMode,
    includeHeld,
  ]);

  // Assign missing invoice numbers idempotently for visible printable orders
  React.useEffect(() => {
    const missing = printableOrders.filter(
      (ord) => !(ord as any).invoice_number && !requestedInvoiceIdsRef.current.has(ord.id)
    );
    if (missing.length === 0) return;

    for (const ord of missing) {
      requestedInvoiceIdsRef.current.add(ord.id);
    }

    let cancelled = false;
    Promise.all(
      missing.map(async (ord) => {
        try {
          const res = await assignInvoiceNumberAction(ord.id);
          return res.ok && res.invoiceNumber ? { id: ord.id, invoiceNumber: res.invoiceNumber } : null;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const updates = new Map<string, string>();
      for (const r of results) {
        if (r) updates.set(r.id, r.invoiceNumber);
      }
      if (updates.size > 0) {
        setOrders((prev) =>
          prev.map((o) =>
            updates.has(o.id) ? ({ ...o, invoice_number: updates.get(o.id) } as Order) : o
          )
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [printableOrders]);

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

  // Record printed snapshot ONLY when actually printing visible filtered orders
  const handlePrint = React.useCallback(() => {
    if (printableOrders.length === 0) return;
    const idsToMark = printableOrders.map((o) => o.id);
    markOrdersAsPrintedAction(idsToMark)
      .then((res) => {
        if (res.success) {
          setSessionPrintedCount(idsToMark.length);
        }
      })
      .catch((err) => {
        console.warn("Could not record print snapshot:", err);
      });
    window.print();
  }, [printableOrders]);

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

  const resetQueueFilters = () => {
    setSendingDate(defaultToday);
    setDateFilterMode("due_on_or_before");
    setStatusFilter("all_active");
    setPriorityFilter("all");
    setPrintStateFilter("all");
    setIncludeHeld(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-800">
        <Loader2 className="h-9 w-9 animate-spin text-amber-600 mb-3" />
        <h2 className="text-sm font-bold tracking-tight">
          {isQueueMode ? "Loading print queue..." : "Preparing invoice..."}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Sorting urgent parcels first, oldest first, and generating QR codes...
        </p>
      </div>
    );
  }

  if (error || (!isQueueMode && orders.length === 0)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-full border border-rose-200 mb-3">
          <FileText className="h-8 w-8" />
        </div>
        <h2 className="text-base font-bold text-slate-900">No Invoices to Print</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          {error || "Could not find any order records matching the provided IDs."}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/admin/orders")}
            className="gap-1.5 text-xs bg-white text-slate-800 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Return to Orders List
          </Button>
          {!isQueueMode && (
            <Button
              size="sm"
              onClick={() => router.push("/admin/orders/print")}
              className="gap-1.5 text-xs bg-amber-700 hover:bg-amber-800 text-white cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" /> Open Print Queue
            </Button>
          )}
        </div>
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
            font-family: var(--font-roboto), Roboto, var(--font-anek-bangla), "Anek Bangla", "Noto Sans Bengali", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif !important;
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
        <div className="w-full max-w-7xl mx-auto space-y-2.5">
          {/* Primary Row: Navigation, Format & Print */}
          <div className="flex flex-wrap items-center justify-between gap-3">
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs sm:text-sm text-slate-900">
                    {isQueueMode
                      ? "Thermal Print Queue"
                      : "Selected Stickers Preview"}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                    Urgent First · Oldest First
                  </span>
                  {urgentCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold">
                      <Flame className="h-2.5 w-2.5" /> {urgentCount} Urgent
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-300">
                    {normalCount} Normal
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Showing {printableOrders.length} of {orders.length} loaded order{orders.length !== 1 ? "s" : ""}
                  {sessionPrintedCount !== null && ` · Recorded ${sessionPrintedCount} printed`}
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

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadOrders}
                className="h-8 px-2.5 text-xs border-slate-300 text-slate-700 cursor-pointer"
                title="Refresh queue from database"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Right: Print Action */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrint}
                disabled={printableOrders.length === 0}
                size="sm"
                className="bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold gap-1.5 text-xs shadow-md cursor-pointer px-4"
              >
                <Printer className="h-4 w-4" /> Print Stickers ({printableOrders.length})
              </Button>
            </div>
          </div>

          {/* Secondary Row: Sending Date Filter, Status, Priority & Print State */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 text-xs">
            {/* Sending Date Picker */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded-lg px-2 py-1">
              <CalendarClock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                Sending Date:
              </span>
              <input
                type="date"
                value={sendingDate}
                disabled={dateFilterMode === "all"}
                onChange={(e) => {
                  const v = normalizeSendingDate(e.target.value);
                  if (v) setSendingDate(v);
                }}
                className="text-xs font-mono bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-900 disabled:opacity-50"
              />
              {sendingDate !== defaultToday && (
                <button
                  type="button"
                  onClick={() => setSendingDate(defaultToday)}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 hover:bg-amber-200 cursor-pointer"
                >
                  Today
                </button>
              )}
            </div>

            {/* Date Match Mode */}
            <div className="flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5 text-[11px]">
              {(
                [
                  { id: "due_on_or_before", label: "Due <= Date" },
                  { id: "exact_date", label: "Exact Date" },
                  { id: "all", label: "All Dates" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDateFilterMode(m.id)}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    dateFilterMode === m.id
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Active Status Pills (Queue Mode) */}
            {isQueueMode && (
              <div className="flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5 text-[11px]">
                {(
                  [
                    { id: "all_active", label: "All Active" },
                    { id: "pending", label: "Pending" },
                    { id: "confirmed", label: "Confirmed" },
                    { id: "processing", label: "Processing" },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                      statusFilter === st.id
                        ? "bg-white text-slate-900 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            )}

            {/* Priority Filter */}
            <div className="flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5 text-[11px]">
              {(
                [
                  { id: "all", label: "All Priority" },
                  { id: "urgent", label: "Urgent" },
                  { id: "normal", label: "Normal" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriorityFilter(p.id)}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    priorityFilter === p.id
                      ? p.id === "urgent"
                        ? "bg-rose-600 text-white shadow-xs font-bold"
                        : "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Print State Filter */}
            <div className="flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5 text-[11px]">
              {(
                [
                  { id: "all", label: "All Print States" },
                  { id: "unprinted", label: "Unprinted / Reprint" },
                  { id: "printed", label: "Printed" },
                ] as const
              ).map((ps) => (
                <button
                  key={ps.id}
                  type="button"
                  onClick={() => setPrintStateFilter(ps.id)}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    printStateFilter === ps.id
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {ps.label}
                </button>
              ))}
            </div>

            {/* Held / Paused override toggle */}
            {includeHeld ? (
              <button
                type="button"
                onClick={() => setIncludeHeld(false)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-bold cursor-pointer hover:bg-amber-700"
                title="Hide paused or future-dated parcels"
              >
                <PauseCircle className="h-3 w-3" /> Showing Paused / Scheduled (Hide)
              </button>
            ) : heldHiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setIncludeHeld(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold cursor-pointer hover:bg-amber-200"
                title="Paused or future sending date parcels are excluded by default"
              >
                <AlertTriangle className="h-3 w-3 text-amber-700" />
                {heldHiddenCount} Held Hidden — Include
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────────────────
          PREVIEW CANVAS / THERMAL ROLL HOLDER
      ───────────────────────────────────────────────────────────────────────────── */}
      <main className="py-8 px-4 flex flex-col items-center justify-start min-h-[calc(100vh-110px)]">
        {/* Held / Override Notice Banner (Screen only) */}
        {includeHeld && (
          <div className="print-control-bar mb-4 text-xs bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-4 py-2.5 max-w-2xl flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
              <span>
                <strong>Override active:</strong> Paused and future-scheduled orders are currently included in the print list.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIncludeHeld(false)}
              className="text-[11px] font-bold px-2.5 py-1 rounded bg-amber-700 text-white hover:bg-amber-800 cursor-pointer"
            >
              Hide Held Orders
            </button>
          </div>
        )}

        {/* Physical Paper Size Spec Banner (Screen only) */}
        {printableOrders.length > 0 && (
          <div className="print-control-bar mb-6 text-center text-xs text-slate-600 max-w-md bg-white/90 border border-slate-300/80 rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-center gap-2 text-slate-800 font-bold mb-1">
              <Package className="h-4 w-4 text-amber-700" />
              <span>Thermal Roll Output: 58mm Thermal Sticker Roll</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Ordered <strong>Urgent First (oldest first)</strong>, then <strong>Normal (oldest first)</strong>
              {dateFilterMode !== "all" ? ` · Filtered by Sending Date (${formatSendingDateDisplay(sendingDate)})` : ""}.
            </p>
          </div>
        )}

        {/* Scaled Preview Wrapper */}
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: "top center",
            transition: "transform 0.15s ease",
          }}
          className={`space-y-8 print:space-y-0 print:transform-none ${
            printableOrders.length === 0 ? "w-full max-w-lg" : getContainerWidth()
          }`}
        >
          {printableOrders.length === 0 ? (
            <div className="print-control-bar bg-white border border-slate-300 rounded-2xl p-6 text-center shadow-sm space-y-3">
              <div className="mx-auto w-11 h-11 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-900">
                  No Parcels Match Current Sending Date &amp; Queue Filters
                </h2>
                <p className="text-xs text-slate-500">
                  {heldHiddenCount > 0
                    ? `${heldHiddenCount} parcel(s) matched your status/priority filters but are paused or scheduled for a future sending date.`
                    : `No active parcels due for ${formatSendingDateDisplay(sendingDate)} under the current filter settings.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {heldHiddenCount > 0 && !includeHeld && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIncludeHeld(true)}
                    className="bg-amber-700 hover:bg-amber-800 text-white text-xs cursor-pointer"
                  >
                    <PauseCircle className="h-3.5 w-3.5 mr-1.5" />
                    Include Paused / Future ({heldHiddenCount})
                  </Button>
                )}
                {dateFilterMode !== "all" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDateFilterMode("all")}
                    className="text-xs cursor-pointer"
                  >
                    Show All Sending Dates
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetQueueFilters}
                  className="text-xs cursor-pointer"
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          ) : printableOrders.map((order, orderIdx) => {
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
            const totalWeightKg = resolveOrderTotalWeightKg(order);
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
                  {/* URGENT PARCEL BANNER (High-contrast monochrome thermal safe) */}
                  {order.is_urgent && (
                    <div className="w-full bg-black text-white text-center py-0.5 px-1 mb-1 border border-black font-mono uppercase tracking-widest leading-none">
                      <span className="font-black text-[10.5px] sm:text-[11px]">★ URGENT PARCEL ★</span>
                    </div>
                  )}

                  {/* ============================================================= */}
                  {/* 1. BUSINESS NAME AND ADDRESS */}
                  {/* ============================================================= */}
                  <header className={storeConfig.logoUrl ? "flex items-center justify-center gap-2 text-left" : "text-center"}>
                    {storeConfig.logoUrl && (
                      <div className="shrink-0 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element -- synchronous raw img required for window.print() invoice rendering */}
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

                    {totalWeightKg !== null && (
                      <div
                        className="text-center font-bold text-[11px] sm:text-[12px] tracking-wide select-all py-0.5 leading-none my-0.5"
                        title="Total Package Weight"
                      >
                        {formatWeightDisplay(totalWeightKg)}
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

                    {order.sending_date && (
                      <div className="flex items-center justify-between gap-1 text-[8.5px] font-bold px-1 py-0.5 bg-black/5 border border-black rounded-xs my-0.5">
                        <span>SEND ON:</span>
                        <span>{formatSendingDateDisplay(order.sending_date)}</span>
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
                        {/* eslint-disable-next-line @next/next/no-img-element -- synchronous data URL required for window.print() invoice rendering */}
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
                <div className="tear-guide-screen flex flex-wrap items-center justify-between gap-1.5 px-2 pt-2 text-[11px] text-slate-500">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      Sticker #{orderIdx + 1} of {printableOrders.length}
                    </span>
                    {order.is_urgent ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold uppercase">
                        <Flame className="h-2.5 w-2.5" /> Urgent
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-semibold">
                        Normal
                      </span>
                    )}
                    {order.sending_date && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-semibold">
                        <CalendarClock className="h-2.5 w-2.5" /> {formatSendingDateDisplay(order.sending_date)}
                      </span>
                    )}
                    {order.is_paused && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-semibold">
                        <PauseCircle className="h-2.5 w-2.5" /> Paused
                      </span>
                    )}
                    {toDhakaDateKey(order.date) && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        Placed: {toDhakaDateKey(order.date)}
                      </span>
                    )}
                  </div>
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
