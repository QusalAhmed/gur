"use client";

import * as React from "react";
import { motion } from "motion/react";
import { MessageSquare, Phone, CheckCircle2, AlertOctagon, Reply, MoreHorizontal } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface Message {
  id: string;
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  channel: string;
  status: "new" | "read" | "replied" | "spam";
  time: string;
}

const messages: Message[] = [
  {
    id: "MSG-001",
    name: "Hafizur Rahman",
    phone: "+8801711998877",
    email: "hafiz@bografeed.com",
    subject: "Bulk animal feed molasses monthly supply contract (15 MT)",
    message: "We operate a cattle feed production facility in Sherpur, Bogura. We need 15 metric tons of 80° Brix blackstrap molasses every month. Please quote your best mill-gate price including tanker freight.",
    channel: "Web Contact Form",
    status: "new",
    time: "Today, 11:45 AM",
  },
  {
    id: "MSG-002",
    name: "Farzana Parveen",
    phone: "+8801812334455",
    email: "farzana.p@gmail.com",
    subject: "Retail delivery for winter wedding Payesh (50 bottles Nolen Gur)",
    message: "I am hosting a family wedding next month in Gulshan-2, Dhaka. Can I order 50 units of the 500ml glass bottle date palm liquid gur with gift packaging? How soon can you deliver?",
    channel: "WhatsApp Lead",
    status: "new",
    time: "Today, 10:10 AM",
  },
  {
    id: "MSG-003",
    name: "Dr. K. M. Saifuddin",
    phone: "+8801913887766",
    email: "saifuddin@vetagri.ac.bd",
    subject: "Sample request for University agricultural microbiology research",
    message: "We are conducting research at Bangladesh Agricultural University on microbial acceleration using raw cane molasses. Can you provide 5kg sample with COA purity sheet?",
    channel: "Web Contact Form",
    status: "new",
    time: "Today, 08:30 AM",
  },
  {
    id: "MSG-004",
    name: "Md. Belal Hossain",
    phone: "+8801614223344",
    email: "belal@chittagongpoultry.org",
    subject: "Urgent: Need 200L drum stock in Chattogram depot tomorrow",
    message: "Do you have 4 steel drums of blackstrap molasses ready in stock at your Chattogram Halishahar depot for urgent pickup by our pickup truck?",
    channel: "Direct Phone Inquiry",
    status: "new",
    time: "Yesterday, 19:20",
  },
  {
    id: "MSG-005",
    name: "Selim Reza",
    phone: "+8801511556677",
    email: "reza.bakery@yahoo.com",
    subject: "Food grade pail pricing and sample approval",
    message: "Our bakery sample was approved by our head pastry chef. Proceeding with quotation for 100 pails.",
    channel: "Web Contact Form",
    status: "replied",
    time: "22 Oct 2026",
  },
  {
    id: "MSG-006",
    name: "Crypto Marketing Bot",
    phone: "+1800123456",
    email: "crypto@fastboost.xyz",
    subject: "Rank your store #1 on Google with crypto backlinks",
    message: "Boost website ranking and automated telegram signals...",
    channel: "Spam Bot",
    status: "spam",
    time: "21 Oct 2026",
  },
];

const statusStyles: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold",
  read: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  replied: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium",
  spam: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export default function ContactMessagesPage() {
  const [tabFilter, setTabFilter] = React.useState<string>("new");

  const filteredMessages = React.useMemo(() => {
    if (tabFilter === "all") return messages;
    return messages.filter((m) => m.status === tabFilter);
  }, [tabFilter]);

  const columns: ColumnDef<Message>[] = React.useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Sender & Channel" />
        ),
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div>
              <p className="font-semibold text-sm">{m.name}</p>
              <Badge variant="outline" className="text-[10px] mt-0.5">
                {m.channel}
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: "phone",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Phone & Email" />
        ),
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div className="text-xs space-y-0.5">
              <p className="font-mono font-medium">{m.phone}</p>
              <p className="text-muted-foreground">{m.email}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "subject",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Subject" />
        ),
        cell: ({ row }) => (
          <span className="text-xs font-semibold max-w-[200px] truncate block" title={row.getValue("subject")}>
            {row.getValue("subject")}
          </span>
        ),
      },
      {
        accessorKey: "message",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Message Preview" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground max-w-sm line-clamp-2 block">
            {row.getValue("message")}
          </span>
        ),
      },
      {
        accessorKey: "time",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Received" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(row.getValue("time"))}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          return (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[status] || ""}`}>
              {status}
            </span>
          );
        },
      },
      {
        id: "actions",
        cell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-amber-700 dark:text-amber-400 font-medium">
                <Reply className="h-3.5 w-3.5 mr-2" /> Reply via Email
              </DropdownMenuItem>
              <DropdownMenuItem>Call on Phone</DropdownMenuItem>
              <DropdownMenuItem>Mark as Read</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Mark as Spam</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Messages & Inquiries</h1>
          <p className="text-muted-foreground text-sm">
            Handle incoming trade inquiries, WhatsApp leads, technical support questions, and spam filtering
          </p>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Unread Inquiries</p>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">4 New</p>
            <p className="text-xs text-blue-600 font-medium mt-1">3 commercial bulk leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Replied Within 24h</p>
              <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">96.8%</p>
            <p className="text-xs text-green-600 font-medium mt-1">Avg response time: 28 mins</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">WhatsApp Channels</p>
              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Phone className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">42 Leads</p>
            <p className="text-xs text-muted-foreground mt-1">High conversion mobile inquiries</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Blocked Spam</p>
              <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertOctagon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2">18</p>
            <p className="text-xs text-muted-foreground mt-1">Auto-filtered by bot defense</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs and Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <Tabs value={tabFilter} onValueChange={setTabFilter}>
          <TabsList>
            <TabsTrigger value="new">Unread (4)</TabsTrigger>
            <TabsTrigger value="all">All Messages</TabsTrigger>
            <TabsTrigger value="replied">Replied</TabsTrigger>
            <TabsTrigger value="spam">Spam Box</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="p-4">
          <DataTable
            columns={columns}
            data={filteredMessages}
            searchKey="subject"
            searchPlaceholder="Search sender, phone, subject..."
            enableRowSelection
            enableColumnVisibility
            enableSorting
            enablePagination
            pageSize={10}
          />
        </Card>
      </motion.div>
    </div>
  );
}
