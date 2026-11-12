"use client";

import * as React from "react";
import { toast } from "sonner";
import { Truck, Plus, Trash2, Loader2, PackageCheck } from "lucide-react";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createShipmentAction, CreateShipmentLine } from "@/actions/shipment-ops";
import { formatUOM } from "@/lib/admin-format";

interface ShipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  orderItems: Array<{
    id: string;
    product_id: string;
    product_name: string;
    sku: string;
    quantity: number;
    shipped_quantity: number;
    net_unit?: string;
  }>;
  availableLots: Array<{
    batch_id: string;
    lot_code: string;
    product_id: string;
    product_name: string;
    batch_status: string;
    remaining_quantity: number;
    best_before?: string;
  }>;
  warehouses: Array<{
    id: string;
    name: string;
    is_default: boolean;
  }>;
}

export function ShipDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  orderItems,
  availableLots,
  warehouses,
}: ShipDialogProps) {
  const [carrier, setCarrier] = React.useState("Steadfast Courier");
  const [trackingNumber, setTrackingNumber] = React.useState("");
  const defaultWh = warehouses.find((w) => w.is_default) || warehouses[0];
  const [warehouseId, setWarehouseId] = React.useState(defaultWh?.id || "");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Unshipped items with lot allocations
  // Each order item can have multiple lines (to split across lots)
  const [allocations, setAllocations] = React.useState<
    Array<{
      orderItemId: string;
      productName: string;
      sku: string;
      unshippedQty: number;
      batchId: string;
      shipQty: number;
    }>
  >([]);

  React.useEffect(() => {
    if (open) {
      setTrackingNumber("");
      const initial: typeof allocations = [];

      for (const it of orderItems) {
        const unshipped = it.quantity - (it.shipped_quantity || 0);
        if (unshipped > 0) {
          // Find first matching released lot for this product
          const matchingLot = availableLots.find(
            (l) => l.product_id === it.product_id && l.batch_status === "released" && l.remaining_quantity > 0
          );

          initial.push({
            orderItemId: it.id,
            productName: it.product_name,
            sku: it.sku,
            unshippedQty: unshipped,
            batchId: matchingLot ? matchingLot.batch_id : "",
            shipQty: unshipped,
          });
        }
      }
      setAllocations(initial);
    }
  }, [open, orderItems, availableLots]);

  const handleUpdateLine = (index: number, fields: Partial<(typeof allocations)[0]>) => {
    setAllocations((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...fields };
      return next;
    });
  };

  const handleSplitLine = (index: number) => {
    setAllocations((prev) => {
      const line = prev[index];
      const half = Math.max(1, Math.floor(line.shipQty / 2));
      const remaining = line.shipQty - half;

      const next = [...prev];
      next[index] = { ...line, shipQty: half };
      next.splice(index + 1, 0, {
        ...line,
        batchId: "",
        shipQty: remaining,
      });
      return next;
    });
  };

  const handleRemoveSplit = (index: number) => {
    setAllocations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const linesToShip: CreateShipmentLine[] = allocations
      .filter((a) => a.shipQty > 0)
      .map((a) => ({
        orderItemId: a.orderItemId,
        batchId: a.batchId,
        quantity: a.shipQty,
      }));

    if (linesToShip.length === 0) {
      toast.error("Please specify a quantity to ship.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createShipmentAction({
        orderId,
        warehouseId,
        carrier,
        trackingNumber: trackingNumber.trim() || undefined,
        lines: linesToShip,
      });

      if (res.ok) {
        toast.success("Shipment recorded! Stock movements updated and lot deducted.");
        onOpenChange(false);
      } else {
        toast.error(res.message || "Failed to create shipment");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-foreground">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Ship Order {orderNumber}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Allocate released lots and create a carrier shipment with lot traceability.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Warehouse and Carrier Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dispatch Warehouse</Label>
              <Select value={warehouseId} onValueChange={(val) => setWarehouseId(val ?? "")}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id} className="text-xs">
                      {w.name} {w.is_default && "(Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Carrier / কুরিয়ার</Label>
              <Select value={carrier} onValueChange={(val) => setCarrier(val ?? "")}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Steadfast Courier" className="text-xs">Steadfast Courier</SelectItem>
                  <SelectItem value="Sundarban Courier" className="text-xs">Sundarban Courier</SelectItem>
                  <SelectItem value="SA Paribahan" className="text-xs">SA Paribahan</SelectItem>
                  <SelectItem value="Pathao Courier" className="text-xs">Pathao Courier</SelectItem>
                  <SelectItem value="RedX" className="text-xs">RedX</SelectItem>
                  <SelectItem value="In-house / Storefront Staff" className="text-xs">In-house Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Consignment / Tracking #</Label>
              <Input
                placeholder="e.g. ST-2026-98124"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Line Items & Lot Allocation Table */}
          <div className="space-y-2 border border-border/80 rounded-xl p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider">
                Line Items & Lot Allocation
              </span>
              <span className="text-[11px] text-muted-foreground">
                Only released, unexpired lots are eligible
              </span>
            </div>

            {allocations.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground text-xs">
                All items in this order have already been shipped.
              </p>
            ) : (
              <div className="space-y-2.5">
                {allocations.map((alloc, idx) => {
                  const matchingLots = availableLots.filter(
                    (l) => l.batch_status === "released" && l.remaining_quantity > 0
                  );

                  return (
                    <div
                      key={`${alloc.orderItemId}-${idx}`}
                      className="p-2.5 rounded-lg border border-border/60 bg-background space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{alloc.productName}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            SKU: {alloc.sku} · Remaining to ship: {alloc.unshippedQty}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] text-amber-600 dark:text-amber-400"
                            onClick={() => handleSplitLine(idx)}
                            title="Split across another lot"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Split Lot
                          </Button>
                          {idx > 0 && allocations[idx - 1]?.orderItemId === alloc.orderItemId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-rose-500 hover:text-rose-600"
                              onClick={() => handleRemoveSplit(idx)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Select Released Lot</Label>
                          <Select
                            value={alloc.batchId}
                            onValueChange={(val) => handleUpdateLine(idx, { batchId: val ?? "" })}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Choose Lot / ব্যাচ" />
                            </SelectTrigger>
                            <SelectContent>
                              {matchingLots.map((lot) => (
                                <SelectItem key={lot.batch_id} value={lot.batch_id} className="text-xs">
                                  {lot.lot_code} (Rem: {lot.remaining_quantity}) {lot.best_before && `· BB: ${lot.best_before}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Qty to Ship</Label>
                          <Input
                            type="number"
                            min={1}
                            max={alloc.unshippedQty}
                            value={alloc.shipQty}
                            onChange={(e) =>
                              handleUpdateLine(idx, { shipQty: Math.max(0, Number(e.target.value)) })
                            }
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            onClick={handleSubmit}
            disabled={isSubmitting || allocations.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Dispatching...
              </>
            ) : (
              <>
                <PackageCheck className="h-3.5 w-3.5" />
                Confirm Dispatch
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
