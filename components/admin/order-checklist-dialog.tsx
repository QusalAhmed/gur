"use client";

import * as React from "react";
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
  Search,
  CheckCheck,
  RotateCcw,
  Scale,
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
  unit_weight_kg: number;
  total_weight_kg: number;
  order_count: number;
  order_ids: string[];
  combo_sources?: Array<{
    combo_name: string;
    count: number;
  }>;
}

const BN_TO_EN_DIGITS: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

function normalizeBengaliDigits(text = ""): string {
  return text.replace(/[০-৯]/g, (d) => BN_TO_EN_DIGITS[d] ?? d);
}

function parseWeightFromText(rawText = ""): number | null {
  if (!rawText || typeof rawText !== "string") return null;
  const text = normalizeBengaliDigits(rawText.toLowerCase());

  // 1. Matches like 0.5 kg, 1kg, 2.5 kg, 1 কেজি, 2 কিলো
  const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|k\.g|kgs|কেজি|কিলো)/i);
  if (kgMatch) return parseFloat(kgMatch[1]);

  // 2. Matches like 500g, 250 gm, 200 g, 500 গ্রাম, 200গ্রা
  const gMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:gm|gms|gram|grams|g|গ্রাম|গ্রা)(?![a-z])/i);
  if (gMatch) return parseFloat(gMatch[1]) / 1000;

  // 3. Matches like 1L, 1.5 ltr, 1 liter, 1 লিটার
  const lMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:liter|liters|ltr|l|লিটার)/i);
  if (lMatch) return parseFloat(lMatch[1]);

  // 4. Matches like 500ml, 250 ml, 250 মিলি
  const mlMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:ml|মিলি)/i);
  if (mlMatch) return parseFloat(mlMatch[1]) / 1000;

  return null;
}

/**
 * Extracts approximate unit weight in kilograms from variant name, product name, or SKU.
 * Checks variant name first, then product name, then SKU, falling back to 1 kg if unspecified.
 * Supports units: kg, g/gm, liter/l, ml (and Bengali variants কেজি, গ্রাম, লিটার, মিলি).
 */
function extractUnitWeightKg(variantName = "", productName = "", sku = ""): number {
  const variantWeight = parseWeightFromText(variantName);
  if (variantWeight !== null) return variantWeight;

  const productWeight = parseWeightFromText(productName);
  if (productWeight !== null) return productWeight;

  const skuWeight = parseWeightFromText(sku);
  if (skuWeight !== null) return skuWeight;

  return 1;
}

