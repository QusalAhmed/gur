"use client";

import * as React from "react";
import { Banknote, Pencil, Phone, Plus, MapPin } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HubPayment, HubPurchase, HubSupplier } from "@/actions/supplier-ops";
import { formatBDT } from "@/lib/admin-format";
import {
  buildSupplierKhata,
  getBalanceStatus,
  SUPPLIER_TYPE_LABELS,
} from "@/lib/supplier-ledger";

interface SupplierKhataDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: HubSupplier | null;
  purchases: HubPurchase[];
  payments: HubPayment[];
  onRecordPurchase: (supplierId: string) => void;
  onRecordPayment: (supplierId: string) => void;
  onEditSupplier: (supplier: HubSupplier) => void;
}

export function SupplierKhataDrawer({
  open,
  onOpenChange,
  supplier,
  purchases,
  payments,
  onRecordPurchase,
  onRecordPayment,
  onEditSupplier,
}: SupplierKhataDrawerProps) {
  const khata = React.useMemo(() => {
    if (!supplier) return null;
    const supPurchases = purchases.filter((p) => p.supplierId === supplier.id);
    const supPayments = payments.filter((p) => p.supplierId === supplier.id);

    return buildSupplierKhata(
      supplier.openingBalance,
      supPurchases.map((p) => ({
        id: p.id,
        number: p.purchaseNumber,
        date: p.purchaseDate,
        createdAt: p.createdAt,
        totalAmount: p.totalAmount,
        summary:
          p.items.length > 0
            ? p.items
                .map((it) => `${it.itemName} (${it.quantity} ${it.unit} × ${formatBDT(it.unitPrice)})`)
                .join(", ")
            : "Purchase",
        notes: p.notes,
        status: p.status,
      })),
      supPayments.map((pay) => ({
        id: pay.id,
        number: pay.paymentNumber,
        date: pay.paymentDate,
        createdAt: pay.createdAt,
        amount: pay.amount,
        method: pay.paymentMethod,
        paidBy: pay.paidBy,
        linkedPurchaseNumber: pay.purchaseNumber,
        notes: pay.notes,
        status: pay.status,
      }))
    );
  }, [supplier, purchases, payments]);

  if (!supplier || !khata) return null;

  const balanceState = getBalanceStatus(khata.netBalance);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="pb-4 border-b">
          <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-base sm:text-lg font-bold leading-snug">
                  {supplier.name}
                </SheetTitle>
                <Badge variant="outline" className="text-[11px]">
                  {SUPPLIER_TYPE_LABELS[supplier.supplierType].en}
                </Badge>
              </div>
              <SheetDescription className="text-xs mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {supplier.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {supplier.phone}
                  </span>
                )}
                {supplier.address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {supplier.address}
                  </span>
                )}
              </SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => onEditSupplier(supplier)}
            >
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>

          {/* Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3">
            <div className="rounded-lg border bg-muted/20 p-2.5">
              <p className="text-[11px] text-muted-foreground">Total Purchased</p>
              <p className="text-sm sm:text-base font-bold font-mono tabular-nums mt-0.5">
                {formatBDT(khata.totalPurchased)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2.5">
              <p className="text-[11px] text-muted-foreground">Cash Paid</p>
              <p className="text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                {formatBDT(khata.totalPaid)}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 flex sm:block items-center justify-between rounded-lg border bg-muted/20 p-2.5">
              <p className="text-[11px] text-muted-foreground">
                {balanceState === "due"
                  ? "Balance Due"
                  : balanceState === "advance"
                    ? "Advance Credit"
                    : "Settled"}
              </p>
              <p
                className={`text-sm sm:text-base font-bold font-mono tabular-nums sm:mt-0.5 ${
                  balanceState === "due"
                    ? "text-rose-700 dark:text-rose-400"
                    : balanceState === "advance"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground"
                }`}
              >
                {formatBDT(Math.abs(khata.netBalance))}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 pt-3">
            <Button
              size="sm"
              className="h-8 w-full sm:w-auto text-xs bg-amber-700 hover:bg-amber-800 text-white"
              onClick={() => onRecordPurchase(supplier.id)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Record Purchase
            </Button>
            <Button
              size="sm"
              className="h-8 w-full sm:w-auto text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
              onClick={() => onRecordPayment(supplier.id)}
            >
              <Banknote className="h-3.5 w-3.5 mr-1" /> Pay Cash
            </Button>
          </div>
        </SheetHeader>

        {/* Chronological Khata Statement */}
        <div className="pt-4">
          <h3 className="text-xs font-semibold text-foreground mb-2">
            Supplier Khata / খাতা ({khata.entries.length} entries)
          </h3>

          {khata.entries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
              No purchases or cash payments recorded for {supplier.name} yet.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table className="min-w-[540px]">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[11px]">Date & Ref</TableHead>
                    <TableHead className="text-[11px]">Details</TableHead>
                    <TableHead className="text-[11px] text-right">Purchase</TableHead>
                    <TableHead className="text-[11px] text-right">Paid</TableHead>
                    <TableHead className="text-[11px] text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {khata.entries.map((entry) => {
                    const isVoided = entry.status === "voided";
                    return (
                      <TableRow
                        key={entry.id}
                        className={isVoided ? "opacity-50 line-through" : undefined}
                      >
                        <TableCell className="align-top text-xs whitespace-nowrap">
                          <div className="font-mono text-[11px]">{entry.date || "Opening"}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {entry.refNumber}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-xs min-w-[180px] max-w-[260px] whitespace-normal">
                          <p className="font-medium text-foreground leading-snug">
                            {entry.description}
                          </p>
                          {entry.meta && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{entry.meta}</p>
                          )}
                          {isVoided && (
                            <Badge variant="outline" className="mt-1 text-[10px] text-destructive">
                              Voided
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-right font-mono tabular-nums text-xs whitespace-nowrap">
                          {entry.debit > 0 ? formatBDT(entry.debit) : "—"}
                        </TableCell>
                        <TableCell className="align-top text-right font-mono tabular-nums text-xs text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {entry.credit > 0 ? formatBDT(entry.credit) : "—"}
                        </TableCell>
                        <TableCell
                          className={`align-top text-right font-mono tabular-nums text-xs font-semibold whitespace-nowrap ${
                            entry.runningBalance > 0
                              ? "text-rose-700 dark:text-rose-400"
                              : entry.runningBalance < 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {entry.runningBalance < 0
                            ? `${formatBDT(Math.abs(entry.runningBalance))} Adv`
                            : formatBDT(entry.runningBalance)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
