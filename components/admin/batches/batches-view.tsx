"use client";

import * as React from "react";
import { useState } from "react";
import {
  FlaskConical,
  Plus,
  ShieldCheck,
  Ban,
  AlertTriangle,
  QrCode,
  Download,
  Search,
  ExternalLink,
  Clock,
  Sparkles,
  Layers,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BatchItem,
  SupplierItem,
  getAdminBatchesAction,
} from "@/actions/inventory";
import { formatDhakaDate } from "@/lib/admin-format";
import { exportToCSV } from "@/lib/csv-export";
import { CreateBatchDialog } from "./create-batch-dialog";
import { BatchQRDialog } from "./batch-qr-dialog";
import { UpdateBatchStatusDialog } from "./update-batch-status-dialog";

interface BatchesViewProps {
  initialBatches: BatchItem[];
  products: { id: string; name: string }[];
  suppliers: SupplierItem[];
}

export function BatchesView({
  initialBatches,
  products,
  suppliers,
}: BatchesViewProps) {
  const [batches, setBatches] = useState<BatchItem[]>(initialBatches);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);

  const handleRefresh = async () => {
    const res = await getAdminBatchesAction();
    if (res.success) {
      setBatches(res.data);
    }
  };

  const filteredBatches = batches.filter((b) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      b.batchNo.toLowerCase().includes(q) ||
      b.product.toLowerCase().includes(q) ||
      b.supplier.toLowerCase().includes(q);

    const matchesStatus = statusFilter === "all" || b.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const counts = {
    all: batches.length,
    quarantine: batches.filter((b) => b.status === "quarantine").length,
    released: batches.filter((b) => b.status === "released").length,
    blocked: batches.filter((b) => b.status === "blocked").length,
    expired: batches.filter((b) => b.status === "expired").length,
  };

  const handleExportCSV = () => {
    exportToCSV(
      filteredBatches.map((b) => ({
        "Lot Code": b.batchNo,
        Product: b.product,
        Supplier: b.supplier,
        Status: b.status,
        "Remaining Quantity": b.remainingQuantity ?? 0,
        "Brix (Bx)": b.brix ?? "N/A",
        pH: b.ph ?? "N/A",
        "Moisture (%)": b.moisturePct ?? "N/A",
        "Density (kg/L)": b.densityKgPerL ?? "N/A",
        "Best Before": b.expDate ? formatDhakaDate(b.expDate) : "N/A",
        Notes: b.notes || "",
      })),
      `lots-batches-${new Date().toISOString().split("T")[0]}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FlaskConical className="size-6 text-primary" />
            Lot Tracking & Quality Control / ব্যাচ ও ল্যাব মান
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Production lots with certified lab measurements (Brix, pH, moisture), status workflow, and QR traceability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="text-xs h-8 gap-1.5 shadow-xs"
          >
            <Plus className="size-3.5" />
            New Lot / নতুন ব্যাচ
          </Button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="size-3 text-emerald-500" />
            Released (Active)
          </div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-emerald-600 dark:text-emerald-400">
            {counts.released}
          </div>
          <span className="text-[10px] text-muted-foreground">Eligible for customer orders</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="size-3 text-amber-500" />
            In Quarantine
          </div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-amber-600 dark:text-amber-400">
            {counts.quarantine}
          </div>
          <span className="text-[10px] text-muted-foreground">Pending lab approval</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Ban className="size-3 text-destructive" />
            Blocked / Rejected
          </div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-destructive">
            {counts.blocked}
          </div>
          <span className="text-[10px] text-muted-foreground">Failed quality checks</span>
        </Card>

        <Card className="rounded-xl p-3 border shadow-xs">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="size-3 text-muted-foreground" />
            Expired Lots
          </div>
          <div className="text-xl font-bold tracking-tight mt-1 font-mono text-muted-foreground">
            {counts.expired}
          </div>
          <span className="text-[10px] text-muted-foreground">Passed shelf life</span>
        </Card>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
          <TabsList className="h-9 bg-muted/60 p-1">
            <TabsTrigger value="all" className="text-xs px-2.5">
              All ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="released" className="text-xs px-2.5 text-emerald-600 dark:text-emerald-400">
              Released ({counts.released})
            </TabsTrigger>
            <TabsTrigger value="quarantine" className="text-xs px-2.5 text-amber-600 dark:text-amber-400">
              Quarantine ({counts.quarantine})
            </TabsTrigger>
            <TabsTrigger value="blocked" className="text-xs px-2.5 text-rose-600 dark:text-rose-400">
              Blocked ({counts.blocked})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search lot code, product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 text-xs gap-1"
          >
            <Download className="size-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* Lots Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-2.5 px-3">Lot Code / ব্যাচ</th>
                <th className="py-2.5 px-3">Product / পণ্য</th>
                <th className="py-2.5 px-3">Supplier / মিল</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Remaining Stock</th>
                <th className="py-2.5 px-3 text-center">Lab Values (Bx / pH / Moisture)</th>
                <th className="py-2.5 px-3">Best Before</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                    No production lots found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => {
                  const isReleased = batch.status === "released";
                  const isQuarantine = batch.status === "quarantine";
                  const isBlocked = batch.status === "blocked";
                  const isExpired = batch.status === "expired";

                  return (
                    <tr key={batch.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-xs tracking-wider">
                          {batch.batchNo}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground">{batch.product}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{batch.supplier}</td>
                      <td className="py-2.5 px-3 text-center">
                        {isReleased ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[10px] uppercase font-mono px-1.5 py-0">
                            Released
                          </Badge>
                        ) : isQuarantine ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 text-[10px] uppercase font-mono px-1.5 py-0">
                            Quarantine
                          </Badge>
                        ) : isBlocked ? (
                          <Badge variant="destructive" className="text-[10px] uppercase font-mono px-1.5 py-0">
                            Blocked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                            Expired
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">
                        {(batch.remainingQuantity ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                        <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                          <span title="Brix sugar content">
                            {batch.brix !== null ? `${batch.brix}°Bx` : "—"}
                          </span>
                          <span>·</span>
                          <span title="pH level">
                            {batch.ph !== null ? `pH ${batch.ph}` : "—"}
                          </span>
                          <span>·</span>
                          <span title="Moisture percentage">
                            {batch.moisturePct !== null ? `${batch.moisturePct}%` : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {batch.expDate ? formatDhakaDate(batch.expDate) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedBatch(batch);
                              setQrOpen(true);
                            }}
                            className="h-7 px-2 text-[11px] gap-1 hover:bg-muted"
                            title="Generate QR code label"
                          >
                            <QrCode className="size-3 text-primary" />
                            QR
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedBatch(batch);
                              setStatusOpen(true);
                            }}
                            className="h-7 px-2 text-[11px] gap-1 hover:bg-muted"
                            title="Change approval status"
                          >
                            <ShieldCheck className="size-3 text-emerald-600" />
                            Status
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialogs */}
      <CreateBatchDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        products={products}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        onSuccess={handleRefresh}
      />

      <BatchQRDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        batch={selectedBatch}
      />

      <UpdateBatchStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        batch={selectedBatch}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
