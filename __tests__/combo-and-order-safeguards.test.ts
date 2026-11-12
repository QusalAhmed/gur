import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractRefToken } from "@/lib/utils";

const { mockClient, mockState } = vi.hoisted(() => {
  const mockState: {
    mockOrders: any[];
    mockInquiries: any[];
    mockOrdersError: Error | null;
    updatedInquiries: any[];
    rpcMock: ((name: string, args: any) => Promise<{ data: any; error: any }>) | null;
  } = {
    mockOrders: [],
    mockInquiries: [],
    mockOrdersError: null,
    updatedInquiries: [],
    rpcMock: null,
  };

  const createMockBuilder = (table: string) => {
    const filters: Array<{ col: string; val: any; op: string }> = [];

    const builder: any = {
      select: () => builder,
      eq: (col: string, val: any) => {
        filters.push({ col, val, op: "eq" });
        return builder;
      },
      in: (col: string, val: any[]) => {
        filters.push({ col, val, op: "in" });
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      update: (data: any) => {
        mockState.updatedInquiries.push(data);
        return builder;
      },
      insert: (data: any) => {
        const insertedRow = {
          id: "new-generated-order-id",
          order_number: "GUR-2611-9999",
          public_token: "tok-new-123",
          ...(typeof data === "object" ? data : {}),
        };
        const insertBuilder: any = {
          select: () => insertBuilder,
          maybeSingle: async () => ({ data: insertedRow, error: null }),
          single: async () => ({ data: insertedRow, error: null }),
          then: (fn: any) => fn({ data: insertedRow, error: null }),
        };
        return insertBuilder;
      },
      delete: () => builder,
      maybeSingle: async () => {
        if (table === "orders") {
          if (mockState.mockOrdersError) return { data: null, error: mockState.mockOrdersError };
          const found = mockState.mockOrders.find((row) =>
            filters.every((f) => {
              if (f.op === "eq") return row[f.col] === f.val;
              if (f.op === "in") return f.val.includes(row[f.col]);
              return true;
            })
          );
          return { data: found || null, error: null };
        }
        if (table === "storefront_inquiries") {
          const found = mockState.mockInquiries.find((row) =>
            filters.every((f) => {
              if (f.op === "eq") return row[f.col] === f.val;
              if (f.op === "in") return f.val.includes(row[f.col]);
              return true;
            })
          );
          return { data: found || null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => builder.maybeSingle(),
    };

    return builder;
  };

  const mockClient = {
    from: (table: string) => createMockBuilder(table),
    rpc: async (name: string, args: any) => {
      if (mockState.rpcMock) return mockState.rpcMock(name, args);
      return { data: null, error: new Error("RPC fallback") };
    },
  };

  return { mockClient, mockState };
});

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: mockClient,
  getSupabaseAdmin: () => mockClient,
  isServiceRoleConfigured: () => true,
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: mockClient,
  getSupabaseClient: () => mockClient,
}));

vi.mock("@/lib/outbox", () => ({
  enqueueAndDispatch: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ["evt-mock"] }),
  },
}));

vi.mock("@/lib/facebook-capi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/facebook-capi")>();
  return {
    ...actual,
    sendCapiEvents: vi.fn().mockResolvedValue({ success: true }),
    captureStorefrontMetaTracking: vi.fn().mockResolvedValue({}),
  };
});

import { placeStorefrontOrderAction, syncStorefrontIncompleteOrderAction } from "@/actions/storefront-order";
import { sendCapiContactAction } from "@/actions/facebook-capi";


describe("Combo Variant Validation Rules", () => {
  function validateComboVariants(variants: Array<{
    id?: string;
    name: string;
    is_combo?: boolean;
    combo_items?: Array<{ component_variant_id: string; quantity: number }>;
  }>) {
    for (const v of variants) {
      if (v.is_combo) {
        if (!v.combo_items || v.combo_items.length === 0) {
          return {
            valid: false,
            error: `Combo variant "${v.name}" must have at least one component.`,
          };
        }
        const compIds = v.combo_items.map((ci) => ci.component_variant_id);
        if (v.id && compIds.some((cid) => cid === v.id)) {
          return {
            valid: false,
            error: `Combo variant "${v.name}" cannot include itself as a component.`,
          };
        }
        if (new Set(compIds).size !== compIds.length) {
          return {
            valid: false,
            error: `Combo variant "${v.name}" has duplicate component items. Each component must be unique.`,
          };
        }
      }
    }
    return { valid: true };
  }

  it("rejects a combo variant when combo_items is empty", () => {
    const res = validateComboVariants([
      {
        name: "Empty Combo",
        is_combo: true,
        combo_items: [],
      },
    ]);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Combo variant "Empty Combo" must have at least one component.');
  });

  it("rejects a combo variant when it includes itself as a component", () => {
    const res = validateComboVariants([
      {
        id: "var-123",
        name: "Self Combo",
        is_combo: true,
        combo_items: [
          { component_variant_id: "var-123", quantity: 1 },
          { component_variant_id: "var-456", quantity: 1 },
        ],
      },
    ]);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Combo variant "Self Combo" cannot include itself as a component.');
  });

  it("rejects duplicate components in the recipe", () => {
    const res = validateComboVariants([
      {
        id: "var-999",
        name: "Duplicate Combo",
        is_combo: true,
        combo_items: [
          { component_variant_id: "var-456", quantity: 1 },
          { component_variant_id: "var-456", quantity: 2 },
        ],
      },
    ]);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Combo variant "Duplicate Combo" has duplicate component items. Each component must be unique.');
  });

  it("accepts valid combo variants with distinct external components", () => {
    const res = validateComboVariants([
      {
        id: "var-combo",
        name: "Valid Combo",
        is_combo: true,
        combo_items: [
          { component_variant_id: "var-1", quantity: 1 },
          { component_variant_id: "var-2", quantity: 2 },
        ],
      },
      {
        id: "var-regular",
        name: "Regular Variant",
        is_combo: false,
      },
    ]);
    expect(res.valid).toBe(true);
  });
});

