import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTRO_BUTTON_LABELS,
  INTRO_STORAGE_KEYS,
  alignIntroTooltipArrow,
  buildCheckoutIntroSteps,
  buildProductIntroSteps,
  clearIntroArrowAlignment,
  computeIntroArrowOffset,
  hasSeenCheckoutIntro,
  hasSeenProductIntro,
  isReturningCustomer,
  markCheckoutIntroSeen,
  markProductIntroSeen,
  markReturningCustomer,
  shouldShowCheckoutIntro,
  shouldShowProductIntro,
} from "@/lib/storefront-intro";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe("Storefront Intro Onboarding Logic", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("handles SSR safely when window is undefined", () => {
    expect(isReturningCustomer()).toBe(false);
    expect(hasSeenProductIntro()).toBe(false);
    expect(hasSeenCheckoutIntro()).toBe(false);
    expect(shouldShowProductIntro()).toBe(true);
    expect(shouldShowCheckoutIntro()).toBe(true);

    // Calling writers in SSR should be no-ops without throwing
    expect(() => markProductIntroSeen()).not.toThrow();
    expect(() => markCheckoutIntroSeen()).not.toThrow();
    expect(() => markReturningCustomer()).not.toThrow();
    expect(() => alignIntroTooltipArrow(null)).not.toThrow();
    expect(() => clearIntroArrowAlignment()).not.toThrow();
  });

  it("tracks product and checkout tours independently for new visitors", () => {
    const localStorage = createMemoryStorage();
    vi.stubGlobal("window", { localStorage });

    expect(shouldShowProductIntro()).toBe(true);
    expect(shouldShowCheckoutIntro()).toBe(true);

    // Completing or skipping product intro only suppresses product tour
    markProductIntroSeen();
    expect(localStorage.getItem(INTRO_STORAGE_KEYS.productSeen)).toBe("1");
    expect(hasSeenProductIntro()).toBe(true);
    expect(shouldShowProductIntro()).toBe(false);
    expect(hasSeenCheckoutIntro()).toBe(false);
    expect(shouldShowCheckoutIntro()).toBe(true);

    // Reaching & finishing checkout tour suppresses checkout tour too
    markCheckoutIntroSeen();
    expect(localStorage.getItem(INTRO_STORAGE_KEYS.checkoutSeen)).toBe("1");
    expect(hasSeenCheckoutIntro()).toBe(true);
    expect(shouldShowCheckoutIntro()).toBe(false);
  });

  it("suppresses both onboarding tours once visitor is marked as returning customer", () => {
    const localStorage = createMemoryStorage();
    vi.stubGlobal("window", { localStorage });

    expect(shouldShowProductIntro()).toBe(true);
    expect(shouldShowCheckoutIntro()).toBe(true);

    markReturningCustomer();
    expect(localStorage.getItem(INTRO_STORAGE_KEYS.returningCustomer)).toBe("1");
    expect(isReturningCustomer()).toBe(true);
    expect(shouldShowProductIntro()).toBe(false);
    expect(shouldShowCheckoutIntro()).toBe(false);
  });

  it("fails gracefully if localStorage throws in restricted browsing modes", () => {
    const brokenStorage = {
      getItem() {
        throw new Error("SecurityError");
      },
      setItem() {
        throw new Error("QuotaExceededError");
      },
    };
    vi.stubGlobal("window", { localStorage: brokenStorage });

    expect(() => markProductIntroSeen()).not.toThrow();
    expect(() => markCheckoutIntroSeen()).not.toThrow();
    expect(() => markReturningCustomer()).not.toThrow();
    expect(shouldShowProductIntro()).toBe(true);
    expect(shouldShowCheckoutIntro()).toBe(true);
  });

  it("builds 3 product tour steps with Pack Size, focused Plus CTA, and Mobile Dock CTA", () => {
    const bnSteps = buildProductIntroSteps({
      lang: "bn",
      hasVariantSelect: true,
      isCombo: false,
      checkoutTarget: "mobile-dock",
    });

    expect(bnSteps.map((s) => s.selector)).toEqual([
      '#products [data-tour="product-variant-select"]',
      '#products [data-tour="product-plus-btn"]',
      '[data-tour="mobile-checkout-cta"]',
    ]);
    expect(bnSteps[0].title).toContain("১.");
    expect(bnSteps[0].highlightClass).toBeUndefined();
    expect(bnSteps[1].title).toContain("২.");
    expect(bnSteps[1].title).toContain("+");
    expect(bnSteps[1].intro).toContain("+");
    expect(bnSteps[1].highlightClass).toBe("gur-intro-plus-highlight");
    expect(bnSteps[2].title).toContain("৩.");
    expect(bnSteps[2].position).toBe("top");
    expect(bnSteps[2].highlightClass).toBeUndefined();

    const enSteps = buildProductIntroSteps({
      lang: "en",
      hasVariantSelect: true,
      isCombo: false,
      checkoutTarget: "header-checkout",
    });
    expect(enSteps.map((s) => s.selector)).toEqual([
      '#products [data-tour="product-variant-select"]',
      '#products [data-tour="product-plus-btn"]',
      '[data-tour="header-checkout-cta"]',
    ]);
    expect(enSteps[1].title).toContain("+");
    expect(enSteps[1].intro).toContain("+");
    expect(enSteps[1].highlightClass).toBe("gur-intro-plus-highlight");
    expect(enSteps[2].position).toBe("bottom");
  });

  it("skips variant selector step for single-variant products and adapts copy for combos", () => {
    const singleVariantSteps = buildProductIntroSteps({
      lang: "en",
      hasVariantSelect: false,
      isCombo: false,
      checkoutTarget: "header-cart",
    });

    expect(singleVariantSteps.map((s) => s.selector)).toEqual([
      '#products [data-tour="product-plus-btn"]',
      '[data-tour="header-cart-cta"]',
    ]);
    expect(singleVariantSteps[0].title).toMatch(/^1\./);
    expect(singleVariantSteps[0].highlightClass).toBe("gur-intro-plus-highlight");
    expect(singleVariantSteps[1].title).toMatch(/^2\./);

    const comboSteps = buildProductIntroSteps({
      lang: "bn",
      hasVariantSelect: true,
      isCombo: true,
      checkoutTarget: null,
    });
    expect(comboSteps.map((s) => s.selector)).toEqual([
      '#products [data-tour="product-combo-buy"]',
    ]);
    expect(comboSteps[0].title).toContain("কম্বো");
    expect(comboSteps[0].highlightClass).toBeUndefined();
  });

  it("builds detailed 6-step checkout tour adapting step 1 to cart state in both languages", () => {
    const bnWithCart = buildCheckoutIntroSteps({
      lang: "bn",
      hasCartItems: true,
    });
    const bnEmptyCart = buildCheckoutIntroSteps({
      lang: "bn",
      hasCartItems: false,
    });

    expect(bnWithCart.map((s) => s.selector)).toEqual([
      '#checkout [data-tour="checkout-summary"]',
      '#checkout [data-tour="checkout-name"]',
      '#checkout [data-tour="checkout-phone"]',
      '#checkout [data-tour="checkout-zone"]',
      '#checkout [data-tour="checkout-address"]',
      '#checkout [data-tour="checkout-submit"]',
    ]);
    expect(bnWithCart[0].title).toContain("নির্বাচিত পণ্য");
    expect(bnEmptyCart[0].title).toContain("সরাসরি ফোন অর্ডার");
    expect(bnEmptyCart[0].intro).toContain("গুড় দেখতে উপরে যান");
    expect(bnWithCart[2].intro).toContain("017XXXXXXXX");
    expect(bnWithCart[3].intro).toContain("৳৭০");
    expect(bnWithCart[3].intro).toContain("৳১৩০");

    const enWithCart = buildCheckoutIntroSteps({
      lang: "en",
      hasCartItems: true,
    });
    const enEmptyCart = buildCheckoutIntroSteps({
      lang: "en",
      hasCartItems: false,
    });
    expect(enWithCart[0].title).toContain("Review Selected Items");
    expect(enEmptyCart[0].title).toContain("Direct Phone Order");
    expect(enWithCart[3].intro).toContain("৳70");
    expect(enWithCart[3].intro).toContain("৳130");
  });

  it("provides localized button labels for bn and en", () => {
    for (const lang of ["bn", "en"] as const) {
      expect(INTRO_BUTTON_LABELS[lang].nextLabel.length).toBeGreaterThan(0);
      expect(INTRO_BUTTON_LABELS[lang].prevLabel.length).toBeGreaterThan(0);
      expect(INTRO_BUTTON_LABELS[lang].skipLabel.length).toBeGreaterThan(0);
      expect(INTRO_BUTTON_LABELS[lang].doneLabel.length).toBeGreaterThan(0);
    }
  });

  it("computes exact target-centered arrow offsets across 360px mobile and desktop clamping", () => {
    // 360px Android: tooltip clamped to [83..343], + button at [281..325] (center 303)
    expect(
      computeIntroArrowOffset({
        axis: "x",
        targetRect: { left: 281, top: 476, width: 44, height: 44 },
        tooltipRect: { left: 83, top: 198, width: 260, height: 262 },
      })
    ).toBe(220);

    // 1280px desktop: tooltip clamped to [1016..1276], + button at [1141..1189] (center 1165)
    expect(
      computeIntroArrowOffset({
        axis: "x",
        targetRect: { left: 1141, top: 444, width: 48, height: 48 },
        tooltipRect: { left: 1016, top: 166, width: 260, height: 262 },
      })
    ).toBe(149);

    // Edge clamping protects 18px rounded tooltip corners on extreme targets
    expect(
      computeIntroArrowOffset({
        axis: "x",
        targetRect: { left: 5, top: 100, width: 10, height: 10 },
        tooltipRect: { left: 20, top: 200, width: 260, height: 200 },
      })
    ).toBe(24);
    expect(
      computeIntroArrowOffset({
        axis: "x",
        targetRect: { left: 295, top: 100, width: 20, height: 10 },
        tooltipRect: { left: 20, top: 200, width: 260, height: 200 },
      })
    ).toBe(236);

    // Y-axis alignment for left/right tooltips
    expect(
      computeIntroArrowOffset({
        axis: "y",
        targetRect: { left: 100, top: 300, width: 48, height: 48 },
        tooltipRect: { left: 170, top: 240, width: 260, height: 220 },
      })
    ).toBe(84);
  });

  it("writes aligned arrow CSS variables on documentElement (accounting for tooltip border) and cleans them up", () => {
    const rootVars = new Map<string, string>();
    const rootStyle = {
      getPropertyValue: (prop: string) => rootVars.get(prop) ?? "",
      setProperty: (prop: string, value: string) => {
        rootVars.set(prop, value);
      },
      removeProperty: (prop: string) => {
        rootVars.delete(prop);
        return "";
      },
    };
    const arrowAttrs = new Map<string, string>();
    const arrowClasses = new Set<string>(["introjs-arrow", "bottom-middle"]);
    const arrowEl = {
      classList: { contains: (cls: string) => arrowClasses.has(cls) },
      hasAttribute: (k: string) => arrowAttrs.has(k),
      getAttribute: (k: string) => arrowAttrs.get(k) ?? null,
      setAttribute: (k: string, v: string) => arrowAttrs.set(k, v),
      removeAttribute: (k: string) => arrowAttrs.delete(k),
    };
    const tooltipEl = {
      classList: { contains: () => false },
      querySelector: (sel: string) => (sel === ".introjs-arrow" ? arrowEl : null),
      getBoundingClientRect: () => ({ left: 370, top: 200, width: 263, height: 220 }),
    };
    const targetEl = {
      getBoundingClientRect: () => ({ left: 400, top: 450, width: 48, height: 48 }),
    };

    vi.stubGlobal("document", {
      documentElement: { style: rootStyle },
      querySelector: (sel: string) =>
        sel === ".introjs-tooltip.gur-intro-tooltip" ? tooltipEl : null,
    });
    vi.stubGlobal("window", {
      getComputedStyle: (el: unknown) =>
        el === arrowEl
          ? { display: "block" }
          : {
              borderLeftWidth: "1.5px",
              borderRightWidth: "1.5px",
              borderTopWidth: "1.5px",
              borderBottomWidth: "1.5px",
            },
    });

    alignIntroTooltipArrow(targetEl as unknown as Element);

    // Target center X = 424; padding edge X = 370 + 1.5 = 371.5 -> offset = round(52.5) = 53px
    expect(arrowAttrs.get("data-arrow-axis")).toBe("x");
    expect(rootVars.get("--gur-arrow-left")).toBe("53px");
    expect(rootVars.has("--gur-arrow-top")).toBe(false);

    clearIntroArrowAlignment();
    expect(rootVars.has("--gur-arrow-left")).toBe(false);
    expect(rootVars.has("--gur-arrow-top")).toBe(false);
  });
});
