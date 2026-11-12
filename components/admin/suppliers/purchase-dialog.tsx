"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Scale, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CatalogProductOption,
  HubPurchase,
  HubSupplier,
  saveSupplierPurchaseAction,
} from "@/actions/supplier-ops";
import { formatBDT } from "@/lib/admin-format";
import { computePurchaseTotals, roundMoney } from "@/lib/supplier-ledger";

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: HubSupplier[];
  products: CatalogProductOption[];
  defaultSupplierId?: string;
  purchase?: HubPurchase | null;
  onRequestNewSupplier?: () => void;
  onSuccess?: () => void;
}

interface LineState {
  key: string;
  productKey: string;
  productId: string | null;
  itemName: string;
  quantity: string;
  unitPrice: string;
}

function todayDhakaIso(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function emptyLine(seed = 0, products: CatalogProductOption[] = []): LineState {
  const firstProduct = products[0];
  return {
    key: `line-${seed}-${Date.now()}`,
    productKey: firstProduct ? firstProduct.productId : "__custom__",
    productId: firstProduct ? firstProduct.productId : null,
    itemName: firstProduct ? firstProduct.name : "",
    quantity: "",
    unitPrice: "",
  };
}

export function PurchaseDialog({
  open,
  onOpenChange,
  suppliers,
  products,
  defaultSupplierId,
  purchase,
  onRequestNewSupplier,
  onSuccess,
}: PurchaseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-[740px] max-h-[90dvh] overflow-y-auto">
        {open && (
          <PurchaseFormBody
            key={purchase?.id ?? "new"}
            suppliers={suppliers}
            products={products}
            defaultSupplierId={defaultSupplierId}
            purchase={purchase}
            onRequestNewSupplier={onRequestNewSupplier}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PurchaseFormBody({
  suppliers,
  products,
  defaultSupplierId,
  purchase,
  onRequestNewSupplier,
  onClose,
  onSuccess,
}: Omit<PurchaseDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const queryClient = useQueryClient();
  const nextLineSeedRef = React.useRef(1);

  const initialSupplierId =
    purchase?.supplierId ||
    defaultSupplierId ||
    suppliers.find((s) => s.isActive)?.id ||
    suppliers[0]?.id ||
    "";

  const [supplierId, setSupplierId] = React.useState(initialSupplierId);
  const [prevDefaultSupplierId, setPrevDefaultSupplierId] = React.useState(defaultSupplierId);
  if (defaultSupplierId && defaultSupplierId !== prevDefaultSupplierId) {
    setPrevDefaultSupplierId(defaultSupplierId);
    if (!purchase) setSupplierId(defaultSupplierId);
  }

  const [purchaseDate, setPurchaseDate] = React.useState(
    purchase?.purchaseDate || todayDhakaIso()
  );
  const [lines, setLines] = React.useState<LineState[]>(() =>
    purchase && purchase.items.length > 0
      ? purchase.items.map((it) => {
          const matched = it.productId
            ? products.find((p) => p.productId === it.productId)
            : undefined;
          return {
            key: it.id,
            productKey: matched ? matched.productId : "__custom__",
            productId: matched ? matched.productId : null,
            itemName: it.itemName,
            quantity: String(it.quantity),
            unitPrice: String(it.unitPrice),
          };
        })
      : [emptyLine(0, products)]
  );
  const [extraCharges, setExtraCharges] = React.useState(String(purchase?.extraCharges ?? 0));
  const [discountAmount, setDiscountAmount] = React.useState(
    String(purchase?.discountAmount ?? 0)
  );
  const [notes, setNotes] = React.useState(purchase?.notes ?? "");

  const [paidNowAmount, setPaidNowAmount] = React.useState("");

  const totalWeightKg = React.useMemo(
    () =>
      roundMoney(
        lines.reduce((sum, l) => sum + Math.max(0, Number(l.quantity) || 0), 0)
      ),
    [lines]
  );

  const totals = React.useMemo(
    () =>
      computePurchaseTotals(
        lines.map((l) => ({
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
        })),
        Number(extraCharges) || 0,
        Number(discountAmount) || 0
      ),
    [lines, extraCharges, discountAmount]
  );

  const updateLine = (key: string, patch: Partial<LineState>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const handleProductChange = (key: string, val: string) => {
    if (!val || val === "__custom__") {
      updateLine(key, {
        productKey: "__custom__",
        productId: null,
        itemName: "",
      });
      return;
    }
    const found = products.find((p) => p.productId === val);
    if (found) {
      updateLine(key, {
        productKey: found.productId,
        productId: found.productId,
        itemName: found.name,
      });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (
      prepared: Array<{
        productId: string | null;
        itemName: string;
        quantity: number;
        unitPrice: number;
      }>
    ) => {
      const res = await saveSupplierPurchaseAction({
        id: purchase?.id,
        supplierId,
        purchaseDate,
        extraCharges: Number(extraCharges || 0),
        discountAmount: Number(discountAmount || 0),
        notes: notes.trim() || undefined,
        items: prepared,
        paidNowAmount: !purchase && paidNowAmount ? Number(paidNowAmount) : undefined,
      });

      if (!res.ok) {
        throw new Error(res.message || "Could not save purchase.");
      }
      return res;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "supplier-hub"] });
      toast.success(purchase ? "Purchase updated." : "Purchase recorded.");
      onClose();
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not save purchase.");
    },
  });

  const isPending = saveMutation.isPending;

  const handleSubmit = () => {
    if (!supplierId) {
      toast.error("Select a supplier first.");
      return;
    }
    if (!totals.isDiscountValid) {
      toast.error("Discount cannot exceed subtotal plus extra charges.");
      return;
    }

    const prepared = lines.map((l) => ({
      productId: l.productId,
      itemName: l.itemName.trim(),
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
    }));

    if (
      prepared.some(
        (l) => !l.itemName || !l.quantity || l.quantity <= 0 || isNaN(l.unitPrice) || l.unitPrice < 0
      )
    ) {
      toast.error("Complete every row with product name, positive weight (kg), and rate.");
      return;
    }

    saveMutation.mutate(prepared);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {purchase ? `Edit Purchase ${purchase.purchaseNumber}` : "Record Supplier Purchase"}
        </DialogTitle>
        <DialogDescription className="text-xs">
          Log supplier deliveries by product and weight in kilograms (kg), with optional immediate cash payout.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Supplier / Gachi <span className="text-destructive">*</span>
              </Label>
              {!purchase && onRequestNewSupplier && (
                <button
                  type="button"
                  onClick={onRequestNewSupplier}
                  className="text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  + Quick add supplier
                </button>
              )}
            </div>
            <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
              <SelectTrigger className="h-9 w-full min-w-0 text-xs">
                <SelectValue placeholder="Choose supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} {!s.isActive && "(Inactive)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pur-date" className="text-xs">
              Purchase Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pur-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="h-9 text-xs font-mono"
            />
          </div>
        </div>

        {/* Weighbridge / Product Lines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Products (Weight in kg)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const seed = nextLineSeedRef.current++;
                setLines((prev) => [...prev, emptyLine(seed, products)]);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Product
            </Button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <div className="divide-y divide-border/70">
              {lines.map((line, index) => {
                const lineTotal = roundMoney(
                  (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)
                );
                const isCustom = line.productKey === "__custom__";

                return (
                  <div key={line.key} className="p-3 space-y-2.5">
                    {/* Full-width Product selector */}
                    <div className="space-y-1.5 min-w-0">
                      <Label className="text-[11px] text-muted-foreground">
                        Product #{index + 1} <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={line.productKey}
                        onValueChange={(val) =>
                          handleProductChange(line.key, val ?? "__custom__")
                        }
                      >
                        <SelectTrigger
                          className="h-9 w-full min-w-0 text-xs bg-background"
                          aria-label={`Select product for row ${index + 1}`}
                        >
                          <SelectValue placeholder="Choose product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem
                              key={p.productId}
                              value={p.productId}
                              className="text-xs"
                            >
                              {p.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__" className="text-xs">
                            Custom / Unlisted Product
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {isCustom && (
                        <Input
                          placeholder="Enter product name (e.g. Raw Patali Gur)"
                          value={line.itemName}
                          onChange={(e) =>
                            updateLine(line.key, { itemName: e.target.value })
                          }
                          aria-label={`Custom product name for row ${index + 1}`}
                          className="h-8 w-full text-xs bg-background"
                        />
                      )}
                    </div>

                    {/* Weight (kg), Rate (৳/kg), Amount, Remove */}
                    <div className="grid grid-cols-12 gap-2.5 items-end">
                      <div className="col-span-5 sm:col-span-4 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Weight (kg) <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0.001"
                            step="any"
                            placeholder="0"
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(line.key, { quantity: e.target.value })
                            }
                            aria-label={`Weight in kg for row ${index + 1}`}
                            className="h-8 pr-8 text-right text-xs bg-background font-mono tabular-nums"
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] font-medium text-muted-foreground">
                            kg
                          </span>
                        </div>
                      </div>

                      <div className="col-span-7 sm:col-span-4 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Rate (৳/kg) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={line.unitPrice}
                          onChange={(e) =>
                            updateLine(line.key, { unitPrice: e.target.value })
                          }
                          aria-label={`Price per kg for row ${index + 1}`}
                          className="h-8 text-right text-xs bg-background font-mono tabular-nums"
                        />
                      </div>

                      <div className="col-span-10 sm:col-span-3 space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Amount
                        </Label>
                        <div className="h-8 flex items-center justify-end px-2.5 rounded-md border bg-muted/25 font-mono tabular-nums font-semibold text-foreground">
                          {formatBDT(lineTotal, { decimals: lineTotal % 1 !== 0 ? 2 : 0 })}
                        </div>
                      </div>

                      <div className="col-span-2 sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={lines.length === 1}
                          onClick={() =>
                            setLines((prev) => prev.filter((l) => l.key !== line.key))
                          }
                          aria-label={`Remove row ${index + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Weight & Subtotal footer bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/25 px-3 py-2 text-xs">
              <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Scale className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                <span>Total weight:</span>
                <strong className="font-mono tabular-nums text-foreground">
                  {totalWeightKg} kg
                </strong>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span>Items subtotal:</span>
                <strong className="font-mono tabular-nums text-foreground">
                  {formatBDT(totals.subtotal, { decimals: totals.subtotal % 1 !== 0 ? 2 : 0 })}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Adjustments & Payable Total */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 rounded-lg border bg-muted/15 p-3">
          <div className="space-y-1">
            <Label htmlFor="pur-extra" className="text-xs">
              Extra / Transport (৳)
            </Label>
            <Input
              id="pur-extra"
              type="number"
              min="0"
              step="0.01"
              value={extraCharges}
              onChange={(e) => setExtraCharges(e.target.value)}
              className="h-8 text-xs font-mono tabular-nums bg-background"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pur-discount" className="text-xs">
              Discount (৳)
            </Label>
            <Input
              id="pur-discount"
              type="number"
              min="0"
              step="0.01"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="h-8 text-xs font-mono tabular-nums bg-background"
            />
          </div>

          <div className="col-span-2 sm:col-span-1 space-y-1">
            <Label className="text-xs">Total Payable</Label>
            <div className="h-8 flex items-center justify-between px-2.5 rounded-md border border-amber-700/30 bg-amber-500/10 font-mono tabular-nums font-bold text-sm text-amber-900 dark:text-amber-300">
              <span>Total</span>
              <span>
                {formatBDT(totals.totalAmount, { decimals: totals.totalAmount % 1 !== 0 ? 2 : 0 })}
              </span>
            </div>
            {!totals.isDiscountValid && (
              <p className="text-[11px] text-destructive">Discount exceeds total.</p>
            )}
          </div>
        </div>

        {!purchase && (
          <div className="space-y-1 rounded-lg border border-emerald-600/20 bg-emerald-500/5 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="pur-paid-now" className="text-xs">
                Cash Paid Now (৳, Optional)
              </Label>
              {totals.totalAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setPaidNowAmount(String(totals.totalAmount))}
                  className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Pay Full ({formatBDT(totals.totalAmount)})
                </button>
              )}
            </div>
            <Input
              id="pur-paid-now"
              type="number"
              min="0"
              step="0.01"
              placeholder="0 (leave blank if unpaid / on credit)"
              value={paidNowAmount}
              onChange={(e) => setPaidNowAmount(e.target.value)}
              className="h-8 text-xs font-mono tabular-nums bg-background"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="pur-notes" className="text-xs">
            Notes / মন্তব্য
          </Label>
          <Textarea
            id="pur-notes"
            rows={2}
            placeholder="Delivery vehicle, quality notes, or verbal agreement..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-xs resize-none"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={isPending || !totals.isDiscountValid}
          className="bg-amber-700 hover:bg-amber-800 text-white"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {purchase ? "Save Changes" : "Record Purchase"}
        </Button>
      </DialogFooter>
    </>
  );
}
