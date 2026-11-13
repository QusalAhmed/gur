import { describe, it, expect } from "vitest";
import { formatBDT, normalizeBDPhone, toBengaliDigits, formatUOM } from "@/lib/admin-format";
import { mapDatabaseError } from "@/lib/admin-errors";
import { canRoleAccessPath, canAssignRole, AdminRole } from "@/lib/admin-permissions";
import { resolveOtherOrdersForDisplay, Order } from "@/types/order";

describe("Admin Formatter Helpers", () => {
  it("formats BDT currency correctly with ৳ and Indian thousands separators", () => {
    expect(formatBDT(0)).toBe("৳ 0");
    expect(formatBDT(1500)).toBe("৳ 1,500");
    expect(formatBDT(125000)).toBe("৳ 1,25,000");
    expect(formatBDT(3500.5, { decimals: 2 })).toBe("৳ 3,500.50");
  });

  it("converts digits to Bengali numerals correctly", () => {
    expect(toBengaliDigits(1234567890)).toBe("১২৩৪৫৬৭৮৯০");
    expect(formatBDT(1500, { useBengaliDigits: true })).toBe("৳ ১,৫০০");
  });

  it("normalizes Bangladeshi phone numbers to standard E.164 +880 format", () => {
    expect(normalizeBDPhone("01712345678")).toBe("+8801712345678");
    expect(normalizeBDPhone("8801812345678")).toBe("+8801812345678");
    expect(normalizeBDPhone("+8801912345678")).toBe("+8801912345678");
    expect(normalizeBDPhone("01312-345678")).toBe("+8801312345678");
    expect(normalizeBDPhone("01400 123 456")).toBe("+8801400123456");

    // Invalid numbers return null
    expect(normalizeBDPhone("12345")).toBeNull();
    expect(normalizeBDPhone("029876543")).toBeNull();
    expect(normalizeBDPhone("")).toBeNull();
  });

  it("formats UOM units with English and Bengali labels", () => {
    expect(formatUOM(5, "kg", "en")).toBe("5 kg");
    expect(formatUOM(5, "kg", "bn")).toBe("৫ কেজি");
    expect(formatUOM(10, "pcs", "bn")).toBe("১০ টি");
  });
});

describe("Admin Error Mapping", () => {
  it("maps Postgres business error codes to friendly messages", () => {
    const err1 = mapDatabaseError("ERROR: ORDER_STATUS_BACKWARDS: delivered -> pending");
    expect(err1.code).toBe("ORDER_STATUS_BACKWARDS");
    expect(err1.title).toBe("Invalid Status Transition");

    const err2 = mapDatabaseError("BATCH_NOT_RELEASED: lot L-2026-01 is quarantine");
    expect(err2.code).toBe("BATCH_NOT_RELEASED");
    expect(err2.title).toBe("Lot Not Released");

    const err3 = mapDatabaseError("CREDIT_LIMIT_EXCEEDED: outstanding 50000");
    expect(err3.code).toBe("CREDIT_LIMIT_EXCEEDED");
    expect(err3.title).toBe("Credit Limit Exceeded");

    const err4 = mapDatabaseError("ORDER_HAS_SHIPMENTS");
    expect(err4.code).toBe("ORDER_HAS_SHIPMENTS");
  });
});

describe("Admin Permission Matrix", () => {
  it("verifies route access rules per role", () => {
    // Owner & Admin have access to settings and staff
    expect(canRoleAccessPath("owner", "/admin/settings")).toBe(true);
    expect(canRoleAccessPath("admin", "/admin/staff")).toBe(true);

    // Manager cannot access settings or staff
    expect(canRoleAccessPath("manager", "/admin/settings")).toBe(false);
    expect(canRoleAccessPath("manager", "/admin/staff")).toBe(false);
    expect(canRoleAccessPath("manager", "/admin/orders")).toBe(true);
    expect(canRoleAccessPath("manager", "/admin/inventory")).toBe(true);

    // Editor can access catalog, but cannot access orders, finance, settings
    expect(canRoleAccessPath("editor", "/admin/products")).toBe(true);
    expect(canRoleAccessPath("editor", "/admin/categories")).toBe(true);
    expect(canRoleAccessPath("editor", "/admin/orders")).toBe(false);
    expect(canRoleAccessPath("editor", "/admin/payments")).toBe(false);

    // Support can access orders and customers, but cannot access catalog management
    expect(canRoleAccessPath("support", "/admin/orders")).toBe(true);
    expect(canRoleAccessPath("support", "/admin/customers")).toBe(true);
    expect(canRoleAccessPath("support", "/admin/products")).toBe(false);
  });

  it("verifies staff role assignment rules", () => {
    // Owner can assign owner, admin, manager, editor, support
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("owner", "admin")).toBe(true);

    // Admin can assign admin, manager, etc. but NEVER owner
    expect(canAssignRole("admin", "admin")).toBe(true);
    expect(canAssignRole("admin", "manager")).toBe(true);
    expect(canAssignRole("admin", "owner")).toBe(false);

    // Manager/Editor/Support cannot assign any roles
    expect(canAssignRole("manager", "support")).toBe(false);
    expect(canAssignRole("editor", "editor")).toBe(false);
  });
});

