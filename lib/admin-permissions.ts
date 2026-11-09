export type AdminRole = "owner" | "admin" | "manager" | "editor" | "support";

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
  if (actingRole === "owner") return true;
  if (actingRole === "admin") return targetRole !== "owner";
  return false;
}

/**
 * Determines whether a role has access to a specific route path.
 */
export function canRoleAccessPath(role: AdminRole, pathname: string): boolean {
  // Normalize path
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  // Login is always open
  if (path === "/admin/login") return true;

  // Root admin overview is accessible to all staff
  if (path === "/admin") return true;

  // Settings, audit, outbox, staff are admin/owner only
  if (
    path.startsWith("/admin/settings") ||
    path.startsWith("/admin/audit") ||
    path.startsWith("/admin/outbox") ||
    path.startsWith("/admin/staff")
  ) {
    return role === "owner" || role === "admin";
  }

  // Finance / Payments reconciliation: support, manager, admin, owner
  if (path.startsWith("/admin/payments")) {
    return role !== "editor";
  }

  // Orders, Incomplete, Shipments, Customers, Quotes (RFQ), Reviews, Messages:
  if (
    path.startsWith("/admin/orders") ||
    path.startsWith("/admin/incomplete") ||
    path.startsWith("/admin/shipments") ||
    path.startsWith("/admin/customers") ||
    path.startsWith("/admin/quotes") ||
    path.startsWith("/admin/reviews") ||
    path.startsWith("/admin/messages")
  ) {
    return role !== "editor";
  }

  // B2B Accounts: manager, admin, owner (support can read, editor cannot)
  if (path.startsWith("/admin/businesses")) {
    return role !== "editor";
  }

  // Inventory, Batches (lots), Warehouses, Suppliers:
  // All staff can read inventory/lots/ledger; editor can read; support can read; manager+ can manage
  if (
    path.startsWith("/admin/inventory") ||
    path.startsWith("/admin/batches") ||
    path.startsWith("/admin/warehouses") ||
    path.startsWith("/admin/suppliers")
  ) {
    return true; // All staff have at least read access
  }

  // Catalog: Products, Combos, Categories, Posts, FAQs
  if (
    path.startsWith("/admin/products") ||
    path.startsWith("/admin/combos") ||
    path.startsWith("/admin/categories") ||
    path.startsWith("/admin/posts") ||
    path.startsWith("/admin/faqs")
  ) {
    // Support cannot manage content
    return role !== "support";
  }

  return true;
}