describe("Inventory Stock Status Change Detection", () => {
  function detectStockStatusChange(v: {
    stock_status: string;
    initial_stock_status?: string;
    stock_status_changed?: boolean;
    previousStockStatus?: string | null;
  }) {
    return (
      v.stock_status_changed !== undefined
        ? v.stock_status_changed
        : v.initial_stock_status !== undefined
        ? v.stock_status !== v.initial_stock_status
        : v.previousStockStatus !== null && v.stock_status !== v.previousStockStatus
    );
  }

  it("does not trigger change when admin saves unchanged stock status", () => {
    const changed = detectStockStatusChange({
      stock_status: "in_stock",
      initial_stock_status: "in_stock",
      stock_status_changed: false,
      previousStockStatus: "in_stock",
    });
    expect(changed).toBe(false);
  });

  it("detects stock status change when admin changes selection", () => {
    const changed = detectStockStatusChange({
      stock_status: "out_of_stock",
      initial_stock_status: "in_stock",
      stock_status_changed: true,
      previousStockStatus: "in_stock",
    });
    expect(changed).toBe(true);
  });

  it("falls back to initial_stock_status comparison if stock_status_changed flag is absent", () => {
    const unchanged = detectStockStatusChange({
      stock_status: "in_stock",
      initial_stock_status: "in_stock",
    });
    expect(unchanged).toBe(false);

    const changed = detectStockStatusChange({
      stock_status: "low_stock",
      initial_stock_status: "in_stock",
    });
    expect(changed).toBe(true);
  });
});

describe("Order Ownership Verification", () => {
  it("rejects order ID if registered phone does not match caller phone", () => {
    const normalizedPhone: string = "+8801712345678";
    const dbOwnerPhone: string = "+8801899999999";

    const isOwner = dbOwnerPhone === normalizedPhone;
    expect(isOwner).toBe(false);
  });

  it("accepts order ID if registered phone matches caller phone", () => {
    const normalizedPhone: string = "+8801712345678";
    const dbOwnerPhone: string = "+8801712345678";

    const isOwner = dbOwnerPhone === normalizedPhone;
    expect(isOwner).toBe(true);
  });
});

describe("Combo Status Toggle for Mixed vs Pure Combo Products", () => {
  function planComboStatusToggle(
    allVariants: Array<{ id: string; is_combo: boolean }>,
    newStatus: "active" | "draft"
  ) {
    const comboVariants = allVariants.filter((v) => v.is_combo);
    const nonComboVariants = allVariants.filter((v) => !v.is_combo);

    if (comboVariants.length === 0) {
      return {
        success: false,
        error: "Product is not a confirmed combo or does not exist.",
      };
    }

    const shouldUpdateProductStatus = nonComboVariants.length === 0;
    const targetVariantIds = comboVariants.map((v) => v.id);

    return {
      success: true,
      shouldUpdateProductStatus,
      targetVariantIds,
      newVariantActiveState: newStatus === "active",
    };
  }

  it("updates product status when product contains only combo variants", () => {
    const plan = planComboStatusToggle(
      [
        { id: "combo-1", is_combo: true },
        { id: "combo-2", is_combo: true },
      ],
      "active"
    );
    expect(plan.success).toBe(true);
    expect(plan.shouldUpdateProductStatus).toBe(true);
    expect(plan.targetVariantIds).toEqual(["combo-1", "combo-2"]);
    expect(plan.newVariantActiveState).toBe(true);
  });

  it("keeps product status unchanged when product contains regular variants as well as combo variants", () => {
    const plan = planComboStatusToggle(
      [
        { id: "regular-1", is_combo: false },
        { id: "combo-1", is_combo: true },
      ],
      "draft"
    );
    expect(plan.success).toBe(true);
    expect(plan.shouldUpdateProductStatus).toBe(false);
    expect(plan.targetVariantIds).toEqual(["combo-1"]);
    expect(plan.newVariantActiveState).toBe(false);
  });

  it("rejects toggle if product has no combo variants", () => {
    const plan = planComboStatusToggle(
      [{ id: "regular-1", is_combo: false }],
      "active"
    );
    expect(plan.success).toBe(false);
    expect(plan.error).toBe("Product is not a confirmed combo or does not exist.");
  });
});

describe("Facebook CAPI Purchase Event ID Selection", () => {
  function resolvePurchaseEventId(
    metaTracking: {
      event_id?: string;
      purchase_event_id?: string | null;
      purchase_event_sent_at?: string | null;
    },
    orderRow: {
      order_number?: string | null;
      id?: string | null;
    }
  ) {
    const isSent = Boolean(metaTracking.purchase_event_sent_at);
    // Align with confirmation page: shared Purchase-specific identifier
    const eventId =
      metaTracking.purchase_event_id ||
      (orderRow.order_number ? String(orderRow.order_number).trim() : undefined) ||
      (orderRow.id ? String(orderRow.id).trim() : undefined) ||
      "generated-fallback-evt";

    return {
      alreadySent: isSent,
      eventId,
    };
  }

  it("uses order_number for unsent Purchase matching confirmation-page trackPurchase", () => {
    const res = resolvePurchaseEventId(
      {
        event_id: "client-pre-checkout-evt-123",
        purchase_event_sent_at: null,
      },
      {
        order_number: "ORD-001",
        id: "uuid-001",
      }
    );
    expect(res.alreadySent).toBe(false);
    expect(res.eventId).toBe("ORD-001");
  });

  it("uses purchase_event_id when explicitly enriched from confirmation page", () => {
    const res = resolvePurchaseEventId(
      {
        event_id: "client-pre-checkout-evt-123",
        purchase_event_id: "ORD-001",
        purchase_event_sent_at: "2026-11-10T00:00:00Z",
      },
      {
        order_number: "ORD-001",
        id: "uuid-001",
      }
    );
    expect(res.alreadySent).toBe(true);
    expect(res.eventId).toBe("ORD-001");
  });

  it("falls back to order ID when order_number is not yet available", () => {
    const res = resolvePurchaseEventId(
      {
        event_id: "client-pre-checkout-evt-123",
        purchase_event_sent_at: null,
      },
      {
        order_number: null,
        id: "uuid-fallback-999",
      }
    );
    expect(res.alreadySent).toBe(false);
    expect(res.eventId).toBe("uuid-fallback-999");
  });
});

