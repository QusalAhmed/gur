"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Share, PlusSquare, Smartphone } from "lucide-react";
import { useAdminAuth } from "@/components/admin/auth-context";
import { useSiteSettings } from "@/hooks/use-site-settings";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type PushPermissionState = NotificationPermission | "unsupported";

interface AdminPwaContextValue {
  isStandalone: boolean;
  isIOS: boolean;
  canInstall: boolean;
  isPushSupported: boolean;
  isPushConfigured: boolean;
  permission: PushPermissionState;
  isSubscribed: boolean;
  isBusy: boolean;
  isTesting: boolean;
  enablePush: () => Promise<boolean>;
  disablePush: () => Promise<boolean>;
  sendTestPush: () => Promise<boolean>;
  promptInstall: () => Promise<void>;
  openIOSInstallGuide: () => void;
  syncAppBadge: (unreadCount: number) => void;
}

const AdminPwaContext = React.createContext<AdminPwaContextValue | undefined>(
  undefined
);

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getSwScope(): string {
  if (typeof window === "undefined") return "/admin";
  const hostname = window.location.hostname.toLowerCase();
  const isAdminSubdomain =
    hostname === "admin.khatikhejurgur.shop" || hostname.startsWith("admin.");
  return isAdminSubdomain ? "/" : "/admin";
}

/**
 * Best-effort cleanup called right before logout so a shared phone or PC
 * stops receiving admin Web Push notifications after sign-out.
 */
export async function cleanupAdminPushOnLogout(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const nav = navigator as Navigator & {
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.clearAppBadge === "function") {
      await nav.clearAppBadge().catch(() => {});
    }
  } catch {
    // Ignore badge errors
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const scope = getSwScope();
    const registration =
      (await navigator.serviceWorker.getRegistration(scope)) ||
      (await navigator.serviceWorker.getRegistration());
    if (!registration) return;

    const existingSub = await registration.pushManager.getSubscription();
    if (!existingSub) return;

    const endpoint = existingSub.endpoint;
    await fetch("/api/admin/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
      keepalive: true,
    }).catch(() => {});

    await existingSub.unsubscribe().catch(() => {});
  } catch {
    // Best-effort cleanup; never block logout
  }
}

