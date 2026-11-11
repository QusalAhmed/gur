export type AdminRole = "owner" | "admin" | "manager" | "editor" | "support";

const VALID_ADMIN_ROLES: ReadonlySet<AdminRole> = new Set([
  "owner",
  "admin",
  "manager",
  "editor",
  "support",
]);

export function isValidAdminRole(role: unknown): role is AdminRole {
  return typeof role === "string" && VALID_ADMIN_ROLES.has(role as AdminRole);
}

export interface RoleCapability {
  canManageOrders: boolean; // orders, shipments, payment entries, notes, RFQs, reviews, messages
  canManageContent: boolean; // products, categories, images, documents, posts, faqs
  canManagePricing: boolean; // variants, prices, volume tiers
  canManageInventory: boolean; // stock movements, lots, suppliers, warehouses, coupons, shipping rates/zones, B2B approval
  canReadInventory: boolean; // read inventory levels, lots, stock ledger
  canManageSettings: boolean; // site settings, audit log, outbox, staff roles
  canManageStaff: boolean; // manage staff roles
}

export const ROLE_CAPABILITIES: Record<AdminRole, RoleCapability> = {
  owner: {
    canManageOrders: true,
    canManageContent: true,
    canManagePricing: true,
    canManageInventory: true,
    canReadInventory: true,
    canManageSettings: true,
    canManageStaff: true,
  },
  admin: {
    canManageOrders: true,
    canManageContent: true,
    canManagePricing: true,
    canManageInventory: true,
    canReadInventory: true,
    canManageSettings: true,
    canManageStaff: true,
  },
  manager: {
    canManageOrders: true,
    canManageContent: true,
    canManagePricing: true,
    canManageInventory: true,
    canReadInventory: true,
    canManageSettings: false,
    canManageStaff: false,
  },
  editor: {
    canManageOrders: false,
    canManageContent: true,
    canManagePricing: false,
    canManageInventory: false,
    canReadInventory: true,
    canManageSettings: false,
    canManageStaff: false,
  },
  support: {
    canManageOrders: true,
    canManageContent: false,
    canManagePricing: false,
    canManageInventory: false,
    canReadInventory: true,
    canManageSettings: false,
    canManageStaff: false,
  },
};

export const ROLE_CONFIG: Record<
  AdminRole,
  {
    label: string;
    labelBn: string;
    description: string;
    colorClasses: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
    level: number;
  }
> = {
  owner: {
    label: "Owner",
    labelBn: "মালিক (Owner)",
    description: "Full master administrative control",
    colorClasses: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    badgeVariant: "default",
    level: 5,
  },
  admin: {
    label: "Admin",
    labelBn: "অ্যাডমিন (Admin)",
    description: "Operations, staff management & security",
    colorClasses: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    badgeVariant: "default",
    level: 4,
  },
  manager: {
    label: "Manager",
    labelBn: "ম্যানেজার (Manager)",
    description: "Orders, logistics, stock & warehouse ops",
    colorClasses: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    badgeVariant: "secondary",
    level: 3,
  },
  editor: {
    label: "Editor",
    labelBn: "এডিটর (Editor)",
    description: "Product catalog, articles & FAQs",
    colorClasses: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    badgeVariant: "outline",
    level: 2,
  },
  support: {
    label: "Support",
    labelBn: "সাপোর্ট (Support)",
    description: "Customer service, orders & inquiries",
    colorClasses: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    badgeVariant: "outline",
    level: 1,
  },
};

/**
 * Validates if an acting role can assign targetRole to a staff member.
 * Owner can assign any role including owner.
 * Admin can assign admin, manager, editor, support (cannot assign owner).
 * Others cannot assign roles.
 */
export function canAssignRole(actingRole: AdminRole, targetRole: AdminRole): boolean {
  if (!isValidAdminRole(actingRole) || !isValidAdminRole(targetRole)) return false;
  if (actingRole === "owner") return true;
  if (actingRole === "admin") return targetRole !== "owner";
  return false;
}

function matchesRoute(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

/**
 * Validates that an admin post-login redirect stays within /admin and never loops to /admin/login.
 */
export function sanitizeAdminRedirect(nextPath: string | null | undefined): string {
  if (!nextPath || typeof nextPath !== "string") return "/admin";
  const trimmed = nextPath.trim();
  if (!trimmed.startsWith("/admin") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return "/admin";
  }
  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost" || !parsed.pathname.startsWith("/admin")) {
      return "/admin";
    }
    const normalizedPath = parsed.pathname.replace(/\/+$/, "") || "/";
    if (normalizedPath === "/admin/login") return "/admin";
    return parsed.pathname + parsed.search;
  } catch {
    return "/admin";
  }
}

/**
 * Determines whether a role has access to a specific route path (fail-closed).
 */
export function canRoleAccessPath(role: AdminRole, pathname: string): boolean {
  if (!isValidAdminRole(role) || typeof pathname !== "string") return false;

  // Normalize path
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  if (path.includes("..")) return false;

  // Login and Unauthorized status page are always reachable
  if (path === "/admin/login" || path === "/admin/unauthorized") return true;

  // Fail closed for non-admin paths
  if (path !== "/admin" && !path.startsWith("/admin/")) return false;

  // Root admin overview is accessible to all staff
  if (path === "/admin") return true;

  // Settings, audit, outbox, staff are admin/owner only
  if (
    matchesRoute(path, "/admin/settings") ||
    matchesRoute(path, "/admin/audit") ||
    matchesRoute(path, "/admin/outbox") ||
    matchesRoute(path, "/admin/staff")
  ) {
    return role === "owner" || role === "admin";
  }

  // Shipping configuration & Coupons: manager, admin, owner
  if (matchesRoute(path, "/admin/shipping") || matchesRoute(path, "/admin/coupons")) {
    return role === "owner" || role === "admin" || role === "manager";
  }

  // Finance / Analytics / Payments reconciliation / CRM & Operations:
  // Support, Manager, Admin, Owner
  if (
    matchesRoute(path, "/admin/payments") ||
    matchesRoute(path, "/admin/analytics") ||
    matchesRoute(path, "/admin/orders") ||
    matchesRoute(path, "/admin/incomplete") ||
    matchesRoute(path, "/admin/shipments") ||
    matchesRoute(path, "/admin/customers") ||
    matchesRoute(path, "/admin/quotes") ||
    matchesRoute(path, "/admin/reviews") ||
    matchesRoute(path, "/admin/messages") ||
    matchesRoute(path, "/admin/businesses")
  ) {
    return role !== "editor";
  }

  // Inventory, Batches (lots), Warehouses, Suppliers:
  // All staff can read inventory/lots/ledger; manager+ can manage
  if (
    matchesRoute(path, "/admin/inventory") ||
    matchesRoute(path, "/admin/batches") ||
    matchesRoute(path, "/admin/warehouses") ||
    matchesRoute(path, "/admin/suppliers")
  ) {
    return true;
  }

  // Catalog: Products, Combos, Categories, Posts, FAQs
  if (
    matchesRoute(path, "/admin/products") ||
    matchesRoute(path, "/admin/combos") ||
    matchesRoute(path, "/admin/categories") ||
    matchesRoute(path, "/admin/posts") ||
    matchesRoute(path, "/admin/faqs")
  ) {
    // Support cannot manage content
    return role !== "support";
  }

  // Unknown admin subpaths fail closed
  return false;
}