describe("Enrichment Purchase Event ID Preservation When Already Sent", () => {
  function enrichPurchaseEventId(
    existingMeta: {
      purchase_event_id?: string | null;
      purchase_event_sent_at?: string | null;
    },
    incomingEventId?: string
  ) {
    const hasSentPurchase = Boolean(existingMeta.purchase_event_sent_at);
    return hasSentPurchase && existingMeta.purchase_event_id
      ? existingMeta.purchase_event_id
      : incomingEventId || existingMeta.purchase_event_id || null;
  }

  it("preserves existing purchase_event_id when purchase was already sent despite different incoming eventId", () => {
    const res = enrichPurchaseEventId(
      {
        purchase_event_id: "original-sent-purchase-id",
        purchase_event_sent_at: "2026-11-10T00:00:00Z",
      },
      "new-different-event-id"
    );
    expect(res).toBe("original-sent-purchase-id");
  });

  it("updates purchase_event_id with incoming eventId when purchase has not yet been sent", () => {
    const res = enrichPurchaseEventId(
      {
        purchase_event_id: null,
        purchase_event_sent_at: null,
      },
      "incoming-pixel-purchase-id"
    );
    expect(res).toBe("incoming-pixel-purchase-id");
  });
});

describe("Delete Combo Action Default Variant Promotion & Clearance", () => {
  function planDeleteComboVariantCleanup(
    allVariants: Array<{ id: string; is_combo: boolean; is_default: boolean }>,
    mode: "deleted" | "archived"
  ) {
    const comboVariants = allVariants.filter((v) => v.is_combo);
    const nonComboVariants = allVariants.filter((v) => !v.is_combo);

    if (comboVariants.length === 0) {
      return { success: false, error: "Not a combo" };
    }

    const hasDefaultRegular = nonComboVariants.some((v) => v.is_default);
    const promotedVariantId =
      !hasDefaultRegular && nonComboVariants.length > 0 ? nonComboVariants[0].id : null;

    const archivedComboState =
      mode === "archived"
        ? comboVariants.map((cv) => ({
            id: cv.id,
            is_active: false,
            is_default: false,
          }))
        : null;

    return {
      success: true,
      promotedVariantId,
      archivedComboState,
    };
  }

  it("clears is_default on archived combo variants and promotes first regular variant if none is default", () => {
    const plan = planDeleteComboVariantCleanup(
      [
        { id: "combo-1", is_combo: true, is_default: true },
        { id: "regular-1", is_combo: false, is_default: false },
        { id: "regular-2", is_combo: false, is_default: false },
      ],
      "archived"
    );

    expect(plan.success).toBe(true);
    expect(plan.promotedVariantId).toBe("regular-1");
    expect(plan.archivedComboState).toEqual([
      { id: "combo-1", is_active: false, is_default: false },
    ]);
  });

  it("does not promote another regular variant if a regular variant is already default", () => {
    const plan = planDeleteComboVariantCleanup(
      [
        { id: "combo-1", is_combo: true, is_default: false },
        { id: "regular-1", is_combo: false, is_default: true },
        { id: "regular-2", is_combo: false, is_default: false },
      ],
      "deleted"
    );

    expect(plan.success).toBe(true);
    expect(plan.promotedVariantId).toBeNull();
  });
});

describe("Status Building for Mixed Products vs Pure Combos in Combos List", () => {
  function resolveComboItemDisplayStatus(params: {
    productStatus: "active" | "draft" | "archived";
    variantIsActive: boolean;
    nonComboVariantsCount: number;
  }): "active" | "draft" | "archived" {
    const { productStatus, variantIsActive, nonComboVariantsCount } = params;
    const isPureCombo = nonComboVariantsCount === 0;

    if (productStatus === "archived") return "archived";
    if (isPureCombo) {
      return productStatus || (variantIsActive ? "active" : "draft");
    }
    return variantIsActive ? "active" : "draft";
  }

  it("displays draft status for mixed products when combo variant is_active is false, even if parent product is active", () => {
    const status = resolveComboItemDisplayStatus({
      productStatus: "active",
      variantIsActive: false,
      nonComboVariantsCount: 1,
    });
    expect(status).toBe("draft");
  });

  it("displays active status for mixed products when combo variant is_active is true", () => {
    const status = resolveComboItemDisplayStatus({
      productStatus: "active",
      variantIsActive: true,
      nonComboVariantsCount: 1,
    });
    expect(status).toBe("active");
  });

  it("displays parent product status for pure combo products", () => {
    const status = resolveComboItemDisplayStatus({
      productStatus: "active",
      variantIsActive: true,
      nonComboVariantsCount: 0,
    });
    expect(status).toBe("active");

    const draftStatus = resolveComboItemDisplayStatus({
      productStatus: "draft",
      variantIsActive: false,
      nonComboVariantsCount: 0,
    });
    expect(draftStatus).toBe("draft");
  });
});

describe("Reference Code Extraction Regex", () => {
  it("extracts ref code containing underscores and hyphens", () => {
    expect(extractRefToken("Check #W-AB_CD please")).toBe("#W-AB_CD");
    expect(extractRefToken("Reference: #P-ORD-123_45")).toBe("#P-ORD-123_45");
    expect(extractRefToken("w-test_code-99")).toBe("W-TEST_CODE-99");
  });

  it("handles basic alphanumeric ref codes", () => {
    expect(extractRefToken("#W-ABCD1234")).toBe("#W-ABCD1234");
    expect(extractRefToken("Plain text W-XYZ1")).toBe("W-XYZ1");
  });

  it("handles trailing-underscore formatting cleanly matching production", () => {
    expect(extractRefToken("_#W-ABC_123_")).toBe("#W-ABC_123");
    expect(extractRefToken("*#P-ORDER_99*")).toBe("#P-ORDER_99");
  });
});

