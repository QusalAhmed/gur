"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminUser, AdminRole } from "@/lib/admin-auth";
import { sanitizeAdminRedirect } from "@/lib/admin-permissions";
import { updateAdminProfileAction } from "@/actions/admin-profile";

interface AdminAuthContextType {
  user: AdminUser | null;
  role: AdminRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (params: {
    email: string;
    password: string;
    rememberMe?: boolean;
    redirectTo?: string;
  }) => Promise<{ success: boolean; error?: string; user?: AdminUser }>;
  logout: () => Promise<void>;
  updateUser: (updatedFields: Partial<AdminUser>) => void;
  saveProfile: (params: {
    name: string;
    avatarUrl: string;
    phone?: string;
  }) => Promise<{ success: boolean; error?: string; user?: AdminUser }>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const LEGACY_LOCAL_STORAGE_KEY = "gur_admin_user";

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load authoritative session from server (no localStorage identity storage)
  const refreshSession = useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
      }

      const res = await fetch("/api/admin/auth/session", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser((prev) => {
            if (
              prev &&
              prev.id === data.user.id &&
              prev.role === data.user.role &&
              prev.name === data.user.name &&
              prev.avatarUrl === data.user.avatarUrl
            ) {
              return prev;
            }
            return data.user;
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (e) {
      console.warn("Session check error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Run initial session check once on mount
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (params: {
      email: string;
      password: string;
      rememberMe?: boolean;
      redirectTo?: string;
    }) => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/admin/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: params.email,
            password: params.password,
            rememberMe: params.rememberMe,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success && data.user) {
          setUser(data.user);

          const rawNext =
            params.redirectTo ||
            (typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("next")
              : null);
          const nextUrl = sanitizeAdminRedirect(rawNext);

          router.push(nextUrl);
          return { success: true, user: data.user };
        } else {
          return {
            success: false,
            error: data.error || "Failed to log in with provided credentials",
          };
        }
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || "Network error during authentication",
        };
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const updateUser = useCallback((updatedFields: Partial<AdminUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      return { ...prev, ...updatedFields };
    });
  }, []);

  const saveProfile = useCallback(
    async (params: { name: string; avatarUrl: string; phone?: string }) => {
      try {
        const res = await updateAdminProfileAction(params);
        if (res.success && res.user) {
          setUser(res.user);
          return { success: true, user: res.user };
        }
        return { success: false, error: res.error || "Failed to save profile" };
      } catch (err: any) {
        return { success: false, error: err?.message || "Failed to update profile" };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch (e) {
      console.warn("Logout error:", e);
    } finally {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
      }
      setIsLoading(false);
      router.push("/admin/login");
    }
  }, [router]);

  const contextValue = React.useMemo<AdminAuthContextType>(
    () => ({
      user,
      role: user?.role || null,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      updateUser,
      saveProfile,
    }),
    [user, isLoading, login, logout, updateUser, saveProfile]
  );

  return (
    <AdminAuthContext.Provider value={contextValue}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
