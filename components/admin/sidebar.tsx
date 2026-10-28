"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "cn";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Building2,
  Tag,
  BarChart3,
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
  Globe,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useAdminAuth } from "@/components/admin/auth-context";

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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
interface NavSubItem {
  title: string;
  href: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: NavSubItem[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navItems: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
      },
      {
        title: "Analytics",
        href: "/admin/analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Commerce",
    items: [
      {
        title: "Orders",
        href: "/admin/orders",
        icon: ShoppingCart,
        badge: "12",
        children: [
          { title: "All Orders", href: "/admin/orders" },
          { title: "Incomplete Orders", href: "/admin/orders?status=incomplete_order" },
          { title: "Pending", href: "/admin/orders?status=pending" },
          { title: "Confirmed", href: "/admin/orders?status=confirmed" },
          { title: "Processing", href: "/admin/orders?status=processing" },
          { title: "Shipped", href: "/admin/orders?status=shipped" },
          { title: "Delivered", href: "/admin/orders?status=delivered" },
          { title: "Partially Delivered", href: "/admin/orders?status=partially_delivered" },
          { title: "Cancelled", href: "/admin/orders?status=cancelled" },
          { title: "Returned", href: "/admin/orders?status=returned" },
        ],
      },
      {
        title: "Payments",
        href: "/admin/payments",
        icon: CreditCard,
      },
      {
        title: "Shipments",
        href: "/admin/shipments",
        icon: Truck,
      },
      {
        title: "Coupons",
        href: "/admin/coupons",
        icon: Tag,
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        title: "Products",
        href: "/admin/products",
        icon: Package,
        children: [
          { title: "All Products", href: "/admin/products" },
          { title: "Variants", href: "/admin/products/variants" },
          { title: "Price Tiers", href: "/admin/products/price-tiers" },
          { title: "Images", href: "/admin/products/images" },
        ],
      },
      {
        title: "Categories",
        href: "/admin/categories",
        icon: Layers,
      },
    ],
  },
  {
    label: "Inventory",
    items: [
      {
        title: "Warehouses",
        href: "/admin/warehouses",
        icon: Warehouse,
      },
      {
        title: "Stock Levels",
        href: "/admin/inventory",
        icon: ClipboardList,
      },
      {
        title: "Batches & Lots",
        href: "/admin/batches",
        icon: ScrollText,
      },
      {
        title: "Suppliers",
        href: "/admin/suppliers",
        icon: Building2,
      },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        title: "Customers",
        href: "/admin/customers",
        icon: Users,
      },
      {
        title: "B2B Accounts",
        href: "/admin/businesses",
        icon: Building2,
        badge: "3",
      },
      {
        title: "Quote Requests",
        href: "/admin/quotes",
        icon: FileQuestion,
        badge: "5",
      },
    ],
  },
  {
    label: "Shipping",
    items: [
      {
        title: "Shipping Methods",
        href: "/admin/shipping",
        icon: Truck,
      },
      {
        title: "Delivery Zones",
        href: "/admin/shipping/zones",
        icon: Globe,
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        title: "Blog Posts",
        href: "/admin/posts",
        icon: FileText,
      },
      {
        title: "FAQs",
        href: "/admin/faqs",
        icon: MessageSquare,
      },
      {
        title: "Reviews",
        href: "/admin/reviews",
        icon: Star,
        badge: "8",
      },
      {
        title: "Messages",
        href: "/admin/messages",
        icon: Bell,
        badge: "4",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Staff Members",
        href: "/admin/staff",
        icon: Users,
      },
      {
        title: "Settings",
        href: "/admin/settings",
        icon: Settings,
      },
      {
        title: "Audit Log",
        href: "/admin/audit",
        icon: ScrollText,
      },
    ],
  },
];

function isSubItemActive(
  childHref: string,
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams> | null
) {
  if (childHref.includes("?status=")) {
    const url = new URL(childHref, "http://localhost");
    const targetStatus = url.searchParams.get("status");
    const currentStatus = searchParams?.get("status");
    return (
      pathname === url.pathname &&
      (currentStatus === targetStatus || (!currentStatus && targetStatus === "all"))
    );
  }
  if (childHref === "/admin/orders") {
    const currentStatus = searchParams?.get("status");
    return pathname === "/admin/orders" && (!currentStatus || currentStatus === "all");
  }
  return pathname === childHref;
}

function CollapsibleNavItem({
  item,
  pathname,
  searchParams,
}: {
  item: NavItem;
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams> | null;
}) {
  const isChildActive = Boolean(
    item.children?.some((child) =>
      isSubItemActive(child.href, pathname, searchParams)
    )
  );
  const isActive =
    pathname === item.href ||
    (item.href !== "/admin" && pathname.startsWith(item.href)) ||
    isChildActive;

  const [isOpen, setIsOpen] = React.useState(isActive);
  const [prevIsActive, setPrevIsActive] = React.useState(isActive);

  if (isActive !== prevIsActive) {
    setPrevIsActive(isActive);
    if (isActive) {
      setIsOpen(true);
    }
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={item.title} isActive={isActive} asChild>
          <CollapsibleTrigger className="flex w-full items-center gap-2">
            <item.icon />
            <span>{item.title}</span>
            {item.badge && (
              <Badge
                variant="secondary"
                className="ml-auto h-5 px-1.5 text-xs"
              >
                {item.badge}
              </Badge>
            )}
            <ChevronDown
              className={cn(
                "ml-auto transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
        </SidebarMenuButton>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children?.map((child) => {
              const isSubActive = isSubItemActive(
                child.href,
                pathname,
                searchParams
              );
              return (
                <SidebarMenuSubItem key={child.title}>
                  <SidebarMenuSubButton asChild isActive={isSubActive}>
                    <Link href={child.href}>{child.title}</Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function AdminSidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAdminAuth();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-amber-600 text-white">
                  <span className="text-xs font-bold">M</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Molasses Store</span>
                  <span className="truncate text-xs text-muted-foreground">Admin Panel</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navItems.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));

                if (item.children) {
                  return (
                    <CollapsibleNavItem
                      key={item.title}
                      item={item}
                      pathname={pathname}
                      searchParams={searchParams}
                    />
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton tooltip={item.title} asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-5 px-1.5 text-xs"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-1.5 p-1 w-full">
              <SidebarMenuButton size="lg" className="flex-1 min-w-0">
                <Avatar className="h-8 w-8 rounded-lg shrink-0">
                  <AvatarFallback className="rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                    {user?.initials || "AO"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-semibold">{user?.name || "Admin Owner"}</span>
                  <span className="truncate text-xs text-muted-foreground capitalize">
                    {user?.role || "owner"}
                  </span>
                </div>
              </SidebarMenuButton>
              <button
                type="button"
                onClick={() => logout()}
                title="Sign out"
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 cursor-pointer"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminSidebar() {
  return (
    <React.Suspense fallback={<Sidebar variant="inset" collapsible="icon" />}>
      <AdminSidebarContent />
    </React.Suspense>
  );
}
