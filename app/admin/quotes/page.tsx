"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  Plus,
  FileQuestion,
  Clock,
  CheckCircle2,
  DollarSign,
  MapPin,
  MoreHorizontal,
  Send,
  Download,
  Trash2,
  Phone,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";

export interface QuoteRequestItem {
  id: string;
  company: string;
  contact: string;
  phone: string;
  product: string;
  quantity: string;
  targetPrice: string;
  destination: string;
  requiredBy: string;
  status: "new" | "quoted" | "converted" | "declined";
  quotedPrice: string;
  createdAt: string;
}

const initialQuotes: QuoteRequestItem[] = [
  {
    id: "RFQ-2610-095",
    company: "Chittagong Poultry Alliance",
    contact: "Mohammad Jahangir",
    phone: "+8801814991122",
    product: "Feed Grade Molasses A",
    quantity: "25 Tons",
    targetPrice: "৳ 72,000 / Ton",
    destination: "Chattogram",
    requiredBy: "5 Nov 2026",
    status: "new",
    quotedPrice: "Pending Review",
    createdAt: "Today, 10:15 AM",
  },
  {
    id: "RFQ-2610-094",
    company: "Sonar Bangla Bakery",
    contact: "Tanvir Ahmed",
    phone: "+8801712445566",
    product: "Food Grade Sugarcane Molasses",
    quantity: "500 Pails (2.5 Tons)",
    targetPrice: "৳ 750 / Pail",
    destination: "Dhaka (Mirpur)",
    requiredBy: "1 Nov 2026",
    status: "new",
    quotedPrice: "Pending Review",
    createdAt: "Today, 09:30 AM",
  },
  {
    id: "RFQ-2610-093",
    company: "Sylhet Bio-Agro Fertilizers",
    contact: "Shabbir Hossain",
    phone: "+8801511883344",
    product: "Blackstrap Molasses (Heavy)",
    quantity: "40 Tons",
    targetPrice: "৳ 18,500 / Drum",
    destination: "Sylhet Sadar",
    requiredBy: "10 Nov 2026",
    status: "new",
    quotedPrice: "Pending Review",
    createdAt: "Yesterday, 17:40",
  },
  {
    id: "RFQ-2610-092",
    company: "Meghna Feeds & Agro",
    contact: "Kabir Hossain",
    phone: "+8801611009988",
    product: "Feed Grade Molasses A (IBC Totes)",
    quantity: "15 Totes (15 Tons)",
    targetPrice: "৳ 74,000 / Ton",
    destination: "Comilla",
    requiredBy: "30 Oct 2026",
    status: "quoted",
    quotedPrice: "৳ 76,000 / Ton",
    createdAt: "Yesterday, 14:10",
  },
  {
    id: "RFQ-2610-091",
    company: "Jamuna Distillery Intermediates",
    contact: "Engr. Nayeem",
    phone: "+8801719223344",
    product: "High Brix Raw Cane Molasses",
    quantity: "100 Tons (Tankers)",
    targetPrice: "৳ 68,000 / Ton",
    destination: "Sirajganj",
    requiredBy: "15 Nov 2026",
    status: "converted",
    quotedPrice: "৳ 69,500 / Ton",
    createdAt: "22 Oct 2026",
  },
];

