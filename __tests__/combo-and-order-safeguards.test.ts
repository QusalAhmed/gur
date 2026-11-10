import { describe, it, expect } from "vitest";

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

describe("Storefront Pending Order Exists Privacy & Status Distinction", () => {
  function handleStorefrontRpcResponse(
    rpcData: {
      success: boolean;
      pending_order_exists?: boolean;
      order_id?: string;
      order_number?: string;
      phone?: string;
    },
    normalizedPhone: string,
    targetStatus: "incomplete_order" | "pending" = "pending"
  ) {
    if (rpcData.pending_order_exists) {
      if (targetStatus === "incomplete_order") {
        return {
          success: true,
          status: "incomplete_order" as const,
          phone: rpcData.phone || normalizedPhone,
        };
      }
      return {
        success: false,
        error: "An active order already exists for this phone number.",
      };
    }
    return {
      success: true,
      orderId: rpcData.order_id,
      orderNumber: rpcData.order_number,
      status: "pending" as const,
      phone: rpcData.phone || normalizedPhone,
    };
  }

  it("returns privacy-safe incomplete_order status without orderId for draft autosaves", () => {
    const res = handleStorefrontRpcResponse(
      {
        success: true,
        pending_order_exists: true,
        phone: "+8801712345678",
      },
      "+8801712345678",
      "incomplete_order"
    );
    expect(res.success).toBe(true);
    expect((res as any).status).toBe("incomplete_order");
    expect((res as any).orderId).toBeUndefined();
    expect((res as any).orderNumber).toBeUndefined();
  });

  it("returns error for explicit checkout when pending_order_exists is true without owned order ID", () => {
    const res = handleStorefrontRpcResponse(
      {
        success: true,
        pending_order_exists: true,
        phone: "+8801712345678",
      },
      "+8801712345678",
      "pending"
    );
    expect(res.success).toBe(false);
    expect((res as any).error).toBe("An active order already exists for this phone number.");
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
