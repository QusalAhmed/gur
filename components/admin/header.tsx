"use client";

import * as React from "react";
import {
  Search,
  LogOut,
  ShieldCheck,
  User,
  Save,
  Loader2,
  Calendar,
  Command as CommandIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AdminNotificationsPopover } from "@/components/admin/notifications-popover";
import { AdminSmsBalance } from "@/components/admin/sms-balance";
import { CommandPalette } from "@/components/admin/command-palette";
import { DateRangePicker } from "@/components/admin/date-range-picker";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/ui/image-uploader";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { ROLE_CONFIG } from "@/lib/admin-permissions";
import Link from "next/link";

function getBreadcrumb(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return "Overview";
  return segments
    .slice(1)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " "))
    .join(" › ");
}

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const breadcrumb = getBreadcrumb(pathname);
  const { user, role, logout, saveProfile } = useAdminAuth();
  const { email: storeEmail } = useSiteSettings();

  const [isCommandOpen, setIsCommandOpen] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [profileName, setProfileName] = React.useState(user?.name || "Admin Staff");
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState(user?.avatarUrl || "");
  const [isSaving, setIsSaving] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileAvatarUrl(user.avatarUrl || "");
    }
  }, [user]);

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
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred");
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
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/80 bg-background/90 px-3 sm:px-4 backdrop-blur-md">
        <SbTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-4 hidden sm:block" />

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <span className="hidden sm:inline font-medium text-foreground/80">Admin</span>
          <span className="hidden sm:inline">›</span>
          <span className="truncate font-semibold text-foreground">{breadcrumb}</span>
        </div>

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Global Search Button (⌘K) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCommandOpen(true)}
            className="h-8 gap-2 bg-muted/30 px-2 sm:px-3 text-xs text-muted-foreground border-border/80 hover:bg-muted/70 hover:text-foreground font-normal"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Search orders, products, pages...</span>
            <kbd className="pointer-events-none hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          {/* Date-Range Picker (Asia/Dhaka) */}
          <div className="hidden lg:block">
            <DateRangePicker />
          </div>

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
                className="h-8 gap-2 p-1 rounded-full ring-1 ring-border/80 hover:ring-amber-500/50 transition-all"
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
                onClick={() => setIsProfileOpen(true)}
                className="cursor-pointer text-xs flex items-center justify-between"
              >
                <span>My Profile / প্রোফাইল</span>
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenuItem>

              {role === "owner" || role === "admin" ? (
                <>
                  <DropdownMenuItem
                    onClick={() => router.push("/admin/staff")}
                    className="cursor-pointer text-xs flex items-center justify-between"
                  >
                    <span>Staff Directory / স্টাফ তালিকা</span>
                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/admin/settings")}
                    className="cursor-pointer text-xs"
                  >
                    Store Settings / সেটিংস
                  </DropdownMenuItem>
                </>
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
