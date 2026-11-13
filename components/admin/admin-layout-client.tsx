"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AdminAuthProvider } from "@/components/admin/auth-context";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";

function AdminRealtimeBridge({ enabled }: { enabled: boolean }) {
  useAdminRealtime(enabled);
  return null;
}

export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBareLayout =
    pathname === "/login" ||
    pathname === "/admin/login" ||
    pathname === "/orders/print" ||
    pathname === "/admin/orders/print";

  return (
    <TooltipProvider>
      <AdminAuthProvider>
        <AdminRealtimeBridge enabled={!isBareLayout} />
        {isBareLayout ? (
          children
        ) : (
          <SidebarProvider className="min-w-0 max-w-full overflow-x-hidden">
            <AdminSidebar />
            <SidebarInset className="min-w-0 max-w-full">
              <AdminHeader />
              <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-2 sm:px-4 pt-2 sm:pt-3 pb-14 sm:pb-16 lg:pb-20">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        )}
      </AdminAuthProvider>
    </TooltipProvider>
  );
}
