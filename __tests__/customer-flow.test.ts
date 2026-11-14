import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminCustomersAction, deleteCustomerAction } from "@/actions/customers";
import { searchCustomerByPhoneAction } from "@/actions/new-order-ops";
import { getOrdersAction } from "@/actions/orders";

const mockStaff = {
  id: "55555555-5555-4555-8555-555555555555",
  role: "admin",
};

vi.mock("@/lib/admin-guard", () => ({
  assertStaffRole: vi.fn(async () => mockStaff),
  getCurrentStaffSession: vi.fn(async () => mockStaff),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockCustomersTable: any[] = [];
let mockProfilesTable: any[] = [];
let mockBusinessesTable: any[] = [];
let mockMembersTable: any[] = [];
let orderQueryCalls = {
  mainGte: [] as any[],
  mainLte: [] as any[],
  mainOr: [] as any[],
  mainEq: [] as any[],
  statsGte: [] as any[],
  statsLte: [] as any[],
  statsOr: [] as any[],
  statsEq: [] as any[],
};

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: (table: string) => {
      if (table === "customers") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockCustomersTable,
                error: null,
              }),
            }),
            or: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  return { data: mockCustomersTable[0] || null, error: null };
                }),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: any) => {
              mockCustomersTable = mockCustomersTable.filter((c) => c.id !== val);
              return Promise.resolve({ error: null });
            }),
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: mockProfilesTable[0] || null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "business_accounts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockBusinessesTable,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "business_members") {
        return {
          select: vi.fn().mockResolvedValue({
            data: mockMembersTable,
            error: null,
          }),
        };
      }

      if (table === "orders") {
        return {
          select: vi.fn().mockImplementation((sel: string) => {
            if (sel === "status, grand_total") {
              const filterObj: any = {
                gte: vi.fn().mockImplementation((...args) => {
                  orderQueryCalls.statsGte.push(args);
                  return filterObj;
                }),
                lte: vi.fn().mockImplementation((...args) => {
                  orderQueryCalls.statsLte.push(args);
                  return filterObj;
                }),
                or: vi.fn().mockImplementation((...args) => {
                  orderQueryCalls.statsOr.push(args);
                  return filterObj;
                }),
                eq: vi.fn().mockImplementation((...args) => {
                  orderQueryCalls.statsEq.push(args);
                  return filterObj;
                }),
                then: (fn: any) => Promise.resolve({ data: [], error: null }).then(fn),
              };
              return filterObj;
            }
            const queryObj: any = {
              eq: vi.fn().mockImplementation((...args) => {
                orderQueryCalls.mainEq.push(args);
                return queryObj;
              }),
              gte: vi.fn().mockImplementation((...args) => {
                orderQueryCalls.mainGte.push(args);
                return queryObj;
              }),
              lte: vi.fn().mockImplementation((...args) => {
                orderQueryCalls.mainLte.push(args);
                return queryObj;
              }),
              or: vi.fn().mockImplementation((...args) => {
                orderQueryCalls.mainOr.push(args);
                return queryObj;
              }),
              order: vi.fn().mockReturnThis(),
              range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
            };
            return queryObj;
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
      };
    },
  })),
}));