const statusStyles: Record<string, string> = {
  new: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  quoted: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  converted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  declined: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

export default function QuotesPage() {
  const [quotes, setQuotes] = React.useState<QuoteRequestItem[]>(initialQuotes);
  const [activeTab, setActiveTab] = React.useState("all");

  const filteredQuotes = React.useMemo(() => {
    return quotes.filter((q) => {
      if (activeTab === "new" && q.status !== "new") return false;
      if (activeTab === "quoted" && q.status !== "quoted") return false;
      if (activeTab === "converted" && q.status !== "converted") return false;
      return true;
    });
  }, [quotes, activeTab]);

  const handleExportCSV = (selected: QuoteRequestItem[]) => {
    const list = selected.length > 0 ? selected : filteredQuotes;
    const headers = ["RFQ_ID", "Company", "Contact", "Phone", "Product", "Quantity", "TargetPrice", "Destination", "NeededBy", "Status"];
    const rows = list.map((q) => [
      q.id,
      `"${q.company}"`,
      `"${q.contact}"`,
      q.phone,
      `"${q.product}"`,
      `"${q.quantity}"`,
      `"${q.targetPrice}"`,
      `"${q.destination}"`,
      formatDate(q.requiredBy),
      q.status,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `quotes_${Date.now()}.csv`;
    link.click();
  };

  const quoteColumns = React.useMemo<ColumnDef<QuoteRequestItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all RFQs"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select RFQ"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="RFQ ID" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
          {row.getValue("id")}
        </span>
      ),
    },
    {
      accessorKey: "company",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Company & Contact" />,
      cell: ({ row }) => {
        const q = row.original;
        return (
          <div className="min-w-[180px]">
            <p className="font-semibold text-sm text-foreground hover:text-amber-600 transition-colors">
              {q.company}
            </p>
            <p className="text-xs text-muted-foreground">{q.contact} • {q.phone}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "product",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Requested Product" />,
      cell: ({ row }) => <span className="text-xs font-medium text-foreground">{row.getValue("product")}</span>,
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Quantity" />,
      cell: ({ row }) => <span className="text-xs font-bold text-foreground">{row.getValue("quantity")}</span>,
    },
    {
      accessorKey: "targetPrice",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Target Price" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground font-medium">{row.getValue("targetPrice")}</span>,
    },
    {
      accessorKey: "destination",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Destination" />,
      cell: ({ row }) => (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 text-amber-600" />
          {row.getValue("destination")}
        </span>
      ),
    },
    {
      accessorKey: "requiredBy",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Needed By" />,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.getValue("requiredBy"))}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize border ${statusStyles[status]}`}
          >
            {status}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const q = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                className="font-medium text-amber-700 dark:text-amber-400"
                onClick={() => alert(`Prepare formal quotation for ${q.company}`)}
              >
                <Send className="h-3.5 w-3.5 mr-2" /> Send Quotation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => alert(`Calling ${q.contact} at ${q.phone}`)}>
                <Phone className="h-3.5 w-3.5 mr-2" /> Call Buyer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-emerald-600 focus:text-emerald-600"
                onClick={() =>
                  setQuotes((prev) =>
                    prev.map((item) => (item.id === q.id ? { ...item, status: "converted" } : item))
                  )
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Convert to Order
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setQuotes((prev) => prev.filter((item) => item.id !== q.id))}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Inquiry
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

  const newCount = quotes.filter((q) => q.status === "new").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotations & RFQs</h1>
          <p className="text-muted-foreground text-sm">
            B2B bulk pricing requests, custom formulation inquiries, and contract negotiation
          </p>
        </div>
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs h-9"
          onClick={() => {
            const newRfq: QuoteRequestItem = {
              id: `RFQ-2610-0${Math.floor(96 + Math.random() * 50)}`,
              company: "New Agro Commercial Farm",
              contact: "Rafiqul Islam",
              phone: "+8801711002233",
              product: "Pure Date Palm Syrup (Bulk Drums)",
              quantity: "10 Tons",
              targetPrice: "৳ 90,000 / Ton",
              destination: "Gazipur",
              requiredBy: "15 Nov 2026",
              status: "new",
              quotedPrice: "Pending Review",
              createdAt: "Just now",
            };
            setQuotes((prev) => [newRfq, ...prev]);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Inquiry
        </Button>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">New RFQs</p>
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <FileQuestion className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">{newCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pending sales response</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Pipeline Value</p>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">৳ 18.4M</p>
            <p className="text-xs text-muted-foreground mt-0.5">Estimated gross wholesale value</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Conversion Rate</p>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">68.4%</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Converted to confirmed orders</p>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-medium text-muted-foreground">Avg Response Time</p>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">3.4 hrs</p>
            <p className="text-xs text-muted-foreground mt-0.5">Within standard 6h SLA</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs and Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 bg-muted/60 p-1">
            <TabsTrigger value="all" className="text-xs">
              All Inquiries <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px]">{quotes.length}</span>
            </TabsTrigger>
            <TabsTrigger value="new" className="text-xs">
              New RFQs <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 text-[10px]">{newCount}</span>
            </TabsTrigger>
            <TabsTrigger value="quoted" className="text-xs">
              Quoted Pending Client
            </TabsTrigger>
            <TabsTrigger value="converted" className="text-xs">
              Converted
            </TabsTrigger>
          </TabsList>

          <DataTable
            columns={quoteColumns}
            data={filteredQuotes}
            searchPlaceholder="Search RFQ ID, company, product..."
            enableRowSelection={true}
            enableSorting={true}
            enablePagination={true}
            initialPageSize={5}
            pageSizeOptions={[5, 10, 20]}
            bulkActions={(selected, clearSelection) => (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-background"
                  onClick={() => handleExportCSV(selected)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export Selected
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  onClick={() => {
                    const ids = new Set(selected.map((s) => s.id));
                    setQuotes((prev) => prev.filter((q) => !ids.has(q.id)));
                    clearSelection();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete Selected
                </Button>
              </>
            )}
            emptyMessage="No RFQs found matching your criteria."
          />
        </Tabs>
      </motion.div>
    </div>
  );
}
