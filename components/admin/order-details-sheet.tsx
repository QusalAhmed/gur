"use client";

import * as React from "react";
import Image from "next/image";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Phone,
  Mail,
  MapPin,
  Truck,
  MessageSquare,
  ShieldCheck,
  PackageCheck,
  Edit,
  Trash2,
  Printer,
  CreditCard,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  Clock,
  Send,
  Plus,
  ExternalLink,
  Store,
  Globe,
  Share2,
  DollarSign,
  User,
  ShoppingBag,
  RotateCcw,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useForm } from "@tanstack/react-form";
import {
  FormFieldItem,
  FormFieldLabel,
  FormFieldError,
} from "@/components/ui/tanstack-form";
import {
  orderNoteFormSchema,
  orderNoteTextSchema,
  validateWithZod,
} from "@/lib/validations/order";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type {
  Order,
  OrderItem,
  OrderNote,
  OrderEvent,
  OrderNoteType,
  CatalogProduct,
} from "@/types/order";

export interface OrderDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  ordersList?: Order[];
  onSelectOrder?: (order: Order) => void;
  onEditOrder: (order: Order) => void;
  onUpdateStatus: (order: Order, status?: Order["status"]) => void;
  onQuickAdvanceStatus: (order: Order) => void;
  onRecordPayment: (order: Order) => void;
  onPrintInvoice: (orders: Order[]) => void;
  onDeleteOrder: (order: Order) => void;
  catalogProducts?: CatalogProduct[];
  onAddNote: (orderId: string, note: OrderNote, currentOrder: Order) => Promise<void> | void;
  onEditNote: (note: OrderNote, orderId: string) => void;
  onDeleteNote: (noteId: string, orderId: string, noteText: string, noteType: OrderNoteType, order: Order) => void;
  onEditCustomerNote: (order: Order) => void;
  onClearCustomerNote: (order: Order) => void;
  isStatusPending?: boolean;
  isNotePending?: boolean;
}

const statusStyles: Record<string, string> = {
  incomplete_order: "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-300 dark:border-slate-700/60",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700/50",
  processing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/50",
  shipped: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700/50",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50",
  partially_delivered: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-300 dark:border-teal-700/50",
  cancelled: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 dark:border-rose-700/50",
  returned: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-300 dark:border-orange-700/50",
};

const pipelineSteps: { value: Order["status"]; label: string }[] = [
  { value: "incomplete_order", label: "Incomplete" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "partially_delivered", label: "Partially Deliv." },
];

function getNextStatusLabel(status: Order["status"]): string | null {
  switch (status) {
    case "incomplete_order":
      return "Submit as Pending";
    case "pending":
      return "Confirm Order";
    case "confirmed":
      return "Start Processing";
    case "processing":
      return "Dispatch / Ship";
    case "shipped":
      return "Mark Delivered";
    case "delivered":
      return "Mark Partially Delivered";
    default:
      return null;
  }
}

