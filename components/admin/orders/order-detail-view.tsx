"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  Clock,
  Printer,
  CreditCard,
  RotateCcw,
  XCircle,
  FileEdit,
  Phone,
  MessageCircle,
  User,
  MapPin,
  Building2,
  Send,
  Loader2,
  Package,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  formatBDT,
  formatDhakaDateTime,
  formatDhakaDate,
  formatPhoneDisplay,
  formatUOM,
} from "@/lib/admin-format";
import { ConfirmReasonDialog } from "@/components/admin/confirm-reason-dialog";
import { ShipDialog } from "@/components/admin/orders/ship-dialog";
import { RecordPaymentDialog } from "@/components/admin/orders/record-payment-dialog";
import { RecordRefundDialog } from "@/components/admin/orders/record-refund-dialog";
import {
  confirmOrderAction,
  processOrderAction,
  cancelOrderWithReasonAction,
  addStaffNoteAction,
} from "@/actions/order-ops";
import { updateShipmentStatusAction } from "@/actions/shipment-ops";
import { ORDER_CANCELLATION_REASONS } from "@/types/order";
import { cn } from "@/lib/utils";

interface OrderDetailViewProps {
  order: any;
  availableLots: any[];
  warehouses: any[];
  currentRole: string;
}

const STATUS_BADGE_STYLE: Record<string, { label: string; className: string }> = {
  incomplete_order: {
    label: "Incomplete Draft",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300",
  },
  pending: {
    label: "Pending Verification",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  processing: {
    label: "Processing / Packaging",
    className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  },
  shipped: {
    label: "Shipped / In Transit",
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

const PAYMENT_BADGE_STYLE: Record<string, { label: string; className: string }> = {
  unpaid: {
    label: "Unpaid",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  },
  partially_paid: {
    label: "Partially Paid",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  paid: {
    label: "Paid in Full",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  partially_refunded: {
    label: "Partially Refunded",
    className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  },
  refunded: {
    label: "Refunded",
    className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30",
  },
};

export function OrderDetailView({
  order,
  availableLots,
  warehouses,
  currentRole,
}: OrderDetailViewProps) {
  const router = useRouter();

  // Dialog open states
  const [shipOpen, setShipOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [copiedPhone, setCopiedPhone] = React.useState(false);
  const copiedPhoneTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (copiedPhoneTimeoutRef.current) {
        clearTimeout(copiedPhoneTimeoutRef.current);
      }
    };
  }, []);

  // Note form state
  const [newNote, setNewNote] = React.useState("");
  const [isSubmittingNote, setIsSubmittingNote] = React.useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  const grandTotal = Number(order.grand_total) || 0;
  const amountPaid = Number(order.amount_paid) || 0;
  const balanceDue = Math.max(0, grandTotal - amountPaid);

  const statusBadge = STATUS_BADGE_STYLE[order.status] || {
    label: order.status,
    className: "bg-muted text-muted-foreground",
  };
  const paymentBadge = PAYMENT_BADGE_STYLE[order.payment_status] || {
    label: order.payment_status,
    className: "bg-muted text-muted-foreground",
  };

  const hasShipments = Array.isArray(order.shipments) && order.shipments.length > 0;
  const canEditItems =
    (order.status === "pending" || order.status === "incomplete_order") &&
    !hasShipments &&
    amountPaid === 0;

  const canShip =
    order.status !== "cancelled" &&
    order.status !== "returned" &&
    order.status !== "delivered" &&
    order.fulfillment_status !== "fulfilled";

  const handleConfirm = async () => {
    try {
      setIsUpdatingStatus(true);
      const res = await confirmOrderAction(order.id);
      if (res.ok) {
        toast.success("Order confirmed!");
        router.refresh();
      } else {
        toast.error(res.message || "Failed to confirm order");
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleProcess = async () => {
    try {
      setIsUpdatingStatus(true);
      const res = await processOrderAction(order.id);
      if (res.ok) {
        toast.success("Order moved to processing!");
        router.refresh();
      } else {
        toast.error(res.message || "Failed to move to processing");
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCancel = async (reason: string) => {
    const res = await cancelOrderWithReasonAction(order.id, reason);
    if (res.ok) {
      toast.success("Order has been cancelled.");
      router.refresh();
    } else {
      toast.error(res.message || "Failed to cancel order");
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setIsSubmittingNote(true);
      const res = await addStaffNoteAction(order.id, newNote.trim(), "internal");
      if (res.ok) {
        toast.success("Staff note added!");
        setNewNote("");
        router.refresh();
      } else {
        toast.error(res.message || "Failed to add note");
      }
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleMarkShipmentDelivered = async (shipmentId: string) => {
    try {
      const res = await updateShipmentStatusAction(shipmentId, "delivered");
      if (res.ok) {
        toast.success("Shipment marked as delivered!");
        router.refresh();
      } else {
        toast.error(res.message || "Failed to update shipment");
      }
    } catch (err: any) {
      toast.error(err?.message || "An error occurred");
    }
  };

  // WhatsApp and Phone Click to Call with Confirmation Link
  const phoneClean = order.customer_phone ? order.customer_phone.replace(/[^\d+]/g, "") : "";
  const waNumber = phoneClean.startsWith("+") ? phoneClean.slice(1) : phoneClean;
  const origin = React.useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
  const confirmationLink = origin
    ? `${origin}/order-confirmed/${order.order_number}${order.public_token ? `?token=${order.public_token}` : ""}`
    : "";
  const waUrl = waNumber && confirmationLink
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`আসসালামু আলাইকুম ${order.customer_name || "সম্মানিত গ্রাহক"}, আপনার অর্ডার #${order.order_number} গ্রহণ করা হয়েছে। বিস্তারিত বিবরণ দেখতে এই লিংকে প্রবেশ করুন:\n${confirmationLink}`)}`
    : "";

  return (
    <div className="space-y-4 pb-16 max-w-7xl mx-auto">
      {/* Sticky Action Top Bar */}
      <div className="sticky top-14 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2.5 bg-background/95 backdrop-blur-md border-b border-border/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
            <Link href="/admin/orders">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Orders
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground">
              {order.order_number}
            </h1>
            <Badge variant="outline" className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", statusBadge.className)}>
              {statusBadge.label}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", paymentBadge.className)}>
              {paymentBadge.label}
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {order.status === "pending" && (
            <Button
              size="sm"
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
              onClick={handleConfirm}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Confirm Order
            </Button>
          )}

          {order.status === "confirmed" && (
            <Button
              size="sm"
              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
              onClick={handleProcess}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              Start Packaging
            </Button>
          )}

          {canShip && (
            <Button
              size="sm"
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
              onClick={() => setShipOpen(true)}
            >
              <Truck className="h-3.5 w-3.5" />
              Ship Items
            </Button>
          )}

          {balanceDue > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400 gap-1"
              onClick={() => setPayOpen(true)}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Record Payment
            </Button>
          )}

          {amountPaid > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-border/80 gap-1"
              onClick={() => setRefundOpen(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Refund
            </Button>
          )}

          {/* Print Invoice & Packing Slip */}
          <Button asChild size="sm" variant="outline" className="h-8 text-xs border-border/80 gap-1">
            <Link href={`/admin/orders/print?orderId=${order.id}&type=invoice`} target="_blank">
              <Printer className="h-3.5 w-3.5" />
              Print Invoice
            </Link>
          </Button>

          {order.status !== "shipped" && order.status !== "delivered" && order.status !== "cancelled" && order.status !== "returned" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 gap-1"
              onClick={() => setCancelOpen(true)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column (Items, Shipments, Timeline, Notes) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order Items Table Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  Line Items ({order.order_items?.length || 0})
                </CardTitle>
                <CardDescription className="text-xs">
                  Products, pricing, and shipment fulfillment progress
                </CardDescription>
              </div>
              {canEditItems && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-border/80" disabled title="Use Edit dialog">
                  <FileEdit className="h-3 w-3" />
                  Edit Items
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground border-y border-border/60">
                    <tr>
                      <th className="py-2 px-4 font-medium">SKU / Product</th>
                      <th className="py-2 px-4 font-medium text-right">Unit Price</th>
                      <th className="py-2 px-4 font-medium text-center">Ordered</th>
                      <th className="py-2 px-4 font-medium text-center">Shipped</th>
                      <th className="py-2 px-4 font-medium text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(order.order_items || []).map((it: any) => {
                      const shipped = Number(it.shipped_quantity) || 0;
                      const ordered = Number(it.quantity) || 0;
                      const isComplete = shipped >= ordered;

                      return (
                        <tr key={it.id} className="hover:bg-muted/20">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-foreground">{it.product_name}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground font-mono">
                              <span>SKU: {it.sku}</span>
                              {it.variant_name && <span>· {it.variant_name}</span>}
                              {it.net_quantity && (
                                <span>· {it.net_quantity} {it.net_unit}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium">
                            {formatBDT(it.unit_price)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-semibold">
                            {ordered}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={cn(
                                "font-mono font-bold text-xs px-2 py-0.5 rounded-full",
                                isComplete
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                  : shipped > 0
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  : "text-muted-foreground"
                              )}
                            >
                              {shipped} / {ordered}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                            {formatBDT(it.unit_price * ordered)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Shipments & Traceability Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base font-semibold tracking-tight">
                Shipments & Lot Traceability ({order.shipments?.length || 0})
              </CardTitle>
              <CardDescription className="text-xs">
                Dispatched parcels with allocated molasses lots
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 pt-0">
              {(!order.shipments || order.shipments.length === 0) ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                  No shipments dispatched yet. Click "Ship Items" above to allocate lots.
                </div>
              ) : (
                <div className="space-y-3">
                  {order.shipments.map((s: any) => (
                    <div key={s.id} className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <span className="font-semibold text-foreground">{s.carrier}</span>
                          {s.tracking_number && (
                            <span className="font-mono text-muted-foreground">
                              · Trk: {s.tracking_number}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                            {s.status}
                          </Badge>
                          {s.status !== "delivered" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] px-2 text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => handleMarkShipmentDelivered(s.id)}
                            >
                              Mark Delivered
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Shipment Items and Allocated Lots */}
                      <div className="space-y-1 pt-1 border-t border-border/60 text-xs">
                        {(s.shipment_items || []).map((si: any) => (
                          <div key={si.id} className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">Qty: {si.quantity} units</span>
                            {si.batches?.lot_code ? (
                              <span className="font-mono font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                Lot: {si.batches.lot_code} (Brix: {si.batches.brix || "—"}°, pH: {si.batches.ph || "—"})
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-mono">Lot: Unassigned</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline Events */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base font-semibold tracking-tight">Order Timeline</CardTitle>
              <CardDescription className="text-xs">Audit log of all lifecycle events</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 pt-0">
              <div className="space-y-3 relative pl-4 border-l-2 border-border/80 ml-2">
                {(order.order_events || []).map((ev: any) => (
                  <div key={ev.id} className="relative text-xs">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-amber-600 dark:bg-amber-400 ring-2 ring-background" />
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{ev.message || ev.event_type}</p>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDhakaDateTime(ev.created_at, "dd MMM, hh:mm a")}
                      </span>
                    </div>
                    {ev.to_value && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">Status: {ev.to_value}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Staff Notes */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base font-semibold tracking-tight">Internal Staff Notes</CardTitle>
              <CardDescription className="text-xs">Private notes visible only to team members</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 pt-1 space-y-3">
              <form onSubmit={handleAddNote} className="space-y-2">
                <Textarea
                  placeholder="Add an internal observation, delivery note, or customer call outcome..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="text-xs resize-none h-18"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
                    disabled={isSubmittingNote || !newNote.trim()}
                  >
                    {isSubmittingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Add Note
                  </Button>
                </div>
              </form>

              {/* Notes list */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                {(order.staff_notes || []).map((sn: any) => (
                  <div key={sn.id} className="p-2.5 rounded-lg bg-muted/40 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Staff Note</span>
                      <span>{formatDhakaDateTime(sn.created_at, "dd MMM yyyy, hh:mm a")}</span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{sn.body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Totals, Customer, Address, Attribution) */}
        <div className="space-y-4">
          {/* Payment & Totals Summary */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base font-semibold tracking-tight">Payment Summary</CardTitle>
              <CardDescription className="text-xs">
                Method: <span className="font-semibold uppercase">{order.payment_method || "COD"}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 pt-0 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">{formatBDT(order.subtotal)}</span>
              </div>
              {Number(order.discount_total) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span className="font-mono">-{formatBDT(order.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping ({order.shipping_method_name || "Standard"})</span>
                <span className="font-mono">{formatBDT(order.shipping_total)}</span>
              </div>
              {Number(order.tax_total) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span className="font-mono">{formatBDT(order.tax_total)}</span>
              </div>
              )}

              <Separator className="my-1.5" />

              <div className="flex justify-between text-sm font-bold text-foreground">
                <span>Grand Total</span>
                <span className="font-mono text-base">{formatBDT(grandTotal)}</span>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Amount Paid</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatBDT(amountPaid)}
                </span>
              </div>

              <div className="flex justify-between text-xs font-semibold pt-0.5">
                <span>Balance Due</span>
                <span className={cn("font-mono text-sm", balanceDue > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-muted-foreground")}>
                  {formatBDT(balanceDue)}
                </span>
              </div>

              {order.payment_due_date && (
                <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Credit Due Date</span>
                  <span className="font-mono font-semibold">{formatDhakaDate(order.payment_due_date)}</span>
                </div>
              )}

              {order.invoice_number && (
                <div className="mt-2 p-2 rounded-lg bg-muted text-[11px] flex justify-between items-center font-mono">
                  <span>Invoice #: {order.invoice_number}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDhakaDate(order.invoiced_at)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Profile Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base font-semibold tracking-tight">Customer</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 pt-0 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-semibold text-foreground">{order.customer_name || "Guest Customer"}</span>
              </div>

              {order.customer_phone && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{formatPhoneDisplay(order.customer_phone)}</span>
                    <div className="flex items-center gap-1">
                      <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        type="button"
                        onClick={async () => {
                          if (order.customer_phone) {
                            try {
                              if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
                                throw new Error("Clipboard API unavailable");
                              }
                              await navigator.clipboard.writeText(order.customer_phone);
                              if (copiedPhoneTimeoutRef.current) {
                                clearTimeout(copiedPhoneTimeoutRef.current);
                              }
                              setCopiedPhone(true);
                              toast.success("Phone number copied to clipboard");
                              copiedPhoneTimeoutRef.current = setTimeout(() => setCopiedPhone(false), 2000);
                            } catch {
                              toast.error("Failed to copy phone number");
                            }
                          }
                        }}
                        className="inline-flex items-center justify-center h-6 px-2 text-[10px] gap-1 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                        title="Copy Phone"
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          {copiedPhone ? (
                            <motion.span
                              key="check"
                              initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                              animate={{ scale: 1, opacity: 1, rotate: 0 }}
                              exit={{ scale: 0.4, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 450, damping: 20 }}
                              className="inline-flex items-center gap-1 text-emerald-600 font-medium"
                            >
                              <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                              <span>Copied</span>
                            </motion.span>
                          ) : (
                            <motion.span
                              key="copy"
                              initial={{ scale: 0.4, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.4, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="inline-flex items-center gap-1"
                            >
                              <Copy className="h-2.5 w-2.5" />
                              <span>Copy</span>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                      <Button asChild size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1">
                        <a href={`tel:${phoneClean}`}>
                          <Phone className="h-2.5 w-2.5" />
                          Call
                        </a>
                      </Button>
                      {waUrl && (
                        <Button asChild size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1 text-emerald-600 border-emerald-500/30">
                          <a href={waUrl} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-2.5 w-2.5" />
                            WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {order.customer_email && (
                <p className="text-[11px] text-muted-foreground truncate">{order.customer_email}</p>
              )}

              {order.business_id && (
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[11px] flex items-center gap-1.5 mt-2">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span>B2B Corporate Account Order</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping Address Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base font-semibold tracking-tight">Delivery Address</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 pt-0 space-y-1 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground">
                    {order.shipping_address?.recipient_name || order.customer_name}
                  </p>
                  <p className="text-muted-foreground">
                    {order.shipping_address?.address_line}
                  </p>
                  <p className="text-muted-foreground font-medium">
                    {[order.shipping_address?.upazila, order.shipping_address?.district, order.shipping_address?.division]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {order.shipping_address?.landmark && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Landmark: {order.shipping_address.landmark}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attribution & Channel Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base font-semibold tracking-tight">Channel & Campaign</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 pt-0 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Channel:</span>
                <span className="font-semibold text-foreground uppercase">{order.channel || "Web"}</span>
              </div>
              {order.attribution?.utm_source && (
                <div className="flex justify-between">
                  <span>Source:</span>
                  <span className="font-mono text-foreground">{order.attribution.utm_source}</span>
                </div>
              )}
              {order.attribution?.utm_campaign && (
                <div className="flex justify-between">
                  <span>Campaign:</span>
                  <span className="font-mono text-foreground">{order.attribution.utm_campaign}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog Modals */}
      <ShipDialog
        open={shipOpen}
        onOpenChange={setShipOpen}
        orderId={order.id}
        orderNumber={order.order_number}
        orderItems={order.order_items || []}
        availableLots={availableLots}
        warehouses={warehouses}
      />

      <RecordPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        orderId={order.id}
        orderNumber={order.order_number}
        balanceDue={balanceDue}
      />

      <RecordRefundDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        orderId={order.id}
        orderNumber={order.order_number}
        amountPaid={amountPaid}
      />

      <ConfirmReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel Order ${order.order_number}?`}
        description="Cancelling an order cannot be undone. Any stock reservations will be returned to inventory."
        confirmLabel="Cancel Order"
        variant="destructive"
        presetReasons={ORDER_CANCELLATION_REASONS}
        onConfirm={handleCancel}
      />
    </div>
  );
}
