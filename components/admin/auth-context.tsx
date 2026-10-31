"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminUser, AdminRole } from "@/lib/admin-auth";
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

const LOCAL_STORAGE_KEY = "gur_admin_user";

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load session from server and synchronize with client state
  const refreshSession = useCallback(async () => {
    try {
      // 1. Instant check from localStorage for fast client paint
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setUser(parsed);
          } catch {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        }
      }

      // 2. Authoritative verification against server session
      const res = await fetch("/api/admin/auth/session", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.user));
        } else {
          setUser(null);
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          if (pathname !== "/admin/login") {
            const currentSearch = typeof window !== "undefined" ? window.location.search : "";
            const target = pathname + currentSearch;
            router.push(`/admin/login?next=${encodeURIComponent(target)}`);
          }
        }
      } else {
        setUser(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Session check error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (params: {
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
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.user));

        // Determine destination redirect from params or window query string
        const nextUrl =
          params.redirectTo ||
          (typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("next")
            : null) ||
          "/admin";

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
  };

  const updateUser = useCallback((updatedFields: Partial<AdminUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const saveProfile = useCallback(
    async (params: { name: string; avatarUrl: string; phone?: string }) => {
      try {
        const res = await updateAdminProfileAction(params);
        if (res.success && res.user) {
          setUser(res.user);
          if (typeof window !== "undefined") {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(res.user));
          }
          return { success: true, user: res.user };
        }
        return { success: false, error: res.error || "Failed to save profile" };
      } catch (err: any) {
        return { success: false, error: err?.message || "Failed to update profile" };
      }
    },
    []
  );

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch (e) {
      console.warn("Logout error:", e);
    } finally {
      setUser(null);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setIsLoading(false);
      router.push("/admin/login");
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser,
        saveProfile,
      }}
    >
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
