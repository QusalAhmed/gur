import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  claritySetTag,
  clarityTrackEvent,
  clarityUpgrade,
  ensureClarityQueueShim,
  initClarity,
  isClarityAdminHostOrPath,
  isClarityEnabledEnvironment,
  resolveClarityProjectId,
  sanitizeClarityProjectId,
  shouldLoadClarity,
} from "@/lib/clarity";

describe("Microsoft Clarity helpers", () => {
  describe("sanitizeClarityProjectId", () => {
    it("accepts valid alphanumeric Clarity project IDs and trims quotes/whitespace", () => {
      expect(sanitizeClarityProjectId("m9k8j7h6g5")).toBe("m9k8j7h6g5");
      expect(sanitizeClarityProjectId('  "AbC123XyZ9"  ')).toBe("AbC123XyZ9");
      expect(sanitizeClarityProjectId("123456")).toBe("123456");
    });

    it("rejects empty, short, overly long, or injection payloads", () => {
      expect(sanitizeClarityProjectId("")).toBe("");
      expect(sanitizeClarityProjectId(null)).toBe("");
      expect(sanitizeClarityProjectId(undefined)).toBe("");
      expect(sanitizeClarityProjectId("abc12")).toBe("");
      expect(sanitizeClarityProjectId("a".repeat(25))).toBe("");
      expect(sanitizeClarityProjectId('m9k8j7"><script>alert(1)</script>')).toBe("");
      expect(sanitizeClarityProjectId("m9k8j7;fetch(1)")).toBe("");
      expect(sanitizeClarityProjectId("m9k8j7-test")).toBe("");
    });
  });

  describe("resolveClarityProjectId", () => {
    it("prefers Admin DB setting over env fallback", () => {
      expect(resolveClarityProjectId("dbproj1234", "envproj999")).toBe(
        "dbproj1234"
      );
    });

    it("falls back to env when Admin DB setting is empty or invalid", () => {
      expect(resolveClarityProjectId("", "envproj999")).toBe("envproj999");
      expect(resolveClarityProjectId(null, "envproj999")).toBe("envproj999");
      expect(resolveClarityProjectId("bad!", "envproj999")).toBe("envproj999");
    });

    it("returns empty string when neither DB nor env has a valid ID", () => {
      expect(resolveClarityProjectId("", "")).toBe("");
      expect(resolveClarityProjectId(null, null)).toBe("");
    });
  });

  describe("isClarityAdminHostOrPath", () => {
    it("detects /admin paths and admin.* subdomains regardless of path", () => {
      expect(isClarityAdminHostOrPath("khatikhejurgur.shop", "/admin")).toBe(true);
      expect(isClarityAdminHostOrPath("khatikhejurgur.shop", "/admin/orders")).toBe(true);
      expect(isClarityAdminHostOrPath("localhost", "/ADMIN/settings")).toBe(true);
      expect(isClarityAdminHostOrPath("admin.khatikhejurgur.shop", "/")).toBe(true);
      expect(isClarityAdminHostOrPath("admin.khatikhejurgur.shop", "/orders")).toBe(true);
      expect(isClarityAdminHostOrPath("admin.localhost:3000", "/")).toBe(true);
    });

    it("allows storefront hosts and paths", () => {
      expect(isClarityAdminHostOrPath("khatikhejurgur.shop", "/")).toBe(false);
      expect(isClarityAdminHostOrPath("www.khatikhejurgur.shop", "/products")).toBe(false);
      expect(isClarityAdminHostOrPath("khatikhejurgur.shop", "/order-confirmed/123")).toBe(false);
      expect(isClarityAdminHostOrPath("khatikhejurgur.shop", "/administrator-info")).toBe(false);
    });
  });

  describe("isClarityEnabledEnvironment & shouldLoadClarity", () => {
    it("enables only in production unless NEXT_PUBLIC_CLARITY_ENABLE_DEV is 'true'", () => {
      expect(isClarityEnabledEnvironment("production", undefined)).toBe(true);
      expect(isClarityEnabledEnvironment("development", undefined)).toBe(false);
      expect(isClarityEnabledEnvironment("test", undefined)).toBe(false);
      expect(isClarityEnabledEnvironment("development", "true")).toBe(true);
      expect(isClarityEnabledEnvironment("development", "false")).toBe(false);
    });

    it("gates Clarity strictly to production storefront with valid project ID", () => {
      expect(
        shouldLoadClarity({
          projectId: "m9k8j7h6g5",
          hostname: "khatikhejurgur.shop",
          pathname: "/",
          nodeEnv: "production",
        })
      ).toBe(true);

      // Blocks admin subdomain even when pathname is "/"
      expect(
        shouldLoadClarity({
          projectId: "m9k8j7h6g5",
          hostname: "admin.khatikhejurgur.shop",
          pathname: "/",
          nodeEnv: "production",
        })
      ).toBe(false);

      // Blocks /admin paths on main domain
      expect(
        shouldLoadClarity({
          projectId: "m9k8j7h6g5",
          hostname: "khatikhejurgur.shop",
          pathname: "/admin/settings",
          nodeEnv: "production",
        })
      ).toBe(false);

      // Blocks development unless opted in
      expect(
        shouldLoadClarity({
          projectId: "m9k8j7h6g5",
          hostname: "localhost",
          pathname: "/",
          nodeEnv: "development",
        })
      ).toBe(false);

      expect(
        shouldLoadClarity({
          projectId: "m9k8j7h6g5",
          hostname: "localhost",
          pathname: "/",
          nodeEnv: "development",
          enableInDev: "true",
        })
      ).toBe(true);

      // Blocks invalid project IDs
      expect(
        shouldLoadClarity({
          projectId: "bad-id!",
          hostname: "khatikhejurgur.shop",
          pathname: "/",
          nodeEnv: "production",
        })
      ).toBe(false);
    });
  });

  describe("Browser Clarity API wrappers", () => {
    const originalWindow = globalThis.window;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      if (originalWindow === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.window;
      } else {
        globalThis.window = originalWindow;
      }
    });

    it("invokes window.clarity on storefront routes and sanitizes tag values", () => {
      const mockClarity = vi.fn();
      globalThis.window = {
        clarity: mockClarity,
        location: {
          hostname: "khatikhejurgur.shop",
          pathname: "/products",
        },
      } as unknown as Window & typeof globalThis;

      clarityTrackEvent("add_to_cart");
      claritySetTag("lang", "  bn\n ");
      claritySetTag("delivery_zone", "inside_dhaka");
      clarityUpgrade("purchase");

      expect(mockClarity).toHaveBeenNthCalledWith(1, "event", "add_to_cart");
      expect(mockClarity).toHaveBeenNthCalledWith(2, "set", "lang", "bn");
      expect(mockClarity).toHaveBeenNthCalledWith(3, "set", "delivery_zone", "inside_dhaka");
      expect(mockClarity).toHaveBeenNthCalledWith(4, "upgrade", "purchase");
    });

    it("is a no-op on admin subdomains and /admin paths", () => {
      const mockClarity = vi.fn();
      globalThis.window = {
        clarity: mockClarity,
        location: {
          hostname: "admin.khatikhejurgur.shop",
          pathname: "/orders",
        },
      } as unknown as Window & typeof globalThis;

      clarityTrackEvent("purchase");
      claritySetTag("order_placed", "true");
      clarityUpgrade("purchase");

      expect(mockClarity).not.toHaveBeenCalled();
    });

    it("ensures window.clarity queue shim is initialized so early events are queued and not dropped", () => {
      const mockWindow = {
        location: {
          hostname: "khatikhejurgur.shop",
          pathname: "/",
        },
      } as unknown as Window & typeof globalThis;
      globalThis.window = mockWindow;

      ensureClarityQueueShim();
      expect(typeof globalThis.window.clarity).toBe("function");
      expect(Array.isArray(globalThis.window.clarity?.q)).toBe(true);

      claritySetTag("lang", "bn");
      expect(globalThis.window.clarity?.q?.length).toBe(1);
      expect(globalThis.window.clarity?.q?.[0]).toEqual(["set", "lang", "bn"]);
    });

    it("injects script using tag.clarity.ms and falls back to www.clarity.ms on load failure", () => {
      const prevDevEnv = process.env.NEXT_PUBLIC_CLARITY_ENABLE_DEV;
      process.env.NEXT_PUBLIC_CLARITY_ENABLE_DEV = "true";

      try {
        const mockExistingScript = {
          parentNode: {
            insertBefore: vi.fn(),
          },
        };

        const createdElements: Array<Record<string, unknown>> = [];
        const mockDocument = {
          getElementById: vi.fn().mockReturnValue(null),
          getElementsByTagName: vi.fn().mockReturnValue([mockExistingScript]),
          createElement: vi.fn().mockImplementation((tag: string) => {
            const el: Record<string, unknown> = { tagName: tag, src: "", id: "", async: false };
            createdElements.push(el);
            return el;
          }),
        };

        globalThis.window = {
          location: {
            hostname: "khatikhejurgur.shop",
            pathname: "/",
          },
        } as unknown as Window & typeof globalThis;
        // @ts-expect-error test mock
        globalThis.document = mockDocument;

        const loaded = initClarity("zfj5g0gmye");
        expect(loaded).toBe(true);
        expect(mockDocument.createElement).toHaveBeenCalledWith("script");

        const scriptEl = createdElements[0];
        expect(scriptEl.src).toBe("https://tag.clarity.ms/tag/zfj5g0gmye");
        expect(scriptEl.id).toBe("ms-clarity-tag");
        expect(scriptEl.async).toBe(true);
        expect(mockExistingScript.parentNode.insertBefore).toHaveBeenCalledWith(
          scriptEl,
          mockExistingScript
        );

        // Simulate network / DNS error on tag.clarity.ms
        if (typeof scriptEl.onerror === "function") {
          scriptEl.onerror(new Event("error"));
          expect(scriptEl.src).toBe("https://www.clarity.ms/tag/zfj5g0gmye");
        }
      } finally {
        process.env.NEXT_PUBLIC_CLARITY_ENABLE_DEV = prevDevEnv;
      }
    });
  });
});