export function AdminPwaProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAdminAuth();
  const { storeName } = useSiteSettings();
  const appName = storeName || "Gramayon";
  const appNameRef = React.useRef(appName);
  appNameRef.current = appName;

  const [isStandalone, setIsStandalone] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [isPushSupported, setIsPushSupported] = React.useState(false);
  const [isPushConfigured, setIsPushConfigured] = React.useState(
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
  const [vapidPublicKey, setVapidPublicKey] = React.useState<string>(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
  );
  const [permission, setPermission] =
    React.useState<PushPermissionState>("unsupported");
  const [subscription, setSubscription] =
    React.useState<PushSubscription | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [iosGuideOpen, setIosGuideOpen] = React.useState(false);

  const registrationRef = React.useRef<ServiceWorkerRegistration | null>(null);

  // Detect standalone mode, iOS, and browser install prompt support
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const nav = navigator as Navigator & { standalone?: boolean };
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const computeStandalone = () =>
      standaloneQuery.matches || nav.standalone === true;

    setIsStandalone(computeStandalone());
    setIsIOS(
      (/iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as unknown as { MSStream?: unknown }).MSStream) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );

    const pushCapable =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsPushSupported(pushCapable);
    if (pushCapable) {
      setPermission(Notification.permission);
    }

    const handleDisplayModeChange = () => setIsStandalone(computeStandalone());
    standaloneQuery.addEventListener?.("change", handleDisplayModeChange);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      toast.success(
        `${appNameRef.current} installed! Open it from your home screen or desktop.`
      );
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      standaloneQuery.removeEventListener?.("change", handleDisplayModeChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Register lightweight Admin Service Worker & listen for SW messages
  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    const scope = getSwScope();

    const registerSw = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope,
          updateViaCache: "none",
        });
        if (cancelled) return;
        registrationRef.current = reg;

        if ("PushManager" in window) {
          const existingSub = await reg.pushManager.getSubscription();
          if (!cancelled) {
            setSubscription(existingSub);
          }
        }
      } catch (err) {
        console.warn("[AdminPWA] Service worker registration skipped:", err);
      }
    };

    registerSw();

    const handleSwMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "GUR_PUSH_RECEIVED") {
        queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "badge-counts"] });
      } else if (msg.type === "GUR_NOTIFICATION_CLICK") {
        if (msg.orderNumber || msg.orderId) {
          window.dispatchEvent(
            new CustomEvent("gur:open-order", {
              detail: {
                orderNumber: msg.orderNumber,
                orderId: msg.orderId,
              },
            })
          );
        }
        if (typeof msg.url === "string" && msg.url.startsWith("/")) {
          router.push(msg.url);
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handleSwMessage);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    };
  }, [queryClient, router]);

  // Fetch authoritative server VAPID config & sync existing browser subscription when signed in
  React.useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let cancelled = false;

    const loadPushConfig = async () => {
      try {
        const res = await fetch("/api/admin/push", {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data.success) return;

        setIsPushConfigured(Boolean(data.configured));
        if (typeof data.vapidPublicKey === "string" && data.vapidPublicKey) {
          setVapidPublicKey(data.vapidPublicKey);
        }

        // Keep DB in sync if this browser already has an active subscription
        if (registrationRef.current && "PushManager" in window) {
          const existingSub =
            await registrationRef.current.pushManager.getSubscription();
          if (!cancelled && existingSub) {
            setSubscription(existingSub);
            const serialized = existingSub.toJSON();
            if (
              serialized.endpoint &&
              serialized.keys?.p256dh &&
              serialized.keys?.auth
            ) {
              fetch("/api/admin/push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  endpoint: serialized.endpoint,
                  keys: {
                    p256dh: serialized.keys.p256dh,
                    auth: serialized.keys.auth,
                  },
                }),
              }).catch(() => {});
            }
          }
        }
      } catch {
        // Non-blocking config check
      }
    };

    loadPushConfig();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  const syncAppBadge = React.useCallback((unreadCount: number) => {
    if (typeof window === "undefined") return;
    const safeCount = Math.max(0, Math.floor(unreadCount || 0));

    try {
      const nav = navigator as Navigator & {
        setAppBadge?: (count?: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      if (safeCount > 0 && typeof nav.setAppBadge === "function") {
        nav.setAppBadge(Math.min(999, safeCount)).catch(() => {});
      } else if (safeCount === 0 && typeof nav.clearAppBadge === "function") {
        nav.clearAppBadge().catch(() => {});
      }
    } catch {
      // Badge API not available
    }

    try {
      navigator.serviceWorker?.controller?.postMessage({
        type: "UPDATE_BADGE",
        count: safeCount,
      });
    } catch {
      // Ignore SW messaging error
    }
  }, []);

  const enablePush = React.useCallback(async (): Promise<boolean> => {
    if (!isPushSupported) {
      if (isIOS && !isStandalone) {
        setIosGuideOpen(true);
      } else {
        toast.error("Push notifications are not supported in this browser.");
      }
      return false;
    }

    const activePublicKey =
      vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    if (!activePublicKey) {
      toast.error("Push notifications are not configured on the server yet.");
      return false;
    }

    setIsBusy(true);
    try {
      let currentPerm = Notification.permission;
      if (currentPerm === "default") {
        currentPerm = await Notification.requestPermission();
      }
      setPermission(currentPerm);

      if (currentPerm !== "granted") {
        toast.error(
          "Notification permission was denied. Enable notifications in your browser settings."
        );
        return false;
      }

      const scope = getSwScope();
      const registration =
        registrationRef.current ||
        (await navigator.serviceWorker.register("/sw.js", {
          scope,
          updateViaCache: "none",
        }));
      registrationRef.current = registration;

      const readyReg = await navigator.serviceWorker.ready;
      let sub = await readyReg.pushManager.getSubscription();
      if (!sub) {
        sub = await readyReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(activePublicKey),
        });
      }

      const serialized = sub.toJSON();
      if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) {
        throw new Error("Browser returned an incomplete push subscription.");
      }

      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: serialized.endpoint,
          keys: {
            p256dh: serialized.keys.p256dh,
            auth: serialized.keys.auth,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to register push subscription.");
      }

      setSubscription(sub);
      toast.success("Push notifications enabled on this device!");
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to enable push notifications";
      toast.error(msg);
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [isIOS, isPushSupported, isStandalone, vapidPublicKey]);

  const disablePush = React.useCallback(async (): Promise<boolean> => {
    setIsBusy(true);
    try {
      const reg =
        registrationRef.current ||
        (await navigator.serviceWorker.getRegistration(getSwScope()));
      const activeSub =
        subscription || (reg ? await reg.pushManager.getSubscription() : null);

      if (activeSub) {
        await fetch("/api/admin/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: activeSub.endpoint }),
        }).catch(() => {});

        await activeSub.unsubscribe().catch(() => {});
      }

      setSubscription(null);
      toast.success("Push notifications turned off on this device.");
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to disable push notifications";
      toast.error(msg);
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [subscription]);

  const sendTestPush = React.useCallback(async (): Promise<boolean> => {
    if (!subscription?.endpoint) {
      toast.error("Enable push notifications on this device first.");
      return false;
    }

    setIsTesting(true);
    try {
      const res = await fetch("/api/admin/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const data = await res.json();

      if (res.status === 410 || data.expired) {
        await subscription.unsubscribe().catch(() => {});
        setSubscription(null);
        toast.error("Push subscription expired. Please turn Push back on.");
        return false;
      }

      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to send test push notification.");
        return false;
      }

      toast.success("Test push sent! Check your device notifications.");
      return true;
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Network error sending test push."
      );
      return false;
    } finally {
      setIsTesting(false);
    }
  }, [subscription]);

  const promptInstall = React.useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
      return;
    }

    if (isIOS) {
      setIosGuideOpen(true);
      return;
    }

    toast.info(
      `Use your browser's menu (Install App / Add to Home Screen) to install ${appName}.`
    );
  }, [deferredPrompt, isIOS, appName]);

  const openIOSInstallGuide = React.useCallback(() => {
    setIosGuideOpen(true);
  }, []);

  const contextValue = React.useMemo<AdminPwaContextValue>(
    () => ({
      isStandalone,
      isIOS,
      canInstall: !isStandalone && Boolean(deferredPrompt),
      isPushSupported,
      isPushConfigured,
      permission,
      isSubscribed: Boolean(subscription),
      isBusy,
      isTesting,
      enablePush,
      disablePush,
      sendTestPush,
      promptInstall,
      openIOSInstallGuide,
      syncAppBadge,
    }),
    [
      isStandalone,
      isIOS,
      deferredPrompt,
      isPushSupported,
      isPushConfigured,
      permission,
      subscription,
      isBusy,
      isTesting,
      enablePush,
      disablePush,
      sendTestPush,
      promptInstall,
      openIOSInstallGuide,
      syncAppBadge,
    ]
  );

  return (
    <AdminPwaContext.Provider value={contextValue}>
      {children}

      {/* iOS Safari Add to Home Screen Instructions Dialog */}
      <Dialog open={iosGuideOpen} onOpenChange={setIosGuideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-amber-500" />
              Install {appName} on iPhone / iPad
            </DialogTitle>
            <DialogDescription>
              Apple requires adding the admin panel to your Home Screen before enabling lock-screen push notifications.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-3 py-2 text-sm text-foreground">
            <li className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
                1
              </span>
              <span className="leading-relaxed">
                Open this page in <strong>Safari</strong> and tap the{" "}
                <span className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-xs font-medium">
                  <Share className="h-3 w-3" /> Share
                </span>{" "}
                button in the toolbar.
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
                2
              </span>
              <span className="leading-relaxed">
                Scroll down and tap{" "}
                <span className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-xs font-medium">
                  <PlusSquare className="h-3 w-3" /> Add to Home Screen
                </span>{" "}
                then tap <strong>Add</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400">
                3
              </span>
              <span className="leading-relaxed">
                Launch <strong>{appName}</strong> from your Home Screen and toggle{" "}
                <strong>Push Alerts</strong> on inside the bell menu.
              </span>
            </li>
          </ol>

          <DialogFooter>
            <Button onClick={() => setIosGuideOpen(false)} className="w-full sm:w-auto">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPwaContext.Provider>
  );
}

export function useAdminPwa() {
  const ctx = React.useContext(AdminPwaContext);
  if (!ctx) {
    throw new Error("useAdminPwa must be used within AdminPwaProvider");
  }
  return ctx;
}
