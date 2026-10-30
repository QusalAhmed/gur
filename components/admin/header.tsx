"use client";

import { Bell, Search, LogOut, ShieldCheck, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger as SbTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { ROLE_CONFIG } from "@/lib/admin-auth";
import Link from "next/link";

function getBreadcrumb(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) return "Dashboard";
  return segments
    .slice(1)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" › ");
}

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const breadcrumb = getBreadcrumb(pathname);
  const { user, role, logout } = useAdminAuth();
  const { email: storeEmail } = useSiteSettings();

  const roleConfig = role ? ROLE_CONFIG[role] : ROLE_CONFIG.owner;
  const displayName = user?.name || "Admin Staff";
  const emailDomain = storeEmail && storeEmail.includes("@") ? storeEmail.split("@")[1] : "molassesstore.com";
  const displayEmail = user?.email || `staff@${emailDomain}`;
  const initials = user?.initials || displayName.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await logout();
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SbTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      {/* Breadcrumb */}
      <span className="text-sm text-muted-foreground hidden sm:block">
        Admin
      </span>
      {breadcrumb !== "Dashboard" && (
        <>
          <span className="text-sm text-muted-foreground hidden sm:block">›</span>
          <span className="text-sm font-medium hidden sm:block">{breadcrumb}</span>
        </>
      )}

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* Search */}
        <div className="relative hidden md:block w-60">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search catalog, orders..."
            className="pl-8 h-9 bg-muted/50 border-0 focus-visible:ring-1 text-xs"
          />
        </div>

        {/* Role Badge Indicator */}
        <div className="hidden sm:flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`text-[11px] font-semibold px-2 py-0.5 border ${roleConfig.colorClasses}`}
          >
            {roleConfig.label}
          </Badge>
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-amber-500 text-black font-bold">
                9
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">9 unread operational alerts</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { title: "New order placed", desc: "MOL-2610-01022 · ৳ 12,500", time: "2m ago", dot: "bg-blue-500" },
              { title: "Quote request received", desc: "RFQ-2610-01015 from Dairy Farm Ltd", time: "15m ago", dot: "bg-amber-500" },
              { title: "Low stock alert", desc: "Blackstrap Molasses 200L Drum", time: "1h ago", dot: "bg-red-500" },
              { title: "New B2B application", desc: "Rahman Feed Mills pending approval", time: "3h ago", dot: "bg-purple-500" },
            ].map((n, i) => (
              <DropdownMenuItem key={i} className="flex gap-3 p-3 cursor-pointer">
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.dot}`} />
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.desc}</p>
                  <p className="text-xs text-muted-foreground">{n.time}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Account Menu with Live Session Data & Logout */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full ring-1 ring-border/60 hover:ring-amber-500/50 transition-all">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2">
            <DropdownMenuLabel className="p-2">
              <div className="flex flex-col space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 border ${roleConfig.colorClasses}`}
                  >
                    {roleConfig.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => router.push("/admin/staff")}
              className="cursor-pointer flex items-center justify-between"
            >
              <span>Staff Directory</span>
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push("/admin/settings")}
              className="cursor-pointer"
            >
              System Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Sign Out Action */}
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer flex items-center gap-2 font-medium"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
