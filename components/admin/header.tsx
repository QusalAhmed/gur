"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  LogOut,
  ShieldCheck,
  User,
  Save,
  Loader2,
  Download,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { AdminNotificationsPopover } from "@/components/admin/notifications-popover";
import { AdminSmsBalance } from "@/components/admin/sms-balance";
import { CommandPalette } from "@/components/admin/command-palette";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/ui/image-uploader";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useAdminPwa } from "@/components/admin/admin-pwa-provider";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { ROLE_CONFIG } from "@/lib/admin-permissions";
import { AdminLoadingBar } from "@/components/admin/admin-loading-bar";
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

function resolveStorefrontUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_SITE_URL || "/";
  }

  const { hostname, host, protocol } = window.location;

  // 1. If currently on production admin subdomain
  if (
    hostname === "admin.khatikhejurgur.shop" ||
    (hostname.endsWith(".khatikhejurgur.shop") && hostname.startsWith("admin."))
  ) {
    return "https://khatikhejurgur.shop/";
  }

  // 2. If on any admin.* subdomain (e.g. admin.localhost:3000, admin.staging.com)
  if (hostname.startsWith("admin.")) {
    const mainHost = host.replace(/^admin\./, "");
    return `${protocol}//${mainHost}/`;
  }

  // 3. If on public site with configured NEXT_PUBLIC_SITE_URL
  if (
    process.env.NEXT_PUBLIC_SITE_URL &&
    !hostname.includes("localhost") &&
    !hostname.includes("127.0.0.1")
  ) {
    const base = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    return `${base}/`;
  }

  // 4. Default to current origin's root path
  return `${protocol}//${host}/`;
}

interface BreadcrumbSegment {
  label: string;
  href?: string;
  isLast: boolean;
}

const SEGMENT_TITLES: Record<string, string> = {
  admin: "Admin",
  orders: "Orders",
  shipments: "Shipments",
  inventory: "Stock Levels",
  batches: "Lots & Batches",
  suppliers: "Suppliers",
  warehouses: "Warehouses",
  products: "Products",
  images: "Media Gallery",
  reorder: "Reorder",
  variants: "Variants",
  combos: "Combos",
  categories: "Categories",
  customers: "Customers",
  calls: "Call Lists",
  businesses: "B2B Accounts",
  quotes: "Quotes",
  reviews: "Reviews",
  messages: "Messages",
  payments: "Payments",
  settings: "Settings",
  shipping: "Shipping",
  zones: "Delivery Zones",
  coupons: "Coupons",
  staff: "Staff Directory",
  audit: "Audit Log",
  outbox: "Outbox Queue",
  new: "New",
  edit: "Edit",
  "price-tiers": "Price Tiers",
};