describe("Customer Flow & Decoupled Customer Management (Approach B)", () => {
  beforeEach(() => {
    orderQueryCalls = {
      mainGte: [],
      mainLte: [],
      mainOr: [],
      mainEq: [],
      statsGte: [],
      statsLte: [],
      statsOr: [],
      statsEq: [],
    };
    mockCustomersTable = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        full_name: "Tariqul Islam",
        phone: "+8801712345678",
        email: "tariqul@example.com",
        total_orders: 3,
        total_spent: 4500,
        last_order_at: "2026-11-12T10:00:00.000Z",
        created_at: "2026-11-01T08:00:00.000Z",
        default_address: {
          address_line: "Sector 3, Uttara",
          district: "Dhaka",
          division: "Dhaka",
        },
      },
    ];
    mockProfilesTable = [];
    mockBusinessesTable = [];
    mockMembersTable = [];
  });

  it("getAdminCustomersAction returns customers populated from customers table", async () => {
    const res = await getAdminCustomersAction();
    expect(res.success).toBe(true);
    expect(res.data.customers).toHaveLength(1);

    const customer = res.data.customers[0];
    expect(customer.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(customer.name).toBe("Tariqul Islam");
    expect(customer.phone).toBe("+8801712345678");
    expect(customer.orders).toBe(3);
    expect(customer.spentNumeric).toBe(4500);
    expect(customer.spent).toContain("4,500");
  });

  it("deleteCustomerAction removes customer from customers table", async () => {
    const res = await deleteCustomerAction("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
    expect(mockCustomersTable).toHaveLength(0);
  });

  it("searchCustomerByPhoneAction falls back to customers table when profile does not exist", async () => {
    mockProfilesTable = []; // No registered profile
    const result = await searchCustomerByPhoneAction("01712345678");

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.name).toBe("Tariqul Islam");
    expect(result.data?.phone).toBe("+8801712345678");
    expect(result.data?.address?.addressLine).toBe("Sector 3, Uttara");
  });

  it("getOrdersAction filters by date range (from and to) with Asia/Dhaka time bounds", async () => {
    const result = await getOrdersAction({
      from: "2026-11-01",
      to: "2026-11-10",
    });

    expect(result).toBeDefined();
    // Main query should filter placed_at >= 2026-11-01T00:00:00+06:00 and <= 2026-11-10T23:59:59.999+06:00
    expect(orderQueryCalls.mainGte).toHaveLength(1);
    expect(orderQueryCalls.mainGte[0]).toEqual(["placed_at", "2026-11-01T00:00:00+06:00"]);
    expect(orderQueryCalls.mainLte).toHaveLength(1);
    expect(orderQueryCalls.mainLte[0]).toEqual(["placed_at", "2026-11-10T23:59:59.999+06:00"]);

    // Stats query should also filter placed_at >= start and <= end
    expect(orderQueryCalls.statsGte).toHaveLength(1);
    expect(orderQueryCalls.statsGte[0]).toEqual(["placed_at", "2026-11-01T00:00:00+06:00"]);
    expect(orderQueryCalls.statsLte).toHaveLength(1);
    expect(orderQueryCalls.statsLte[0]).toEqual(["placed_at", "2026-11-10T23:59:59.999+06:00"]);
  });

  it("getOrdersAction without date range defaults to Last 30 Days", async () => {
    const result = await getOrdersAction({});

    expect(result).toBeDefined();
    // Should have applied 30-day start and end bounds
    expect(orderQueryCalls.mainGte).toHaveLength(1);
    expect(orderQueryCalls.mainGte[0][0]).toBe("placed_at");
    expect(orderQueryCalls.mainGte[0][1]).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\+06:00$/);

    expect(orderQueryCalls.mainLte).toHaveLength(1);
    expect(orderQueryCalls.mainLte[0][0]).toBe("placed_at");
    expect(orderQueryCalls.mainLte[0][1]).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59\.999\+06:00$/);

    expect(orderQueryCalls.statsGte).toHaveLength(1);
    expect(orderQueryCalls.statsLte).toHaveLength(1);
  });

  it("getOrdersAction with explicit 'all' does not apply date filters (All Time)", async () => {
    const result = await getOrdersAction({ from: "all" });

    expect(result).toBeDefined();
    expect(orderQueryCalls.mainGte).toHaveLength(0);
    expect(orderQueryCalls.mainLte).toHaveLength(0);
    expect(orderQueryCalls.statsGte).toHaveLength(0);
    expect(orderQueryCalls.statsLte).toHaveLength(0);
  });

  it("getOrdersAction while searching ignores date range (even when from/to are passed)", async () => {
    const result = await getOrdersAction({
      search: "01712345678",
      from: "2026-11-01",
      to: "2026-11-10",
    });

    expect(result).toBeDefined();
    // Date bounds must NOT be applied to either main query or stats query when searching
    expect(orderQueryCalls.mainGte).toHaveLength(0);
    expect(orderQueryCalls.mainLte).toHaveLength(0);
    expect(orderQueryCalls.statsGte).toHaveLength(0);
    expect(orderQueryCalls.statsLte).toHaveLength(0);

    // Main query and stats query must have applied the search filter across fields
    expect(orderQueryCalls.mainOr).toHaveLength(1);
    expect(orderQueryCalls.mainOr[0][0]).toContain("customer_phone.ilike.%01712345678%");
    expect(orderQueryCalls.statsOr).toHaveLength(1);
    expect(orderQueryCalls.statsOr[0][0]).toContain("customer_phone.ilike.%01712345678%");
  });

  it("getOrdersAction while searching without date range ignores default 30-day bounds", async () => {
    const result = await getOrdersAction({
      search: "ORD-9999",
    });

    expect(result).toBeDefined();
    expect(orderQueryCalls.mainGte).toHaveLength(0);
    expect(orderQueryCalls.mainLte).toHaveLength(0);
    expect(orderQueryCalls.statsGte).toHaveLength(0);
    expect(orderQueryCalls.statsLte).toHaveLength(0);
    expect(orderQueryCalls.mainOr).toHaveLength(1);
    expect(orderQueryCalls.mainOr[0][0]).toContain("order_number.ilike.%ORD-9999%");
  });

  it("getOrdersAction while searching retains status, channel, and payment filters", async () => {
    const result = await getOrdersAction({
      search: "Tariqul",
      status: "confirmed",
      channel: "pos",
      payment: "paid",
      from: "2026-10-01",
      to: "2026-10-15",
    });

    expect(result).toBeDefined();
    // Date bounds ignored
    expect(orderQueryCalls.mainGte).toHaveLength(0);
    expect(orderQueryCalls.mainLte).toHaveLength(0);

    // Filters still applied
    expect(orderQueryCalls.mainEq).toContainEqual(["status", "confirmed"]);
    expect(orderQueryCalls.mainEq).toContainEqual(["channel", "pos"]);
    expect(orderQueryCalls.mainEq).toContainEqual(["payment_status", "paid"]);
    expect(orderQueryCalls.statsEq).toContainEqual(["channel", "pos"]);
    expect(orderQueryCalls.statsEq).toContainEqual(["payment_status", "paid"]);
  });
});
