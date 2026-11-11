import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  canAssignRole,
  canRoleAccessPath,
  sanitizeAdminRedirect,
} from "@/lib/admin-permissions";
import {
  clampInt,
  escapeHtml,
  isValidUuid,
  safePublicErrorMessage,
  sanitizeCsvCell,
  sanitizeImageKitFolder,
  sanitizePostgrestFilterTerm,
  sanitizeTelHref,
} from "@/lib/security";
import { timingSafeTokenEqual } from "@/lib/server-security";
import { createSessionToken, verifySessionToken } from "@/lib/admin-auth";

const PRODUCT_ID_1 = "11111111-1111-4111-8111-111111111111";
const VARIANT_ID_1 = "22222222-2222-4222-8222-222222222222";
const ORDER_UUID_1 = "33333333-3333-4333-8333-333333333333";
const OTHER_ORDER_UUID = "44444444-4444-4444-8444-444444444444";
const STAFF_USER_UUID = "55555555-5555-4555-8555-555555555555";
const VALID_PUBLIC_TOKEN = "a1b2c3d4-e5f6-4789-abcd-1234567890ef";

type MockRow = Record<string, unknown>;

interface MockFilter {
  op: string;
  col: string;
  val: unknown;
}

interface MockBuilder {
  select: () => MockBuilder;
  eq: (col: string, val: unknown) => MockBuilder;
  neq: () => MockBuilder;
  in: (col: string, val: unknown[]) => MockBuilder;
  or: () => MockBuilder;
  order: () => MockBuilder;
  limit: () => MockBuilder;
  range: () => MockBuilder;
  update: () => MockBuilder;
  delete: () => MockBuilder;
  insert: (payload: MockRow | MockRow[]) => {
    select: () => unknown;
    maybeSingle: () => Promise<{ data: MockRow; error: null }>;
    single: () => Promise<{ data: MockRow; error: null }>;
    then: (resolve: (val: { data: MockRow[]; error: null }) => void) => void;
  };
  maybeSingle: () => Promise<{ data: MockRow | null; error: null }>;
  single: () => Promise<{ data: MockRow | null; error: null }>;
  then: (
    resolve: (val: { data: MockRow[]; count: number; error: null }) => void
  ) => void;
}