function formatSegmentLabel(segment: string): string {
  const lower = segment.toLowerCase();
  if (SEGMENT_TITLES[lower]) return SEGMENT_TITLES[lower];
  if (/^\d+$/.test(segment)) return `#${segment}`;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(segment)) return `#${segment.slice(0, 6)}…`;
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildBreadcrumbs(pathname: string): { items: BreadcrumbSegment[]; hasBack: boolean; parentHref?: string } {
  const segments = pathname.split("/").filter(Boolean);
  const relevant = segments[0] === "admin" ? segments.slice(1) : segments;

  if (relevant.length === 0) {
    return {
      items: [{ label: "Overview", isLast: true }],
      hasBack: false,
    };
  }

  const items: BreadcrumbSegment[] = [
    { label: "Admin", href: toCleanPath("/admin"), isLast: false },
  ];

  let currentPath = "/admin";
  for (let i = 0; i < relevant.length; i++) {
    const seg = relevant[i];
    currentPath += `/${seg}`;
    const isLast = i === relevant.length - 1;
    items.push({
      label: formatSegmentLabel(seg),
      href: isLast ? undefined : toCleanPath(currentPath),
      isLast,
    });
  }

  const hasBack = relevant.length > 1;
  const parentSegments = relevant.slice(0, -1);
  const parentHref = toCleanPath(
    parentSegments.length === 0 ? "/admin" : `/admin/${parentSegments.join("/")}`
  );

  return { items, hasBack, parentHref };
}

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { items: breadcrumbs, hasBack, parentHref } = React.useMemo(
    () => buildBreadcrumbs(pathname),
    [pathname]
  );

  const { user, role, logout, saveProfile } = useAdminAuth();
  const { isStandalone, isIOS, canInstall, promptInstall } = useAdminPwa();
  const { email: storeEmail, storeName } = useSiteSettings();

  const [isCommandOpen, setIsCommandOpen] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [profileName, setProfileName] = React.useState(user?.name || "Admin Staff");
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState(user?.avatarUrl || "");
  const [isSaving, setIsSaving] = React.useState(false);
  const [storefrontUrl, setStorefrontUrl] = React.useState<string>(() =>
    process.env.NEXT_PUBLIC_SITE_URL || "/"
  );
  const mounted = useMounted();

  React.useEffect(() => {
    setStorefrontUrl(resolveStorefrontUrl());
  }, []);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (parentHref) {
      router.push(parentHref);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      const res = await saveProfile({
        name: profileName.trim(),
        avatarUrl: profileAvatarUrl,
      });

      if (res.success) {
        toast.success("Profile photo and details saved!");
        setIsProfileOpen(false);
      } else {
        toast.error(res.error || "Failed to save profile");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const roleConfig = role ? ROLE_CONFIG[role] : ROLE_CONFIG.owner;
  const displayName = mounted && user?.name ? user.name : "Staff Member";
  const emailDomain = storeEmail && storeEmail.includes("@") ? storeEmail.split("@")[1] : "gur.com.bd";
  const displayEmail = mounted && user?.email ? user.email : `staff@${emailDomain}`;
  const initials = mounted && user?.initials ? user.initials : displayName.slice(0, 2).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 relative flex h-14 shrink-0 items-center gap-2 border-b border-border/80 bg-background/90 px-3 sm:px-4 backdrop-blur-md">
        <SbTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-4 hidden sm:block" />

        {/* Smart Context-Aware Back Button (Auto-appears on subpages) */}
        {hasBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors shrink-0"
            title="Go back / ফিরে যান"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Interactive Clickable Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label + idx}>
              {idx > 0 && (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60 mx-0.5" />
              )}
              {crumb.isLast || !crumb.href ? (
                <span className="truncate font-semibold text-foreground max-w-[130px] sm:max-w-[200px]">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate hover:text-amber-600 dark:hover:text-amber-400 hover:underline transition-colors max-w-[100px] sm:max-w-[160px]"
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* View Live Storefront Button */}
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border/70 bg-muted/20 hover:bg-muted/70 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            title="Open customer storefront in a new tab / ওয়েবসাইট দেখুন"
          >
            <span>View Store</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>

          {/* Global Search Button (⌘K) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCommandOpen(true)}
            className="h-8 gap-2 bg-muted/30 px-2 sm:px-3 text-xs text-muted-foreground border-border/80 hover:bg-muted/70 hover:text-foreground font-normal rounded-lg"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Search orders, products, pages...</span>
            <kbd className="pointer-events-none hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          {/* SMS Gateway Balance Pill */}
          <div className="hidden xl:block">
            <AdminSmsBalance />
          </div>

          {/* Theme Toggle (Light / Dark / System) */}
          <ThemeToggle />

          {/* Realtime Notifications Center */}
          <AdminNotificationsPopover />

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          {/* User Account Menu with Live Session Data & Logout */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 p-1 rounded-full ring-1 ring-border/80 hover:ring-amber-500/50 transition-all cursor-pointer"
              >
                <Avatar className="h-6 w-6">
                  {mounted && user?.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={displayName} className="object-cover" />
                  )}
                  <AvatarFallback className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden xl:flex items-center gap-1.5 pr-1 text-left">
                  <span className="text-xs font-medium truncate max-w-[100px]">{displayName}</span>
                  <span
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${roleConfig.colorClasses}`}
                  >
                    {roleConfig.label}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2">
              <DropdownMenuLabel className="p-2">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 border ${roleConfig.colorClasses}`}
                    >
                      {roleConfig.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{displayEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => {
                  setProfileName(user?.name || "Admin Staff");
                  setProfileAvatarUrl(user?.avatarUrl || "");
                  setIsProfileOpen(true);
                }}
                className="cursor-pointer text-xs flex items-center justify-between"
              >
                <span>My Profile / প্রোফাইল</span>
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenuItem>

              {role === "owner" || role === "admin" ? (
                <>
                  <DropdownMenuItem
                    onClick={() => router.push(toCleanPath("/admin/staff"))}
                    className="cursor-pointer text-xs flex items-center justify-between"
                  >
                    <span>Staff Directory / স্টাফ তালিকা</span>
                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push(toCleanPath("/admin/settings"))}
                    className="cursor-pointer text-xs"
                  >
                    Store Settings / সেটিংস
                  </DropdownMenuItem>
                </>
              ) : null}

              {mounted && !isStandalone && (canInstall || isIOS) ? (
                <DropdownMenuItem
                  onClick={() => void promptInstall()}
                  className="cursor-pointer text-xs flex items-center justify-between text-amber-600 dark:text-amber-400"
                >
                  <span>Install {storeName || "Gramayon"} / অ্যাপ ইনস্টল</span>
                  <Download className="h-3.5 w-3.5" />
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="cursor-pointer text-xs text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-500/10 flex items-center justify-between"
              >
                <span>Sign Out / লগ আউট</span>
                <LogOut className="h-3.5 w-3.5" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Attached Loading Animation Bar */}
        <AdminLoadingBar />
      </header>

      {/* Global Command Palette Dialog */}
      <CommandPalette open={isCommandOpen} onOpenChange={setIsCommandOpen} />

      {/* Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Admin Profile</DialogTitle>
            <DialogDescription>
              Update your display name and photo shown on audit events and staff logs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-20 w-20 border-2 border-border shadow-sm">
                {profileAvatarUrl ? (
                  <AvatarImage src={profileAvatarUrl} alt={profileName} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-lg font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="w-full max-w-xs">
                <ImageUploader
                  value={profileAvatarUrl}
                  onChange={(items) => {
                    const first = items[0];
                    if (first?.url) setProfileAvatarUrl(first.url);
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-name" className="text-xs font-medium">
                Full Name / পুরো নাম
              </Label>
              <Input
                id="staff-name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g. Rahim Ahmed"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Assigned Role</Label>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs px-2.5 py-0.5 border ${roleConfig.colorClasses}`}
                >
                  {roleConfig.label} ({roleConfig.labelBn})
                </Badge>
                <span className="text-[11px] text-muted-foreground">{roleConfig.description}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsProfileOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-3.5 w-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
