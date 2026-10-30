"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast-notification";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AdminAuthProvider } from "@/components/admin/auth-context";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // If on login page or dedicated printable invoice page, render full screen without the administrative sidebar or header
  if (pathname === "/admin/login" || pathname === "/admin/orders/print") {
    return (
      <TooltipProvider>
        <ToastProvider>
          <Suspense fallback={null}>
            <AdminAuthProvider>{children}</AdminAuthProvider>
          </Suspense>
        </ToastProvider>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <ToastProvider>
        <Suspense fallback={null}>
          <AdminAuthProvider>
            <SidebarProvider className="min-w-0 max-w-full overflow-x-hidden">
              <AdminSidebar />
              <SidebarInset className="min-w-0 max-w-full">
                <AdminHeader />
                <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-2 sm:px-4">
                  {children}
                </div>
              </SidebarInset>
            </SidebarProvider>
          </AdminAuthProvider>
        </Suspense>
      </ToastProvider>
    </TooltipProvider>
  );
}