const { mockState, mockAdminClient } = vi.hoisted(() => {
  const mockState: {
    authUser: { id: string; email: string; user_metadata?: Record<string, unknown> } | null;
    authError: Error | null;
    staffRole: string | null;
    cookieMap: Record<string, string>;
    orders: MockRow[];
    products: MockRow[];
    productVariants: MockRow[];
    priceTiers: MockRow[];
    rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
  } = {
    authUser: null,
    authError: null,
    staffRole: null,
    cookieMap: {},
    orders: [],
    products: [],
    productVariants: [],
    priceTiers: [],
    rpcCalls: [],
  };

  function getRowsForTable(table: string): MockRow[] {
    if (table === "orders") return mockState.orders;
    if (table === "products") return mockState.products;
    if (table === "product_variants") return mockState.productVariants;
    if (table === "price_tiers") return mockState.priceTiers;
    if (table === "staff_members") {
      return mockState.staffRole && mockState.authUser
        ? [{ user_id: mockState.authUser.id, role: mockState.staffRole }]
        : [];
    }
    if (table === "profiles" && mockState.authUser) {
      return [{ id: mockState.authUser.id, full_name: "Staff Member", avatar_path: null }];
    }
    return [];
  }

  function createBuilder(table: string): MockBuilder {
    const filters: MockFilter[] = [];
    let isUpdate = false;

    const applyFilters = (rows: MockRow[]) =>
      rows.filter((row) =>
        filters.every((f) => {
          if (f.op === "eq") return row[f.col] === f.val;
          if (f.op === "in") return Array.isArray(f.val) && f.val.includes(row[f.col]);
          return true;
        })
      );

    const builder: MockBuilder = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push({ op: "eq", col, val });
        return builder;
      },
      neq: () => builder,
      in: (col: string, val: unknown[]) => {
        filters.push({ op: "in", col, val });
        return builder;
      },
      or: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      update: () => {
        isUpdate = true;
        return builder;
      },
      delete: () => builder,
      insert: (payload: MockRow | MockRow[]) => {
        const row = Array.isArray(payload) ? payload[0] : payload;
        const resultBuilder = {
          select: () => resultBuilder,
          maybeSingle: async () => ({ data: row, error: null }),
          single: async () => ({ data: row, error: null }),
          then: (resolve: (val: { data: MockRow[]; error: null }) => void) =>
            resolve({ data: [row], error: null }),
        };
        return resultBuilder;
      },
      maybeSingle: async () => {
        const matched = applyFilters(getRowsForTable(table));
        if (isUpdate) {
          return { data: matched[0] || null, error: null };
        }
        return { data: matched[0] || null, error: null };
      },
      single: async () => {
        const matched = applyFilters(getRowsForTable(table));
        return { data: matched[0] || null, error: null };
      },
      then: (
        resolve: (val: { data: MockRow[]; count: number; error: null }) => void
      ) => {
        const matched = applyFilters(getRowsForTable(table));
        resolve({ data: matched, count: matched.length, error: null });
      },
    };
    return builder;
  }

  const mockAdminClient = {
    from: (table: string) => createBuilder(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      mockState.rpcCalls.push({ name, args });
      if (name === "process_storefront_order") {
        const items = Array.isArray(args.p_items)
          ? (args.p_items as Array<Record<string, unknown>>)
          : [];
        const subtotal = items.reduce(
          (sum: number, item) =>
            sum + (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
          0
        );
        const shippingTotal =
          args.p_delivery_zone === "inside_dhaka"
            ? 70
            : args.p_delivery_zone === "outside_dhaka"
            ? 130
            : 0;
        return {
          data: {
            success: true,
            order_id: "99999999-9999-4999-8999-999999999999",
            order_number: "GUR-2611-7777",
            public_token: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            status: args.p_status || "pending",
            subtotal,
            shipping_total: shippingTotal,
            grand_total: subtotal + shippingTotal,
            customer_name: args.p_customer_name,
            phone: args.p_customer_phone,
            delivery_zone: args.p_delivery_zone,
          },
          error: null,
        };
      }
      return { data: [], error: null };
    },
  };

  return { mockState, mockAdminClient };
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => mockAdminClient,
  supabaseAdmin: mockAdminClient,
  isServiceRoleConfigured: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockState.authUser },
        error: mockState.authError,
      }),
    },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      mockState.cookieMap[name] ? { name, value: mockState.cookieMap[name] } : undefined,
    getAll: () =>
      Object.entries(mockState.cookieMap).map(([name, value]) => ({ name, value })),
  }),
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@/lib/outbox", () => ({
  enqueueAndDispatch: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ["evt-test"] }),
  },
}));

vi.mock("@/lib/capi-service", () => ({
  captureStorefrontMetaTrackingInternal: vi.fn().mockResolvedValue({}),
  triggerCapiPurchaseInternal: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/notifications-service", () => ({
  createNotificationInternal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/steadfast-service", () => ({
  bookSteadfastParcelInternal: vi.fn().mockResolvedValue({ success: false }),
}));

import {
  deleteOrderAction,
  getOrdersAction,
  getPublicOrderAction,
} from "@/actions/orders";
import { saveProductAction } from "@/actions/products";
import {
  getSiteSettingsAction,
  updateSiteSettingsAction,
} from "@/actions/settings";
import { placeStorefrontOrderAction } from "@/actions/storefront-order";

