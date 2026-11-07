"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, Loader2, PackageCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { receiveStockAction } from "@/actions/inventory-ops";
import { InventoryItem, BatchItem, WarehouseItem } from "@/actions/inventory";

interface ReceiveStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: InventoryItem[];
  batches: BatchItem[];
  warehouses: WarehouseItem[];
  defaultVariantId?: string;
  defaultWarehouseId?: string;
  onSuccess?: () => void;
}

export function ReceiveStockDialog({
  open,
  onOpenChange,
  inventory,
  batches,
  warehouses,
  defaultVariantId,
  defaultWarehouseId,
  onSuccess,
}: ReceiveStockDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [variantId, setVariantId] = React.useState<string>("");
  const [warehouseId, setWarehouseId] = React.useState<string>("");
  const [batchId, setBatchId] = React.useState<string>("");
  const [quantity, setQuantity] = React.useState<string>("");
  const [unitCost, setUnitCost] = React.useState<string>("");
  const [note, setNote] = React.useState<string>("");

  React.useEffect(() => {
    if (open) {
      setVariantId(defaultVariantId || (inventory[0]?.variantId ?? ""));
      setWarehouseId(defaultWarehouseId || (warehouses[0]?.id ?? ""));
      setBatchId("");
      setQuantity("");
      setUnitCost("");
      setNote("");
    }
  }, [open, defaultVariantId, defaultWarehouseId, inventory, warehouses]);

  const selectedItem = inventory.find((i) => i.variantId === variantId);

  const handleReceive = () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      toast.error("Please enter a valid quantity greater than zero.");
      return;
    }
    if (!variantId) {
      toast.error("Please select a variant.");
      return;
    }
    if (!warehouseId) {
      toast.error("Please select a destination warehouse.");
      return;
    }

    startTransition(async () => {
      const res = await receiveStockAction({
        variantId,
        warehouseId,
        batchId: batchId || null,
        quantity: qty,
        unitCost: unitCost ? Number(unitCost) : null,
        note: note.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(`Successfully received ${qty} ${selectedItem?.uom || "units"} into stock.`);
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Receive Stock / স্টক গ্রহণ</DialogTitle>
              <DialogDescription className="text-xs">
                Record new production intake or purchase goods into the inventory ledger.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="space-y-1">
            <Label className="text-xs">Product Variant / পণ্য ভ্যারিয়েন্ট</Label>
            <Select value={variantId} onValueChange={(val) => setVariantId(val ?? "")}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select variant" />
              </SelectTrigger>
              <SelectContent>
                {inventory.map((item) => (
                  <SelectItem key={item.id} value={item.variantId} className="text-xs">
                    {item.variant} ({item.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Destination Warehouse / গুদাম</Label>
              <Select value={warehouseId} onValueChange={(val) => setWarehouseId(val ?? "")}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id} className="text-xs">
                      {w.name} {w.isDefault && "(Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Production Lot / ব্যাচ (Optional)</Label>
              <Select value={batchId} onValueChange={(val) => setBatchId(val ?? "")}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose Lot / ব্যাচ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">No specific lot</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.batchNo} ({b.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                Quantity / পরিমাণ {selectedItem?.uom && `(${selectedItem.uom})`}
              </Label>
              <Input
                type="number"
                min="0.01"
                step="any"
                placeholder="e.g. 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Unit Cost / একক মূল্য (৳ BDT)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 320"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Note / মন্তব্য</Label>
            <Textarea
              placeholder="e.g. Sugar mill shipment #42 delivered in good condition"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleReceive}
            disabled={isPending || !quantity}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <PackageCheck className="size-3.5" />}
            Confirm Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