describe("resolveOtherOrdersForDisplay Deduplication", () => {
  const currentOrder: Partial<Order> = {
    id: "MOL-2611-01024",
    order_number: "MOL-2611-01024",
    uuid: "3c60625c-e167-4821-b201-eae6c07d09e2",
    phone: "+8801714690382",
    customer: "Test Customer",
    attribution: {
      has_other_orders: true,
      other_order_numbers: ["MOL-2611-01008", "MOL-2610-01090"],
      other_orders: [
        {
          id: "e687a347-525e-4f90-9a0c-8ae4e5fccbab", // UUID without order_number
          status: "delivered",
          note: "old customer",
          grand_total: 570,
          created_at: "2026-11-07T15:25:42Z",
        },
        {
          id: "1bb0d9d8-10d8-40f0-b3b9-95951423bb0e", // UUID without order_number
          status: "pending",
          note: "pending order",
          grand_total: 720,
          created_at: "2026-11-06T20:32:38Z",
        },
      ],
    },
  };

  it("deduplicates orders when one entry has UUID and one has order ID", () => {
    const result = resolveOtherOrdersForDisplay(currentOrder);

    // Must NOT have 4 items (2 UUIDs + 2 order numbers). Must have EXACTLY 2 items!
    expect(result).toHaveLength(2);

    const ids = result.map((r) => r.id);
    expect(ids).toContain("MOL-2611-01008");
    expect(ids).toContain("MOL-2610-01090");

    // Neither id should be a raw UUID
    expect(ids.some((id) => id.includes("-e5fccbab"))).toBe(false);
    expect(ids.some((id) => id.includes("-95951423bb0e"))).toBe(false);

    // Status and insights must be preserved
    const o1 = result.find((r) => r.id === "MOL-2611-01008");
    expect(o1?.status).toBe("delivered");
    expect(o1?.grand_total).toBe(570);
    expect(o1?.uuid).toBe("e687a347-525e-4f90-9a0c-8ae4e5fccbab");

    const o2 = result.find((r) => r.id === "MOL-2610-01090");
    expect(o2?.status).toBe("pending");
    expect(o2?.grand_total).toBe(720);
    expect(o2?.uuid).toBe("1bb0d9d8-10d8-40f0-b3b9-95951423bb0e");
  });

  it("merges cleanly with loaded table orders sharing the customer phone", () => {
    const loadedOrders: Order[] = [
      {
        id: "MOL-2611-01008",
        order_number: "MOL-2611-01008",
        uuid: "e687a347-525e-4f90-9a0c-8ae4e5fccbab",
        phone: "+8801714690382",
        customer: "Test Customer",
        status: "delivered",
        grand_total: 570,
      } as Order,
    ];

    const result = resolveOtherOrdersForDisplay(currentOrder, loadedOrders);

    // Must still have exactly 2 unique other orders
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["MOL-2611-01008", "MOL-2610-01090"]);
  });

  it("never includes the current order itself in other orders", () => {
    const orderWithSelfInAttribution: Partial<Order> = {
      id: "MOL-2611-01024",
      order_number: "MOL-2611-01024",
      uuid: "3c60625c-e167-4821-b201-eae6c07d09e2",
      phone: "+8801714690382",
      attribution: {
        other_order_numbers: ["MOL-2611-01024", "MOL-2611-01008"],
        other_orders: [
          { id: "3c60625c-e167-4821-b201-eae6c07d09e2", status: "pending" }, // self UUID
          { id: "e687a347-525e-4f90-9a0c-8ae4e5fccbab", order_number: "MOL-2611-01008", status: "delivered" },
        ],
      },
    };

    const loadedOrders: Order[] = [
      {
        id: "MOL-2611-01024",
        order_number: "MOL-2611-01024",
        uuid: "3c60625c-e167-4821-b201-eae6c07d09e2",
        phone: "+8801714690382",
      } as Order,
    ];

    const result = resolveOtherOrdersForDisplay(orderWithSelfInAttribution, loadedOrders);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("MOL-2611-01008");
  });
});

