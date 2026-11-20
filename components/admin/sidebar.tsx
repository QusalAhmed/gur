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
  ArrowUpDown,
  PhoneCall,
  Image as ImageIcon,
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
  badgeKey?: "pendingOrders" | "incompleteOrders" | "pendingReviews" | "newQuotes" | "newMessages" | "dueCallbacks";
}

interface NavGroup {
  label: string;
  labelBn: string;
  items: NavItem[];
}

// Tier 1: Daily Operations (Fulfillment, Inventory, Catalog, Customers)
const tier1Groups: NavGroup[] = [
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
    label: "Sales & Orders",
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
    label: "Catalog & Stock",
    labelBn: "পণ্য ও ইনভেন্টরি",
    items: [
      {
        title: "Products",
        titleBn: "পণ্য তালিকা",
        href: "/admin/products",
        icon: Package,
      },
      {
        title: "Product Images",
        titleBn: "পণ্যের ছবি ও মিডিয়া",
        href: "/admin/products/images",
        icon: ImageIcon,
      },
      {
        title: "Product Ordering",
        titleBn: "পণ্য ক্রম সাজানো",
        href: "/admin/products/reorder",
        icon: ArrowUpDown,
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
    label: "Customers & CRM",
    labelBn: "গ্রাহক ও যোগাযোগ",
    items: [
      {
        title: "Customers CRM",
        titleBn: "গ্রাহক তালিকা",
        href: "/admin/customers",
        icon: Users,
      },
      {
        title: "Call Lists",
        titleBn: "কল লিস্ট ও ট্র্যাকার",
        href: "/admin/calls",
        icon: PhoneCall,
        badgeKey: "dueCallbacks",
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
];

// Tier 2: Administration & Configuration (Finance, Settings, Security)
const tier2Groups: NavGroup[] = [
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
    label: "Store Settings",
    labelBn: "স্টোর সেটিংস",
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
    ],
  },
  {
    label: "System & Security",
    labelBn: "সিস্টেম ও অডিট",
    items: [
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

function toCleanPath(href: string): string {
  if (href === "/admin") return "/";
  if (href.startsWith("/admin?")) return href.replace(/^\/admin/, "");
  if (href.startsWith("/admin/")) return href.replace(/^\/admin/, "");
  return href;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, role, logout } = useAdminAuth();
  const { data: counts } = useAdminBadgeCounts();
  const { storeName, logoUrl } = useSiteSettings();
  const mounted = useMounted();

  const roleConfig = role ? ROLE_CONFIG[role] : ROLE_CONFIG.support;

  // Set of all base item paths across all sidebar groups to prevent parent links
  // from remaining highlighted when on a child page with its own sidebar item
  const allItemPaths = React.useMemo(() => {
    const set = new Set<string>();
    const allGroups = [...tier1Groups, ...tier2Groups];
    for (const group of allGroups) {
      for (const item of group.items) {
        set.add(item.href.split("?")[0]);
      }
    }
    return set;
  }, []);

  const brandName = mounted ? (storeName || "Gramayon") : "Gramayon";
  const effectiveLogoUrl = mounted && logoUrl ? logoUrl : "/admin-icon/icon-192.png";
  const brandInitial = brandName.slice(0, 1).toUpperCase();

  const renderNavGroup = (group: NavGroup) => {
    const visibleItems = group.items.filter((item) =>
      !role ? true : canRoleAccessPath(role, item.href)
    );

    if (visibleItems.length === 0) return null;

    return (
      <SidebarGroup
        key={group.label}
        className="py-1 group-data-[collapsible=icon]:py-0.5"
      >
        <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2 group-data-[collapsible=icon]:hidden">
          {group.label}
        </SidebarGroupLabel>
        <SidebarMenu className="gap-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const [itemPath, itemQuery] = item.href.split("?");
            const normalizedPathname = pathname.startsWith("/admin")
              ? pathname
              : `/admin${pathname === "/" ? "" : pathname}`;

            let isActive = false;
            if (item.href === "/admin") {
              isActive = normalizedPathname === "/admin";
            } else if (itemQuery) {
              const itemParams = new URLSearchParams(itemQuery);
              const matchesPath = normalizedPathname === itemPath;
              const matchesParams = Array.from(itemParams.entries()).every(
                ([k, v]) => searchParams?.get(k) === v
              );
              isActive = matchesPath && matchesParams;
            } else {
              if (normalizedPathname === itemPath) {
                const hasStatusIncomplete =
                  normalizedPathname === "/admin/orders" &&
                  searchParams?.get("status") === "incomplete_order";
                isActive = !hasStatusIncomplete;
              } else if (normalizedPathname.startsWith(itemPath + "/")) {
                const hasSpecificSidebarMatch = allItemPaths.has(normalizedPathname);
                isActive = !hasSpecificSidebarMatch;
              }

              // Explicit safeguard for specific subroutes
              if (
                (normalizedPathname.startsWith("/admin/products/reorder") ||
                  normalizedPathname.startsWith("/admin/products/images")) &&
                (itemPath === "/admin/products" || itemPath === "/admin/orders")
              ) {
                isActive = false;
              }
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
                    "relative h-8.5 rounded-lg px-2 text-xs font-medium transition-all group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:mx-auto",
                    isActive
                      ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-amber-600 dark:before:bg-amber-500 shadow-xs"
                      : "text-muted-foreground hover:bg-zinc-200/60 hover:text-foreground dark:hover:bg-zinc-900/80"
                  )}
                >
                  <Link
                    href={toCleanPath(item.href)}
                    className="flex items-center justify-between w-full group-data-[collapsible=icon]:justify-center"
                  >
                    <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:gap-0 min-w-0">
                      <div className="relative flex items-center justify-center shrink-0">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
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
                        className={cn(
                          "h-4.5 px-1.5 text-[10px] font-bold rounded-full group-data-[collapsible=icon]:hidden shrink-0 border transition-all",
                          isActive
                            ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                        )}
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
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/80 bg-zinc-50/50 dark:bg-zinc-950/50 backdrop-blur-sm transition-[width] duration-200"
    >
      {/* Brand Header */}
      <SidebarHeader className="border-b border-border/60 px-3.5 py-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2.5">
        <Link
          href={toCleanPath("/admin")}
          className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center w-full"
          title={brandName}
        >
          {effectiveLogoUrl ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border border-border/80 shadow-xs ring-1 ring-border/30">
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
              Operations Console
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Navigation Groups */}
      <SidebarContent className="px-2 py-2 group-data-[collapsible=icon]:px-1.5">
        {/* Tier 1: Daily Operations */}
        {tier1Groups.map((group) => renderNavGroup(group))}

        {/* Distinct Visual Divider for Tier 2: Administration */}
        <div className="my-2.5 border-t border-border/70 mx-2 group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:mx-1" />

        <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/90 bg-muted/40 rounded-md border border-border/40">
            <ShieldCheck className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span>Administration & System</span>
          </div>
        </div>

        {/* Tier 2: Administration & Configuration */}
        {tier2Groups.map((group) => renderNavGroup(group))}
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
