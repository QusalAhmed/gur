"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StorefrontLang } from "@/lib/storefront-i18n";
import {
  INTRO_BUTTON_LABELS,
  type IntroStepBlueprint,
  alignIntroTooltipArrow,
  buildProductIntroSteps,
  clearIntroArrowAlignment,
  isElementVisibleInViewport,
  markProductIntroSeen,
  scrollSectionElementIntoView,
  shouldShowProductIntro,
} from "@/lib/storefront-intro";

interface UseStorefrontIntroProps {
  lang: StorefrontLang;
  activeSectionIndex: number;
  productsStartIndex: number;
  isLoading: boolean;
  hasProducts: boolean;
  isCartOpen: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useStorefrontIntro({
  lang,
  activeSectionIndex,
  productsStartIndex,
  isLoading,
  hasProducts,
  isCartOpen,
  containerRef,
}: UseStorefrontIntroProps) {
  const [isTourActive, setIsTourActive] = useState(false);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isTourActiveRef = useRef(false);
  const activeTourRef = useRef<{
    exit: (force?: boolean) => Promise<unknown>;
    refresh: (refreshSteps?: boolean) => unknown;
    nextStep: () => Promise<unknown>;
    getCurrentStep: () => number | undefined;
    getSteps: () => Array<{ element?: Element | HTMLElement | string | null }>;
  } | null>(null);
  const programmaticExitRef = useRef(false);
  const plusAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productInteractedRef = useRef(false);

  const clearPlusAdvanceTimer = useCallback(() => {
    if (plusAdvanceTimerRef.current !== null) {
      clearTimeout(plusAdvanceTimerRef.current);
      plusAdvanceTimerRef.current = null;
    }
  }, []);

  const onProductSectionRef = useRef(false);
  useEffect(() => {
    onProductSectionRef.current = activeSectionIndex === productsStartIndex;
  }, [activeSectionIndex, productsStartIndex]);

  // Detect early user interaction on Product 1 controls (even during scroll
  // transitions before activeSectionIndex commits) and handle interactive clicks
  // while the product tour is open.
  useEffect(() => {
    const handleInteraction = (e: Event) => {
      const target = e.target as Element | null;
      if (!target) return;

      // While the product tour is active, clicking the highlighted + button adds
      // to cart and advances or finishes the tour.
      if (isTourActiveRef.current) {
        if (e.type === "click" && onProductSectionRef.current && activeTourRef.current) {
          const plusTarget = target.closest('#products [data-tour="product-plus-btn"]');
          if (plusTarget) {
            const tour = activeTourRef.current;
            const currentIdx = tour.getCurrentStep();
            const steps = tour.getSteps();
            const activeStepElement =
              typeof currentIdx === "number" ? steps[currentIdx]?.element : null;

            if (
              activeStepElement instanceof Element &&
              (activeStepElement === plusTarget ||
                activeStepElement.contains(plusTarget)) &&
              plusAdvanceTimerRef.current === null &&
              typeof currentIdx === "number"
            ) {
              plusAdvanceTimerRef.current = setTimeout(() => {
                plusAdvanceTimerRef.current = null;
                if (activeTourRef.current !== tour) return;
                const latestIdx = tour.getCurrentStep();
                const latestSteps = tour.getSteps();
                if (typeof latestIdx === "number" && latestIdx === currentIdx) {
                  if (latestIdx < latestSteps.length - 1) {
                    void tour.nextStep();
                  } else {
                    void tour.exit(true);
                  }
                }
              }, 260);
            }
          }
        }
        return;
      }

      if (target.closest('#products [data-tour-zone="product-controls"]')) {
        productInteractedRef.current = true;
        markProductIntroSeen();
      }
    };

    document.addEventListener("pointerdown", handleInteraction, { capture: true, passive: true });
    document.addEventListener("click", handleInteraction, { capture: true, passive: true });
    document.addEventListener("focusin", handleInteraction, { capture: true, passive: true });
    document.addEventListener("change", handleInteraction, { capture: true, passive: true });

    return () => {
      document.removeEventListener("pointerdown", handleInteraction, { capture: true });
      document.removeEventListener("click", handleInteraction, { capture: true });
      document.removeEventListener("focusin", handleInteraction, { capture: true });
      document.removeEventListener("change", handleInteraction, { capture: true });
    };
  }, [clearPlusAdvanceTimer]);

  useEffect(() => {
    // Pause / don't launch if cart drawer is open or products are still loading
    if (isCartOpen) {
      clearPlusAdvanceTimer();
      if (activeTourRef.current) {
        programmaticExitRef.current = true;
        const tourToClose = activeTourRef.current;
        activeTourRef.current = null;
        isTourActiveRef.current = false;
        tourToClose
          .exit(true)
          .catch(() => {})
          .finally(() => {
            if (isMountedRef.current && !isTourActiveRef.current) {
              setIsTourActive(false);
            }
          });
      }
      return;
    }

    if (
      activeSectionIndex !== productsStartIndex ||
      isLoading ||
      !hasProducts ||
      productInteractedRef.current ||
      !shouldShowProductIntro()
    ) {
      return;
    }

    let cancelled = false;
    let rafId: number | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeCleanup: (() => void) | null = null;
    let observerCleanup: (() => void) | null = null;

    const resolveBlueprintSteps = (): IntroStepBlueprint[] => {
      const hasVariantSelect = isElementVisibleInViewport(
        document.querySelector('#products [data-tour="product-variant-select"]')
      );
      const isCombo = isElementVisibleInViewport(
        document.querySelector('#products [data-tour="product-combo-buy"]')
      );

      return buildProductIntroSteps({
        lang,
        hasVariantSelect,
        isCombo,
      });
    };

    const launchTour = async () => {
      if (cancelled) return;
      if (productInteractedRef.current || !shouldShowProductIntro()) return;

      const blueprints = resolveBlueprintSteps();
      const isCompactMobileViewport =
        typeof window !== "undefined" && window.innerWidth < 640;

      const resolvedSteps = blueprints
        .map((bp) => {
          const el = document.querySelector(bp.selector);
          if (!isElementVisibleInViewport(el)) return null;

          let position = bp.position;
          if (isCompactMobileViewport) {
            const rect = el.getBoundingClientRect();
            // For tall elements on phones, center inside the highlighted card
            // so the tooltip never gets pushed under the bottom MobileDock.
            if (rect.height > Math.max(290, window.innerHeight - 340)) {
              position = "floating";
            }
          }

          return {
            element: el,
            title: bp.title,
            intro: bp.intro,
            position,
            ...(bp.highlightClass ? { highlightClass: bp.highlightClass } : {}),
          };
        })
        .filter((step): step is NonNullable<typeof step> => step !== null);

      if (resolvedSteps.length === 0 || cancelled) return;

      const { default: introJs } = await import("intro.js");
      if (cancelled) return;
      if (productInteractedRef.current || !shouldShowProductIntro()) return;

      // Ensure any prior tour is cleanly closed before starting
      if (activeTourRef.current) {
        programmaticExitRef.current = true;
        await activeTourRef.current.exit(true).catch(() => {});
        activeTourRef.current = null;
      }

      const labels = INTRO_BUTTON_LABELS[lang];
      const isDark =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark");

      const tour = introJs.tour();
      programmaticExitRef.current = false;

      tour.setOptions({
        steps: resolvedSteps,
        nextLabel: labels.nextLabel,
        prevLabel: labels.prevLabel,
        skipLabel: labels.skipLabel,
        doneLabel: labels.doneLabel,
        nextToDone: true,
        hidePrev: true,
        showButtons: true,
        showBullets: resolvedSteps.length > 1,
        showProgress: resolvedSteps.length > 1,
        showStepNumbers: false,
        exitOnEsc: true,
        exitOnOverlayClick: false,
        keyboardNavigation: true,
        scrollToElement: false,
        autoPosition: true,
        positionPrecedence: ["bottom", "top", "right", "left"],
        overlayOpacity: 0.58,
        helperElementPadding: 8,
        tooltipClass: "gur-intro-tooltip",
        highlightClass: "gur-intro-highlight",
        theme: isDark ? "dark" : "light",
      });

      tour.onBeforeChange(async (targetElement) => {
        if (targetElement instanceof HTMLElement) {
          await scrollSectionElementIntoView(targetElement);
        }
        return true;
      });

      let activeStepTarget: Element | null = null;
      let observedTourEl: Element | null = null;
      let tourObserver: MutationObserver | null = null;
      let alignRafId: number | null = null;
      let secondAlignRafId: number | null = null;
      let arrowQuickTimer: ReturnType<typeof setTimeout> | null = null;
      let arrowSettleTimer: ReturnType<typeof setTimeout> | null = null;

      const cancelArrowTimers = () => {
        if (alignRafId !== null) {
          cancelAnimationFrame(alignRafId);
          alignRafId = null;
        }
        if (secondAlignRafId !== null) {
          cancelAnimationFrame(secondAlignRafId);
          secondAlignRafId = null;
        }
        if (arrowQuickTimer !== null) {
          clearTimeout(arrowQuickTimer);
          arrowQuickTimer = null;
        }
        if (arrowSettleTimer !== null) {
          clearTimeout(arrowSettleTimer);
          arrowSettleTimer = null;
        }
      };

      const handleTourTransitionEnd = (e: Event) => {
        if (cancelled || activeTourRef.current !== tour || !activeStepTarget) return;
        const targetNode = e.target;
        if (
          targetNode instanceof Element &&
          targetNode.classList.contains("introjs-tooltipReferenceLayer")
        ) {
          alignIntroTooltipArrow(activeStepTarget);
        }
      };

      const disconnectTourObserver = () => {
        tourObserver?.disconnect();
        tourObserver = null;
        if (observedTourEl) {
          observedTourEl.removeEventListener("transitionend", handleTourTransitionEnd);
          observedTourEl = null;
        }
      };

      observerCleanup = () => {
        cancelArrowTimers();
        disconnectTourObserver();
        clearIntroArrowAlignment();
      };

      const ensureTourObserver = () => {
        if (
          typeof document === "undefined" ||
          typeof MutationObserver === "undefined" ||
          cancelled ||
          activeTourRef.current !== tour
        ) {
          return;
        }
        const tourRoot = document.querySelector(".introjs-tour");
        if (!tourRoot || tourRoot === observedTourEl) return;

        disconnectTourObserver();
        observedTourEl = tourRoot;
        tourRoot.addEventListener("transitionend", handleTourTransitionEnd);

        tourObserver = new MutationObserver(() => {
          if (cancelled || activeTourRef.current !== tour || !activeStepTarget) return;
          alignIntroTooltipArrow(activeStepTarget);
        });
        tourObserver.observe(tourRoot, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "class"],
        });
      };

      const scheduleArrowAlign = (targetElement: Element | null) => {
        activeStepTarget = targetElement;
        cancelArrowTimers();
        ensureTourObserver();
        alignIntroTooltipArrow(targetElement);

        alignRafId = requestAnimationFrame(() => {
          alignRafId = null;
          if (cancelled || activeTourRef.current !== tour) return;
          ensureTourObserver();
          tour.refresh(false);
          alignIntroTooltipArrow(activeStepTarget);
          secondAlignRafId = requestAnimationFrame(() => {
            secondAlignRafId = null;
            if (!cancelled && activeTourRef.current === tour) {
              ensureTourObserver();
              alignIntroTooltipArrow(activeStepTarget);
            }
          });
        });

        arrowQuickTimer = setTimeout(() => {
          arrowQuickTimer = null;
          if (!cancelled && activeTourRef.current === tour) {
            ensureTourObserver();
            alignIntroTooltipArrow(activeStepTarget);
          }
        }, 75);

        // Wait past Intro.js's 300ms `.introjs-tooltipReferenceLayer` transition
        arrowSettleTimer = setTimeout(() => {
          arrowSettleTimer = null;
          if (!cancelled && activeTourRef.current === tour) {
            ensureTourObserver();
            alignIntroTooltipArrow(activeStepTarget);
          }
        }, 340);
      };

      const handleResize = () => {
        if (cancelled || activeTourRef.current !== tour) return;
        const currentIdx = tour.getCurrentStep();
        const stepEl =
          typeof currentIdx === "number" ? tour.getSteps()[currentIdx]?.element : null;
        if (stepEl instanceof Element) {
          scheduleArrowAlign(stepEl);
        }
      };

      if (typeof window !== "undefined") {
        window.addEventListener("resize", handleResize);
        resizeCleanup = () => {
          window.removeEventListener("resize", handleResize);
        };
      }

      tour.onAfterChange((targetElement) => {
        scheduleArrowAlign(targetElement);
      });

      const finishTour = () => {
        clearPlusAdvanceTimer();
        observerCleanup?.();
        observerCleanup = null;
        resizeCleanup?.();
        resizeCleanup = null;
        if (activeTourRef.current === tour) {
          activeTourRef.current = null;
        }
        isTourActiveRef.current = false;
        if (isMountedRef.current) {
          setIsTourActive(false);
        }
        if (!programmaticExitRef.current) {
          markProductIntroSeen();
        }
      };

      tour.onComplete(() => {
        finishTour();
      });

      tour.onSkip(() => {
        finishTour();
      });

      tour.onExit(() => {
        finishTour();
      });

      activeTourRef.current = tour;
      isTourActiveRef.current = true;
      setIsTourActive(true);

      try {
        await tour.start();
        if (!cancelled && activeTourRef.current === tour) {
          ensureTourObserver();
          if (activeStepTarget) {
            alignIntroTooltipArrow(activeStepTarget);
          }
        }
      } catch {
        observerCleanup?.();
        observerCleanup = null;
        resizeCleanup?.();
        resizeCleanup = null;
        if (activeTourRef.current === tour) {
          activeTourRef.current = null;
        }
        isTourActiveRef.current = false;
        if (isMountedRef.current) {
          setIsTourActive(false);
        }
      }
    };

    const waitForSnapSettle = () => {
      const container = containerRef.current;
      const startTime = performance.now();

      const checkScroll = () => {
        if (cancelled) return;

        if (!container) {
          settleTimer = setTimeout(() => {
            void launchTour();
          }, 400);
          return;
        }

        const targetEl = container.children[activeSectionIndex] as HTMLElement | null;
        const targetTop = targetEl ? targetEl.offsetTop : activeSectionIndex * (window.innerHeight || 1);
        const currentTop = typeof window !== "undefined" && window.scrollY !== undefined ? window.scrollY : container.scrollTop;
        const distance = Math.abs(currentTop - targetTop);
        const elapsed = performance.now() - startTime;

        if (distance <= 8 || elapsed >= 850) {
          settleTimer = setTimeout(() => {
            void launchTour();
          }, 580);
          return;
        }

        rafId = requestAnimationFrame(checkScroll);
      };

      rafId = requestAnimationFrame(checkScroll);
    };

    waitForSnapSettle();

    return () => {
      cancelled = true;
      clearPlusAdvanceTimer();
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (settleTimer !== null) clearTimeout(settleTimer);
      observerCleanup?.();
      observerCleanup = null;
      resizeCleanup?.();
      resizeCleanup = null;
      if (activeTourRef.current) {
        programmaticExitRef.current = true;
        const tourToClose = activeTourRef.current;
        activeTourRef.current = null;
        isTourActiveRef.current = false;
        tourToClose
          .exit(true)
          .catch(() => {})
          .finally(() => {
            if (isMountedRef.current && !isTourActiveRef.current) {
              setIsTourActive(false);
            }
          });
      }
    };
  }, [
    lang,
    activeSectionIndex,
    productsStartIndex,
    isLoading,
    hasProducts,
    isCartOpen,
    containerRef,
    clearPlusAdvanceTimer,
  ]);

  return { isTourActive, isTourActiveRef };
}