describe("Admin RBAC Permissions & Redirects", () => {
  it("enforces fail-closed route access per staff role", () => {
    expect(canRoleAccessPath("support", "/admin/orders")).toBe(true);
    expect(canRoleAccessPath("support", "/admin/settings")).toBe(false);
    expect(canRoleAccessPath("support", "/admin/staff")).toBe(false);
    expect(canRoleAccessPath("support", "/admin/products")).toBe(false);
    expect(canRoleAccessPath("support", "/admin/shipping")).toBe(false);

    expect(canRoleAccessPath("editor", "/admin/products")).toBe(true);
    expect(canRoleAccessPath("editor", "/admin/combos")).toBe(true);
    expect(canRoleAccessPath("editor", "/admin/orders")).toBe(false);
    expect(canRoleAccessPath("editor", "/admin/payments")).toBe(false);
    expect(canRoleAccessPath("editor", "/admin/settings")).toBe(false);

    expect(canRoleAccessPath("manager", "/admin/orders")).toBe(true);
    expect(canRoleAccessPath("manager", "/admin/shipping")).toBe(true);
    expect(canRoleAccessPath("manager", "/admin/settings")).toBe(false);
    expect(canRoleAccessPath("manager", "/admin/audit")).toBe(false);

    expect(canRoleAccessPath("admin", "/admin/settings")).toBe(true);
    expect(canRoleAccessPath("owner", "/admin/staff")).toBe(true);

    // Unknown or traversal paths fail closed
    expect(canRoleAccessPath("owner", "/admin/nonexistent-panel")).toBe(false);
    expect(canRoleAccessPath("owner", "/admin/orders/../settings")).toBe(false);
    expect(canRoleAccessPath("owner", "/storefront")).toBe(false);
  });

  it("prevents privilege escalation in canAssignRole", () => {
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(true);
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("manager", "support")).toBe(false);
    expect(canAssignRole("editor", "editor")).toBe(false);
    expect(canAssignRole("support", "support")).toBe(false);
  });

  it("sanitizes post-login admin redirect targets against open redirects", () => {
    expect(sanitizeAdminRedirect("https://evil.example/phish")).toBe("/admin");
    expect(sanitizeAdminRedirect("//evil.example/admin")).toBe("/admin");
    expect(sanitizeAdminRedirect("/\\evil.example")).toBe("/admin");
    expect(sanitizeAdminRedirect("/admin/login")).toBe("/admin");
    expect(sanitizeAdminRedirect("/checkout")).toBe("/admin");
    expect(sanitizeAdminRedirect("/admin/orders?status=pending")).toBe(
      "/admin/orders?status=pending"
    );
  });
});

