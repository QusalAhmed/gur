"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  Package,
  Truck,
  Copy,
  Check,
  MapPin,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Home,
  Building,
} from "lucide-react";
import { CustomerOrderHistory } from "@/actions/call-lists";
import { formatCustomerAddress } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  incomplete_order: {
    label: "Incomplete Draft",
    className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  processing: {
    label: "Processing",
    className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  },
  shipped: {
    label: "Shipped",
    className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  },
  delivered: {
    label: "Delivered",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  },
  returned: {
    label: "Returned",
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  paid: {
    label: "Paid",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  unpaid: {
    label: "Unpaid",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  },
  partial: {
    label: "Partial",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  refunded: {
    label: "Refunded",
    className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  },
};

interface CustomerOrderCardProps {
  order: CustomerOrderHistory;
  defaultOpen?: boolean;
}

export function CustomerOrderCard({
  order,
  defaultOpen = false,
}: CustomerOrderCardProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const [copiedTracking, setCopiedTracking] = React.useState(false);

  const statusConfig = ORDER_STATUS_CONFIG[order.status] || {
    label: order.status,
    className: "bg-muted text-muted-foreground border-border",
  };

  const paymentConfig = PAYMENT_STATUS_CONFIG[order.paymentStatus] || {
    label: order.paymentStatus,
    className: "bg-muted text-muted-foreground border-border",
  };

  const formattedDate = order.createdAt
    ? format(new Date(order.createdAt), "dd MMM yyyy, h:mm a")
    : "—";

  const deliveredDate = order.deliveredAt
    ? format(new Date(order.deliveredAt), "dd MMM yyyy, h:mm a")
    : null;

  const shippedDate = order.shippedAt
    ? format(new Date(order.shippedAt), "dd MMM yyyy, h:mm a")
    : null;

  const handleCopyTracking = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.courierTrackingCode) return;
    navigator.clipboard.writeText(order.courierTrackingCode);
    setCopiedTracking(true);
    toast.success("Tracking code copied to clipboard");
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  // Robust parsing of order shipping address
  const parsedAddress = formatCustomerAddress(order.shippingAddress);

  // Live tracking URL resolution
  const trackingUrl =
    order.courierTrackingUrl ||
    (order.courierTrackingCode
      ? `https://steadfast.com.bd/tracking/${order.courierTrackingCode}`
      : null);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border rounded-lg bg-card shadow-2xs overflow-hidden transition-all duration-200"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full text-left p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-muted/30 transition-colors focus:outline-hidden"
        >
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-xs text-foreground">
                #{order.orderNumber}
              </span>
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0 font-medium", statusConfig.className)}
              >
                {statusConfig.label}
              </Badge>
              {order.fulfillmentStatus && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 font-medium bg-muted/30 text-muted-foreground"
                >
                  {order.fulfillmentStatus === "fulfilled"
                    ? "Fulfilled"
                    : order.fulfillmentStatus === "partially_fulfilled"
                    ? "Partial"
                    : "Unfulfilled"}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0 font-medium", paymentConfig.className)}
              >
                {order.paymentMethod ? `${order.paymentMethod.toUpperCase()} · ` : ""}
                {paymentConfig.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 shrink-0" />
                {formattedDate}
              </span>
              <span>·</span>
              <span>
                {order.items.length} {order.items.length === 1 ? "item" : "items"}
              </span>
              {order.courierTrackingCode && (
                <>
                  <span>·</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono text-[10px] flex items-center gap-1">
                    <Truck className="w-3 h-3 shrink-0" />
                    {order.courierTrackingCode}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="font-bold text-sm text-foreground">
              ৳ {order.grandTotal.toLocaleString("en-BD")}
            </span>
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground">
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  isOpen ? "rotate-180" : ""
                )}
              />
            </div>
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-3.5 pt-0 space-y-3.5 border-t border-border/50 bg-muted/10 text-xs">
          {/* Courier & Delivery Track Status */}
          {(order.courierName || order.courierTrackingCode || order.deliveredAt || order.shippedAt) && (
            <div className="mt-2.5 p-3 rounded-lg bg-card border border-border/60 space-y-2 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-700 dark:text-amber-400">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">
                      {order.courierName || "Steadfast Courier"}
                    </span>
                    {order.courierConsignmentId && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Consignment #{order.courierConsignmentId}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {order.courierTrackingCode && (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] bg-muted/50 px-2 py-0.5 rounded border">
                      <span>{order.courierTrackingCode}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 text-muted-foreground hover:text-foreground"
                        onClick={handleCopyTracking}
                        title="Copy Tracking Code"
                      >
                        {copiedTracking ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  )}

                  {trackingUrl && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <a href={trackingUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        <span>Track Parcel</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Delivery timestamps */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                {deliveredDate && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Delivered: {deliveredDate}
                  </span>
                )}
                {shippedDate && !deliveredDate && (
                  <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                    <Truck className="w-3 h-3" />
                    Shipped: {shippedDate}
                  </span>
                )}
                {order.cancelReason && (
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-3 h-3" />
                    Cancel reason: {order.cancelReason}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Delivery Destination Address */}
          {parsedAddress && (
            <div className="p-3 rounded-lg bg-card border border-border/60 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  Order Delivery Destination
                </span>
                {parsedAddress.isHomeDelivery !== undefined && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                    {parsedAddress.isHomeDelivery ? (
                      <span className="flex items-center gap-1">
                        <Home className="w-2.5 h-2.5" />
                        Home Delivery
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Building className="w-2.5 h-2.5" />
                        Point / Courier Delivery
                      </span>
                    )}
                  </Badge>
                )}
              </div>

              <div className="space-y-0.5 pt-0.5">
                {(parsedAddress.recipientName || parsedAddress.phone) && (
                  <p className="font-semibold text-foreground text-xs">
                    {parsedAddress.recipientName || "Recipient"}{" "}
                    {parsedAddress.phone ? `(${parsedAddress.phone})` : ""}
                  </p>
                )}
                {parsedAddress.addressLine && (
                  <p className="text-foreground/90 font-medium leading-relaxed">
                    {parsedAddress.addressLine}
                  </p>
                )}
                {parsedAddress.areaLine && (
                  <p className="text-muted-foreground text-[11px]">
                    {parsedAddress.areaLine}
                  </p>
                )}
                {parsedAddress.landmark && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    Landmark: {parsedAddress.landmark}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Purchased Items List */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Purchased Products ({order.items.length})
            </span>
            <div className="divide-y divide-border/40 border rounded-md bg-card overflow-hidden">
              {order.items.length === 0 ? (
                <div className="p-2.5 text-center text-muted-foreground text-[11px]">
                  No item details recorded.
                </div>
              ) : (
                order.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-medium text-foreground flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{item.productName}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        {item.variantName && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 font-normal">
                            {item.variantName}
                          </Badge>
                        )}
                        <span>
                          {item.quantity} × ৳{item.unitPrice.toLocaleString("en-BD")}
                        </span>
                        {item.weightGrams ? (
                          <span>({(item.weightGrams / 1000).toFixed(1)} kg)</span>
                        ) : null}
                      </div>
                    </div>
                    <span className="font-semibold text-foreground shrink-0">
                      ৳ {item.lineTotal.toLocaleString("en-BD")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="bg-card p-2.5 rounded-md border space-y-1 text-[11px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span>৳ {order.subtotal.toLocaleString("en-BD")}</span>
            </div>
            {order.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Discount Applied:</span>
                <span>-৳ {order.discountTotal.toLocaleString("en-BD")}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery / Courier Charge:</span>
              <span>৳ {order.shippingTotal.toLocaleString("en-BD")}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-bold text-foreground text-xs pt-0.5">
              <span>Grand Total:</span>
              <span className="text-primary font-bold">
                ৳ {order.grandTotal.toLocaleString("en-BD")}
              </span>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
