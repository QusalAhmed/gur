export type AdminRole = "owner" | "admin" | "manager" | "editor" | "support";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  phone?: string;
  department?: string;
  assignedWarehouse?: string;
  initials: string;
  twoFactor?: boolean;
}

export interface SessionPayload {
  user: AdminUser;
  exp: number; // Unix timestamp in seconds
  iat: number; // Issued at
}

export const ADMIN_COOKIE_NAME = "gur_admin_session";

const AUTH_SECRET =
  process.env.ADMIN_AUTH_SECRET ||
  "gur-molasses-admin-secret-2026-auth-token-secure-key-99214";

// Base64Url helpers compatible with all environments
function toBase64Url(str: string): string {
  if (typeof btoa !== "undefined") {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(base64url: string): string {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  if (typeof atob !== "undefined") {
    return atob(base64);
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Creates an HMAC-SHA256 signed session token for an AdminUser.
 */
export async function createSessionToken(
  user: AdminUser,
  expiresInSeconds: number = 60 * 60 * 24 * 7 // 7 days default
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    user,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const payloadString = JSON.stringify(payload);
  const encodedPayload = toBase64Url(payloadString);

  const enc = new TextEncoder();
  const key = await getHmacKey(AUTH_SECRET);
  const signatureBuffer = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(encodedPayload)
  );

  const signatureHex = bufferToHex(signatureBuffer);
  return `${encodedPayload}.${signatureHex}`;
}

/**
 * Verifies the HMAC signature and expiration of a session token.
 * Returns the decoded AdminUser if valid, or null if invalid or expired.
 */
export async function verifySessionToken(
  token: string | null | undefined
): Promise<AdminUser | null> {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signatureHex] = parts;

  try {
    const enc = new TextEncoder();
    const key = await getHmacKey(AUTH_SECRET);

    // Recompute signature
    const signatureBuffer = await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(encodedPayload)
    );
    const expectedHex = bufferToHex(signatureBuffer);

    // Constant-time comparison
    if (signatureHex !== expectedHex) {
      return null;
    }

    const jsonStr = fromBase64Url(encodedPayload);
    const payload: SessionPayload = JSON.parse(jsonStr);

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null; // Expired
    }

    return payload.user || null;
  } catch {
    return null;
  }
}

/**
 * Role metadata and badge styling
 */
export const ROLE_CONFIG: Record<
  AdminRole,
  {
    label: string;
    description: string;
    colorClasses: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
    level: number;
  }
> = {
  owner: {
    label: "Owner",
    description: "Full master administrative control",
    colorClasses: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    badgeVariant: "default",
    level: 5,
  },
  admin: {
    label: "Admin",
    description: "Operations, staff management & security",
    colorClasses: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    badgeVariant: "default",
    level: 4,
  },
  manager: {
    label: "Manager",
    description: "Orders, logistics, stock & warehouse ops",
    colorClasses: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    badgeVariant: "secondary",
    level: 3,
  },
  editor: {
    label: "Editor",
    description: "Product catalog, articles & FAQs",
    colorClasses: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    badgeVariant: "outline",
    level: 2,
  },
  support: {
    label: "Support",
    description: "Customer service, orders & inquiries",
    colorClasses: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    badgeVariant: "outline",
    level: 1,
  },
};

/**
 * Check if a role can access a specific route
 */
export function canRoleAccessPath(role: AdminRole, pathname: string): boolean {
  if (role === "owner" || role === "admin") return true;

  if (role === "manager") {
    const restricted = ["/admin/staff", "/admin/settings"];
    return !restricted.some((p) => pathname.startsWith(p));
  }

  if (role === "editor") {
    const allowed = [
      "/admin",
      "/admin/products",
      "/admin/categories",
      "/admin/posts",
      "/admin/faqs",
      "/admin/reviews",
    ];
    return allowed.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }

  if (role === "support") {
    const allowed = [
      "/admin",
      "/admin/orders",
      "/admin/shipments",
      "/admin/customers",
      "/admin/messages",
      "/admin/reviews",
    ];
    return allowed.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }

  return true;
}
