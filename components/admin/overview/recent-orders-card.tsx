"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingCart, ArrowUpRight, Plus, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBDT, formatDhakaDateTime, formatPhoneDisplay } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

interface RecentOrdersCardProps {
  orders: Array<{
    id: string;
    order_number: string;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    grand_total: number;
    status: string;
    payment_status: string;
    fulfillment_status: string;
    channel: string;
    order_items: Array<{
      id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
    }>;
  }>;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  incomplete_order: {
    label: "Incomplete",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  processing: {
    label: "Processing",
    className: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  },
  shipped: {
    label: "Shipped",
    className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  },
  delivered: {
    label: "Delivered",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
  },
  returned: {
    label: "Returned",
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
  },
};

const PAYMENT_BADGES: Record<string, { label: string; className: string }> = {
  unpaid: {
    label: "Unpaid",
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
  },
  partially_paid: {
    label: "Partially Paid",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  paid: {
    label: "Paid",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  refunded: {
    label: "Refunded",
    className: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/30",
  },
};

export function RecentOrdersCard({ orders }: RecentOrdersCardProps) {
  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4 sm:px-6">
        <div>
          <CardTitle className="text-base font-semibold tracking-tight">Recent Orders</CardTitle>
          <CardDescription className="text-xs">Latest customer purchases and order status</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1 border-border/80">
            <Link href="/admin/orders/new">
              <Plus className="h-3.5 w-3.5" />
              New Order
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs gap-1 text-amber-600 dark:text-amber-400">
            <Link href="/admin/orders">
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-2">
        {orders.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No orders yet</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              Orders placed on the storefront or via phone will appear here.
            </p>
            <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
              <Link href="/admin/orders/new">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Place First Order
              </Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-y border-border/60">
                <tr>
                  <th className="py-2 px-4 font-medium">Order #</th>
                  <th className="py-2 px-4 font-medium">Date & Time</th>
                  <th className="py-2 px-4 font-medium">Customer</th>
                  <th className="py-2 px-4 font-medium">Items</th>
                  <th className="py-2 px-4 font-medium text-right">Total</th>
                  <th className="py-2 px-4 font-medium text-center">Status</th>
                  <th className="py-2 px-4 font-medium text-center">Payment</th>
                  <th className="py-2 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {orders.map((o) => {
                  const statusBadge = STATUS_BADGES[o.status] || {
                    label: o.status,
                    className: "bg-muted text-muted-foreground",
                  };
                  const paymentBadge = PAYMENT_BADGES[o.payment_status] || {
                    label: o.payment_status,
                    className: "bg-muted text-muted-foreground",
                  };

                  const itemsCount = o.order_items?.length || 0;
                  const firstItem = o.order_items?.[0]?.product_name || "Order Item";

                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-foreground">
                        <Link href={`/admin/orders/${o.id}`} className="hover:underline hover:text-amber-600">
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                        {formatDhakaDateTime(o.created_at, "dd MMM, hh:mm a")}
                      </td>
                      <td className="py-2.5 px-4 min-w-[140px]">
                        <p className="font-medium text-foreground truncate">{o.customer_name || "Guest"}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {formatPhoneDisplay(o.customer_phone)}
                        </p>
                      </td>
                      <td className="py-2.5 px-4 max-w-[200px] truncate text-muted-foreground">
                        {firstItem}
                        {itemsCount > 1 && (
                          <span className="text-[10px] ml-1 font-semibold text-foreground/70">
                            +{itemsCount - 1} more
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground">
                        {formatBDT(o.grand_total)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", statusBadge.className)}
                        >
                          {statusBadge.label}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", paymentBadge.className)}
                        >
                          {paymentBadge.label}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button asChild size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                          <Link href={`/admin/orders/${o.id}`} title="View Order">
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
