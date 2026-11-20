"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  PhoneCall,
  Package,
  Menu,
} from "lucide-react";
import { useAdminBadgeCounts } from "@/hooks/use-admin-badge-counts";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

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

export function AdminBottomNav() {
  const pathname = usePathname();
  const { setOpenMobile, openMobile } = useSidebar();
  const { data: counts } = useAdminBadgeCounts();
  const mounted = useMounted();

  const normalizedPathname = pathname.startsWith("/admin")
    ? pathname
    : `/admin${pathname === "/" ? "" : pathname}`;

  const pendingOrders = mounted && counts?.pendingOrders ? counts.pendingOrders : 0;
  const dueCallbacks = mounted && counts?.dueCallbacks ? counts.dueCallbacks : 0;

  const isHomeActive = normalizedPathname === "/admin";
  const isOrdersActive = normalizedPathname.startsWith("/admin/orders");
  const isCallsActive = normalizedPathname.startsWith("/admin/calls");
  const isProductsActive = normalizedPathname.startsWith("/admin/products");

  // Determine if "More" represents an active subpage outside the 4 shortcuts
  const isMoreActive =
    openMobile ||
    (!isHomeActive && !isOrdersActive && !isCallsActive && !isProductsActive);

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 inset-x-0 z-40 block md:hidden border-t border-border/80 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      <div className="grid grid-cols-5 h-14 items-center">
        {/* 1. Dashboard */}
        <Link
          href={toCleanPath("/admin")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 h-full py-1 text-center transition-colors focus-visible:outline-hidden",
            isHomeActive
              ? "text-amber-600 dark:text-amber-400 font-semibold"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          )}
        >
          <div className="relative flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <span className="text-[10px] leading-none tracking-tight">Overview</span>
        </Link>

        {/* 2. Orders (with badge) */}
        <Link
          href={toCleanPath("/admin/orders")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 h-full py-1 text-center transition-colors focus-visible:outline-hidden",
            isOrdersActive
              ? "text-amber-600 dark:text-amber-400 font-semibold"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          )}
        >
          <div className="relative flex items-center justify-center">
            <ShoppingCart className="h-5 w-5" />
            {pendingOrders > 0 && (
              <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-bold text-white shadow-xs animate-in zoom-in-50">
                {pendingOrders > 99 ? "99+" : pendingOrders}
              </span>
            )}
          </div>
          <span className="text-[10px] leading-none tracking-tight">Orders</span>
        </Link>

        {/* 3. Calls (with badge) */}
        <Link
          href={toCleanPath("/admin/calls")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 h-full py-1 text-center transition-colors focus-visible:outline-hidden",
            isCallsActive
              ? "text-amber-600 dark:text-amber-400 font-semibold"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          )}
        >
          <div className="relative flex items-center justify-center">
            <PhoneCall className="h-5 w-5" />
            {dueCallbacks > 0 && (
              <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-bold text-white shadow-xs animate-in zoom-in-50">
                {dueCallbacks > 9 ? "9+" : dueCallbacks}
              </span>
            )}
          </div>
          <span className="text-[10px] leading-none tracking-tight">Calls</span>
        </Link>

        {/* 4. Products */}
        <Link
          href={toCleanPath("/admin/products")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 h-full py-1 text-center transition-colors focus-visible:outline-hidden",
            isProductsActive
              ? "text-amber-600 dark:text-amber-400 font-semibold"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          )}
        >
          <div className="relative flex items-center justify-center">
            <Package className="h-5 w-5" />
          </div>
          <span className="text-[10px] leading-none tracking-tight">Products</span>
        </Link>

        {/* 5. More (opens full sidebar drawer) */}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className={cn(
            "flex flex-col items-center justify-center gap-1 h-full py-1 text-center transition-colors cursor-pointer focus-visible:outline-hidden active:scale-95",
            isMoreActive
              ? "text-amber-600 dark:text-amber-400 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Open full menu"
        >
          <div className="relative flex items-center justify-center">
            <Menu className="h-5 w-5" />
          </div>
          <span className="text-[10px] leading-none tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
