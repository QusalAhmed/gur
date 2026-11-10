"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Building2,
  Tag,
  FileText,
  MessageSquare,
  Settings,
  Truck,
  Warehouse,
  Star,
  Bell,
  Layers,
  ClipboardList,
  CreditCard,
  FileQuestion,
  ScrollText,
  Clock,
  ShieldCheck,
  LogOut,
  Gift,
} from "lucide-react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useAdminBadgeCounts } from "@/hooks/use-admin-badge-counts";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { canRoleAccessPath, ROLE_CONFIG } from "@/lib/admin-permissions";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  title: string;
  titleBn: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "pendingOrders" | "incompleteOrders" | "pendingReviews" | "newQuotes" | "newMessages";
}

interface NavGroup {
  label: string;
  labelBn: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    labelBn: "ওভারভিউ",
    items: [
      {
        title: "Overview",
        titleBn: "ড্যাশবোর্ড",
        href: "/admin",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Sales",
    labelBn: "বিক্রয় ও অর্ডার",
    items: [
      {
        title: "Orders",
        titleBn: "অর্ডারসমূহ",
        href: "/admin/orders",
        icon: ShoppingCart,
        badgeKey: "pendingOrders",
      },
      {
        title: "Incomplete",
        titleBn: "অসম্পূর্ণ চেকআউট",
        href: "/admin/orders?status=incomplete_order",
        icon: Clock,
        badgeKey: "incompleteOrders",
      },
      {
        title: "Shipments",
        titleBn: "শিপমেন্ট ও ট্র্যাকিং",
        href: "/admin/shipments",
        icon: Truck,
      },
    ],
  },
  {
    label: "Inventory",
    labelBn: "ইনভেন্টরি ও লট",
    items: [
      {
        title: "Stock Levels",
        titleBn: "স্টক ও লেজার",
        href: "/admin/inventory",
        icon: ClipboardList,
      },
      {
        title: "Lots & Batches",
        titleBn: "লট ও মান নিয়ন্ত্রণ",
        href: "/admin/batches",
        icon: ScrollText,
      },
      {
        title: "Suppliers",
        titleBn: "গাছি ও সরবরাহকারী",
        href: "/admin/suppliers",
        icon: Building2,
      },
      {
        title: "Warehouses",
        titleBn: "গুদাম",
        href: "/admin/warehouses",
        icon: Warehouse,
      },
    ],
  },
  {
    label: "Catalog",
    labelBn: "পণ্য ক্যাটালগ",
    items: [
      {
        title: "Products",
        titleBn: "পণ্য তালিকা",
        href: "/admin/products",
        icon: Package,
      },
      {
        title: "Combos & Bundles",
        titleBn: "কম্বো অফার",
        href: "/admin/combos",
        icon: Gift,
      },
      {
        title: "Categories",
        titleBn: "ক্যাটাগরি",
        href: "/admin/categories",
        icon: Layers,
      },
    ],
  },
  {
    label: "Customers",
    labelBn: "গ্রাহক ও B2B",
    items: [
      {
        title: "Customers CRM",
        titleBn: "গ্রাহক তালিকা",
        href: "/admin/customers",
        icon: Users,
      },
      {
        title: "B2B Accounts",
        titleBn: "পাইকারি অ্যাকাউন্ট",
        href: "/admin/businesses",
        icon: Building2,
      },
      {
        title: "Quote Requests",
        titleBn: "কোটেশন (RFQ)",
        href: "/admin/quotes",
        icon: FileQuestion,
        badgeKey: "newQuotes",
      },
      {
        title: "Reviews",
        titleBn: "রিভিউ যাচাই",
        href: "/admin/reviews",
        icon: Star,
        badgeKey: "pendingReviews",
      },
      {
        title: "Messages",
        titleBn: "ইনবক্স মেসেজ",
        href: "/admin/messages",
        icon: MessageSquare,
        badgeKey: "newMessages",
      },
    ],
  },
  {
    label: "Finance",
    labelBn: "অর্থ ও পেমেন্ট",
    items: [
      {
        title: "Payments",
        titleBn: "পেমেন্ট ও রিকনসিলিয়েশন",
        href: "/admin/payments",
        icon: CreditCard,
      },
    ],
  },
  {
    label: "Settings",
    labelBn: "সেটিংস ও নিরাপত্তা",
    items: [
      {
        title: "Store Settings",
        titleBn: "স্টোর কনফিগারেশন",
        href: "/admin/settings",
        icon: Settings,
      },
      {
        title: "Shipping & Zones",
        titleBn: "শিপিং রেট ও এলাকা",
        href: "/admin/shipping",
        icon: Truck,
      },
      {
        title: "Coupons",
        titleBn: "ডিসকাউন্ট কুপন",
        href: "/admin/coupons",
        icon: Tag,
      },
      {
        title: "Staff Roles",
        titleBn: "স্টাফ পারমিশন",
        href: "/admin/staff",
        icon: ShieldCheck,
      },
      {
        title: "Audit Log",
        titleBn: "অডিট লগ",
        href: "/admin/audit",
        icon: FileText,
      },
      {
        title: "Notification Outbox",
        titleBn: "আউটবক্স কিউ",
        href: "/admin/outbox",
        icon: Bell,
      },
    ],
  },
];

const emptySubscribe = () => () => {};
function useMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, role, logout } = useAdminAuth();
  const { data: counts } = useAdminBadgeCounts();
  const { storeName, storeNameBn, logoUrl } = useSiteSettings();
  const mounted = useMounted();

  const roleConfig = role ? ROLE_CONFIG[role] : ROLE_CONFIG.support;

  // Render stable server fallback ("গুড়" / placeholder initial) until mounted
  // to avoid SSR/client hydration mismatches when React Query client cache has settings
  const brandName = mounted ? (storeNameBn || storeName || "গুড়") : "গুড়";
  const brandSubtitle =
    mounted && storeName && storeNameBn && storeName !== storeNameBn
      ? storeName
      : "Molasses Operations";
  const effectiveLogoUrl = mounted ? logoUrl : "";

  const brandInitial =
    brandName.length >= 2 && brandName.charCodeAt(1) >= 0x0980 && brandName.charCodeAt(1) <= 0x09ff
      ? brandName.slice(0, 2)
      : brandName.slice(0, 1).toUpperCase();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/80 bg-zinc-50/50 dark:bg-zinc-950/50 backdrop-blur-sm transition-[width] duration-200"
    >
      {/* Brand Header */}
      <SidebarHeader className="border-b border-border/60 px-4 py-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2.5">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center w-full"
          title={brandName}
        >
          {effectiveLogoUrl ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border border-border/80 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={effectiveLogoUrl}
                alt={brandName}
                className="h-full w-full object-contain p-0.5"
              />
            </div>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white font-bold shadow-sm ring-1 ring-amber-700/20 text-sm">
              {brandInitial}
            </div>
          )}
          <div className="flex flex-col group-data-[collapsible=icon]:hidden min-w-0">
            <span className="text-sm font-semibold tracking-tight text-foreground truncate">
              {brandName}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium truncate">
              {brandSubtitle}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Navigation Groups */}
      <SidebarContent className="px-2 py-2 group-data-[collapsible=icon]:px-1.5">
        {navGroups.map((group) => {
          // Filter items by role capability
          const visibleItems = group.items.filter((item) =>
            !role ? true : canRoleAccessPath(role, item.href)
          );

          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup
              key={group.label}
              className="py-1 group-data-[collapsible=icon]:py-0.5"
            >
              <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 px-2 group-data-[collapsible=icon]:hidden">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu className="gap-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const [itemPath, itemQuery] = item.href.split("?");

                  let isActive = false;
                  if (item.href === "/admin") {
                    isActive = pathname === "/admin";
                  } else if (itemQuery) {
                    const itemParams = new URLSearchParams(itemQuery);
                    const matchesPath = pathname === itemPath;
                    const matchesParams = Array.from(itemParams.entries()).every(
                      ([k, v]) => searchParams?.get(k) === v
                    );
                    isActive = matchesPath && matchesParams;
                  } else {
                    const matchesPath =
                      pathname === item.href || pathname.startsWith(item.href + "/");
                    const hasStatusIncomplete =
                      pathname === "/admin/orders" &&
                      searchParams?.get("status") === "incomplete_order";
                    isActive = matchesPath && !hasStatusIncomplete;
                  }

                  const badgeCount = mounted && item.badgeKey && counts ? counts[item.badgeKey] : 0;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={{
                          children: (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 font-medium">
                                <span>{item.title}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  ({item.titleBn})
                                </span>
                              </div>
                              {badgeCount > 0 && (
                                <span className="text-[10px] text-amber-500 font-semibold">
                                  {badgeCount} pending
                                </span>
                              )}
                            </div>
                          ),
                        }}
                        className={cn(
                          "h-8.5 rounded-lg px-2 text-xs font-medium transition-colors group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:mx-auto",
                          isActive
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                            : "text-muted-foreground hover:bg-zinc-200/50 hover:text-foreground dark:hover:bg-zinc-900"
                        )}
                      >
                        <Link
                          href={item.href}
                          className="flex items-center justify-between w-full group-data-[collapsible=icon]:justify-center"
                        >
                          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:gap-0 min-w-0">
                            <div className="relative flex items-center justify-center shrink-0">
                              <Icon
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  isActive
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-muted-foreground"
                                )}
                              />
                              {badgeCount > 0 && (
                                <span className="absolute -top-1 -right-1.5 hidden group-data-[collapsible=icon]:flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-600 px-0.5 text-[8px] font-bold text-white shadow-xs">
                                  {badgeCount > 9 ? "•" : badgeCount}
                                </span>
                              )}
                            </div>
                            <span className="truncate group-data-[collapsible=icon]:hidden">
                              {item.title}
                            </span>
                          </div>
                          {badgeCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="h-4.5 px-1.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 group-data-[collapsible=icon]:hidden shrink-0"
                            >
                              {badgeCount > 99 ? "99+" : badgeCount}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Footer: User profile & role badge */}
      <SidebarFooter className="border-t border-border/60 p-2.5 group-data-[collapsible=icon]:p-1.5">
        {/* Expanded View */}
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8 rounded-lg border border-border shrink-0">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback className="rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 text-xs font-semibold">
                {user?.initials || "ST"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-medium text-foreground">
                {user?.name || "Staff Member"}
              </span>
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded border",
                    roleConfig.colorClasses
                  )}
                >
                  {roleConfig.label}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Sign out / লগ আউট"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-zinc-200 hover:text-foreground dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Collapsed View: Avatar Dropdown Menu */}
        <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center justify-center rounded-lg p-0.5 outline-hidden ring-sidebar-ring focus-visible:ring-2 hover:bg-sidebar-accent cursor-pointer"
              title={`${user?.name || "Staff Member"} (${roleConfig.label})`}
            >
              <Avatar className="h-8 w-8 rounded-lg border border-border">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                <AvatarFallback className="rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 text-xs font-semibold">
                  {user?.initials || "ST"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="end"
              sideOffset={8}
              className="w-56 p-1.5 shadow-lg"
            >
              <div className="flex items-center gap-2.5 p-2">
                <Avatar className="h-8 w-8 rounded-lg border border-border">
                  {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback className="rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 text-xs font-semibold">
                    {user?.initials || "ST"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {user?.name || "Staff Member"}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {user?.email}
                  </span>
                  <div className="mt-1">
                    <span
                      className={cn(
                        "text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded border",
                        roleConfig.colorClasses
                      )}
                    >
                      {roleConfig.label}
                    </span>
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer gap-2 py-1.5"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out / লগ আউট</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
