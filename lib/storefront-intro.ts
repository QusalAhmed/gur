import type { StorefrontLang } from "@/lib/storefront-i18n";

export const INTRO_STORAGE_KEYS = {
  productSeen: "gur_intro_product_seen_v1",
  returningCustomer: "gur_returning_customer_v1",
} as const;

export interface IntroStepBlueprint {
  selector: string;
  title: string;
  intro: string;
  position?: "top" | "bottom" | "left" | "right" | "floating";
  highlightClass?: string;
}

export const INTRO_BUTTON_LABELS: Record<
  StorefrontLang,
  {
    nextLabel: string;
    prevLabel: string;
    skipLabel: string;
    doneLabel: string;
  }
> = {
  bn: {
    nextLabel: "পরবর্তী →",
    prevLabel: "← পেছনে",
    skipLabel: "বাদ দিন ✕",
    doneLabel: "বুঝেছি ✓",
  },
  en: {
    nextLabel: "Next →",
    prevLabel: "← Back",
    skipLabel: "Skip ✕",
    doneLabel: "Got it ✓",
  },
};

function readStorageFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeStorageFlag(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Ignore storage quota / private mode restrictions
  }
}

export function isReturningCustomer(): boolean {
  return readStorageFlag(INTRO_STORAGE_KEYS.returningCustomer);
}

export function markReturningCustomer(): void {
  writeStorageFlag(INTRO_STORAGE_KEYS.returningCustomer);
}

export function hasSeenProductIntro(): boolean {
  return readStorageFlag(INTRO_STORAGE_KEYS.productSeen);
}

export function markProductIntroSeen(): void {
  writeStorageFlag(INTRO_STORAGE_KEYS.productSeen);
}

export function shouldShowProductIntro(): boolean {
  return !isReturningCustomer() && !hasSeenProductIntro();
}

const BN_STEP_NUMS = ["১", "২", "৩", "৪", "৫", "৬"];

function stepPrefix(index: number, lang: StorefrontLang): string {
  if (lang === "bn") {
    return BN_STEP_NUMS[index] || String(index + 1);
  }
  return String(index + 1);
}

export function buildProductIntroSteps(params: {
  lang: StorefrontLang;
  hasVariantSelect: boolean;
  isCombo: boolean;
}): IntroStepBlueprint[] {
  const { lang, hasVariantSelect, isCombo } = params;
  const steps: IntroStepBlueprint[] = [];

  if (!isCombo && hasVariantSelect) {
    const n = stepPrefix(steps.length, lang);
    steps.push({
      selector: '#products [data-tour="product-variant-select"]',
      title: lang === "bn" ? `${n}. প্যাক বা সাইজ বেছে নিন` : `${n}. Choose Pack Size`,
      intro:
        lang === "bn"
          ? "এখানে ট্যাপ করে আপনার পছন্দের ওজন বা প্যাক সাইজ নির্বাচন করুন।"
          : "Tap here to pick your preferred weight or pack size before adding to your cart.",
      position: "bottom",
    });
  }

  if (isCombo) {
    const n = stepPrefix(steps.length, lang);
    steps.push({
      selector: '#products [data-tour="product-combo-buy"]',
      title: lang === "bn" ? `${n}. কম্বো প্যাকেজ অর্ডার করুন` : `${n}. Order This Combo`,
      intro:
        lang === "bn"
          ? "এই বাটনে চাপ দিলে কম্বো প্যাকেজটি কার্টে যোগ হবে এবং সরাসরি অর্ডার ফরমে নিয়ে যাবে।"
          : "Tap this button to add the combo package to your cart and jump straight to the order form.",
      position: "top",
    });
  } else {
    const n = stepPrefix(steps.length, lang);
    steps.push({
      selector: '#products [data-tour="product-plus-btn"]',
      title:
        lang === "bn"
          ? `${n}. কার্টে যোগ করতে (+) বাটনে চাপুন`
          : `${n}. Click + to Add to Cart`,
      intro:
        lang === "bn"
          ? "পণ্যটি কার্টে যোগ করতে চিহ্নিত + বাটনে ক্লিক করুন। প্রতিবার ক্লিকে ১টি করে প্যাক যোগ হবে।"
          : "Click this highlighted + button to add 1 pack to your cart.",
      position: "top",
      highlightClass: "gur-intro-plus-highlight",
    });
  }

  return steps;
}

