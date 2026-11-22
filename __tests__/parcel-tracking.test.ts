import { describe, it, expect, vi, beforeEach } from "vitest";
import { getParcelTrackingAction } from "@/actions/tracking";

const VALID_PUBLIC_TOKEN = "a1b2c3d4-e5f6-4789-abcd-1234567890ef";
const INTERNAL_ORDER_ID = "11111111-2222-3333-4444-555555555555";
const ORDER_NUMBER = "10042";

type MockRow = Record<string, unknown>;

const { mockState, mockAdminClient } = vi.hoisted(() => {
  const mockState: {
    orders: MockRow[];
    orderItems: MockRow[];
    orderEvents: MockRow[];
  } = {
    orders: [],
    orderItems: [],
    orderEvents: [],
  };

  const createBuilder = (table: string) => {
    const filters: Array<{ col: string; val: unknown }> = [];

    const builder: any = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push({ col, val });
        return builder;
      },
      in: () => builder,
      order: () => builder,
      maybeSingle: async () => {
        const rows = table === "orders" ? mockState.orders : [];
        const match = rows.find((r) =>
          filters.every((f) => r[f.col] === f.val)
        );
        return { data: match ?? null, error: null };
      },
      then: (resolve: (val: { data: MockRow[]; error: null }) => void) => {
        let rows = table === "order_items" ? mockState.orderItems : mockState.orderEvents;
        rows = rows.filter((r) =>
          filters.every((f) => r[f.col] === f.val)
        );
        resolve({ data: rows, error: null });
      },
    };
    return builder;
  };

  const mockAdminClient = {
    from: (table: string) => createBuilder(table),
  };

  return { mockState, mockAdminClient };
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => mockAdminClient,
}));

vi.mock("@/actions/storefront-products", () => ({
  getStorefrontProductsAction: async () => ({
    success: true,
    products: [],
  }),
}));

describe("Parcel Tracking Security: Strictly public_token Only", () => {
  beforeEach(() => {
    mockState.orders = [
      {
        id: INTERNAL_ORDER_ID,
        order_number: ORDER_NUMBER,
        public_token: VALID_PUBLIC_TOKEN,
        status: "confirmed",
        fulfillment_status: "processing",
        payment_status: "unpaid",
        payment_method: "cod",
        subtotal: 1200,
        shipping_total: 120,
        grand_total: 1320,
        amount_paid: 0,
        total_weight_kg: 1,
        courier_consignment_id: "CID-998877",
        courier_tracking_code: "STEADFAST-12345",
        courier_tracking_url: null,
        shipping_address: {
          recipient_name: "Abdur Rahim",
          phone: "01712345678",
          district: "Dhaka",
          division: "Dhaka",
          address_line: "Mirpur-10",
        },
        customer_name: "Abdur Rahim",
        customer_phone: "01712345678",
        shipping_phone: "01712345678",
        customer_alternative_phone: null,
        placed_at: "2026-11-20T10:00:00.000Z",
        confirmed_at: "2026-11-20T11:00:00.000Z",
        shipped_at: null,
        delivered_at: null,
        created_at: "2026-11-20T10:00:00.000Z",
      },
    ];

    mockState.orderItems = [
      {
        id: "item-1",
        order_id: INTERNAL_ORDER_ID,
        product_id: "prod-1",
        variant_id: "var-1",
        product_name: "Khejurer Patali Gur",
        variant_name: "1 KG",
        quantity: 1,
        unit_price: 1200,
        line_total: 1200,
        weight_grams: 1000,
        sku: "PATALI-1KG",
      },
    ];

    mockState.orderEvents = [];
  });

  it("rejects blank, non-string, or non-UUID identifiers with notFound: true", async () => {
    const emptyResult = await getParcelTrackingAction("");
    expect(emptyResult.success).toBe(false);
    if (!emptyResult.success) {
      expect(emptyResult.notFound).toBe(true);
    }

    const whitespaceResult = await getParcelTrackingAction("   ");
    expect(whitespaceResult.success).toBe(false);
    if (!whitespaceResult.success) {
      expect(whitespaceResult.notFound).toBe(true);
    }

    const nonUuidResult = await getParcelTrackingAction("invalid-token-string");
    expect(nonUuidResult.success).toBe(false);
    if (!nonUuidResult.success) {
      expect(nonUuidResult.notFound).toBe(true);
    }
  });

  it("strictly disallows tracking by sequential order_number", async () => {
    const result = await getParcelTrackingAction(ORDER_NUMBER);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.notFound).toBe(true);
      expect(result.error).toBe("Invalid or expired tracking link.");
    }
  });

  it("strictly disallows tracking by internal database order UUID", async () => {
    // INTERNAL_ORDER_ID is a valid UUID, but it is orders.id NOT orders.public_token
    const result = await getParcelTrackingAction(INTERNAL_ORDER_ID);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.notFound).toBe(true);
    }
  });

  it("strictly disallows tracking by courier consignment ID or tracking code", async () => {
    const consignmentResult = await getParcelTrackingAction("CID-998877");
    expect(consignmentResult.success).toBe(false);
    if (!consignmentResult.success) {
      expect(consignmentResult.notFound).toBe(true);
    }

    const courierCodeResult = await getParcelTrackingAction("STEADFAST-12345");
    expect(courierCodeResult.success).toBe(false);
    if (!courierCodeResult.success) {
      expect(courierCodeResult.notFound).toBe(true);
    }
  });

  it("successfully retrieves tracking details when queried with a valid public_token", async () => {
    const result = await getParcelTrackingAction(VALID_PUBLIC_TOKEN);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.publicToken).toBe(VALID_PUBLIC_TOKEN);
    expect(result.data.orderNumber).toBe(ORDER_NUMBER);
    expect(result.data.grandTotal).toBe(1320);
    expect(result.data.status).toBe("confirmed");

    // Privacy verification: phone and name must be masked
    expect(result.data.maskedCustomerPhone).toContain("******");
    expect(result.data.maskedCustomerName).toContain("*");
    expect(result.data.maskedCustomerPhone).not.toBe("01712345678");

    // Checkpoints & items
    expect(result.data.items.length).toBe(1);
    expect(result.data.items[0].productName).toBe("Khejurer Patali Gur");
  });
});
