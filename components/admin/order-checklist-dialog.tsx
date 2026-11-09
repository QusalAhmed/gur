"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClipboardCheck,
  Printer,
  Download,
  Search,
  CheckCheck,
  RotateCcw,
  Package,
  Layers,
  ShoppingBag,
} from "lucide-react";
import type { Order } from "@/types/order";
import { useSiteSettings } from "@/hooks/use-site-settings";

export interface OrderChecklistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
}

export interface ConsolidatedChecklistItem {
  key: string;
  product_name: string;
  variant_name: string;
  sku: string;
  total_quantity: number;
  order_count: number;
  order_ids: string[];
}

export function OrderChecklistDialog({
  isOpen,
  onClose,
  orders,
}: OrderChecklistDialogProps) {
  const [mounted, setMounted] = React.useState(false);
  const { storeName, storeNameBn } = useSiteSettings();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [checkedItems, setCheckedItems] = React.useState<Record<string, boolean>>({});
  const [printDate, setPrintDate] = React.useState("");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Reset checked state & search whenever dialog opens or selected orders change
  React.useEffect(() => {
    if (isOpen) {
      setCheckedItems({});
      setSearchQuery("");
      setPrintDate(
        new Date().toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      );
    }
  }, [isOpen, orders]);

  // Aggregate items across all selected orders
  const consolidatedItems = React.useMemo<ConsolidatedChecklistItem[]>(() => {
    const map = new Map<string, ConsolidatedChecklistItem>();

    for (const order of orders) {
      if (!order.items || !Array.isArray(order.items)) continue;

      for (const item of order.items) {
        const prodName = (item.product_name || "Unknown Product").trim();
        const variantName = (item.variant_name || "").trim();
        const sku = (item.sku || "").trim();
        const key = `${prodName}___${variantName}___${sku}`.toLowerCase();

        const qty = Number(item.quantity) || 1;
        const existing = map.get(key);

        if (existing) {
          existing.total_quantity += qty;
          if (!existing.order_ids.includes(order.id)) {
            existing.order_ids.push(order.id);
            existing.order_count += 1;
          }
        } else {
          map.set(key, {
            key,
            product_name: prodName,
            variant_name: variantName,
            sku,
            total_quantity: qty,
            order_count: 1,
            order_ids: [order.id],
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const comp = a.product_name.localeCompare(b.product_name);
      if (comp !== 0) return comp;
      return a.variant_name.localeCompare(b.variant_name);
    });
  }, [orders]);

  // Calculate totals
  const totalUnits = React.useMemo(() => {
    return consolidatedItems.reduce((acc, curr) => acc + curr.total_quantity, 0);
  }, [consolidatedItems]);

  const checkedCount = React.useMemo(() => {
    return consolidatedItems.filter((item) => checkedItems[item.key]).length;
  }, [consolidatedItems, checkedItems]);

  const progressPercent = consolidatedItems.length > 0
    ? Math.round((checkedCount / consolidatedItems.length) * 100)
    : 0;

  // Filter items by search query
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return consolidatedItems;
    const query = searchQuery.toLowerCase();
    return consolidatedItems.filter(
      (item) =>
        item.product_name.toLowerCase().includes(query) ||
        item.variant_name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
    );
  }, [consolidatedItems, searchQuery]);

  // Toggle single item check
  const toggleItemCheck = (key: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Check all items
  const handleCheckAll = () => {
    const next: Record<string, boolean> = {};
    for (const item of consolidatedItems) {
      next[item.key] = true;
    }
    setCheckedItems(next);
  };

  // Uncheck / reset all items
  const handleUncheckAll = () => {
    setCheckedItems({});
  };

  // Export clean CSV
  const handleExportCsv = () => {
    if (consolidatedItems.length === 0) return;

    const headers = ["Product Name", "Variant", "SKU", "Total Quantity"];
    const rows = consolidatedItems.map((item) => [
      `"${item.product_name.replace(/"/g, '""')}"`,
      `"${item.variant_name.replace(/"/g, '""')}"`,
      `"${item.sku.replace(/"/g, '""')}"`,
      item.total_quantity,
    ]);

    const csvContent =
      "\uFEFF" + // UTF-8 BOM for Excel compatibility
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `gur_packing_checklist_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Instant print for 58mm thermal roll
  const handlePrint = () => {
    window.print();
  };

  const displayName = storeNameBn || storeName || "খেজুরের খাটি গুড়";
  const nowFormatted = printDate || new Date().toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (!mounted || !isOpen) return null;

  return (
    <>
      {/* 58mm Thermal Print Stylesheet */}
      <style jsx global>{`
        @media print {
          @page {
            size: 58mm auto;
            margin: 0mm !important;
          }

          /* Hide everything except the thermal checklist print container */
          body * {
            visibility: hidden !important;
          }

          #order-checklist-thermal-print,
          #order-checklist-thermal-print * {
            visibility: visible !important;
          }

          #order-checklist-thermal-print {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 54mm !important;
            max-width: 54mm !important;
            margin: 0 auto !important;
            padding: 2mm 1mm 4mm 1mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            z-index: 999999 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hind Siliguri", sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Dedicated Hidden Container for 58mm Thermal Roll Printing */}
      <div
        id="order-checklist-thermal-print"
        className="hidden"
        aria-hidden="true"
      >
        <div style={{ textAlign: "center", marginBottom: "4px" }}>
          <div style={{ fontSize: "14px", fontWeight: "bold", lineHeight: 1.2 }}>
            {displayName}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 800, marginTop: "2px", letterSpacing: "0.5px" }}>
            === PACKING CHECK LIST ===
          </div>
          <div style={{ fontSize: "9px", color: "#333", marginTop: "2px" }}>
            {nowFormatted}
          </div>
          <div style={{ fontSize: "9px", marginTop: "2px" }}>
            Orders ({orders.length}): {orders.map((o) => `#${o.order_number || o.id.slice(-6)}`).join(", ")}
          </div>
        </div>

        <div style={{ borderBottom: "1px dashed #000", margin: "4px 0" }} />

        <div style={{ fontSize: "10px" }}>
          {consolidatedItems.map((item, idx) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                padding: "2.5px 0",
                borderBottom: "1px dotted #ccc",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  width: "11px",
                  height: "11px",
                  border: "1.2px solid #000",
                  marginRight: "5px",
                  marginTop: "1.5px",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: "bold", fontSize: "11px", lineHeight: 1.2 }}>
                  [{item.total_quantity}x] {item.product_name}
                </div>
                {(item.variant_name || item.sku) && (
                  <div style={{ fontSize: "9px", color: "#222" }}>
                    {item.variant_name && <span>{item.variant_name} </span>}
                    {item.sku && <span>({item.sku})</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderBottom: "1px dashed #000", margin: "4px 0" }} />

        <div style={{ fontSize: "10px", lineHeight: 1.4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Total Unique Items:</span>
            <strong>{consolidatedItems.length}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <span>Total Units (Pieces):</span>
            <strong style={{ fontSize: "12px" }}>{totalUnits} pcs</strong>
          </div>
        </div>

        <div style={{ borderBottom: "1px dashed #000", margin: "6px 0 4px 0" }} />

        <div style={{ fontSize: "9px", marginTop: "8px", paddingTop: "4px" }}>
          <div>Packer: ________________________</div>
          <div style={{ marginTop: "4px" }}>Verified: ______________________</div>
        </div>
      </div>

      {/* Screen Interactive Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    Check List / Packing List
                    <Badge variant="outline" className="text-xs font-normal">
                      {orders.length} order{orders.length !== 1 ? "s" : ""}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Consolidated products & quantities across selected orders for picking & packing.
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Quick Stats & Progress Bar */}
            <div className="mt-4 pt-3 border-t border-border/60 space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background border text-xs">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-medium">Orders</span>
                    <span className="font-semibold text-foreground text-sm">{orders.length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background border text-xs">
                  <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-medium">Unique Items</span>
                    <span className="font-semibold text-foreground text-sm">{consolidatedItems.length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background border text-xs">
                  <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-medium">Total Units</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {totalUnits} pcs
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="space-y-1.5 bg-background p-2.5 rounded-md border">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <span>Packing Progress:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {checkedCount} / {consolidatedItems.length} packed
                    </span>
                    <span className="text-muted-foreground">({progressPercent}%)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCheckAll}
                      className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                    >
                      <CheckCheck className="h-3 w-3 mr-1" />
                      Check All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleUncheckAll}
                      className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1.5 transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Search Filter Toolbar */}
          <div className="px-5 py-2.5 border-b bg-muted/10 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search products, variant or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>
          </div>

          {/* Product Items Table */}
          <div className="flex-1 overflow-y-auto max-h-[360px] p-0">
            {filteredItems.length === 0 ? (
              <div className="text-center py-10 px-4 text-muted-foreground text-xs">
                {consolidatedItems.length === 0
                  ? "No products found in the selected orders."
                  : "No products match your search filter."}
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-xs">
                  <TableRow className="text-xs hover:bg-transparent">
                    <TableHead className="w-10 text-center">Status</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="w-28">SKU</TableHead>
                    <TableHead className="w-24 text-right">Total Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filteredItems.map((item) => {
                    const isChecked = !!checkedItems[item.key];
                    return (
                      <TableRow
                        key={item.key}
                        onClick={() => toggleItemCheck(item.key)}
                        className={`cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-emerald-500/5 hover:bg-emerald-500/10 text-muted-foreground"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <TableCell className="text-center py-2.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleItemCheck(item.key)}
                            aria-label={`Mark ${item.product_name} as packed`}
                          />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="space-y-0.5">
                            <span
                              className={`font-medium block leading-snug ${
                                isChecked
                                  ? "line-through text-muted-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {item.product_name}
                            </span>
                            {item.variant_name && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-normal px-1.5 py-0 h-4 bg-muted text-muted-foreground border-transparent"
                              >
                                {item.variant_name}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-muted-foreground font-mono text-[11px]">
                          {item.sku || "—"}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span
                            className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded-md text-xs ${
                              isChecked
                                ? "bg-muted text-muted-foreground"
                                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono"
                            }`}
                          >
                            {item.total_quantity}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Footer Actions */}
          <DialogFooter className="p-3.5 border-t bg-muted/20 flex sm:flex-row items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              Showing {filteredItems.length} of {consolidatedItems.length} unique products
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={consolidatedItems.length === 0}
                className="h-8 text-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
                Export CSV
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handlePrint}
                disabled={consolidatedItems.length === 0}
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Print 58mm
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 text-xs cursor-pointer"
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
