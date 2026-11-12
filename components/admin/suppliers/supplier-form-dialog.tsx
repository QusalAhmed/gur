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
import { Checkbox } from "@/components/ui/checkbox";
import { HubSupplier, upsertSupplierAction } from "@/actions/supplier-ops";
import { SUPPLIER_TYPE_LABELS, SupplierType } from "@/lib/supplier-ledger";

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: HubSupplier | null;
  onSuccess?: (supplierId?: string) => void;
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSuccess,
}: SupplierFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-[480px] max-h-[90dvh] overflow-y-auto">
        {open && (
          <SupplierFormBody
            key={supplier?.id ?? "new"}
            supplier={supplier}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SupplierFormBody({
  supplier,
  onClose,
  onSuccess,
}: {
  supplier?: HubSupplier | null;
  onClose: () => void;
  onSuccess?: (supplierId?: string) => void;
}) {
  const queryClient = useQueryClient();

  const [name, setName] = React.useState(supplier?.name ?? "");
  const [supplierType, setSupplierType] = React.useState<SupplierType>(
    supplier?.supplierType ?? "gachi"
  );
  const [contactName, setContactName] = React.useState(supplier?.contactName ?? "");
  const [phone, setPhone] = React.useState(supplier?.phone ?? "");
  const [address, setAddress] = React.useState(supplier?.address ?? "");
  const [openingBalance, setOpeningBalance] = React.useState(
    String(supplier?.openingBalance ?? 0)
  );
  const [notes, setNotes] = React.useState(supplier?.notes ?? "");
  const [isActive, setIsActive] = React.useState(supplier?.isActive ?? true);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await upsertSupplierAction({
        id: supplier?.id,
        name: name.trim(),
        supplierType,
        contactName: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        openingBalance: Number(openingBalance || 0),
        notes: notes.trim() || undefined,
        isActive,
      });
      if (!res.ok) {
        throw new Error(res.message || "Could not save supplier.");
      }
      return res;
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "supplier-hub"] });
      toast.success(supplier ? "Supplier updated." : "Supplier added.");
      onClose();
      onSuccess?.(res.supplierId);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not save supplier.");
    },
  });

  const isPending = saveMutation.isPending;

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Enter the supplier or gachi name.");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{supplier ? "Edit Supplier" : "Add Supplier / Gachi"}</DialogTitle>
        <DialogDescription className="text-xs">
          Store contact details and any pre-existing due or advance opening balance.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3.5 py-2 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="sup-name" className="text-xs">
              Name / নাম <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sup-name"
              placeholder="e.g. Rahim Gachi (Bagha)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select
              value={supplierType}
              onValueChange={(val) => setSupplierType((val as SupplierType) || "gachi")}
            >
              <SelectTrigger className="h-9 w-full min-w-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SUPPLIER_TYPE_LABELS) as SupplierType[]).map((key) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {SUPPLIER_TYPE_LABELS[key].en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="sup-phone" className="text-xs">Phone / মোবাইল</Label>
            <Input
              id="sup-phone"
              placeholder="017XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sup-contact" className="text-xs">Contact Person</Label>
            <Input
              id="sup-contact"
              placeholder="Optional representative"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="sup-address" className="text-xs">Village / Mill Address</Label>
            <Input
              id="sup-address"
              placeholder="e.g. Bagha, Rajshahi"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sup-opening" className="text-xs">Opening Balance (৳ BDT)</Label>
            <Input
              id="sup-opening"
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="h-9 text-xs font-mono tabular-nums"
            />
            <p className="text-[11px] text-muted-foreground">
              Positive = previous due owed; negative = advance paid.
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="sup-notes" className="text-xs">Notes</Label>
          <Textarea
            id="sup-notes"
            rows={2}
            placeholder="Season terms, quality notes, or pickup spot..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-xs resize-none"
          />
        </div>

        {supplier && (
          <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
            <Checkbox
              checked={isActive}
              onCheckedChange={(v) => setIsActive(Boolean(v))}
            />
            <span className="text-xs text-foreground">Active supplier</span>
          </label>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={isPending || !name.trim()}
          className="bg-amber-700 hover:bg-amber-800 text-white"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {supplier ? "Save Changes" : "Save Supplier"}
        </Button>
      </DialogFooter>
    </>
  );
}
