"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useAdminBadgeCounts } from "@/hooks/use-admin-badge-counts";
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
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
        href: "/admin/incomplete",
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

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, role, logout } = useAdminAuth();
  const { data: counts } = useAdminBadgeCounts();

  const roleConfig = role ? ROLE_CONFIG[role] : ROLE_CONFIG.support;

  return (
    <Sidebar className="border-r border-border/80 bg-zinc-50/50 dark:bg-zinc-950/50 backdrop-blur-sm">
      {/* Brand Header */}
      <SidebarHeader className="border-b border-border/60 px-4 py-3">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-white font-bold shadow-sm ring-1 ring-amber-700/20">
            গূ
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              খাঁটি গুড় অ্যাডমিন
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              Molasses Operations
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Navigation Groups */}
      <SidebarContent className="px-2 py-2">
        {navGroups.map((group) => {
          // Filter items by role capability
          const visibleItems = group.items.filter((item) =>
            !role ? true : canRoleAccessPath(role, item.href)
          );

          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 px-2">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname === item.href || pathname.startsWith(item.href + "/");

                  const badgeCount = item.badgeKey && counts ? counts[item.badgeKey] : 0;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={cn(
                          "h-8.5 rounded-lg px-2 text-xs font-medium transition-colors",
                          isActive
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                            : "text-muted-foreground hover:bg-zinc-200/50 hover:text-foreground dark:hover:bg-zinc-900"
                        )}
                      >
                        <Link href={item.href} className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isActive ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                              )}
                            />
                            <span>{item.title}</span>
                          </div>
                          {badgeCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="h-4.5 px-1.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
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
      <SidebarFooter className="border-t border-border/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8 rounded-lg border border-border">
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
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-zinc-200 hover:text-foreground dark:hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
