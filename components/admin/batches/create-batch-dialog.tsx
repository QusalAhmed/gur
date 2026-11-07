"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { FlaskConical, Loader2, Plus } from "lucide-react";
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
import { createBatchAction } from "@/actions/batch-ops";

interface CreateBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function CreateBatchDialog({
  open,
  onOpenChange,
  products,
  suppliers,
  onSuccess,
}: CreateBatchDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [lotCode, setLotCode] = React.useState<string>("");
  const [productId, setProductId] = React.useState<string>("");
  const [supplierId, setSupplierId] = React.useState<string>("");
  const [producedOn, setProducedOn] = React.useState<string>("");
  const [bestBefore, setBestBefore] = React.useState<string>("");
  const [brix, setBrix] = React.useState<string>("");
  const [ph, setPh] = React.useState<string>("");
  const [moisturePct, setMoisturePct] = React.useState<string>("");
  const [densityKgPerL, setDensityKgPerL] = React.useState<string>("");
  const [ashPct, setAshPct] = React.useState<string>("");
  const [totalSugarPct, setTotalSugarPct] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  React.useEffect(() => {
    if (open) {
      // Suggest a lot code: LOT-YYMM-01
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      setLotCode(`LOT-${yy}${mm}-${Math.floor(100 + Math.random() * 900)}`);
      setProductId(products[0]?.id || "");
      setSupplierId(suppliers[0]?.id || "");
      setProducedOn(new Date().toISOString().split("T")[0]);
      setBestBefore("");
      setBrix("78.5");
      setPh("5.4");
      setMoisturePct("18.0");
      setDensityKgPerL("1.42");
      setAshPct("2.5");
      setTotalSugarPct("68.0");
      setNotes("");
    }
  }, [open, products, suppliers]);

  const handleCreate = () => {
    const cleanCode = lotCode.trim().toUpperCase();
    if (!/^[A-Z0-9._-]+$/.test(cleanCode)) {
      toast.error("Lot code must only contain uppercase letters, numbers, dots, hyphens, and underscores.");
      return;
    }
    if (!productId) {
      toast.error("Please select a product.");
      return;
    }

    startTransition(async () => {
      const res = await createBatchAction({
        lotCode: cleanCode,
        productId,
        supplierId: supplierId || null,
        producedOn: producedOn || null,
        bestBefore: bestBefore || null,
        status: "quarantine", // Default to quarantine until released
        brix: brix ? Number(brix) : null,
        ph: ph ? Number(ph) : null,
        moisturePct: moisturePct ? Number(moisturePct) : null,
        densityKgPerL: densityKgPerL ? Number(densityKgPerL) : null,
        ashPct: ashPct ? Number(ashPct) : null,
        totalSugarPct: totalSugarPct ? Number(totalSugarPct) : null,
        notes: notes.trim() || null,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(`Lot ${cleanCode} created in quarantine status.`);
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FlaskConical className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Create Production Lot / নতুন ব্যাচ</DialogTitle>
              <DialogDescription className="text-xs">
                Register a new batch with lab specifications. Created in quarantine status until tested and released.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Top row: Code & Product */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                Lot Code / ব্যাচ কোড <span className="text-destructive">*</span>
              </Label>
              <Input
                value={lotCode}
                onChange={(e) => setLotCode(e.target.value.toUpperCase())}
                placeholder="e.g. LOT-2611-001"
                className="h-9 text-xs font-mono font-bold uppercase tracking-wider"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                Product / পণ্য <span className="text-destructive">*</span>
              </Label>
              <Select value={productId} onValueChange={(val) => setProductId(val ?? "")}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Supplier and Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Supplier / মিল সরবরাহকারী</Label>
              <Select value={supplierId} onValueChange={(val) => setSupplierId(val ?? "")}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">In-house / Own Mill</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Produced On / উৎপাদনের তারিখ</Label>
              <Input
                type="date"
                value={producedOn}
                onChange={(e) => setProducedOn(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Best Before / মেয়াদ</Label>
              <Input
                type="date"
                value={bestBefore}
                onChange={(e) => setBestBefore(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Lab Measurements Fieldset */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <FlaskConical className="size-3.5 text-primary" />
                Lab Test Values / ল্যাব মানসমূহ
              </span>
              <span className="text-[10px] text-muted-foreground">Certified specs</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Brix (°Bx)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 78.5"
                  value={brix}
                  onChange={(e) => setBrix(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">pH Level</Label>
                <Input
                  type="number"
                  step="0.05"
                  placeholder="e.g. 5.4"
                  value={ph}
                  onChange={(e) => setPh(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Moisture / আর্দ্রতা (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 18.0"
                  value={moisturePct}
                  onChange={(e) => setMoisturePct(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Density (kg/L)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1.42"
                  value={densityKgPerL}
                  onChange={(e) => setDensityKgPerL(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Sulfated Ash (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 2.5"
                  value={ashPct}
                  onChange={(e) => setAshPct(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Total Sugar / মোট চিনি (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 68.0"
                  value={totalSugarPct}
                  onChange={(e) => setTotalSugarPct(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes & Sensory Observations</Label>
            <Textarea
              placeholder="e.g. Rich dark amber, pleasant aroma, no crystallization observed"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            onClick={handleCreate}
            disabled={isPending || !lotCode.trim() || !productId}
            className="text-xs gap-1.5"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Create Lot in Quarantine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
