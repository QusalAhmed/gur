"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  Users,
  CreditCard,
  Settings,
  FileText,
  Truck,
  Building2,
  Clock,
  MessageSquare,
  Star,
  ShieldCheck,
  Bell,
  PlusCircle,
  FileQuestion,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { searchGlobalAction, QuickSearchResult } from "@/actions/quick-search";
import { formatBDT } from "@/lib/admin-format";
import { useAdminAuth } from "@/components/admin/auth-context";
import { canRoleAccessPath } from "@/lib/admin-permissions";

const EMPTY_RESULTS: QuickSearchResult = {
  orders: [],
  products: [],
  customers: [],
};

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { role } = useAdminAuth();
  const [query, setQuery] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [searchResults, setSearchResults] = React.useState<QuickSearchResult>(EMPTY_RESULTS);

  const isShortQuery = !query || query.trim().length < 2;
  const effectiveResults = isShortQuery ? EMPTY_RESULTS : searchResults;

  // Debounced search
  React.useEffect(() => {
    if (isShortQuery) return;

    const timeout = setTimeout(() => {
      startTransition(async () => {
        const res = await searchGlobalAction(query);
        setSearchResults(res);
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [query, isShortQuery]);

  const handleSelect = (url: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(url);
  };

  const navItems = [
    { label: "Overview / ড্যাশবোর্ড", path: "/admin", icon: LayoutDashboard },
    { label: "Orders / অর্ডার তালিকা", path: "/admin/orders", icon: ShoppingCart },
    { label: "Create Order / নতুন অর্ডার", path: "/admin/orders?create=true", icon: PlusCircle },
    { label: "Incomplete Checkouts / অসম্পূর্ণ অর্ডার", path: "/admin/orders?status=incomplete_order", icon: Clock },
    { label: "Shipments / শিপমেন্ট", path: "/admin/shipments", icon: Truck },
    { label: "Inventory Levels / স্টক তালিকা", path: "/admin/inventory", icon: Package },
    { label: "Lots & Batches / গুড়ের লট", path: "/admin/batches", icon: Layers },
    { label: "Products / ক্যাটালগ", path: "/admin/products", icon: Package },
    { label: "Categories / ক্যাটাগরি", path: "/admin/categories", icon: Layers },
    { label: "Customers CRM / গ্রাহক", path: "/admin/customers", icon: Users },
    { label: "B2B Accounts / পাইকারি গ্রাহক", path: "/admin/businesses", icon: Building2 },
    { label: "RFQ Quotes / কোটেশন আবেদন", path: "/admin/quotes", icon: FileQuestion },
    { label: "Reviews / রিভিউ যাচাই", path: "/admin/reviews", icon: Star },
    { label: "Messages / ইনবক্স", path: "/admin/messages", icon: MessageSquare },
    { label: "Payments & Reconciliation / পেমেন্ট", path: "/admin/payments", icon: CreditCard },
    { label: "Settings / সেটিংস", path: "/admin/settings", icon: Settings },
    { label: "Staff Roles / স্টাফ পারমিশন", path: "/admin/staff", icon: ShieldCheck },
    { label: "Audit Log / অডিট লগ", path: "/admin/audit", icon: FileText },
    { label: "Outbox / নোটিফিকেশন মেসেজ", path: "/admin/outbox", icon: Bell },
  ];

  const allowedNav = navItems.filter(
    (item) => !role || canRoleAccessPath(role, item.path)
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Global Command Search"
      description="Quickly jump to orders, products, customers or pages"
    >
      <CommandInput
        placeholder="Type a command, order #, phone, product name..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isPending ? "Searching..." : "No matching orders, products or pages found."}
        </CommandEmpty>

        {/* Live Search: Orders */}
        {effectiveResults.orders.length > 0 && (
          <CommandGroup heading="Orders">
            {effectiveResults.orders.map((o) => (
              <CommandItem
                key={o.id}
                value={`order-${o.order_number}-${o.customer_name}-${o.customer_phone}`}
                onSelect={() => handleSelect(`/admin/orders/${o.id}`)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-amber-600" />
                  <span className="font-mono font-medium">{o.order_number}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm">{o.customer_name}</span>
                  <span className="text-xs text-muted-foreground">({o.customer_phone})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{formatBDT(o.grand_total)}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {o.status}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Live Search: Products */}
        {effectiveResults.products.length > 0 && (
          <CommandGroup heading="Products">
            {effectiveResults.products.map((p) => (
              <CommandItem
                key={p.id}
                value={`product-${p.name}-${p.slug}`}
                onSelect={() => handleSelect(`/admin/products/${p.id}/edit`)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">{p.name}</span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{p.slug}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Live Search: Customers */}
        {effectiveResults.customers.length > 0 && (
          <CommandGroup heading="Customers">
            {effectiveResults.customers.map((c) => (
              <CommandItem
                key={c.id}
                value={`customer-${c.name}-${c.phone}`}
                onSelect={() => handleSelect(`/admin/customers/${c.id}`)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">{c.name}</span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{c.phone}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {query.trim().length >= 2 && <CommandSeparator />}

        {/* Navigation Links */}
        <CommandGroup heading="Navigation">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.path}
                value={item.label}
                onSelect={() => handleSelect(item.path)}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
