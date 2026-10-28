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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Order } from "@/types/order";
import { fetchOrdersByIdsFromDb } from "@/lib/supabase/api";

type PaperFormat = "2inch" | "58mm" | "a4";

interface StoreConfig {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  website: string;
  email: string;
  binNumber: string;
}

const DEFAULT_STORE: StoreConfig = {
  name: "GUR | Pure Cane & Date Molasses",
  tagline: "Heritage Artisanal Molasses & Natural Sweeteners",
  address: "House 12, Road 4, Dhanmondi, Dhaka-1205, Bangladesh",
  phone: "+880 1811-223344",
  website: "https://gur.com.bd",
  email: "orders@gur.com.bd",
  binNumber: "TRAD/DSCC/019284/2026",
};

function PrintContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idsParam = searchParams.get("ids") || "";
  const initialFormat = (searchParams.get("format") as PaperFormat) || "2inch";

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Print controls & preferences
  const [paperFormat, setPaperFormat] = React.useState<PaperFormat>(initialFormat);
  const [zoomLevel, setZoomLevel] = React.useState<number>(100);
  const [showPrices, setShowPrices] = React.useState<boolean>(true);
  const [showQrCode, setShowQrCode] = React.useState<boolean>(true);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // QR Code SVG Cache: map of url -> svg string
  const [qrSvgs, setQrSvgs] = React.useState<Record<string, string>>({});

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
        const data = await fetchOrdersByIdsFromDb(idList);
        setOrders(data);
      } catch (err: any) {
        console.error("Failed to load orders for print:", err);
        setError(err.message || "Failed to load order invoices");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, [idsParam]);

  // 2. Pre-generate SVG QR Codes for website & tracking links
  React.useEffect(() => {
    if (orders.length === 0) return;

    async function generateQrs() {
      const cache: Record<string, string> = {};

      // General website QR
      try {
        const generalSvg = await QRCode.toString(DEFAULT_STORE.website, {
          type: "svg",
          margin: 1,
          width: 90,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        cache[DEFAULT_STORE.website] = generalSvg;
      } catch (e) {
        console.error("Failed to generate store QR code:", e);
      }

      // Order specific tracking QR codes
      for (const ord of orders) {
        const trackUrl = `${DEFAULT_STORE.website}/track?order=${encodeURIComponent(ord.id)}`;
        try {
          const svg = await QRCode.toString(trackUrl, {
            type: "svg",
            margin: 1,
            width: 90,
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          });
          cache[ord.id] = svg;
        } catch (e) {
          console.error(`Failed to generate QR for order ${ord.id}:`, e);
        }
      }

      setQrSvgs(cache);
    }

    generateQrs();
  }, [orders]);

  // Keyboard shortcut Ctrl+P / Cmd+P
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-800">
        <Loader2 className="h-9 w-9 animate-spin text-amber-600 mb-3" />
        <h2 className="text-sm font-bold tracking-tight">Preparing 2&quot; Thermal Stickers...</h2>
        <p className="text-xs text-slate-500 mt-1">
          Loading order line items, address records, and generating vector QR codes...
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
    if (paperFormat === "2inch") return "w-[300px]"; // 2 inch preview representation
    if (paperFormat === "58mm") return "w-[340px]"; // 58mm preview
    return "w-[800px]"; // A4 preview
  };

  return (
    <div className="min-h-screen bg-slate-200 text-slate-900 print:bg-white print:text-black">
      {/* ─────────────────────────────────────────────────────────────────────────────
          PRINT STYLESHEET (Configured specifically for 2-inch thermal sticker paper rolls)
      ───────────────────────────────────────────────────────────────────────────── */}
      <style jsx global>{`
        @media print {
          @page {
            /* 2-inch roll = 50.8mm width, continuous auto height */
            size: ${paperFormat === "2inch"
                ? "50.8mm auto"
                : paperFormat === "58mm"
                ? "58mm auto"
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
            width: ${paperFormat === "a4" ? "100%" : "50.8mm"} !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          }

          /* Hide UI Chrome */
          .print-control-bar,
          .tear-guide-screen {
            display: none !important;
          }

          /* Thermal Sticker Container for Print */
          .thermal-sticker-page {
            width: ${paperFormat === "2inch"
              ? "48mm"
              : paperFormat === "58mm"
              ? "54mm"
              : "100%"} !important;
            max-width: ${paperFormat === "2inch"
              ? "48mm"
              : paperFormat === "58mm"
              ? "54mm"
              : "100%"} !important;
            margin: 0 auto !important;
            padding: 2.5mm 1mm 4mm 1mm !important;
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
            border-bottom: 1px dashed #000000 !important;
            margin: 4mm 0 0 0 !important;
            padding-bottom: 2mm !important;
            text-align: center !important;
            font-size: 8px !important;
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
                  2&quot; Thermal Sticker Invoice & Packing Slip
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                  50.8mm Roll
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
                onClick={() => setPaperFormat("2inch")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  paperFormat === "2inch"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="2 inch (50.8mm) continuous adhesive sticker roll for jars and cartons"
              >
                2&quot; Sticker Roll
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat("58mm")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  paperFormat === "58mm"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="58mm POS receipt roll"
              >
                58mm POS
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
                checked={showPrices}
                onChange={(e) => setShowPrices(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Prices</span>
            </label>

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
              onClick={() => window.print()}
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
            <span>Thermal Roll Output: 2 Inch (50.8mm) Sticker Roll</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Layout is optimized for 203/300 DPI thermal barcode and sticker printers (Xprinter, Rongta, Munbyn, Dymo, generic POS). High contrast monochrome typography with 100% full-width phone banners.
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
            const dueAmount = Math.max(0, order.grand_total - (order.amount_paid || 0));
            const isPaid = order.payment === "paid" || dueAmount === 0;
            const fullAddress = [
              order.address?.address_line,
              order.address?.district,
              order.address?.division,
            ]
              .filter(Boolean)
              .join(", ");

            const qrSvgString = qrSvgs[order.id] || qrSvgs[DEFAULT_STORE.website] || "";

            return (
              <div key={order.id} className="relative">
                {/* ─────────────────────────────────────────────────────────────────
                    2-INCH / 58MM THERMAL STICKER TICKET
                ───────────────────────────────────────────────────────────────── */}
                <article
                  className="thermal-sticker-page bg-white text-black font-sans shadow-lg rounded-sm border border-slate-300 p-4 print:p-0 print:border-none print:shadow-none print:rounded-none select-text"
                  style={{
                    width: paperFormat === "2inch" ? "48mm" : paperFormat === "58mm" ? "54mm" : "100%",
                    minWidth: paperFormat === "a4" ? "auto" : undefined,
                  }}
                >
                  {/* ============================================================= */}
                  {/* 1. BUSINESS NAME AND ADDRESS */}
                  {/* ============================================================= */}
                  <header className="text-center pb-2 border-b-2 border-black space-y-0.5">
                    {/* Brand Crown / Emblem */}
                    <div className="inline-flex items-center justify-center gap-1 font-black text-[13px] tracking-wider uppercase text-black">
                      <span>★</span>
                      <span>GUR</span>
                      <span>★</span>
                    </div>

                    <h1 className="font-extrabold text-[12px] leading-tight text-black tracking-tight uppercase">
                      Pure Cane & Date Molasses
                    </h1>

                    <p className="text-[9px] font-medium text-black/90 leading-tight">
                      Heritage Artisanal Natural Sweeteners
                    </p>

                    {/* Physical Address */}
                    <p className="text-[9px] font-semibold text-black leading-tight pt-0.5">
                      House 12, Road 4, Dhanmondi, Dhaka-1205
                    </p>

                    <p className="text-[8.5px] font-mono text-black/80">
                      BIN: {DEFAULT_STORE.binNumber}
                    </p>
                  </header>

                  {/* ============================================================= */}
                  {/* STORE HOTLINE STRIP */}
                  {/* ============================================================= */}
                  <div className="w-full text-center py-1 border-b border-black text-[9.5px] font-bold tracking-tight">
                    SUPPORT: {DEFAULT_STORE.phone}
                  </div>

                  {/* ============================================================= */}
                  {/* ORDER IDENTIFICATION & COURIER TAG */}
                  {/* ============================================================= */}
                  <div className="py-2 border-b border-black space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-black text-[13px] tracking-tight bg-black text-white px-1.5 py-0.5 rounded-xs">
                        #{order.id}
                      </span>
                      <span className="font-bold text-[9px] uppercase border border-black px-1 py-0.5 rounded-xs">
                        {order.channel || "WEB"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] font-medium text-black pt-0.5">
                      <span>DATE: {order.date?.slice(0, 16) || "N/A"}</span>
                      {order.courier_name && (
                        <span className="font-bold font-mono uppercase text-right truncate max-w-[120px]">
                          {order.courier_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ============================================================= */}
                  {/* DELIVER TO: CUSTOMER & DESTINATION */}
                  {/* ============================================================= */}
                  <div className="pt-2 pb-1 space-y-0.5">
                    <p className="font-black text-[9px] uppercase tracking-wider text-black">
                      DELIVER TO:
                    </p>
                    <p className="font-black text-[12px] leading-tight text-black break-words">
                      {order.customer || "Valued Customer"}
                    </p>
                    <p className="text-[10px] leading-snug font-medium text-black break-words">
                      {fullAddress || "Address provided at delivery"}
                    </p>
                    {order.address?.district && (
                      <p className="text-[9.5px] font-black uppercase text-black pt-0.5">
                        DESTINATION: {order.address.district}
                      </p>
                    )}
                  </div>

                  {/* ============================================================= */}
                  {/* 2. PHONE NUMBER (SPAN FULL WIDTH OF PAGE)                      */}
                  {/* ============================================================= */}
                  <section
                    className="w-full bg-black text-white text-center py-2 px-1 my-2 rounded-xs select-all"
                    title="Customer Delivery Phone Number"
                  >
                    <div className="text-[8px] font-bold tracking-widest uppercase opacity-90 leading-none mb-0.5">
                      CUSTOMER CONTACT NUMBER
                    </div>
                    <div className="font-mono font-black text-[15px] sm:text-[16px] tracking-widest leading-tight">
                      {order.phone || "NO PHONE GIVEN"}
                    </div>
                  </section>

                  {/* Customer checkout instructions/note if present */}
                  {order.customer_note && (
                    <div className="p-1.5 my-1.5 bg-black/5 border border-dashed border-black text-[9px] rounded-xs">
                      <span className="font-black uppercase text-[8px] block">
                        NOTE FROM CUSTOMER:
                      </span>
                      <p className="italic text-black font-medium leading-tight">
                        &quot;{order.customer_note}&quot;
                      </p>
                    </div>
                  )}

                  {/* ============================================================= */}
                  {/* 3. ORDER ITEM NAME AND QUANTITY                                */}
                  {/* ============================================================= */}
                  <section className="my-2 border-t-2 border-b-2 border-black py-1.5">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider pb-1 border-b border-black">
                      <span>ORDER ITEMS</span>
                      <span className="text-right">QTY {showPrices && "/ AMT"}</span>
                    </div>

                    <div className="divide-y divide-dashed divide-black/50">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((it, idx) => (
                          <div key={it.id || idx} className="py-1.5 space-y-0.5">
                            {/* Product Name */}
                            <div className="font-bold text-[10.5px] leading-tight text-black break-words">
                              {idx + 1}. {it.product_name}
                            </div>

                            {/* Variant / Pack description if present */}
                            {it.variant_name && (
                              <div className="text-[9px] text-black/80 font-medium pl-3">
                                Pack: {it.variant_name}
                              </div>
                            )}

                            {/* Quantity and Price Row */}
                            <div className="flex items-center justify-between pl-3 pt-0.5 text-[10px]">
                              <span className="font-black bg-black text-white px-1.5 py-0.2 rounded-xs text-[9.5px]">
                                QTY: {it.quantity}
                              </span>
                              {showPrices && (
                                <span className="font-mono font-bold text-black text-right">
                                  ৳ {Number(it.line_total).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] italic text-center py-2 text-black/70">
                          No line items found.
                        </p>
                      )}
                    </div>
                  </section>

                  {/* ============================================================= */}
                  {/* FINANCIAL TOTALS & PAYMENT STATUS                              */}
                  {/* ============================================================= */}
                  {showPrices && (
                    <div className="py-1 text-[9.5px] space-y-1">
                      <div className="flex justify-between text-black">
                        <span>Items Subtotal:</span>
                        <span className="font-mono font-medium">
                          ৳ {Number(order.subtotal).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-black">
                        <span>Delivery Fee:</span>
                        <span className="font-mono font-medium">
                          ৳ {Number(order.shipping_total).toLocaleString()}
                        </span>
                      </div>
                      {order.discount_total > 0 && (
                        <div className="flex justify-between font-medium text-black">
                          <span>Discount:</span>
                          <span className="font-mono">
                            - ৳ {Number(order.discount_total).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Grand Total Bar */}
                      <div className="flex justify-between items-center py-1 border-t border-b border-black font-black text-[12px]">
                        <span>GRAND TOTAL:</span>
                        <span className="font-mono">
                          ৳ {Number(order.grand_total).toLocaleString()}
                        </span>
                      </div>

                      {/* PAYMENT INSTRUCTION / COD BOX */}
                      <div
                        className={`w-full p-2 my-1.5 text-center rounded-xs border-2 ${
                          isPaid
                            ? "border-black bg-white text-black"
                            : "border-black bg-black text-white"
                        }`}
                      >
                        <div className="text-[8.5px] font-bold tracking-widest uppercase opacity-90">
                          PAYMENT STATUS
                        </div>
                        <div className="font-black text-[13px] tracking-tight leading-tight">
                          {isPaid ? "✓ PAID IN FULL (PREPAID)" : "CASH ON DELIVERY (COD)"}
                        </div>
                        <div className="font-mono font-bold text-[11px] mt-0.5">
                          {isPaid ? (
                            "DO NOT COLLECT CASH"
                          ) : (
                            <span>COLLECT: ৳ {dueAmount.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ============================================================= */}
                  {/* 4. CONTACT INFORMATION (WEB ADDRESS, QR CODE OF WEB ADDRESS)   */}
                  {/* ============================================================= */}
                  <footer className="pt-2 border-t border-black text-center space-y-1.5">
                    {/* QR Code */}
                    {showQrCode && qrSvgString && (
                      <div className="flex flex-col items-center justify-center pt-1">
                        <div
                          className="w-[84px] h-[84px] border border-black p-1 bg-white inline-flex items-center justify-center"
                          dangerouslySetInnerHTML={{ __html: qrSvgString }}
                          title={`Scan to visit ${DEFAULT_STORE.website}`}
                        />
                        <p className="text-[8px] font-bold uppercase tracking-wider text-black pt-0.5">
                          SCAN TO VISIT OUR STORE
                        </p>
                      </div>
                    )}

                    {/* Web Address */}
                    <div className="font-mono font-black text-[11px] tracking-wider text-black uppercase">
                      {DEFAULT_STORE.website.replace(/^https?:\/\//, "")}
                    </div>

                    <p className="text-[8px] font-medium text-black leading-tight">
                      Email: {DEFAULT_STORE.email} · Phone: {DEFAULT_STORE.phone}
                    </p>

                    <div className="text-[8px] font-bold text-black border-t border-dotted border-black pt-1">
                      Pure & Authentic Artisanal Molasses Guaranteed
                    </div>
                  </footer>

                  {/* Perforation / Tear Marker for Roll Printers */}
                  <div className="thermal-tear-line text-[9px] font-mono tracking-widest text-center py-1 border-b border-dashed border-black/80 my-2 select-none">
                    - - ✂ TEAR HERE ✂ - -
                  </div>
                </article>

                {/* On-screen quick copy / action bar underneath each sticker */}
                <div className="tear-guide-screen flex items-center justify-between px-2 pt-2 text-[11px] text-slate-500">
                  <span className="font-mono text-xs">Sticker #{orderIdx + 1} of {orders.length}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyId(order.id)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-amber-700 cursor-pointer font-medium"
                  >
                    {copiedId === order.id ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy #{order.id}</span>
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
