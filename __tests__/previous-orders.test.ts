import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrdersAction, getOrderAction } from "@/actions/orders";

vi.mock("@/lib/admin-guard", () => ({
  assertStaffRole: vi.fn(async () => ({
    id: "55555555-5555-4555-8555-555555555555",
    role: "admin",
    user: { id: "55555555-5555-4555-8555-555555555555", name: "Admin Staff" },
  })),
  getActorUuid: vi.fn(() => "55555555-5555-4555-8555-555555555555"),
}));

let dbOrders: any[] = [];

function createOrdersMockChain(selectStr: string) {
  let rows = [...dbOrders];
  const filters: Array<(r: any) => boolean> = [];

  const applyFilters = () =>
    rows.filter((r) => filters.every((fn) => fn(r)));

  const chain: any = {
    eq: (col: string, val: any) => {
      filters.push((r) => r[col] === val);
      return chain;
    },
    is: (col: string, val: any) => {
      filters.push((r) => (val === null ? r[col] == null : r[col] === val));
      return chain;
    },
    in: (col: string, vals: any[]) => {
      const set = new Set(vals);
      filters.push((r) => set.has(r[col]));
      return chain;
    },
    not: () => chain,
    gte: () => chain,
    lte: () => chain,
    or: (expr: string) => {
      if (expr.includes("customer_phone.is.null")) {
        filters.push((r) => !(r.customer_phone || "").trim());
      }
      return chain;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      const asc = opts?.ascending ?? true;
      rows = [...rows].sort((a, b) => {
        const va = String(a[col] || "");
        const vb = String(b[col] || "");
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
      return chain;
    },
    range: async (from: number, to: number) => {
      const filtered = applyFilters();
      return {
        data: filtered.slice(from, to + 1),
        count: filtered.length,
        error: null,
      };
    },
    limit: async (n: number) => {
      const filtered = applyFilters();
      return {
        data: filtered.slice(0, n),
        error: null,
      };
    },
    maybeSingle: async () => {
      const filtered = applyFilters();
      return {
        data: filtered[0] ?? null,
        error: null,
      };
    },
    then: (resolve: any) => {
      if (selectStr.includes("grand_total") && !selectStr.includes("customer_phone")) {
        return Promise.resolve({ data: applyFilters(), error: null }).then(resolve);
      }
      return Promise.resolve({ data: applyFilters(), error: null }).then(resolve);
    },
  };

  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: (table: string) => {
      if (table === "orders") {
        return {
          select: (sel: string) => createOrdersMockChain(sel),
        };
      }
      if (table === "order_events") {
        return {
          select: () => ({
            or: () => ({
              limit: async () => ({
                data: dbOrders
                  .filter((o) =>
                    (o.order_events || []).some(
                      (ev: any) =>
                        ev.event_type === "courier_status_partial_delivered" ||
                        ev.to_value === "partially_delivered"
                    )
                  )
                  .map((o) => ({ order_id: o.id })),
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => createOrdersMockChain(""),
      };
    },
  })),
}));

describe("Live previous-order DB enrichment across delivered, partially_delivered, and cancelled statuses", () => {
  beforeEach(() => {
    dbOrders = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        order_number: "MOL-2611-01050",
        status: "pending",
        payment_status: "unpaid",
        fulfillment_status: "unfulfilled",
        payment_method: "cod",
        channel: "admin",
        subtotal: 900,
        discount_total: 0,
        shipping_total: 80,
        grand_total: 980,
        advance_paid: 0,
        amount_paid: 0,
        customer_name: "Rahim Mia",
        customer_phone: "+8801711223344",
        shipping_phone: "+8801711223344",
        shipping_address: { division: "Dhaka", district: "Dhaka", address_line: "Mirpur" },
        placed_at: "2026-11-26T10:00:00Z",
        created_at: "2026-11-26T10:00:00Z",
        attribution: {}, // empty attribution (admin manual order)
        order_items: [],
        order_events: [],
        order_notes: [],
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        order_number: "MOL-2610-00901",
        status: "delivered",
        payment_status: "paid",
        fulfillment_status: "fulfilled",
        payment_method: "cod",
        channel: "web",
        subtotal: 1200,
        discount_total: 0,
        shipping_total: 80,
        grand_total: 1280,
        advance_paid: 0,
        amount_paid: 1280,
        delivered_at: "2026-10-15T12:00:00Z",
        customer_name: "Rahim Mia",
        customer_phone: "01711223344", // local format variant
        shipping_phone: "01711223344",
        shipping_address: { division: "Dhaka", district: "Dhaka", address_line: "Mirpur" },
        placed_at: "2026-10-12T10:00:00Z",
        created_at: "2026-10-12T10:00:00Z",
        attribution: {},
        order_items: [],
        order_events: [],
        order_notes: [],
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        order_number: "MOL-2611-00988",
        status: "delivered", // DB enum stores partially_delivered as delivered + event
        payment_status: "partially_paid",
        fulfillment_status: "partial",
        payment_method: "cod",
        channel: "web",
        subtotal: 1500,
        discount_total: 0,
        shipping_total: 80,
        grand_total: 1580,
        advance_paid: 200,
        amount_paid: 900,
        delivered_at: "2026-11-10T12:00:00Z",
        customer_name: "Rahim Mia",
        customer_phone: "+8801711223344",
        shipping_phone: "+8801711223344",
        shipping_address: { division: "Dhaka", district: "Dhaka", address_line: "Mirpur" },
        placed_at: "2026-11-08T10:00:00Z",
        created_at: "2026-11-08T10:00:00Z",
        attribution: {},
        order_items: [],
        order_events: [
          {
            id: "ev-partial-1",
            event_type: "courier_status_partial_delivered",
            to_value: "delivered",
            message: "Parcel partially delivered by Steadfast Courier",
            created_at: "2026-11-10T12:00:00Z",
          },
        ],
        order_notes: [],
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        order_number: "MOL-2611-01012",
        status: "cancelled",
        payment_status: "unpaid",
        fulfillment_status: "unfulfilled",
        payment_method: "cod",
        channel: "phone",
        subtotal: 600,
        discount_total: 0,
        shipping_total: 80,
        grand_total: 680,
        advance_paid: 0,
        amount_paid: 0,
        customer_name: "Rahim Mia",
        customer_phone: null, // tests fallback to shipping_phone when customer_phone is null
        shipping_phone: "8801711223344",
        shipping_address: { division: "Dhaka", district: "Dhaka", address_line: "Mirpur" },
        placed_at: "2026-11-18T10:00:00Z",
        created_at: "2026-11-18T10:00:00Z",
        attribution: {},
        order_items: [],
        order_events: [],
        order_notes: [],
      },
    ];
  });

  it("attaches delivered, partially_delivered, and cancelled sibling orders when viewing pending tab", async () => {
    const res = await getOrdersAction({ status: "pending", from: "all" });
    expect(res.orders).toHaveLength(1);

    const pendingOrder = res.orders[0];
    expect(pendingOrder.id).toBe("MOL-2611-01050");
    expect(pendingOrder.other_orders).toHaveLength(3);

    const byId = new Map(pendingOrder.other_orders!.map((o) => [o.id, o]));
    expect(byId.get("MOL-2610-00901")?.status).toBe("delivered");
    expect(byId.get("MOL-2611-00988")?.status).toBe("partially_delivered");
    expect(byId.get("MOL-2611-01012")?.status).toBe("cancelled");
  });

  it("attaches live sibling orders on getOrderAction and resolves partially_delivered tab cleanly", async () => {
    const detail = await getOrderAction("MOL-2611-01050");
    expect(detail).not.toBeNull();
    expect(detail?.other_orders).toHaveLength(3);

    const partialTab = await getOrdersAction({ status: "partially_delivered", from: "all" });
    expect(partialTab.orders).toHaveLength(1);
    expect(partialTab.orders[0].id).toBe("MOL-2611-00988");
    expect(partialTab.orders[0].status).toBe("partially_delivered");
  });
});