export function OrderDetailsSheet({
  open,
  onOpenChange,
  order,
  ordersList = [],
  onSelectOrder,
  onEditOrder,
  onUpdateStatus,
  onQuickAdvanceStatus,
  onRecordPayment,
  onPrintInvoice,
  onDeleteOrder,
  catalogProducts = [],
  onAddNote,
  onEditNote,
  onDeleteNote,
  onEditCustomerNote,
  onClearCustomerNote,
  isStatusPending = false,
  isNotePending = false,
}: OrderDetailsSheetProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [noteFilterType, setNoteFilterType] = React.useState<string>("all");
  const [activeTab, setActiveTab] = React.useState<string>("notes");

  // Reset filter when opening or changing orders
  React.useEffect(() => {
    setNoteFilterType("all");
  }, [order?.id]);

  // Order Queue Switcher
  const currentIndex = React.useMemo(() => {
    if (!order || !ordersList?.length) return -1;
    return ordersList.findIndex((o) => o.id === order.id);
  }, [order, ordersList]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < ordersList.length - 1;

  const handlePrevOrder = React.useCallback(() => {
    if (hasPrev && onSelectOrder) {
      onSelectOrder(ordersList[currentIndex - 1]);
    }
  }, [hasPrev, onSelectOrder, ordersList, currentIndex]);

  const handleNextOrder = React.useCallback(() => {
    if (hasNext && onSelectOrder) {
      onSelectOrder(ordersList[currentIndex + 1]);
    }
  }, [hasNext, onSelectOrder, ordersList, currentIndex]);

  // Keyboard navigation for queue (< and >)
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevOrder();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextOrder();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handlePrevOrder, handleNextOrder]);

  // Copy helper with feedback
  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    try {
      navigator.clipboard?.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore
    }
  };

  // WhatsApp launcher generator
  const getWhatsAppUrl = () => {
    if (!order?.phone) return "#";
    let clean = order.phone.replace(/[^0-9+]/g, "");
    if (clean.startsWith("01")) {
      clean = "88" + clean;
    } else if (clean.startsWith("+88")) {
      clean = clean.replace("+", "");
    }
    const text = encodeURIComponent(
      `Hello ${order.customer || "Valued Customer"}, greetings from Molasses Store regarding your Order #${order.id}.`
    );
    return `https://wa.me/${clean}?text=${text}`;
  };

  // Courier format copy
  const handleCopyCourierFormat = () => {
    if (!order) return;
    const addressParts = [
      order.address?.address_line,
      order.address?.district,
      order.address?.division,
    ]
      .filter(Boolean)
      .join(", ");

    const text = [
      `Name: ${order.customer || "Customer"}`,
      `Phone: ${order.phone}`,
      `Address: ${addressParts || "N/A"}`,
      order.courier_name ? `Courier: ${order.courier_name}` : null,
      order.customer_note ? `Note: ${order.customer_note}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    handleCopy(text, "courier-format");
  };

  // Product thumbnail lookup helper
  const getProductThumbnail = (item: OrderItem) => {
    if (!catalogProducts?.length) return null;
    const match = catalogProducts.find(
      (p) =>
        (item.sku && p.sku === item.sku) ||
        (item.variant_id && p.variant_id === item.variant_id) ||
        p.product_name.toLowerCase() === item.product_name.toLowerCase()
    );
    return match?.image || null;
  };

  // Total unit count
  const totalUnits = React.useMemo(() => {
    if (!order?.items?.length) return 0;
    return order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [order?.items]);

  // TanStack Form for adding notes
  const noteForm = useForm({
    defaultValues: {
      text: "",
      type: "internal" as OrderNoteType,
    },
    onSubmit: async ({ value }) => {
      const validation = orderNoteFormSchema.safeParse(value);
      if (!validation.success || !order) return;

      const isCustomer = validation.data.type === "customer";
      const newNoteObj: OrderNote = {
        id: `note-${Date.now()}`,
        author: isCustomer
          ? order.customer
            ? `${order.customer} (Customer)`
            : "Customer"
          : "Admin Staff",
        text: validation.data.text.trim(),
        type: validation.data.type,
        created_at: new Date().toISOString().replace("T", " ").slice(0, 16),
      };

      await onAddNote(order.id, newNoteObj, order);
      noteForm.reset();
    },
  });

  if (!order) return null;

  const nextStatusLabel = getNextStatusLabel(order.status);
  const dueAmount = Math.max(0, order.grand_total - order.amount_paid);
  const isCancelledOrReturned =
    order.status === "cancelled" || order.status === "returned";

  // Channel icon and color
  const renderChannelBadge = () => {
    switch (order.channel) {
      case "web":
        return (
          <Badge variant="outline" className="text-[11px] gap-1 font-mono uppercase bg-muted/40">
            <Globe className="h-3 w-3 text-blue-500" />
            Web
          </Badge>
        );
      case "whatsapp":
        return (
          <Badge variant="outline" className="text-[11px] gap-1 font-mono uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300">
            <Share2 className="h-3 w-3" />
            WhatsApp
          </Badge>
        );
      case "phone":
        return (
          <Badge variant="outline" className="text-[11px] gap-1 font-mono uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300">
            <Phone className="h-3 w-3" />
            Phone
          </Badge>
        );
      case "walk_in":
        return (
          <Badge variant="outline" className="text-[11px] gap-1 font-mono uppercase bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300">
            <Store className="h-3 w-3" />
            Walk-in
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[11px] gap-1 font-mono uppercase bg-muted/40">
            {order.channel}
          </Badge>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-[56rem] h-full p-0 flex flex-col gap-0 overflow-hidden bg-background shadow-2xl border-l"
      >
        {/* ========================================================================= */}
        {/* 1. STICKY HEADER */}
        {/* ========================================================================= */}
        <div className="px-5 py-3.5 border-b bg-card/60 backdrop-blur-md shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-base sm:text-lg font-bold text-amber-700 dark:text-amber-400 truncate">
                {order.id}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(order.id, "order-id")}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                title="Copy Order ID"
              >
                {copiedKey === "order-id" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {renderChannelBadge()}

            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap ${statusStyles[order.status] || "bg-muted text-muted-foreground"
                }`}
            >
              {order.status.replace(/_/g, " ")}
            </span>
          </div>

          {/* Right Header: Queue Switcher & Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            {ordersList.length > 1 && (
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 border">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-md cursor-pointer"
                  disabled={!hasPrev}
                  onClick={handlePrevOrder}
                  title="Previous Order (Left Arrow)"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-[11px] font-mono px-1.5 text-muted-foreground select-none">
                  {currentIndex + 1} / {ordersList.length}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-md cursor-pointer"
                  disabled={!hasNext}
                  onClick={handleNextOrder}
                  title="Next Order (Right Arrow)"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer"
              onClick={() => onOpenChange(false)}
              title="Close Panel (Esc)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sub-header meta bar */}
        <div className="px-5 py-2 bg-muted/20 border-b flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Placed: {formatDate(order.date)}</span>
            <span>•</span>
            <span>Currency: {order.currency}</span>
            {order.isFromDb && (
              <>
                <span>•</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Synced
                </span>
              </>
            )}
          </div>

          {order.public_token && (
            <button
              type="button"
              onClick={() => {
                const trackingUrl = `${window.location.origin}/orders/${order.public_token}`;
                handleCopy(trackingUrl, "tracking-url");
              }}
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium cursor-pointer"
            >
              {copiedKey === "tracking-url" ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span>Tracking URL Copied!</span>
                </>
              ) : (
                <>
                  <ExternalLink className="h-3 w-3" />
                  <span>Copy Tracking Link</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 2. SCROLLABLE BODY CONTENT */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Status Pipeline or Exception Banner */}
          {isCancelledOrReturned ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 font-semibold text-sm">
                  {order.status === "cancelled" ? (
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  ) : (
                    <RotateCcw className="h-4 w-4 text-orange-600 shrink-0" />
                  )}
                  <span>Order is {order.status === "cancelled" ? "Cancelled" : "Returned"}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-rose-300 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                  onClick={() => onUpdateStatus(order, "pending")}
                >
                  <RefreshCw className="h-3 w-3 mr-1 text-rose-600" />
                  Reactivate Order
                </Button>
              </div>
              {order.cancel_reason && (
                <div className="mt-2 text-xs text-rose-800 dark:text-rose-300 bg-rose-100/50 dark:bg-rose-900/30 p-2.5 rounded-lg">
                  <span className="font-semibold">Reason: </span>
                  {order.cancel_reason}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-muted/40 border">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <PackageCheck className="h-3.5 w-3.5 text-amber-600" />
                  Fulfillment Pipeline
                </span>
                <span className="text-[11px] text-muted-foreground">Click step to transition</span>
              </div>
              <div className="flex items-center justify-between text-xs overflow-x-auto gap-2 pb-1">
                {pipelineSteps.map((stepObj, idx) => {
                  const statusOrderList = pipelineSteps.map((s) => s.value);
                  const currentIdx = statusOrderList.indexOf(order.status);
                  const isDone = currentIdx >= idx && currentIdx !== -1;
                  const isCurrent = order.status === stepObj.value;

                  return (
                    <button
                      key={stepObj.value}
                      type="button"
                      onClick={() => onUpdateStatus(order, stepObj.value)}
                      className="flex flex-col items-center gap-1 flex-1 min-w-[55px] group hover:opacity-85 transition-all cursor-pointer"
                    >
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${isCurrent
                          ? "bg-amber-600 text-white ring-4 ring-amber-100 dark:ring-amber-950 scale-110 shadow-sm"
                          : isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-muted-foreground border group-hover:border-amber-500"
                          }`}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      <span
                        className={`text-[10px] capitalize text-center leading-tight ${isCurrent
                          ? "font-bold text-amber-700 dark:text-amber-400"
                          : "text-muted-foreground"
                          }`}
                      >
                        {stepObj.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customer & Shipping Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Customer Details */}
            <Card className="rounded-xl border bg-card shadow-xs">
              <CardContent className="p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-xs">
                        {(order.customer || "CU").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground text-sm leading-tight">
                        {order.customer || <span className="text-muted-foreground italic">Guest Customer</span>}
                      </p>
                      <span className="text-[10px] text-muted-foreground">Buyer Details</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <a href={`tel:${order.phone}`} className="hover:underline text-foreground font-mono font-medium">
                        {order.phone}
                      </a>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(order.phone, "phone")}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Copy Phone"
                      >
                        {copiedKey === "phone" ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <a
                        href={getWhatsAppUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        title="Chat on WhatsApp"
                      >
                        <Share2 className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {order.email && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <a href={`mailto:${order.email}`} className="hover:underline truncate">
                        {order.email}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card className="rounded-xl border bg-card shadow-xs">
              <CardContent className="p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                    <MapPin className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Shipping Destination</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10 cursor-pointer"
                    onClick={handleCopyCourierFormat}
                    title="Copy name, phone & address formatted for courier"
                  >
                    {copiedKey === "courier-format" ? (
                      <>
                        <Check className="h-3 w-3 mr-1 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Courier Info
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {[order.address?.district, order.address?.division].filter(Boolean).join(", ") || (
                      <span className="text-muted-foreground italic font-normal">District / Division not specified</span>
                    )}
                  </p>
                  {order.address?.address_line && (
                    <p className="text-muted-foreground leading-relaxed">
                      {order.address.address_line}
                    </p>
                  )}
                </div>

                {order.courier_name && (
                  <div className="pt-1.5 flex items-center gap-1.5 border-t border-border/50 text-[11px]">
                    <Truck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="text-muted-foreground">Courier:</span>
                    <Badge variant="outline" className="font-semibold text-amber-800 dark:text-amber-300 border-amber-300 bg-amber-500/10">
                      {order.courier_name}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Split Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Products & Financials (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Ordered Products Table */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShoppingBag className="h-4 w-4 text-amber-600 shrink-0" />
                    Ordered Products ({order.items?.length || 0} items • {totalUnits} units)
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2"
                    onClick={() => {
                      onOpenChange(false);
                      onEditOrder(order);
                    }}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Modify Items
                  </Button>
                </div>

                {!order.items || order.items.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed text-center space-y-2 bg-muted/20">
                    <PackageCheck className="h-7 w-7 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs text-muted-foreground">No products added to this order yet.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => {
                        onOpenChange(false);
                        onEditOrder(order);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Products
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 text-[11px]">
                          <TableHead className="py-2">Item</TableHead>
                          <TableHead className="text-right py-2">Price</TableHead>
                          <TableHead className="text-center py-2">Qty</TableHead>
                          <TableHead className="text-right py-2">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.items.map((item) => {
                          const thumbnail = getProductThumbnail(item);
                          return (
                            <TableRow key={item.id} className="text-xs hover:bg-muted/30">
                              <TableCell className="py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-9 w-9 rounded-lg border bg-muted/30 shrink-0 overflow-hidden relative flex items-center justify-center">
                                    {thumbnail ? (
                                      <Image
                                        src={thumbnail}
                                        alt={item.product_name}
                                        fill
                                        sizes="36px"
                                        className="object-cover"
                                      />
                                    ) : (
                                      <ShoppingBag className="h-4 w-4 text-muted-foreground/50" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-foreground leading-tight truncate">
                                      {item.product_name}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                                      {item.variant_name && (
                                        <span>{item.variant_name}</span>
                                      )}
                                      {item.variant_name && item.sku && <span>•</span>}
                                      {item.sku && (
                                        <button
                                          type="button"
                                          onClick={() => handleCopy(item.sku, `sku-${item.id}`)}
                                          className="font-mono text-[10px] hover:text-foreground flex items-center gap-1"
                                          title="Click to copy SKU"
                                        >
                                          {item.sku}
                                          {copiedKey === `sku-${item.id}` && (
                                            <Check className="h-2.5 w-2.5 text-emerald-600" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono py-2.5 text-muted-foreground">
                                ৳ {item.unit_price.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center font-mono font-semibold py-2.5">
                                <Badge variant="secondary" className="px-1.5 py-0 text-xs font-mono">
                                  {item.quantity}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold py-2.5 text-foreground">
                                ৳ {item.line_total.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Financial Breakdown Receipt */}
              <div className="p-4 rounded-xl bg-card border shadow-xs space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-amber-600" />
                    Financial Breakdown
                  </span>
                  <Badge variant="outline" className="text-[11px] capitalize font-semibold border-amber-300 bg-amber-500/10 text-amber-800 dark:text-amber-300">
                    {order.method.replace(/_/g, " ").toUpperCase()}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-muted-foreground pt-0.5">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono text-foreground">৳ {order.subtotal.toLocaleString()}</span>
                  </div>
                  {order.discount_total > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Discount</span>
                      <span className="font-mono">- ৳ {order.discount_total.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Shipping Fee</span>
                    <span className="font-mono text-foreground">৳ {order.shipping_total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-between font-bold text-sm pt-2 border-t text-foreground">
                  <span>Grand Total</span>
                  <span className="font-mono text-amber-700 dark:text-amber-400">
                    ৳ {order.grand_total.toLocaleString()}
                  </span>
                </div>

                {/* Paid vs Due Status Box */}
                <div className="pt-2 border-t border-dashed space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Payment Status:</span>
                    <Badge
                      variant="outline"
                      className={`capitalize font-semibold text-xs ${order.payment === "paid"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : order.payment === "partially_paid"
                          ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400"
                          : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400"
                        }`}
                    >
                      {order.payment.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      ৳ {order.amount_paid.toLocaleString()}
                    </span>
                  </div>

                  {dueAmount > 0 && (
                    <div className="flex justify-between text-xs font-bold text-rose-600 dark:text-rose-400 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                      <span>Remaining Balance Due:</span>
                      <span className="font-mono">৳ {dueAmount.toLocaleString()}</span>
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-1 text-xs font-medium border-emerald-600/30 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
                    onClick={() => onRecordPayment(order)}
                  >
                    <CreditCard className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                    Record / Update Payment
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column: Tabbed Notes & Activity (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-2 p-1 bg-muted/60 rounded-xl">
                  <TabsTrigger value="notes" className="text-xs py-1.5 rounded-lg">
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    Notes ({(order.notes || []).length + (order.customer_note ? 1 : 0)})
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="text-xs py-1.5 rounded-lg">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    Activity ({(order.events || []).length})
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: NOTES & MEMOS */}
                <TabsContent value="notes" className="space-y-3 mt-3">
                  {/* Inline Note Composer */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      noteForm.handleSubmit();
                    }}
                    className="p-3 rounded-xl border bg-card shadow-xs space-y-2.5"
                  >
                    <noteForm.Field
                      name="text"
                      validators={{
                        onChange: validateWithZod(orderNoteTextSchema),
                      }}
                    >
                      {(field) => (
                        <FormFieldItem>
                          <FormFieldLabel htmlFor="sheet_note_text" className="text-xs font-semibold">
                            Add Note / Memo
                          </FormFieldLabel>
                          <noteForm.Subscribe selector={(state) => state.values.type}>
                            {(noteType) => (
                              <Textarea
                                id="sheet_note_text"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder={
                                  noteType === "customer"
                                    ? "Customer note for seller (saves to orders.customer_note)..."
                                    : noteType === "delivery"
                                      ? "Delivery instructions for rider (saves to notes table)..."
                                      : noteType === "packaging"
                                        ? "Packaging checklist notes for packing..."
                                        : "Internal staff update note..."
                                }
                                rows={2}
                                className="text-xs bg-background resize-none"
                              />
                            )}
                          </noteForm.Subscribe>
                          <FormFieldError errors={field.state.meta.errors} />
                        </FormFieldItem>
                      )}
                    </noteForm.Field>

                    <div className="flex items-center justify-between gap-2">
                      <noteForm.Field name="type">
                        {(field) => (
                          <div className="flex items-center gap-1.5">
                            {field.state.value === "internal" ? (
                              <ShieldCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            ) : field.state.value === "customer" ? (
                              <MessageSquare className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            ) : field.state.value === "delivery" ? (
                              <Truck className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            ) : (
                              <PackageCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                            )}
                            <select
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value as OrderNoteType)}
                              className="h-7 rounded-md border border-input bg-background px-2 text-[11px] focus:outline-none cursor-pointer max-w-[190px]"
                            >
                              <option value="internal">Staff Note (Internal)</option>
                              <option value="customer">Customer Note (Buyer)</option>
                              <option value="delivery">Delivery Note (Courier)</option>
                              <option value="packaging">Packaging Note (Packer)</option>
                            </select>
                          </div>
                        )}
                      </noteForm.Field>

                      <Button
                        type="submit"
                        size="sm"
                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                        disabled={isNotePending}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Record
                      </Button>
                    </div>
                  </form>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                    {(() => {
                      const allTotal = (order.notes || []).length + (order.customer_note ? 1 : 0);
                      const staffCount = (order.notes || []).filter((n) => n.type === "internal").length;
                      const delivCount = (order.notes || []).filter((n) => n.type === "delivery").length;
                      const packCount = (order.notes || []).filter((n) => n.type === "packaging").length;
                      const custCount = order.customer_note ? 1 : 0;

                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => setNoteFilterType("all")}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all cursor-pointer ${noteFilterType === "all"
                              ? "bg-foreground text-background font-semibold"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                          >
                            All ({allTotal})
                          </button>
                          <button
                            type="button"
                            onClick={() => setNoteFilterType("internal")}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${noteFilterType === "internal"
                              ? "bg-amber-600 text-white font-semibold"
                              : "bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
                              }`}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Staff ({staffCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setNoteFilterType("delivery")}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${noteFilterType === "delivery"
                              ? "bg-indigo-600 text-white font-semibold"
                              : "bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-500/20"
                              }`}
                          >
                            <Truck className="h-3 w-3" />
                            Delivery ({delivCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setNoteFilterType("packaging")}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${noteFilterType === "packaging"
                              ? "bg-emerald-600 text-white font-semibold"
                              : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20"
                              }`}
                          >
                            <PackageCheck className="h-3 w-3" />
                            Packing ({packCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setNoteFilterType("customer")}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${noteFilterType === "customer"
                              ? "bg-blue-600 text-white font-semibold"
                              : "bg-blue-500/10 text-blue-800 dark:text-blue-300 hover:bg-blue-500/20"
                              }`}
                          >
                            <MessageSquare className="h-3 w-3" />
                            Customer ({custCount})
                          </button>
                        </>
                      );
                    })()}
                  </div>

                  {/* Notes Feed */}
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {/* Customer Note Card */}
                    {(noteFilterType === "all" || noteFilterType === "customer") && order.customer_note && (
                      <div className="p-3 rounded-xl border text-xs space-y-1.5 bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 relative group">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <Badge className="text-[10px] py-0 px-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300">
                              <MessageSquare className="h-3 w-3 mr-1 inline" />
                              Customer Note
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">{order.customer || "Customer"}</span>
                          </span>
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => onEditCustomerNote(order)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-blue-200/40 cursor-pointer"
                              title="Edit Customer Note"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onClearCustomerNote(order)}
                              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-rose-200/40 cursor-pointer"
                              title="Clear Customer Note"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-foreground/90 whitespace-pre-wrap italic">&quot;{order.customer_note}&quot;</p>
                      </div>
                    )}

                    {/* Other Notes */}
                    {(() => {
                      const filteredNotes = (order.notes || []).filter((n) => {
                        if (noteFilterType === "all") return true;
                        return n.type === noteFilterType;
                      });

                      if (filteredNotes.length === 0 && (noteFilterType !== "all" || !order.customer_note)) {
                        return (
                          <div className="p-6 rounded-xl border border-dashed text-center text-xs text-muted-foreground italic bg-muted/10">
                            No notes found for this category.
                          </div>
                        );
                      }

                      return filteredNotes.map((note) => {
                        const isDeliv = note.type === "delivery";
                        const isPack = note.type === "packaging";

                        const bgClass = isDeliv
                          ? "bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800"
                          : isPack
                            ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                            : "bg-amber-500/[0.04] dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-900/40";

                        return (
                          <div
                            key={note.id}
                            className={`p-3 rounded-xl border text-xs space-y-1.5 relative group ${bgClass}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground flex items-center gap-1.5">
                                {isDeliv ? (
                                  <Badge className="text-[10px] py-0 px-1.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-indigo-300">
                                    <Truck className="h-3 w-3 mr-1 inline" />
                                    Delivery Note
                                  </Badge>
                                ) : isPack ? (
                                  <Badge className="text-[10px] py-0 px-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-300">
                                    <PackageCheck className="h-3 w-3 mr-1 inline" />
                                    Packing Note
                                  </Badge>
                                ) : (
                                  <Badge className="text-[10px] py-0 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300">
                                    <ShieldCheck className="h-3 w-3 mr-1 inline" />
                                    Staff Note
                                  </Badge>
                                )}
                                <span className="text-[11px] text-muted-foreground">{note.author}</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">{formatDateTime(note.created_at)}</span>
                                <button
                                  type="button"
                                  onClick={() => onEditNote(note, order.id)}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  title="Edit Note"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onDeleteNote(
                                      note.id,
                                      order.id,
                                      note.text,
                                      note.type,
                                      order
                                    )
                                  }
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-rose-500/10 opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  title="Delete Note"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            <p className="text-foreground/90 whitespace-pre-wrap">{note.text}</p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </TabsContent>

                {/* TAB 2: ACTIVITY TIMELINE */}
                <TabsContent value="activity" className="space-y-3 mt-3">
                  {!order.events || order.events.length === 0 ? (
                    <div className="p-8 rounded-xl border border-dashed text-center text-xs text-muted-foreground italic bg-muted/10">
                      No activity logged yet for this order.
                    </div>
                  ) : (
                    <div className="border-l-2 border-muted ml-3 space-y-4 pl-4 text-xs py-2">
                      {order.events.map((ev) => (
                        <div key={ev.id} className="relative">
                          <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-background" />
                          <p className="font-medium text-foreground">{ev.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {ev.actor} • {formatDateTime(ev.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. STICKY BOTTOM ACTION DOCK */}
        {/* ========================================================================= */}
        <div className="px-5 py-3 border-t bg-card/80 backdrop-blur-md shrink-0 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            {nextStatusLabel && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs h-8 cursor-pointer shadow-xs"
                disabled={isStatusPending}
                onClick={() => onQuickAdvanceStatus(order)}
              >
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                {nextStatusLabel}
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 cursor-pointer"
              onClick={() => onUpdateStatus(order)}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1 text-amber-600" />
              Status
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 cursor-pointer"
              onClick={() => {
                onOpenChange(false);
                onEditOrder(order);
              }}
            >
              <Edit className="h-3.5 w-3.5 mr-1 text-blue-600" />
              Edit
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 cursor-pointer"
              onClick={() => onPrintInvoice([order])}
              title="Print 58mm thermal sticker label"
            >
              <Printer className="h-3.5 w-3.5 mr-1 text-amber-600" />
              58mm Label
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 text-destructive hover:bg-destructive/10 cursor-pointer"
              onClick={() => {
                onDeleteOrder(order);
              }}
              title="Delete Order"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

