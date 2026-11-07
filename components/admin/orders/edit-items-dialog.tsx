"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Edit3, Plus, Trash2, Loader2, Check } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setOrderItemsAction } from "@/actions/order-ops";
import { formatBDT } from "@/lib/admin-format";

interface EditItemLine {
  variantId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  priceOverride?: string;
}

interface EditItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  initialItems: {
    variantId?: string | null;
    name: string;
    sku?: string | null;
    unitPrice: number;
    quantity: number;
  }[];
  availableVariants?: {
    id: string;
    title: string;
    sku: string;
    price: number;
    productName: string;
  }[];
  onSuccess?: () => void;
}

export function EditItemsDialog({
  open,
  onOpenChange,
  orderId,
  initialItems,
  availableVariants = [],
  onSuccess,
}: EditItemsDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<EditItemLine[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

  React.useEffect(() => {
    if (open) {
      setLines(
        initialItems.map((item) => ({
          variantId: item.variantId || "",
          name: item.name,
          sku: item.sku || "SKU",
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        }))
      );
      setSelectedVariantId(availableVariants[0]?.id || "");
    }
  }, [open, initialItems, availableVariants]);

  const handleAddVariant = () => {
    const v = availableVariants.find((av) => av.id === selectedVariantId);
    if (!v) return;

    const existingIdx = lines.findIndex((l) => l.variantId === v.id);
    if (existingIdx >= 0) {
      const copy = [...lines];
      copy[existingIdx].quantity += 1;
      setLines(copy);
    } else {
      setLines((prev) => [
        ...prev,
        {
          variantId: v.id,
          name: `${v.productName} - ${v.title}`,
          sku: v.sku,
          unitPrice: v.price,
          quantity: 1,
        },
      ]);
    }
  };

  const handleUpdateLine = (idx: number, updates: Partial<EditItemLine>) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...updates } : l))
    );
  };

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (lines.length === 0) {
      toast.error("Order must have at least one line item.");
      return;
    }

    const priceOverrides: Record<string, number> = {};
    const items = lines.map((l) => {
      if (l.priceOverride && Number(l.priceOverride) > 0) {
        priceOverrides[l.variantId] = Number(l.priceOverride);
      }
      return {
        variant_id: l.variantId,
        quantity: l.quantity,
      };
    });

    startTransition(async () => {
      const res = await setOrderItemsAction(
        orderId,
        items,
        Object.keys(priceOverrides).length > 0 ? priceOverrides : undefined
      );

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success("Order items updated successfully.");
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Edit3 className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Edit Order Items / পণ্য পরিবর্তন</DialogTitle>
              <DialogDescription className="text-xs">
                Modify quantities or negotiate unit price overrides before fulfillment.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Add Variant Bar if catalog available */}
          {availableVariants.length > 0 && (
            <div className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-lg border">
              <div className="flex-1">
                <Select
                  value={selectedVariantId}
                  onValueChange={(val) => setSelectedVariantId(val ?? "")}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Add new product item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVariants.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="text-xs">
                        {v.productName} - {v.title} ({formatBDT(v.price)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddVariant}
                className="h-8 text-xs gap-1"
              >
                <Plus className="size-3.5" />
                Add Item
              </Button>
            </div>
          )}

          {/* Lines Table */}
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-[11px] border-b font-medium text-muted-foreground">
                <tr>
                  <th className="p-2.5">Item</th>
                  <th className="p-2.5 text-right">Standard</th>
                  <th className="p-2.5 text-right">Price Override</th>
                  <th className="p-2.5 text-center">Qty</th>
                  <th className="p-2.5 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((line, idx) => (
                  <tr key={`${line.variantId}-${idx}`}>
                    <td className="p-2.5 font-medium">
                      <div>{line.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{line.sku}</div>
                    </td>
                    <td className="p-2.5 text-right font-mono text-muted-foreground">
                      {formatBDT(line.unitPrice)}
                    </td>
                    <td className="p-2.5 text-right">
                      <Input
                        type="number"
                        placeholder={String(line.unitPrice)}
                        value={line.priceOverride || ""}
                        onChange={(e) => handleUpdateLine(idx, { priceOverride: e.target.value })}
                        className="h-7 w-24 text-right text-xs font-mono ml-auto"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <Input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) =>
                          handleUpdateLine(idx, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="h-7 w-16 text-center text-xs font-mono mx-auto"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveLine(idx)}
                        className="size-6 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            onClick={handleSave}
            disabled={isPending || lines.length === 0}
            className="text-xs gap-1.5"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