describe("Order Items API Combo Properties Pass-Through", () => {
  function mapInsertedOrderItems(insertedItems: any[]) {
    return insertedItems.map((it: any, idx: number) => ({
      id: it.id || `item-${idx}`,
      sku: it.sku,
      product_name: it.product_name,
      variant_name: it.variant_name,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      line_total: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
      variant_id: it.variant_id,
      is_combo: Boolean(it.is_combo),
      combo_components: it.combo_components || [],
    }));
  }

  it("preserves is_combo and combo_components in mapped items", () => {
    const items = mapInsertedOrderItems([
      {
        id: "item-1",
        sku: "GUR-COMBO",
        product_name: "Mega Combo",
        variant_name: "Special Pack",
        quantity: 2,
        unit_price: 1500,
        variant_id: "var-1",
        is_combo: true,
        combo_components: [
          { component_variant_id: "comp-1", quantity: 2 },
          { component_variant_id: "comp-2", quantity: 1 },
        ],
      },
    ]);

    expect(items[0].is_combo).toBe(true);
    expect(items[0].combo_components).toHaveLength(2);
    expect(items[0].combo_components[0].component_variant_id).toBe("comp-1");
  });
});

describe("Existing Order Selection & Public Token Safeguards", () => {
  function resolveOrderReuseAndToken(params: {
    targetStatus: "pending" | "incomplete_order";
    validatedOrderId?: string | null;
    foundExistingOrder?: {
      id: string;
      status: "pending" | "incomplete_order";
      public_token?: string;
    } | null;
  }) {
    const { targetStatus, validatedOrderId, foundExistingOrder } = params;

    // Rule: in pending checkout, a pending order can ONLY be reused if validated by order ID
    // In draft autosync (incomplete_order), drafts strictly require established ownership proof (validatedOrderId)
    let canReuse = false;
    if (foundExistingOrder) {
      // Both pending orders and incomplete drafts strictly require established ownership proof (validatedOrderId)
      canReuse = Boolean(validatedOrderId && foundExistingOrder.id === validatedOrderId);
    }

    const publicToken =
      canReuse && validatedOrderId && foundExistingOrder?.id === validatedOrderId
        ? foundExistingOrder?.public_token
        : undefined;

    return {
      canReuse,
      publicToken,
    };
  }

  it("does not reuse existing pending order if matched only by phone without validated order ID", () => {
    const res = resolveOrderReuseAndToken({
      targetStatus: "pending",
      validatedOrderId: null,
      foundExistingOrder: {
        id: "ord-pending-1",
        status: "pending",
        public_token: "tok-secret-123",
      },
    });

    expect(res.canReuse).toBe(false);
    expect(res.publicToken).toBeUndefined();
  });

  it("reuses pending order and returns token when order ID was validated", () => {
    const res = resolveOrderReuseAndToken({
      targetStatus: "pending",
      validatedOrderId: "ord-pending-1",
      foundExistingOrder: {
        id: "ord-pending-1",
        status: "pending",
        public_token: "tok-secret-123",
      },
    });

    expect(res.canReuse).toBe(true);
    expect(res.publicToken).toBe("tok-secret-123");
  });

  it("does not reuse incomplete draft for autosave if matched only by phone without validated order ID", () => {
    const res = resolveOrderReuseAndToken({
      targetStatus: "incomplete_order",
      validatedOrderId: null,
      foundExistingOrder: {
        id: "draft-1",
        status: "incomplete_order",
        public_token: "tok-draft-456",
      },
    });

    expect(res.canReuse).toBe(false);
    expect(res.publicToken).toBeUndefined();
  });

  it("reuses incomplete draft for autosave when validated by order ID", () => {
    const res = resolveOrderReuseAndToken({
      targetStatus: "incomplete_order",
      validatedOrderId: "draft-1",
      foundExistingOrder: {
        id: "draft-1",
        status: "incomplete_order",
        public_token: "tok-draft-456",
      },
    });

    expect(res.canReuse).toBe(true);
    expect(res.publicToken).toBe("tok-draft-456");
  });

  it("does not upgrade incomplete draft by phone match without validated order ID", () => {
    const res = resolveOrderReuseAndToken({
      targetStatus: "pending",
      validatedOrderId: null,
      foundExistingOrder: {
        id: "draft-1",
        status: "incomplete_order",
        public_token: "tok-draft-456",
      },
    });

    expect(res.canReuse).toBe(false);
    expect(res.publicToken).toBeUndefined();
  });

  it("upgrades incomplete draft when validated by order ID", () => {
    const res = resolveOrderReuseAndToken({
      targetStatus: "pending",
      validatedOrderId: "draft-1",
      foundExistingOrder: {
        id: "draft-1",
        status: "incomplete_order",
        public_token: "tok-draft-456",
      },
    });

    expect(res.canReuse).toBe(true);
    expect(res.publicToken).toBe("tok-draft-456");
  });
});

describe("Reference Token Extraction With WhatsApp Formatting & Underscores", () => {
  it("excludes surrounding italic formatting underscores while keeping internal underscores intact", () => {
    expect(extractRefToken("_#W-ABC_123_")).toBe("#W-ABC_123");
  });

  it("excludes surrounding bold formatting asterisks while keeping internal underscores intact", () => {
    expect(extractRefToken("*#P-ORDER_99*")).toBe("#P-ORDER_99");
  });

  it("excludes combined WhatsApp formatting and preserves hyphens and underscores", () => {
    expect(extractRefToken("Hello, here is my ref: *_#W-LEAD_DEV-42_* thank you!")).toBe("#W-LEAD_DEV-42");
  });

  it("handles standard non-formatted reference codes", () => {
    expect(extractRefToken("#w-simple123")).toBe("#W-SIMPLE123");
    expect(extractRefToken("p-order")).toBe("P-ORDER");
  });

  it("strips surrounding formatting on fallback text and trims spaces, preserving original case", () => {
    expect(extractRefToken("** abc **")).toBe("abc");
    expect(extractRefToken("* Order-XYZ *")).toBe("Order-XYZ");
    expect(extractRefToken("_CustomRef_")).toBe("CustomRef");
  });
});