describe("Security Sanitizers & Constant-Time Token Verification", () => {
  it("neutralizes PostgREST .or() filter injection operators", () => {
    const raw = '01711,id.neq.0,customer_phone.ilike.*%("\\\';\n\r';
    const sanitized = sanitizePostgrestFilterTerm(raw);
    expect(sanitized).not.toContain(",");
    expect(sanitized).not.toContain("(");
    expect(sanitized).not.toContain(")");
    expect(sanitized).not.toContain("*");
    expect(sanitized).not.toContain("%");
    expect(sanitized).not.toContain("'");
    expect(sanitized).not.toContain('"');
    expect(sanitized).not.toContain("\\");
    expect(sanitized).toBe("01711id.neq.0customer_phone.ilike.");
  });

  it("escapes HTML special characters and sanitizes tel: hrefs", () => {
    expect(escapeHtml(`<script>alert("x&'y'")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&amp;&#39;y&#39;&quot;)&lt;/script&gt;"
    );
    expect(sanitizeTelHref("+8801712345678")).toBe("+8801712345678");
    expect(sanitizeTelHref("javascript:alert(1)")).toBe("");
    expect(sanitizeTelHref("123")).toBe("");
  });

  it("neutralizes CSV/Excel formula injection triggers", () => {
    expect(sanitizeCsvCell("=CMD|'/C calc'!A0")).toBe("'=CMD|'/C calc'!A0");
    expect(sanitizeCsvCell("+1+1")).toBe("'+1+1");
    expect(sanitizeCsvCell("-100")).toBe("'-100");
    expect(sanitizeCsvCell("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
    expect(sanitizeCsvCell("  =HYPERLINK()")).toBe("'  =HYPERLINK()");
    expect(sanitizeCsvCell("Normal Customer Name")).toBe("Normal Customer Name");
  });

  it("validates ImageKit folder paths without traversal", () => {
    expect(sanitizeImageKitFolder("")).toBe("/");
    expect(sanitizeImageKitFolder("products/jars")).toBe("/products/jars");
    expect(sanitizeImageKitFolder("../etc")).toBeNull();
    expect(sanitizeImageKitFolder("/products//secret")).toBeNull();
    expect(sanitizeImageKitFolder("/products?bad=1")).toBeNull();
  });

  it("performs valid UUID checking, clamping, error scrubbing, and constant-time comparison", () => {
    expect(isValidUuid(PRODUCT_ID_1)).toBe(true);
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(clampInt(5000, 10, 1, 100)).toBe(100);
    expect(clampInt("invalid", 10, 1, 100)).toBe(10);
    expect(safePublicErrorMessage("Try again")).toBe("Try again");

    expect(timingSafeTokenEqual("secret-token-value", "secret-token-value")).toBe(true);
    expect(timingSafeTokenEqual("secret-token-value", "secret-token-valuX")).toBe(false);
    expect(timingSafeTokenEqual("short", "longer-secret")).toBe(false);
    expect(timingSafeTokenEqual("", "secret")).toBe(false);
    expect(timingSafeTokenEqual(null, "secret")).toBe(false);
  });
});

describe("HMAC Signed Admin Session Token Verification", () => {
  const originalSecret = process.env.ADMIN_AUTH_SECRET;

  beforeEach(() => {
    process.env.ADMIN_AUTH_SECRET = "0123456789abcdef0123456789abcdef_secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ADMIN_AUTH_SECRET;
    } else {
      process.env.ADMIN_AUTH_SECRET = originalSecret;
    }
  });

  it("verifies intact HMAC tokens and rejects tampered or expired tokens", async () => {
    const token = await createSessionToken({
      id: "admin-root",
      name: "Root Owner",
      email: "owner@example.com",
      role: "owner",
      initials: "RO",
    });

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.role).toBe("owner");

    // Flip last character of signature
    const [payloadPart, sigPart] = token.split(".");
    const badSig =
      sigPart.slice(0, -1) + (sigPart.endsWith("a") ? "b" : "a");
    expect(await verifySessionToken(`${payloadPart}.${badSig}`)).toBeNull();

    // Tamper payload role without resigning
    const forgedPayload = Buffer.from(
      JSON.stringify({
        user: {
          id: "admin-root",
          name: "Hacker",
          email: "owner@example.com",
          role: "owner",
          initials: "HK",
        },
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    )
      .toString("base64url");
    expect(await verifySessionToken(`${forgedPayload}.${sigPart}`)).toBeNull();

    // Expired token
    const expired = await createSessionToken(
      {
        id: "admin-root",
        name: "Root Owner",
        email: "owner@example.com",
        role: "owner",
        initials: "RO",
      },
      -10
    );
    expect(await verifySessionToken(expired)).toBeNull();
  });

  it("refuses to sign when ADMIN_AUTH_SECRET is missing or weak", async () => {
    process.env.ADMIN_AUTH_SECRET = "too-short";
    await expect(
      createSessionToken({
        id: "admin-root",
        name: "Root",
        email: "root@example.com",
        role: "owner",
        initials: "R",
      })
    ).rejects.toThrow(/SECURITY_MISCONFIGURATION/);
  });
});

describe("Server Action Authentication, RBAC & Public Order Token Enforcement", () => {
  beforeEach(() => {
    mockState.authUser = null;
    mockState.authError = null;
    mockState.staffRole = null;
    mockState.cookieMap = {};
    mockState.rpcCalls = [];
    mockState.products = [
      {
        id: PRODUCT_ID_1,
        name: "Khejurer Patali Gur",
        name_bn: "খেজুরের পাটালি গুড়",
        status: "active",
        sort_order: 1,
      },
    ];
    mockState.productVariants = [
      {
        id: VARIANT_ID_1,
        product_id: PRODUCT_ID_1,
        sku: "PATALI-1KG",
        name: "1 KG",
        price: 1250,
        is_default: true,
        is_active: true,
        sort_order: 1,
      },
    ];
    mockState.priceTiers = [];
    mockState.orders = [
      {
        id: ORDER_UUID_1,
        order_number: "GUR-2611-0001",
        public_token: VALID_PUBLIC_TOKEN,
        status: "confirmed",
        payment_status: "unpaid",
        fulfillment_status: "unfulfilled",
        payment_method: "cod",
        channel: "web",
        subtotal: 1250,
        discount_total: 0,
        shipping_total: 70,
        grand_total: 1320,
        amount_paid: 0,
        currency: "BDT",
        placed_at: "2026-11-11T10:00:00Z",
        created_at: "2026-11-11T10:00:00Z",
        customer_name: "Rahim",
        customer_phone: "+8801711111111",
        shipping_phone: "+8801711111111",
        shipping_address: {
          division: "Dhaka",
          district: "Dhaka",
          address_line: "House 12, Dhanmondi",
        },
        customer_note: "Call before delivery",
        cancel_reason: "Internal sensitive cancel note",
        attribution: { fbp: "secret-fbp", admin_debug: true },
        printed_courier_snapshot: { secret: "internal" },
        courier_payload_snapshot: { secret: "internal" },
        order_items: [
          {
            id: "item-1",
            product_id: PRODUCT_ID_1,
            variant_id: VARIANT_ID_1,
            sku: "PATALI-1KG",
            product_name: "Khejurer Patali Gur",
            variant_name: "1 KG",
            quantity: 1,
            unit_price: 1250,
          },
        ],
        order_events: [
          {
            id: "ev-1",
            event_type: "placed",
            message: "Order placed",
            created_at: "2026-11-11T10:00:00Z",
          },
        ],
      },
      {
        id: OTHER_ORDER_UUID,
        order_number: "GUR-2611-0002",
        public_token: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "incomplete_order",
        customer_phone: "+8801899999999",
      },
    ];
  });

  it("rejects unauthenticated callers on protected admin Server Actions", async () => {
    await expect(getOrdersAction()).rejects.toThrow(/LOGIN_REQUIRED/);
    await expect(deleteOrderAction("GUR-2611-0001")).rejects.toThrow(/LOGIN_REQUIRED/);

    const prodRes = await saveProductAction({
      product: { name: "Test", slug: "test", status: "draft" },
      variants: [
        {
          sku: "SKU-1",
          name: "1kg",
          pack_type: "jar",
          net_quantity: 1,
          net_unit: "kg",
          price: 100,
          stock_status: "in_stock",
        },
      ],
      images: [],
    });
    expect(prodRes.success).toBe(false);
    expect(prodRes.error).toMatch(/LOGIN_REQUIRED/);

    const settingsRes = await getSiteSettingsAction();
    expect(settingsRes.success).toBe(false);
    expect(settingsRes.settings).toEqual({});
  });

  it("blocks horizontal/vertical privilege escalation across staff roles", async () => {
    mockState.authUser = { id: STAFF_USER_UUID, email: "editor@example.com" };
    mockState.staffRole = "editor";

    // Editor cannot access order actions or site settings
    await expect(getOrdersAction()).rejects.toThrow(/FORBIDDEN/);
    await expect(deleteOrderAction("GUR-2611-0001")).rejects.toThrow(/FORBIDDEN/);

    const settingsRes = await updateSiteSettingsAction({ "store.name": "Pwned" });
    expect(settingsRes.success).toBe(false);
    expect(settingsRes.error).toMatch(/FORBIDDEN/);

    // Support cannot modify catalog products or site settings
    mockState.staffRole = "support";
    const prodRes = await saveProductAction({
      product: { name: "Test", slug: "test", status: "draft" },
      variants: [
        {
          sku: "SKU-1",
          name: "1kg",
          pack_type: "jar",
          net_quantity: 1,
          net_unit: "kg",
          price: 100,
          stock_status: "in_stock",
        },
      ],
      images: [],
    });
    expect(prodRes.success).toBe(false);
    expect(prodRes.error).toMatch(/FORBIDDEN/);
  });

  it("requires valid publicToken on getPublicOrderAction and strips internal fields", async () => {
    // Missing / short / wrong tokens must return null
    expect(await getPublicOrderAction("GUR-2611-0001", null)).toBeNull();
    expect(await getPublicOrderAction("GUR-2611-0001", "short")).toBeNull();
    expect(
      await getPublicOrderAction(
        "GUR-2611-0001",
        "00000000-0000-4000-8000-000000000000"
      )
    ).toBeNull();

    // Valid matching token returns scrubbed receipt
    const receipt = await getPublicOrderAction("GUR-2611-0001", VALID_PUBLIC_TOKEN);
    expect(receipt).not.toBeNull();
    expect(receipt?.id).toBe("GUR-2611-0001");
    expect(receipt?.grand_total).toBe(1320);
    expect(receipt?.notes).toEqual([]);
    expect(receipt?.attribution).toBeUndefined();
    expect(receipt?.cancel_reason).toBeUndefined();
    expect(receipt?.printed_courier_snapshot).toBeUndefined();
    expect(receipt?.courier_payload_snapshot).toBeUndefined();
    expect(receipt?.public_token).toBeUndefined();
  });

  it("enforces authoritative server catalog prices and discards forged orderId in placeStorefrontOrderAction", async () => {
    const result = await placeStorefrontOrderAction({
      orderId: OTHER_ORDER_UUID, // Belongs to +8801899999999, NOT +8801712345678
      status: "pending",
      customerName: "Attacker",
      customerPhone: "01712345678",
      deliveryZone: "inside_dhaka",
      addressLine: "Dhaka",
      items: [
        {
          productId: PRODUCT_ID_1,
          productName: "Khejurer Patali Gur",
          variantId: VARIANT_ID_1,
          variantName: "1 KG",
          quantity: 2,
          unitPrice: 1, // Client-tampered price (real DB price = 1250)
        },
      ],
    });

    expect(result.success).toBe(true);
    // 2 * 1250 + 70 shipping = 2570 (never 2 * 1 + 70 = 72)
    expect(result.subtotal).toBe(2500);
    expect(result.grandTotal).toBe(2570);

    const rpcCall = mockState.rpcCalls.find(
      (c) => c.name === "process_storefront_order"
    );
    expect(rpcCall).toBeDefined();
    expect(rpcCall?.args.p_order_id).toBeNull();
    const rpcItems = rpcCall?.args.p_items as Array<{ unit_price: number }>;
    expect(rpcItems[0].unit_price).toBe(1250);
  });

  it("rejects fabricated unknown products during storefront checkout", async () => {
    const result = await placeStorefrontOrderAction({
      status: "pending",
      customerName: "Customer",
      customerPhone: "01712345679",
      deliveryZone: "inside_dhaka",
      items: [
        {
          productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          productName: "Nonexistent Product XYZ",
          variantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          variantName: "Fake Pack",
          quantity: 1,
          unitPrice: 1,
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(mockState.rpcCalls).toHaveLength(0);
  });
});
