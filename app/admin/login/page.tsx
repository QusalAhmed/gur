"use client";

import * as React from "react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminAuth } from "@/components/admin/auth-context";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/admin";

  const { login } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await login({
        email: email.trim(),
        password,
        rememberMe,
      });

      if (!res.success) {
        setErrorMessage(
          res.error || "Authentication failed. Please verify your credentials."
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || "An unexpected error occurred during authentication."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 overflow-hidden bg-gradient-to-br from-zinc-950 via-stone-950 to-amber-950/40 text-foreground selection:bg-amber-500 selection:text-black">
      {/* Ambient background glow accents */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-amber-700/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-amber-600/5 blur-[160px]" />

      {/* Top Bar with Return to Store */}
      <div className="w-full max-w-md flex items-center justify-between mb-6 z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-amber-400 transition-colors"
        >
          <Store className="h-4 w-4" />
          <span>Return to Storefront</span>
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full text-amber-300">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
          <span>Staff Gateway</span>
        </div>
      </div>

      {/* Main Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <Card className="border-border/50 bg-background/85 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden ring-1 ring-white/10">
          {/* Card Header with Brand Details */}
          <CardHeader className="text-center pb-4 pt-6 px-6 sm:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-black shadow-lg shadow-amber-500/25 mb-3">
              <ShieldCheck className="h-7 w-7 stroke-[2.2]" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2">
                <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
                  GUR <span className="text-amber-500">|</span> গুড়
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 border-amber-500/30 text-amber-500 text-[10px] uppercase font-semibold tracking-wider"
                >
                  Admin Portal
                </Badge>
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Enter your staff credentials to access the administrative terminal
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-6 sm:px-8 pb-6">
            {/* Error Notification Alert */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-xs sm:text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Credentials Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-foreground/80">
                  Staff Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@molassesstore.com"
                    className="pl-9 h-10 bg-muted/30 border-border/60 focus-visible:ring-amber-500/40 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-foreground/80">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="pl-9 pr-10 h-10 bg-muted/30 border-border/60 focus-visible:ring-amber-500/40 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(c) => setRememberMe(Boolean(c))}
                    className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                  <span>Remember this device</span>
                </label>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !email || !password}
                className="w-full h-11 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer mt-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    <span>Verifying Credentials...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Sign In to Admin Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>
          </CardContent>

          {/* Footer Security Notice */}
          <CardFooter className="flex flex-col gap-1.5 pt-3 pb-6 px-6 sm:px-8 border-t border-border/40 text-center bg-muted/10">
            <p className="text-xs text-muted-foreground font-medium">
              Enterprise Role-Based Access Control • 256-bit Encrypted Session
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              Authorized personnel only. All access attempts and administrative events are logged.
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 text-amber-500">
          <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
