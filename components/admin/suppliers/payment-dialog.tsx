"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
  HubPayment,
  HubPurchase,
  HubSupplier,
  saveSupplierPaymentAction,
} from "@/actions/supplier-ops";
import { formatBDT } from "@/lib/admin-format";
import { SUPPLIER_PAYMENT_METHODS } from "@/lib/supplier-ledger";
import { Database } from "@/types/database.types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: HubSupplier[];
  purchases: HubPurchase[];
  defaultSupplierId?: string;
  defaultPurchaseId?: string;
  defaultAmount?: number;
  payment?: HubPayment | null;
  onSuccess?: () => void;
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

export function PaymentDialog({
  open,
  onOpenChange,
  suppliers,
  purchases,
  defaultSupplierId,
  defaultPurchaseId,
  defaultAmount,
  payment,
  onSuccess,
}: PaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-[480px] max-h-[90dvh] overflow-y-auto">
        {open && (
          <PaymentFormBody
            key={payment?.id ?? `new-${defaultSupplierId ?? "any"}-${defaultPurchaseId ?? "none"}`}
            suppliers={suppliers}
            purchases={purchases}
            defaultSupplierId={defaultSupplierId}
            defaultPurchaseId={defaultPurchaseId}
            defaultAmount={defaultAmount}
            payment={payment}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaymentFormBody({
  suppliers,
  purchases,
  defaultSupplierId,
  defaultPurchaseId,
  defaultAmount,
  payment,
  onClose,
  onSuccess,
}: Omit<PaymentDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const queryClient = useQueryClient();

  const [supplierId, setSupplierId] = React.useState(
    payment?.supplierId ||
      defaultSupplierId ||
      suppliers.find((s) => s.isActive)?.id ||
      suppliers[0]?.id ||
      ""
  );
  const [purchaseId, setPurchaseId] = React.useState(
    payment?.purchaseId || defaultPurchaseId || "__none__"
  );
  const [paymentDate, setPaymentDate] = React.useState(
    payment?.paymentDate || todayDhakaIso()
  );
  const [amount, setAmount] = React.useState(
    payment
      ? String(payment.amount)
      : defaultAmount && defaultAmount > 0
        ? String(defaultAmount)
        : ""
  );
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(
    payment?.paymentMethod || "cash"
  );
  const [reference, setReference] = React.useState(payment?.reference ?? "");
  const [notes, setNotes] = React.useState(payment?.notes ?? "");

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const supplierPurchases = React.useMemo(
    () =>
      purchases.filter(
        (p) =>
          p.supplierId === supplierId &&
          p.status === "active" &&
          (p.settlementStatus === "active" || p.id === purchaseId || p.id === payment?.purchaseId)
      ),
    [purchases, supplierId, purchaseId, payment?.purchaseId]
  );
  const selectedPurchase = supplierPurchases.find((p) => p.id === purchaseId);

  const saveMutation = useMutation({
    mutationFn: async (amt: number) => {
      const res = await saveSupplierPaymentAction({
        id: payment?.id,
        supplierId,
        purchaseId: purchaseId && purchaseId !== "__none__" ? purchaseId : null,
        paymentDate,
        amount: amt,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        throw new Error(res.message || "Could not record payment.");
      }
      return res;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "supplier-hub"] });
      toast.success(payment ? "Payment updated." : "Cash payment recorded.");
      onClose();
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not record payment.");
    },
  });

  const isPending = saveMutation.isPending;

  const handleSubmit = () => {
    if (!supplierId) {
      toast.error("Select a supplier.");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a cash payment amount greater than zero.");
      return;
    }
    saveMutation.mutate(amt);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {payment ? `Edit Payment ${payment.paymentNumber}` : "Record Cash Payment"}
        </DialogTitle>
        <DialogDescription className="text-xs">
          Record a cash payout, partial installment, or advance paid to a supplier.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3.5 py-2 text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">
              Supplier / Gachi <span className="text-destructive">*</span>
            </Label>
            {selectedSupplier && (
              <span
                className={`text-[11px] font-mono tabular-nums font-medium ${
                  selectedSupplier.netBalance > 0
                    ? "text-rose-700 dark:text-rose-400"
                    : selectedSupplier.netBalance < 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground"
                }`}
              >
                {selectedSupplier.netBalance > 0
                  ? `Due: ${formatBDT(selectedSupplier.netBalance)}`
                  : selectedSupplier.netBalance < 0
                    ? `Advance: ${formatBDT(Math.abs(selectedSupplier.netBalance))}`
                    : "Settled"}
              </span>
            )}
          </div>
          <Select
            value={supplierId}
            onValueChange={(v) => {
              setSupplierId(v ?? "");
              setPurchaseId("__none__");
            }}
          >
            <SelectTrigger className="h-9 w-full min-w-0 text-xs">
              <SelectValue placeholder="Choose supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="pay-amount" className="text-xs">
                Amount (৳ BDT) <span className="text-destructive">*</span>
              </Label>
              {!payment && selectedPurchase && selectedPurchase.remainingDue > 0 ? (
                <button
                  type="button"
                  onClick={() => setAmount(String(selectedPurchase.remainingDue))}
                  className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Purchase Due ({formatBDT(selectedPurchase.remainingDue)})
                </button>
              ) : (
                selectedSupplier &&
                selectedSupplier.netBalance > 0 &&
                !payment && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(selectedSupplier.netBalance))}
                    className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Full Due
                  </button>
                )
              )}
            </div>
            <Input
              id="pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 text-xs font-mono tabular-nums"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pay-date" className="text-xs">
              Payment Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pay-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="h-9 text-xs font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod((v as PaymentMethod) || "cash")}
            >
              <SelectTrigger className="h-9 w-full min-w-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPLIER_PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Against Purchase (Optional)</Label>
            <Select
              value={purchaseId}
              onValueChange={(v) => {
                const nextId = v || "__none__";
                setPurchaseId(nextId);
                if (!payment && nextId !== "__none__" && !amount.trim()) {
                  const chosen = supplierPurchases.find((p) => p.id === nextId);
                  if (chosen && chosen.remainingDue > 0) {
                    setAmount(String(chosen.remainingDue));
                  }
                }
              }}
            >
              <SelectTrigger className="h-9 w-full min-w-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs">
                  General / Advance (against running balance)
                </SelectItem>
                {supplierPurchases.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.purchaseNumber} · {p.purchaseDate} ·{" "}
                    {p.remainingDue > 0 ? `Due ${formatBDT(p.remainingDue)}` : "Paid"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {paymentMethod !== "cash" && (
          <div className="space-y-1">
            <Label htmlFor="pay-ref" className="text-xs">Transaction / Reference ID</Label>
            <Input
              id="pay-ref"
              placeholder="bKash TrxID or bank slip no."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-9 text-xs font-mono"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="pay-notes" className="text-xs">Notes</Label>
          <Textarea
            id="pay-notes"
            rows={2}
            placeholder="Optional note about this cash payout..."
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
          disabled={isPending || !amount}
          className="bg-emerald-700 hover:bg-emerald-800 text-white"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {payment ? "Save Payment" : "Record Cash Payment"}
        </Button>
      </DialogFooter>
    </>
  );
}