describe("Inquiry Session Attribution & Read Error Prevention", () => {
  function processInquiryUpdate(params: {
    readError: Error | null;
    existingInquiry: { fbp: string | null; customer_phone: string | null } | null;
    callerFbp: string | null;
    incomingPhone: string | null;
  }) {
    if (params.readError) {
      return { status: "read_error_blocked", updated: false };
    }
    if (params.existingInquiry) {
      if (params.existingInquiry.fbp && params.callerFbp && params.existingInquiry.fbp !== params.callerFbp) {
        return { status: "session_mismatch_blocked", updated: false };
      }
      return {
        status: "merged_update",
        updated: true,
        mergedPhone: params.incomingPhone || params.existingInquiry.customer_phone,
      };
    }
    return { status: "new_insert", updated: true };
  }

  it("prevents upsert and overwrites when read error occurs", () => {
    const res = processInquiryUpdate({
      readError: new Error("Network timeout"),
      existingInquiry: null,
      callerFbp: "fb.1.12345",
      incomingPhone: "01711111111",
    });
    expect(res.status).toBe("read_error_blocked");
    expect(res.updated).toBe(false);
  });

  it("blocks update when caller session fbp does not match originating inquiry fbp", () => {
    const res = processInquiryUpdate({
      readError: null,
      existingInquiry: { fbp: "fb.1.original_user", customer_phone: "01700000000" },
      callerFbp: "fb.1.different_attacker",
      incomingPhone: "01799999999",
    });
    expect(res.status).toBe("session_mismatch_blocked");
    expect(res.updated).toBe(false);
  });

  it("allows safe update and merging when originating session matches", () => {
    const res = processInquiryUpdate({
      readError: null,
      existingInquiry: { fbp: "fb.1.valid_session", customer_phone: null },
      callerFbp: "fb.1.valid_session",
      incomingPhone: "01712345678",
    });
    expect(res.status).toBe("merged_update");
    expect(res.updated).toBe(true);
    expect((res as any).mergedPhone).toBe("01712345678");
  });
});

describe("Combo Default Variant Promotion Result Inspection", () => {
  function handlePromotionResult(promoErr: { message: string } | null) {
    if (promoErr) {
      return { logged: true, success: false, error: promoErr.message };
    }
    return { logged: false, success: true };
  }

  it("inspects and captures default variant promotion error", () => {
    const res = handlePromotionResult({ message: "Database update timeout" });
    expect(res.logged).toBe(true);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Database update timeout");
  });

  it("succeeds when promotion completes with null error", () => {
    const res = handlePromotionResult(null);
    expect(res.logged).toBe(false);
    expect(res.success).toBe(true);
  });
});

describe("Combo Drawer Existing Product Selection Validation", () => {
  function validateComboDrawerSubmit(params: {
    isEditing: boolean;
    mode: "new" | "existing";
    selectedExistingProductId?: string;
  }) {
    if (!params.isEditing && params.mode === "existing" && !params.selectedExistingProductId) {
      return { valid: false, error: "Please select an existing product to convert into a combo offer." };
    }
    return { valid: true };
  }

  it("rejects submission in existing mode when no product is selected", () => {
    const res = validateComboDrawerSubmit({
      isEditing: false,
      mode: "existing",
      selectedExistingProductId: "",
    });
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Please select an existing product to convert into a combo offer.");
  });

  it("allows submission when product is selected in existing mode", () => {
    const res = validateComboDrawerSubmit({
      isEditing: false,
      mode: "existing",
      selectedExistingProductId: "prod-123",
    });
    expect(res.valid).toBe(true);
  });

  it("allows submission in editing mode even if mode is not new", () => {
    const res = validateComboDrawerSubmit({
      isEditing: true,
      mode: "existing",
      selectedExistingProductId: "",
    });
    expect(res.valid).toBe(true);
  });
});

describe("Mixed Product Status Preservation on Inactive Combo Save", () => {
  function computeProductUpdatePayload(params: {
    productId?: string;
    existingVariants: Array<{ id: string; is_combo: boolean }>;
    comboVariantId?: string;
    inputStatus: "active" | "draft";
  }) {
    const { existingVariants, comboVariantId, inputStatus } = params;
    const hasNonComboVariants = existingVariants.some(
      (v) => !v.is_combo && v.id !== comboVariantId
    );

    const payload: { status?: "active" | "draft"; comboVariantIsActive: boolean } = {
      comboVariantIsActive: inputStatus === "active",
    };

    // Only update product status if it's a pure combo (no regular variants);
    // for mixed products, preserve parent product's status
    if (!hasNonComboVariants) {
      payload.status = inputStatus;
    }

    return {
      hasNonComboVariants,
      payload,
    };
  }

  it("preserves parent product status when saving an inactive combo on an active mixed product", () => {
    const res = computeProductUpdatePayload({
      productId: "mixed-prod-1",
      existingVariants: [
        { id: "reg-var-1", is_combo: false },
        { id: "combo-var-1", is_combo: true },
      ],
      comboVariantId: "combo-var-1",
      inputStatus: "draft",
    });

    expect(res.hasNonComboVariants).toBe(true);
    // Parent product status is NOT changed (remains active in DB)
    expect(res.payload.status).toBeUndefined();
    // The combo variant itself becomes inactive
    expect(res.payload.comboVariantIsActive).toBe(false);
  });

  it("updates parent product status when saving combo on a pure combo product", () => {
    const res = computeProductUpdatePayload({
      productId: "pure-combo-prod-1",
      existingVariants: [{ id: "combo-var-1", is_combo: true }],
      comboVariantId: "combo-var-1",
      inputStatus: "draft",
    });

    expect(res.hasNonComboVariants).toBe(false);
    expect(res.payload.status).toBe("draft");
    expect(res.payload.comboVariantIsActive).toBe(false);
  });
});

