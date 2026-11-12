"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ShoppingCart,
  Phone,
  MessageCircle,
  ArrowRight,
  MessageSquarePlus,
  Trash2,
  Clock,
  MapPin,
  Search,
  Download,
  Loader2,
  AlertCircle,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  IncompleteOrderRecord,
  convertIncompleteToPendingAction,
  addIncompleteOrderNoteAction,
  deleteIncompleteOrderAction,
  getIncompleteOrdersAction,
} from "@/actions/incomplete-ops";
import { formatBDT, normalizeBDPhone } from "@/lib/admin-format";
import { exportToCSV } from "@/lib/csv-export";

interface IncompleteViewProps {
  initialOrders: IncompleteOrderRecord[];
}

export function IncompleteView({ initialOrders }: IncompleteViewProps) {
  const [orders, setOrders] = useState<IncompleteOrderRecord[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // Dialogs
  const [selectedOrder, setSelectedOrder] = useState<IncompleteOrderRecord | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleRefresh = async () => {
    const res = await getIncompleteOrdersAction();
    if (res.ok) {
      setOrders(res.data);
    }
  };

  const handleConvert = (order: IncompleteOrderRecord) => {
    startTransition(async () => {
      const res = await convertIncompleteToPendingAction(order.id);
      if (!res.ok) {
        toast.error(res.message || "Failed to convert draft to active order");
        return;
      }

      toast.success(`Draft order #${order.orderNumber || order.id.slice(0, 8)} converted to pending order!`);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    });
  };

  const handleSaveNote = () => {
    if (!selectedOrder || !noteText.trim()) return;

    startTransition(async () => {
      const res = await addIncompleteOrderNoteAction(selectedOrder.id, noteText);
      if (!res.ok) {
        toast.error(res.message || "Failed to add note");
        return;
      }

      toast.success("Internal note added to order.");
      setNoteOpen(false);
      setNoteText("");
      setSelectedOrder(null);
    });
  };

  const handleDelete = () => {
    if (!selectedOrder) return;

    startTransition(async () => {
      const res = await deleteIncompleteOrderAction(selectedOrder.id);
      if (!res.ok) {
        toast.error(res.message || "Failed to delete draft checkout");
        return;
      }

      toast.success("Draft checkout deleted.");
      setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id));
      setDeleteOpen(false);
      setSelectedOrder(null);
    });
  };

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
      (o.customerPhone && o.customerPhone.includes(q)) ||
      (o.districtName && o.districtName.toLowerCase().includes(q)) ||
      (o.itemsSummary && o.itemsSummary.toLowerCase().includes(q))
    );
  });

  const handleExportCSV = () => {
    exportToCSV(
      filteredOrders.map((o) => ({
        "Order Number": o.orderNumber || o.id.slice(0, 8),
        Customer: o.customerName || "Guest",
        Phone: o.customerPhone || "N/A",
        District: o.districtName || "N/A",
        "Age (Hours)": o.ageHours,
        "Total (BDT)": o.totalAmount,
        Items: o.itemsSummary || "",
        "UTM Source": o.utmSource || "",
        "UTM Campaign": o.utmCampaign || "",
      })),
      `abandoned-checkouts-${new Date().toISOString().split("T")[0]}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingCart className="size-6 text-amber-500" />
            Incomplete Checkouts / অসম্পূর্ণ চেকআউট
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Recover abandoned customer checkouts with 1-tap phone and WhatsApp outreach, or convert to confirmed orders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs h-8 gap-1"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground">Abandoned Drafts</div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-amber-600 dark:text-amber-400">
            {orders.length}
          </div>
          <span className="text-[10px] text-muted-foreground">Checkouts not finalized</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground">Pipeline Value</div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-foreground">
            {formatBDT(orders.reduce((sum, o) => sum + o.totalAmount, 0))}
          </div>
          <span className="text-[10px] text-muted-foreground">Potential recoverable revenue</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground">With Valid Phone</div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-emerald-600 dark:text-emerald-400">
            {orders.filter((o) => Boolean(o.customerPhone)).length}
          </div>
          <span className="text-[10px] text-muted-foreground">Directly reachable callers</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground">Average Age</div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-muted-foreground">
            {orders.length > 0
              ? `${Math.round(orders.reduce((sum, o) => sum + o.ageHours, 0) / orders.length)}h`
              : "0h"}
          </div>
          <span className="text-[10px] text-muted-foreground">Hours since abandonment</span>
        </Card>
      </div>

      {/* Search and filters */}
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div className="relative w-64 sm:w-80">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by phone, name, district, item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Drafts Cards / List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            <ShoppingCart className="size-8 mx-auto text-muted-foreground/40 mb-2" />
            <div className="text-sm font-semibold">No incomplete checkouts found</div>
            <div className="text-xs text-muted-foreground mt-1">
              All started checkouts have been completed or converted into orders.
            </div>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const rawPhone = order.customerPhone || "";
            const normalizedPhone = rawPhone ? normalizeBDPhone(rawPhone) : "";
            const cleanDigits = rawPhone.replace(/[^0-9]/g, "");
            const waNumber = cleanDigits.startsWith("880")
              ? cleanDigits
              : cleanDigits.startsWith("0")
              ? `88${cleanDigits}`
              : `880${cleanDigits}`;

            const waText = encodeURIComponent(
              `আসসালামু আলাইকুম ${order.customerName ? order.customerName + " সাহেব" : ""}, খাটি আখের গুড় / লালি গুড়ের অর্ডারে কোনো সহায়তার প্রয়োজন আছে কি? আপনার কার্টের বিবরণ: ${order.itemsSummary || "গুড় পণ্য"}`
            );

            return (
              <div
                key={order.id}
                className="rounded-xl border bg-card p-4 shadow-xs hover:border-primary/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Customer & Age Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs bg-muted px-2 py-0.5 rounded-xs">
                      #{order.orderNumber || order.id.slice(0, 8)}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 gap-1 px-1.5 py-0">
                      <Clock className="size-2.5" />
                      {order.ageHours}h ago
                    </Badge>
                    {order.utmSource && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {order.utmSource} {order.utmCampaign && `· ${order.utmCampaign}`}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-foreground">
                      {order.customerName || "Anonymous Customer"}
                    </span>
                    {normalizedPhone ? (
                      <span className="font-mono text-muted-foreground">{normalizedPhone}</span>
                    ) : (
                      <span className="text-muted-foreground italic text-[11px]">No phone entered</span>
                    )}
                    {order.districtName && (
                      <span className="flex items-center gap-0.5 text-muted-foreground text-[11px]">
                        <MapPin className="size-3 text-muted-foreground/60" />
                        {order.districtName}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                    <Package className="size-3 text-muted-foreground/60 shrink-0" />
                    <span className="truncate">{order.itemsSummary || "Cart contents pending"}</span>
                  </div>
                </div>

                {/* Center: Total */}
                <div className="text-left md:text-right md:px-4">
                  <div className="text-base font-bold font-mono text-foreground">
                    {formatBDT(order.totalAmount)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                  </div>
                </div>

                {/* Right: Quick Outreach & Convert Action Bar */}
                <div className="flex items-center gap-2 flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                  {/* One-tap Phone Call */}
                  {normalizedPhone && (
                    <a
                      href={`tel:${normalizedPhone}`}
                      className="inline-flex items-center justify-center size-8 rounded-lg border bg-background hover:bg-muted text-foreground transition-colors"
                      title="Direct Phone Call"
                    >
                      <Phone className="size-3.5 text-emerald-600" />
                    </a>
                  )}

                  {/* One-tap WhatsApp */}
                  {normalizedPhone && (
                    <a
                      href={`https://wa.me/${waNumber}?text=${waText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center size-8 rounded-lg border bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                      title="Direct WhatsApp Message"
                    >
                      <MessageCircle className="size-3.5" />
                    </a>
                  )}

                  {/* Add Note */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedOrder(order);
                      setNoteText("");
                      setNoteOpen(true);
                    }}
                    className="h-8 text-xs gap-1"
                    title="Add staff note"
                  >
                    <MessageSquarePlus className="size-3" />
                    Note
                  </Button>

                  {/* Convert to Order */}
                  <Button
                    size="sm"
                    onClick={() => handleConvert(order)}
                    disabled={isPending}
                    className="h-8 text-xs bg-primary text-primary-foreground gap-1.5 shadow-xs"
                  >
                    <ArrowRight className="size-3.5" />
                    Convert to Order
                  </Button>

                  {/* Delete Draft */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setSelectedOrder(order);
                      setDeleteOpen(true);
                    }}
                    className="size-8 text-destructive hover:bg-destructive/10"
                    title="Discard incomplete draft"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add Internal Staff Note</DialogTitle>
            <DialogDescription className="text-xs">
              Log customer outreach notes or follow-up details.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Label className="text-xs">Note</Label>
            <Textarea
              placeholder="e.g. Called customer at 3 PM; customer requested 2kg jar instead of 1kg. Will place order tomorrow."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNoteOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveNote}
              disabled={isPending || !noteText.trim()}
              className="text-xs"
            >
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Draft Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Discard Abandoned Checkout?</DialogTitle>
                <DialogDescription className="text-xs">
                  This will remove the draft checkout record permanently.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              className="text-xs"
            >
              Keep Draft
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs"
            >
              Discard Checkout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
