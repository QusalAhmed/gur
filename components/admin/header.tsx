"use client";

import * as React from "react";
import { Search, LogOut, ShieldCheck, UserCheck, User, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminNotificationsPopover } from "@/components/admin/notifications-popover";
import { AdminSmsBalance } from "@/components/admin/sms-balance";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImageUploader } from "@/components/ui/image-uploader";
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
  const { user, role, logout, updateUser, saveProfile } = useAdminAuth();
  const { email: storeEmail } = useSiteSettings();

  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [profileName, setProfileName] = React.useState(user?.name || "Admin Staff");
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState(user?.avatarUrl || "");
  const [isSaving, setIsSaving] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
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
        toast.success("Profile photo and details saved to database!");
        setIsProfileOpen(false);
      } else {
        toast.error(res.error || "Failed to save profile to database");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const roleConfig = role ? ROLE_CONFIG[role] : ROLE_CONFIG.owner;
  const displayName = mounted && user?.name ? user.name : "Admin Staff";
  const emailDomain = storeEmail && storeEmail.includes("@") ? storeEmail.split("@")[1] : "molassesstore.com";
  const displayEmail = mounted && user?.email ? user.email : `staff@${emailDomain}`;
  const initials = mounted && user?.initials ? user.initials : displayName.slice(0, 2).toUpperCase();

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

        {/* Async SMS Gateway Balance Pill */}
        <AdminSmsBalance />

        {/* Role Badge Indicator */}
        <div className="hidden sm:flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`text-[11px] font-semibold px-2 py-0.5 border ${roleConfig.colorClasses}`}
          >
            {roleConfig.label}
          </Badge>
        </div>

        {/* Realtime Notifications Center */}
        <AdminNotificationsPopover />

        {/* User Account Menu with Live Session Data & Logout */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full ring-1 ring-border/60 hover:ring-amber-500/50 transition-all">
              <Avatar className="h-8 w-8">
                {mounted && user?.avatarUrl && (
                  <AvatarImage
                    src={user.avatarUrl}
                    alt={displayName}
                    className="object-cover"
                  />
                )}
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
              onClick={() => setIsProfileOpen(true)}
              className="cursor-pointer flex items-center justify-between"
            >
              <span>My Profile</span>
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuItem>

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

      {/* Admin Profile Modal */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-amber-600" />
              Admin Profile & Avatar
            </DialogTitle>
            <DialogDescription>
              Customize your administrative account display name and photo avatar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 pb-4">
            {/* Avatar Uploader */}
            <div className="space-y-2">
              <label className="text-xs font-semibold block">Profile Photo / Avatar</label>
              <ImageUploader
                value={profileAvatarUrl ? [profileAvatarUrl] : []}
                onChange={(items) => {
                  const first = items[0];
                  setProfileAvatarUrl(first?.url || first?.path || "");
                }}
                onRemove={() => setProfileAvatarUrl("")}
                multiple={false}
                
                folder="avatars"
                label="Upload Profile Photo"
                description="Click or drag square photo (JPEG, PNG, WebP)"
                aspectRatio="square"
              />
            </div>

            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold block">Full Name</label>
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g. John Doe"
                className="h-9 text-sm"
              />
            </div>

            {/* Read-only Role & Email */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground block">Email</span>
                <span className="text-xs font-mono font-medium truncate block">{user?.email || displayEmail}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground block">Role</span>
                <Badge variant="outline" className={`text-[10px] w-fit border ${roleConfig.colorClasses}`}>
                  {roleConfig.label}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
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
              className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving to Database...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Profile
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