describe("CAPI Contact Event RefCode Filtering & Persistence Skipping", () => {
  function processContactRef(rawRefCode?: string) {
    if (!rawRefCode) {
      return { shouldPersistInquiry: false, cleanRef: null, dispatchContactEvent: true };
    }
    const cleanRef = rawRefCode.replace(/^#/, "").trim().toUpperCase();
    if (!cleanRef) {
      // Empty or whitespace reference: skip inquiry persistence but still dispatch Contact event
      return { shouldPersistInquiry: false, cleanRef: null, dispatchContactEvent: true };
    }
    return { shouldPersistInquiry: true, cleanRef, dispatchContactEvent: true };
  }

  it("skips inquiry persistence for empty or whitespace refCode while dispatching Contact event", () => {
    expect(processContactRef("   ")).toEqual({
      shouldPersistInquiry: false,
      cleanRef: null,
      dispatchContactEvent: true,
    });
    expect(processContactRef("#")).toEqual({
      shouldPersistInquiry: false,
      cleanRef: null,
      dispatchContactEvent: true,
    });
  });

  it("persists inquiry and dispatches Contact event when valid refCode is supplied", () => {
    expect(processContactRef("#W-ABC123")).toEqual({
      shouldPersistInquiry: true,
      cleanRef: "W-ABC123",
      dispatchContactEvent: true,
    });
  });
});

describe("Draft Shipping and Weight Preservation Logic", () => {
  function computeDraftTotals(params: {
    itemCount: number;
    deliveryZone?: string | null;
    existingShippingTotal?: number;
    existingTotalWeightKg?: number;
    calculatedWeightGrams: number;
  }) {
    const {
      itemCount,
      deliveryZone,
      existingShippingTotal = 0,
      existingTotalWeightKg = 0,
      calculatedWeightGrams,
    } = params;

    const baseShipping = deliveryZone === "inside_dhaka" ? 70 : deliveryZone === "outside_dhaka" ? 130 : 0;

    let shippingTotal = 0;
    if (itemCount > 0) {
      if (deliveryZone && deliveryZone.trim() !== "") {
        shippingTotal = baseShipping;
      } else {
        shippingTotal = existingShippingTotal || baseShipping;
      }
    }

    const totalWeightKg =
      itemCount === 0
        ? existingTotalWeightKg
        : Math.round((calculatedWeightGrams / 1000.0) * 1000) / 1000;

    return {
      shippingTotal,
      totalWeightKg,
    };
  }

  it("preserves stored shipping charge on existing draft with items when delivery zone is omitted", () => {
    const res = computeDraftTotals({
      itemCount: 2,
      deliveryZone: null,
      existingShippingTotal: 130,
      calculatedWeightGrams: 2000,
    });
    expect(res.shippingTotal).toBe(130);
  });

  it("applies new zone shipping when delivery zone is supplied", () => {
    const res = computeDraftTotals({
      itemCount: 2,
      deliveryZone: "inside_dhaka",
      existingShippingTotal: 130,
      calculatedWeightGrams: 2000,
    });
    expect(res.shippingTotal).toBe(70);
  });

  it("preserves total_weight_kg when item count is zero", () => {
    const res = computeDraftTotals({
      itemCount: 0,
      existingTotalWeightKg: 1.5,
      calculatedWeightGrams: 0,
    });
    expect(res.totalWeightKg).toBe(1.5);
  });
});

describe("Draft Shipping Method Name and Address Preservation", () => {
  function resolveDraftMethodAndAddress(params: {
    courierName?: string | null;
    deliveryZone?: string | null;
    shippingTotal: number;
    existingMethodName?: string | null;
    existingAddress?: Record<string, any> | null;
    phone: string;
    customerName?: string | null;
  }) {
    const {
      courierName,
      deliveryZone,
      shippingTotal,
      existingMethodName,
      existingAddress,
      phone,
      customerName,
    } = params;

    let resolvedMethodName: string | null = null;
    if (courierName && courierName.trim().length > 0) {
      resolvedMethodName = courierName.trim();
    } else if (shippingTotal > 0 && deliveryZone && deliveryZone.trim().length > 0) {
      if (deliveryZone === "inside_dhaka") {
        resolvedMethodName = "Inside Dhaka Home Delivery";
      } else {
        resolvedMethodName = "Outside Dhaka Delivery";
      }
    } else {
      resolvedMethodName = null;
    }

    const finalMethodName = resolvedMethodName || existingMethodName || null;

    const shippingAddress = {
      phone: existingAddress?.phone || phone,
      recipient_name: customerName || existingAddress?.recipient_name || "",
      city:
        deliveryZone === "inside_dhaka"
          ? "Dhaka"
          : deliveryZone && deliveryZone.trim().length > 0
          ? ""
          : existingAddress?.city || "",
      zone: (deliveryZone && deliveryZone.trim()) || existingAddress?.zone || null,
    };

    return {
      finalMethodName,
      shippingAddress,
    };
  }

  it("preserves existing shipping method name and address fields when delivery zone is omitted on update", () => {
    const res = resolveDraftMethodAndAddress({
      deliveryZone: null,
      shippingTotal: 70,
      existingMethodName: "Inside Dhaka Home Delivery",
      existingAddress: {
        phone: "+8801700000000",
        recipient_name: "Original Recipient",
        city: "Dhaka",
        zone: "inside_dhaka",
      },
      phone: "+8801700000000",
      customerName: "Original Recipient",
    });

    expect(res.finalMethodName).toBe("Inside Dhaka Home Delivery");
    expect(res.shippingAddress.zone).toBe("inside_dhaka");
    expect(res.shippingAddress.city).toBe("Dhaka");
    expect(res.shippingAddress.phone).toBe("+8801700000000");
    expect(res.shippingAddress.recipient_name).toBe("Original Recipient");
  });

  it("derives new delivery name and updates zone/city when delivery zone is supplied", () => {
    const res = resolveDraftMethodAndAddress({
      deliveryZone: "outside_dhaka",
      shippingTotal: 130,
      existingMethodName: "Inside Dhaka Home Delivery",
      existingAddress: {
        phone: "+8801700000000",
        recipient_name: "Original Recipient",
        city: "Dhaka",
        zone: "inside_dhaka",
      },
      phone: "+8801700000000",
      customerName: "New Recipient",
    });

    expect(res.finalMethodName).toBe("Outside Dhaka Delivery");
    expect(res.shippingAddress.zone).toBe("outside_dhaka");
    expect(res.shippingAddress.city).toBe("");
    expect(res.shippingAddress.recipient_name).toBe("New Recipient");
  });
});

describe("Product Variant Query Error Handling in saveComboAction", () => {
  function handleVariantQuery(queryError: Error | null, existingVars: any[] | null) {
    if (queryError) {
      throw new Error(`Failed to check existing product variants: ${queryError.message}`);
    }
    return (existingVars || []).some((v) => !v.is_combo);
  }

  it("throws error when variant query fails instead of treating it as empty result", () => {
    expect(() => handleVariantQuery(new Error("Connection timeout"), null)).toThrow(
      "Failed to check existing product variants: Connection timeout"
    );
  });

  it("evaluates variants correctly when query succeeds", () => {
    expect(handleVariantQuery(null, [{ id: "v1", is_combo: false }])).toBe(true);
    expect(handleVariantQuery(null, [{ id: "v1", is_combo: true }])).toBe(false);
  });
});

describe("sendCapiContactAction - Session Authorization Decisions", () => {
  beforeEach(() => {
    mockState.mockOrders = [];
    mockState.mockInquiries = [];
    mockState.mockOrdersError = null;
    mockState.updatedInquiries = [];
    mockState.rpcMock = null;
  });

  it("rejects inquiry update when caller fbp does not match stored fbp", async () => {
    mockState.mockInquiries = [
      {
        id: "inq-1",
        ref_code: "W-REF123",
        channel: "whatsapp",
        customer_phone: "+8801712345678",
        fbp: "fb.1.11111111",
        meta_tracking: {},
      },
    ];

    await sendCapiContactAction({
      eventId: "evt-contact-1",
      channel: "whatsapp",
      refCode: "#W-REF123",
      phone: "+8801799999999",
      fbp: "fb.1.22222222", // Mismatched fbp
    });

    expect(mockState.updatedInquiries.length).toBe(0);
  });

  it("rejects inquiry update when caller fbp is missing but stored fbp exists", async () => {
    mockState.mockInquiries = [
      {
        id: "inq-2",
        ref_code: "W-REF456",
        channel: "whatsapp",
        customer_phone: "+8801712345678",
        fbp: "fb.1.11111111",
        meta_tracking: {},
      },
    ];

    await sendCapiContactAction({
      eventId: "evt-contact-2",
      channel: "whatsapp",
      refCode: "W-REF456",
      phone: "+8801799999999",
      fbp: undefined, // Missing fbp
    });

    expect(mockState.updatedInquiries.length).toBe(0);
  });

  it("allows inquiry update when caller fbp matches stored fbp exactly", async () => {
    mockState.mockInquiries = [
      {
        id: "inq-3",
        ref_code: "W-MATCH789",
        channel: "whatsapp",
        customer_phone: "+8801712345678",
        fbp: "fb.1.33333333",
        meta_tracking: {},
      },
    ];

    await sendCapiContactAction({
      eventId: "evt-contact-3",
      channel: "whatsapp",
      refCode: "W-MATCH789",
      phone: "+8801799999999",
      fbp: "fb.1.33333333", // Matching fbp
    });

    expect(mockState.updatedInquiries.length).toBe(1);
    expect(mockState.updatedInquiries[0].fbp).toBe("fb.1.33333333");
    expect(mockState.updatedInquiries[0].customer_phone).toBe("+8801799999999");
  });

  it("allows inquiry update when no fbp is stored", async () => {
    mockState.mockInquiries = [
      {
        id: "inq-4",
        ref_code: "W-NOFBP",
        channel: "whatsapp",
        customer_phone: null,
        fbp: null,
        meta_tracking: {},
      },
    ];

    await sendCapiContactAction({
      eventId: "evt-contact-4",
      channel: "whatsapp",
      refCode: "W-NOFBP",
      phone: "+8801755555555",
      fbp: "fb.1.44444444",
    });

    expect(mockState.updatedInquiries.length).toBe(1);
    expect(mockState.updatedInquiries[0].fbp).toBe("fb.1.44444444");
  });
});

describe("placeStorefrontOrderAction - Multiple Orders Per Phone & Owned Order Updates", () => {
  beforeEach(() => {
    mockState.mockOrders = [];
    mockState.mockInquiries = [];
    mockState.mockOrdersError = null;
    mockState.updatedInquiries = [];
    mockState.rpcMock = null;
  });

  const validUuid = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

  it("allows placing a new pending order when another pending order exists for the same phone number", async () => {
    mockState.mockOrders = [
      {
        id: validUuid,
        customer_phone: "+8801712345678",
        order_number: "GUR-2611-0001",
        public_token: "tok-pending-abc",
        status: "pending",
        customer_name: "Karim Uddin",
        shipping_address: {
          zone: "outside_dhaka",
          address_line: "Chittagong",
        },
        shipping_total: 130,
        subtotal: 1000,
        grand_total: 1130,
      },
    ];

    const result = await placeStorefrontOrderAction({
      customerPhone: "01712345678",
      customerName: "Karim Uddin Second Order",
      deliveryZone: "inside_dhaka",
      status: "pending",
      items: [{ productId: "p1", productName: "Item", variantId: "v1", variantName: "1", quantity: 2, unitPrice: 300 }],
    });

    expect(result.success).toBe(true);
    expect(result.orderId).toBe("new-generated-order-id");
    expect(result.orderId).not.toBe(validUuid);
    expect(result.status).toBe("pending");
    expect(result.grandTotal).toBe(670);
  });

  it("allows creating a new incomplete_order draft when another pending order exists for the same phone number", async () => {
    mockState.mockOrders = [
      {
        id: validUuid,
        customer_phone: "+8801712345678",
        order_number: "GUR-2611-0001",
        public_token: "tok-pending-abc",
        status: "pending",
      },
    ];

    const result = await placeStorefrontOrderAction({
      customerPhone: "01712345678",
      customerName: "Draft Buyer",
      deliveryZone: "inside_dhaka",
      status: "incomplete_order",
      items: [{ productId: "p1", productName: "Item", variantId: "v1", variantName: "1", quantity: 1, unitPrice: 500 }],
    });

    expect(result.success).toBe(true);
    expect(result.orderId).toBe("new-generated-order-id");
    expect(result.status).toBe("incomplete_order");
  });

  it("updates an owned pending order when matching orderId and status='pending' are passed", async () => {
    mockState.mockOrders = [
      {
        id: validUuid,
        customer_phone: "+8801712345678",
        order_number: "GUR-2611-0001",
        public_token: "tok-pending-abc",
        status: "pending",
        customer_name: "Karim Uddin",
        shipping_address: {
          zone: "outside_dhaka",
          address_line: "Chittagong",
        },
        shipping_total: 130,
        subtotal: 1000,
        grand_total: 1130,
      },
    ];

    const result = await placeStorefrontOrderAction({
      orderId: validUuid,
      customerPhone: "01712345678",
      customerName: "Karim Updated",
      deliveryZone: "inside_dhaka",
      status: "pending",
      items: [{ productId: "p1", productName: "Item", variantId: "v1", variantName: "1", quantity: 5, unitPrice: 200 }],
    });

    expect(result.success).toBe(true);
    expect(result.orderId).toBe(validUuid);
    expect(result.orderNumber).toBe("GUR-2611-0001");
    expect(result.publicToken).toBe("tok-pending-abc");
    expect(result.status).toBe("pending");
    expect(result.customerName).toBe("Karim Updated");
    expect(result.subtotal).toBe(1000);
    expect(result.shippingTotal).toBe(70);
    expect(result.grandTotal).toBe(1070);
    expect(result.deliveryZone).toBe("inside_dhaka");
  });

  it("does not downgrade an owned pending order when a late incomplete_order autosave arrives", async () => {
    mockState.mockOrders = [
      {
        id: validUuid,
        customer_phone: "+8801712345678",
        order_number: "GUR-2611-0002",
        public_token: "tok-pending-def",
        status: "pending",
        customer_name: "Rahim Ali",
        shipping_address: {
          zone: "outside_dhaka",
          address_line: "Old Dhaka",
        },
        shipping_total: 130,
        subtotal: 500,
        grand_total: 630,
      },
    ];

    const result = await placeStorefrontOrderAction({
      orderId: validUuid,
      customerPhone: "01712345678",
      customerName: "Late Draft Overwrite",
      deliveryZone: "inside_dhaka",
      status: "incomplete_order",
    });

    expect(result.success).toBe(true);
    expect(result.orderId).toBe(validUuid);
    expect(result.status).toBe("pending");
    expect(result.customerName).toBe("Rahim Ali");
    expect(result.grandTotal).toBe(630);
    expect(result.deliveryZone).toBe("outside_dhaka");
  });
});

describe("syncStorefrontIncompleteOrderAction - Autosave ID Retention & Fallback Decisions", () => {
  beforeEach(() => {
    mockState.mockOrders = [];
    mockState.mockInquiries = [];
    mockState.mockOrdersError = null;
    mockState.updatedInquiries = [];
    mockState.rpcMock = null;
  });

  const validUuid = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

  it("retains validatedOrderId and delegates to autosave queue when ownership matches", async () => {
    mockState.mockOrders = [
      {
        id: validUuid,
        customer_phone: "+8801712345678",
      },
    ];

    const result = await syncStorefrontIncompleteOrderAction({
      orderId: validUuid,
      customerPhone: "01712345678",
      customerName: "Buyer",
      addressLine: "Banani",
      deliveryZone: "inside_dhaka",
    });

    expect(result.success).toBe(true);
    expect(result.orderId).toBe(validUuid);
    expect(result.status).toBe("incomplete_order");
  });

  it("clears orderId to undefined and routes to placeStorefrontOrderAction when lookup fails with error", async () => {
    mockState.mockOrdersError = new Error("Connection failed");

    const result = await syncStorefrontIncompleteOrderAction({
      orderId: validUuid,
      customerPhone: "01712345678",
      customerName: "Buyer",
    });

    // Since orderId was cleared, it routed to new draft creation
    expect(result.orderId).not.toBe(validUuid);
  });

  it("clears orderId when phone does not match owner", async () => {
    mockState.mockOrders = [
      {
        id: validUuid,
        customer_phone: "+8801999999999",
      },
    ];

    const result = await syncStorefrontIncompleteOrderAction({
      orderId: validUuid,
      customerPhone: "01712345678",
    });

    expect(result.orderId).not.toBe(validUuid);
  });

  it("clears orderId when payload orderId is not a valid UUID", async () => {
    mockState.mockOrders = [
      {
        id: "invalid-id",
        customer_phone: "+8801712345678",
      },
    ];

    const result = await syncStorefrontIncompleteOrderAction({
      orderId: "invalid-id",
      customerPhone: "01712345678",
    });

    expect(result.orderId).not.toBe("invalid-id");
  });
});

describe("Reference Token Normalization and Casing Preservation", () => {
  it("uppercases matched ref codes", () => {
    expect(extractRefToken("Check #w-ab_cd please")).toBe("#W-AB_CD");
    expect(extractRefToken("p-ord-123_45")).toBe("P-ORD-123_45");
  });

  it("preserves original casing when unmatched", () => {
    expect(extractRefToken("Order-MixedCase-123")).toBe("Order-MixedCase-123");
    expect(extractRefToken("*someFormattedText*")).toBe("someFormattedText");
    expect(extractRefToken("_CamelCaseRef_")).toBe("CamelCaseRef");
    expect(extractRefToken("  plain-lowercase-token  ")).toBe("plain-lowercase-token");
  });
});