export function isElementVisibleInViewport(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Scrolls the containing full-screen snap section (`#products`)
 * so that `targetElement` is positioned inside the safe visible zone (avoiding
 * fixed desktop header at top and fixed MobileDock at bottom, and leaving room
 * for the Intro.js tooltip).
 */
export async function scrollSectionElementIntoView(
  targetElement: HTMLElement
): Promise<void> {
  if (typeof window === "undefined") return;
  // Fixed header / mobile dock targets are already pinned in viewport
  if (targetElement.closest("header, [data-mobile-dock='true']")) {
    return;
  }

  const section = targetElement.closest<HTMLElement>("[data-section-index]");
  if (!section) return;

  // Only scroll if section itself can overflow vertically
  if (section.scrollHeight <= section.clientHeight + 4) {
    return;
  }

  const isDesktopHeaderVisible = window.innerWidth >= 640;
  const topSafePadding = isDesktopHeaderVisible ? 84 : 20;
  const bottomSafePadding = isDesktopHeaderVisible ? 28 : 92;

  const sectionRect = section.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();

  const visibleTop = sectionRect.top + topSafePadding;
  const visibleBottom = sectionRect.bottom - bottomSafePadding;

  // Also ensure ~145px headroom or footroom exists where possible so tooltip isn't cramped
  const needsScrollUp = targetRect.top < visibleTop;
  const needsScrollDown = targetRect.bottom > visibleBottom;

  if (!needsScrollUp && !needsScrollDown) {
    return;
  }

  const availableHeight = Math.max(120, visibleBottom - visibleTop);
  const currentOffsetInsideSection = targetRect.top - sectionRect.top + section.scrollTop;

  // Place element comfortably centered within the safe visible region of the section
  const desiredTopInSection =
    topSafePadding + Math.max(0, (availableHeight - targetRect.height) / 2);

  const maxScrollTop = Math.max(0, section.scrollHeight - section.clientHeight);
  const nextScrollTop = Math.max(
    0,
    Math.min(maxScrollTop, currentOffsetInsideSection - desiredTopInSection)
  );

  if (Math.abs(nextScrollTop - section.scrollTop) < 3) {
    return;
  }

  section.scrollTo({ top: nextScrollTop, behavior: "smooth" });

  await new Promise<void>((resolve) => {
    const start = performance.now();
    let lastTop = section.scrollTop;
    let stableFrames = 0;

    const tick = () => {
      const now = performance.now();
      const diff = Math.abs(section.scrollTop - nextScrollTop);
      if (diff <= 2 || now - start > 360) {
        requestAnimationFrame(() => resolve());
        return;
      }
      if (Math.abs(section.scrollTop - lastTop) < 0.5) {
        stableFrames += 1;
        if (stableFrames >= 4) {
          requestAnimationFrame(() => resolve());
          return;
        }
      } else {
        stableFrames = 0;
      }
      lastTop = section.scrollTop;
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

export interface IntroArrowRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function computeIntroArrowOffset(params: {
  axis: "x" | "y";
  targetRect: IntroArrowRectLike;
  tooltipRect: IntroArrowRectLike;
  edgeInset?: number;
}): number {
  const { axis, targetRect, tooltipRect, edgeInset = 24 } = params;
  const tooltipSize = axis === "x" ? tooltipRect.width : tooltipRect.height;
  const safeInset = Math.min(edgeInset, tooltipSize / 2);
  const targetCenter =
    axis === "x"
      ? targetRect.left + targetRect.width / 2
      : targetRect.top + targetRect.height / 2;
  const tooltipOrigin = axis === "x" ? tooltipRect.left : tooltipRect.top;
  const rawOffset = targetCenter - tooltipOrigin;

  return Math.round(
    Math.max(safeInset, Math.min(tooltipSize - safeInset, rawOffset))
  );
}

const ARROW_VAR_LEFT = "--gur-arrow-left";
const ARROW_VAR_TOP = "--gur-arrow-top";

export function clearIntroArrowAlignment(): void {
  if (typeof document === "undefined") return;
  const rootStyle = document.documentElement.style;
  rootStyle.removeProperty(ARROW_VAR_LEFT);
  rootStyle.removeProperty(ARROW_VAR_TOP);
}

/**
 * Aligns `.introjs-arrow` dynamically to the center of `targetElement`
 * (clamped within the tooltip's flat border edge) so Intro.js's viewport
 * clamping and fallback alignments never point the arrow into empty space.
 *
 * Stores custom properties on `document.documentElement.style` rather than
 * `.introjs-tooltip` inline `style` because Intro.js (VanJS) overwrites the
 * tooltip's `style` string on reactive positioning/opacity updates.
 */
export function alignIntroTooltipArrow(targetElement: Element | null): void {
  if (typeof document === "undefined" || !targetElement) return;
  const tooltipEl = document.querySelector<HTMLElement>(
    ".introjs-tooltip.gur-intro-tooltip"
  );
  const arrowEl = tooltipEl?.querySelector<HTMLElement>(".introjs-arrow");
  if (!tooltipEl || !arrowEl) return;

  const rootStyle = document.documentElement.style;

  if (
    tooltipEl.classList.contains("introjs-floating") ||
    window.getComputedStyle(arrowEl).display === "none"
  ) {
    if (arrowEl.hasAttribute("data-arrow-axis")) {
      arrowEl.removeAttribute("data-arrow-axis");
    }
    clearIntroArrowAlignment();
    return;
  }

  const tooltipRect = tooltipEl.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();
  if (
    tooltipRect.width <= 0 ||
    tooltipRect.height <= 0 ||
    targetRect.width <= 0 ||
    targetRect.height <= 0
  ) {
    return;
  }

  const tooltipStyle = window.getComputedStyle(tooltipEl);
  const borderLeft = parseFloat(tooltipStyle.borderLeftWidth) || 0;
  const borderRight = parseFloat(tooltipStyle.borderRightWidth) || 0;
  const borderTop = parseFloat(tooltipStyle.borderTopWidth) || 0;
  const borderBottom = parseFloat(tooltipStyle.borderBottomWidth) || 0;

  // `.introjs-arrow` is positioned relative to the tooltip's padding box
  const containingRect: IntroArrowRectLike = {
    left: tooltipRect.left + borderLeft,
    top: tooltipRect.top + borderTop,
    width: Math.max(0, tooltipRect.width - borderLeft - borderRight),
    height: Math.max(0, tooltipRect.height - borderTop - borderBottom),
  };

  const isHorizontalEdgeArrow =
    arrowEl.classList.contains("left") ||
    arrowEl.classList.contains("left-bottom") ||
    arrowEl.classList.contains("right") ||
    arrowEl.classList.contains("right-bottom");

  if (isHorizontalEdgeArrow) {
    const topOffset = computeIntroArrowOffset({
      axis: "y",
      targetRect,
      tooltipRect: containingRect,
    });
    const nextTop = `${topOffset}px`;
    if (arrowEl.getAttribute("data-arrow-axis") !== "y") {
      arrowEl.setAttribute("data-arrow-axis", "y");
    }
    if (rootStyle.getPropertyValue(ARROW_VAR_TOP) !== nextTop) {
      rootStyle.setProperty(ARROW_VAR_TOP, nextTop);
    }
    rootStyle.removeProperty(ARROW_VAR_LEFT);
    return;
  }

  const leftOffset = computeIntroArrowOffset({
    axis: "x",
    targetRect,
    tooltipRect: containingRect,
  });
  const nextLeft = `${leftOffset}px`;
  if (arrowEl.getAttribute("data-arrow-axis") !== "x") {
    arrowEl.setAttribute("data-arrow-axis", "x");
  }
  if (rootStyle.getPropertyValue(ARROW_VAR_LEFT) !== nextLeft) {
    rootStyle.setProperty(ARROW_VAR_LEFT, nextLeft);
  }
  rootStyle.removeProperty(ARROW_VAR_TOP);
}