function formatWeightKg(kg: number): string {
  if (kg <= 0) return "0 kg";
  if (kg < 0.01) {
    const grams = Number.isInteger(kg * 1000)
      ? (kg * 1000).toString()
      : (kg * 1000).toFixed(2).replace(/\.?0+$/, "");
    return `${grams} g`;
  }
  const formatted = Number.isInteger(kg) ? kg.toString() : kg.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted || "0"} kg`;
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
    const idToKey = new Map<string, string>();
    const attrsToKey = new Map<string, string>();

    const resolveKey = (varId: string, attrsKey: string): string => {
      let key = (varId && idToKey.get(varId)) || attrsToKey.get(attrsKey);
      if (!key) {
        key = varId ? `var_${varId}`.toLowerCase() : attrsKey;
      }
      if (varId) idToKey.set(varId, key);
      attrsToKey.set(attrsKey, key);
      return key;
    };

    for (const order of orders) {
      if (!order.items || !Array.isArray(order.items)) continue;

      for (const item of order.items) {
        // If item is a combo and has components snapshot, explode into physical components
        const isComboItem = Boolean(item.is_combo) || (Array.isArray(item.combo_components) && item.combo_components.length > 0);
        if (isComboItem && Array.isArray(item.combo_components) && item.combo_components.length > 0) {
          const comboQty = Number(item.quantity) || 1;
          const comboName = (item.product_name || "Combo").trim();

          for (const comp of item.combo_components) {
            const compProdName = (comp.product_name || "Unknown Product").trim();
            const compVarName = (comp.variant_name || "").trim();
            const compSku = (comp.sku || "").trim();
            const compVarId = comp.component_variant_id ? String(comp.component_variant_id).trim() : "";
            const compAttrsKey = `${compProdName}___${compVarName}___${compSku}`.toLowerCase();
            const key = resolveKey(compVarId, compAttrsKey);

            const singleCompQty = Number(comp.quantity) || 1;
            const totalCompQty = singleCompQty * comboQty;
            const unitWeight = comp.weight_grams
              ? comp.weight_grams / 1000
              : extractUnitWeightKg(compVarName, compProdName, compSku);
            const lineWeight = unitWeight * totalCompQty;

            const existing = map.get(key);
            if (existing) {
              existing.total_quantity += totalCompQty;
              existing.total_weight_kg += lineWeight;
              if (!existing.order_ids.includes(order.id)) {
                existing.order_ids.push(order.id);
                existing.order_count += 1;
              }
              if (!existing.combo_sources) existing.combo_sources = [];
              const src = existing.combo_sources.find((s) => s.combo_name === comboName);
              if (src) {
                src.count += totalCompQty;
              } else {
                existing.combo_sources.push({ combo_name: comboName, count: totalCompQty });
              }
            } else {
              map.set(key, {
                key,
                product_name: compProdName,
                variant_name: compVarName,
                sku: compSku,
                total_quantity: totalCompQty,
                unit_weight_kg: unitWeight,
                total_weight_kg: lineWeight,
                order_count: 1,
                order_ids: [order.id],
                combo_sources: [{ combo_name: comboName, count: totalCompQty }],
              });
            }
          }
        } else {
          // Standard loose physical item
          const prodName = (item.product_name || "Unknown Product").trim();
          const variantName = (item.variant_name || "").trim();
          const sku = (item.sku || "").trim();
          const itemVarId = item.variant_id ? String(item.variant_id).trim() : "";
          const itemAttrsKey = `${prodName}___${variantName}___${sku}`.toLowerCase();
          const key = resolveKey(itemVarId, itemAttrsKey);

          const qty = Number(item.quantity) || 1;
          const unitWeight = extractUnitWeightKg(variantName, prodName, sku);
          const lineWeight = unitWeight * qty;
          const existing = map.get(key);

          if (existing) {
            existing.total_quantity += qty;
            existing.total_weight_kg += lineWeight;
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
              unit_weight_kg: unitWeight,
              total_weight_kg: lineWeight,
              order_count: 1,
              order_ids: [order.id],
            });
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const comp = a.product_name.localeCompare(b.product_name);
      if (comp !== 0) return comp;
      return a.variant_name.localeCompare(b.variant_name);
    });
  }, [orders]);

  // Calculate total weight (kg)
  const totalWeightKg = React.useMemo(() => {
    return consolidatedItems.reduce((acc, curr) => acc + curr.total_weight_kg, 0);
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
          {consolidatedItems.map((item) => (
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
                <div style={{ fontSize: "9px", color: "#222" }}>
                  {item.variant_name && <span>{item.variant_name} </span>}
                  {item.sku && <span>({item.sku}) </span>}
                  {item.total_weight_kg > 0 && (
                    <span style={{ fontWeight: 600 }}>• {formatWeightKg(item.total_weight_kg)}</span>
                  )}
                  {item.combo_sources && item.combo_sources.length > 0 && (
                    <div style={{ fontSize: "8px", fontStyle: "italic", color: "#444", marginTop: "1px" }}>
                      ↳ {item.combo_sources.map((s) => `${s.count} from ${s.combo_name}`).join(", ")}
                    </div>
                  )}
                </div>
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
            <span>Total Weight:</span>
            <strong style={{ fontSize: "12px" }}>{formatWeightKg(totalWeightKg)}</strong>
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
                    Consolidated products, quantities & total weight for picking & packing.
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
                  <Scale className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-medium">Total Weight</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatWeightKg(totalWeightKg)}
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
                    <TableHead className="w-28 text-right">Qty & Weight</TableHead>
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
                            {item.combo_sources && item.combo_sources.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.combo_sources.map((src, sIdx) => (
                                  <Badge
                                    key={sIdx}
                                    variant="outline"
                                    className="text-[10px] font-normal px-1.5 py-0 h-4 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                  >
                                    {src.count} from {src.combo_name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-muted-foreground font-mono text-[11px]">
                          {item.sku || "—"}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <div className="flex flex-col items-end">
                            <span
                              className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded-md text-xs ${
                                isChecked
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono"
                              }`}
                            >
                              {item.total_quantity}
                            </span>
                            {item.total_weight_kg > 0 && (
                              <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                {formatWeightKg(item.total_weight_kg)}
                              </span>
                            )}
                          </div>
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
              Showing {filteredItems.length} of {consolidatedItems.length} unique products • Total Weight:{" "}
              <strong className="text-foreground">{formatWeightKg(totalWeightKg)}</strong>
            </div>
            <div className="flex items-center gap-2">
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
