"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore, useCallback, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion, type MotionValue } from "motion/react";
import { Plus, Minus, Check, ChevronDown, Boxes, ShoppingBag, ArrowRight, Sparkles } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT, formatStorePrice } from "@/lib/storefront-i18n";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  addToCart,
  updateQuantity,
  removeFromCart,
  selectCartItems,
} from "@/lib/redux/slices/cart-slice";
import {
  recordProductView,
  recordVariantView,
  selectHasViewedProduct,
  selectHasViewedVariant,
} from "@/lib/redux/slices/pixel-slice";
import { trackViewContent, trackAddToCart, getClientFbpAndFbc, sendCapiClientEvent } from "@/lib/facebook-pixel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ProductVideoPlayer } from "./product-video-player";
import { parseVideoUrl } from "@/lib/video";
import { SlidingNumber } from "@/components/ui/sliding-number";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface StorefrontVariant {
  id: string;
  name: string;
  nameBn?: string;
  price: number;
  compareAtPrice?: number | null;
  netQuantity?: number;
  netUnit?: string;
  weightGrams?: number;
  weightKg?: number;
  stockStatus?: string;
  isDefault?: boolean;
  sortOrder?: number;
  isCombo?: boolean;
  comboItems?: Array<{
    component_variant_id: string;
    product_name?: string;
    product_name_bn?: string;
    variant_name?: string;
    variant_name_bn?: string;
    quantity: number;
    unit_price?: number;
    weight_grams?: number;
    weight_kg?: number;
  }>;
}

export interface StorefrontProduct {
  id: string;
  slug?: string;
  name: string;
  nameBn?: string;
  summary?: string;
  summaryBn?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  image: string;
  images?: string[];
  videoUrl?: string | null;
  category?: string;
  origin?: string;
  ratingAvg?: number;
  ratingCount?: number;
  variants: StorefrontVariant[];
}

const emptySubscribe = () => () => {};

export function parseGramsFromText(text?: string | null): number | undefined {
  if (!text || typeof text !== "string") return undefined;
  const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|k\.g|kgs|কেজি|কিলো)/i);
  if (kgMatch) return Math.round(parseFloat(kgMatch[1]) * 1000);
  const gMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gms|gram|grams|গ্রাম)(?![a-z])/i);
  if (gMatch) return Math.round(parseFloat(gMatch[1]));
  return undefined;
}

export function formatComboComponentWeight(
  ci: {
    weight_grams?: number;
    weight_kg?: number;
    variant_name?: string;
    variant_name_bn?: string;
  },
  lang: StorefrontLang
): string | null {
  const parsedGrams =
    typeof ci.weight_grams === "number" && ci.weight_grams > 0
      ? ci.weight_grams
      : typeof ci.weight_kg === "number" && ci.weight_kg > 0
      ? Math.round(ci.weight_kg * 1000)
      : parseGramsFromText(ci.variant_name) ?? parseGramsFromText(ci.variant_name_bn);

  if (parsedGrams && parsedGrams > 0) {
    if (parsedGrams >= 1000) {
      const kg = parsedGrams / 1000;
      return lang === "bn" ? `${kg.toLocaleString("bn-BD")} কেজি` : `${kg} kg`;
    }
    return lang === "bn" ? `${parsedGrams.toLocaleString("bn-BD")} গ্রাম` : `${parsedGrams}g`;
  }

  const rawVariantName = lang === "bn" ? ci.variant_name_bn || ci.variant_name : ci.variant_name;
  if (!rawVariantName) return null;
  return rawVariantName.trim() || null;
}

export interface ProductCardProps {
  product: StorefrontProduct;
  index: number;
  totalProducts: number;
  lang: StorefrontLang;
  isActive?: boolean;
  pauseViewTracking?: boolean;
  priority?: boolean;
  initialVariantId?: string;
  trackProgress?: MotionValue<number>;
  onScrollToNext?: () => void;
  onScrollToOrder?: () => void;
}

export function ProductCard({
  product,
  index,
  totalProducts,
  lang,
  isActive,
  pauseViewTracking = false,
  priority = false,
  initialVariantId,
  trackProgress,
  onScrollToNext,
  onScrollToOrder,
}: ProductCardProps) {
  const t = STOREFRONT_TEXT[lang];

  const variants = product.variants || [];
  const sortedVariants = [...variants].sort((a, b) => {
    if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    }
    return Number(a.price) - Number(b.price);
  });
  // Prefer initialVariantId from URL, fallback to default variant, then first variant
  const explicitVariant = initialVariantId
    ? variants.find((v) => v.id === initialVariantId)
    : undefined;
  const defaultVariant =
    explicitVariant ||
    variants.find((v) => v.isDefault) ||
    sortedVariants[0] || {
      id: "var-default",
      name: "1 kg",
      nameBn: "১ কেজি",
      price: 700,
      isDefault: true,
    };
  const initialVariant = defaultVariant;

  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Framer Motion scroll animation: ensure only one product card is in view and focused at a time
  const { scrollYProgress: fallbackProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"],
  });
  const effectiveProgress = trackProgress || fallbackProgress;

  const { inputRange, opacityRange, scaleRange, yRange, activeMin, activeMax } = useMemo(() => {
    if (totalProducts <= 1) {
      return {
        inputRange: [0, 1],
        opacityRange: [1, 1],
        scaleRange: [1, 1],
        yRange: [0, 0],
        activeMin: -0.01,
        activeMax: 1.01,
      };
    }

    const step = 1 / (totalProducts - 1);
    const center = index * step;
    const fadeSpan = step * 0.38;

    if (index === 0) {
      return {
        inputRange: [0, step - fadeSpan, step],
        opacityRange: [1, 1, 0],
        scaleRange: [1, 1, 0.94],
        yRange: [0, 0, -24],
        activeMin: -0.01,
        activeMax: step * 0.5,
      };
    }

    if (index === totalProducts - 1) {
      return {
        inputRange: [center - step, center - step + fadeSpan, 1],
        opacityRange: [0, 1, 1],
        scaleRange: [0.94, 1, 1],
        yRange: [24, 0, 0],
        activeMin: center - step * 0.5,
        activeMax: 1.01,
      };
    }

    return {
      inputRange: [
        center - step,
        center - step + fadeSpan,
        center + step - fadeSpan,
        center + step,
      ],
      opacityRange: [0, 1, 1, 0],
      scaleRange: [0.94, 1, 1, 0.94],
      yRange: [24, 0, 0, -24],
      activeMin: center - step * 0.5,
      activeMax: center + step * 0.5,
    };
  }, [index, totalProducts]);

  const scrollOpacity = useTransform(effectiveProgress, inputRange, opacityRange);
  const scrollScale = useTransform(effectiveProgress, inputRange, scaleRange);
  const scrollY = useTransform(effectiveProgress, inputRange, yRange);
  const pointerEvents = useTransform(effectiveProgress, (val) =>
    val >= activeMin && val <= activeMax ? "auto" : "none"
  );

  const cardOpacity = !hasMounted || prefersReducedMotion ? (isActive ? 1 : 0) : scrollOpacity;
  const cardScale = !hasMounted || prefersReducedMotion ? 1 : scrollScale;
  const cardY = !hasMounted || prefersReducedMotion ? 0 : scrollY;
  const cardPointerEvents = hasMounted && !prefersReducedMotion ? pointerEvents : (isActive ? "auto" : "none");
  const [selectedVariant, setSelectedVariant] = useState<StorefrontVariant>(initialVariant);
  const prevProductIdRef = useRef(product.id);
  const prevDefaultVariantIdRef = useRef(defaultVariant.id);
  const userInteractedRef = useRef(false);

  const hasFiredVariantView = useAppSelector(
    selectedVariant.id ? selectHasViewedVariant(selectedVariant.id) : () => false
  );

  // Synchronize selected variant when product or default variant changes (unless user explicitly selected another)
  useEffect(() => {
    const productChanged = prevProductIdRef.current !== product.id;
    const defaultChanged = prevDefaultVariantIdRef.current !== defaultVariant.id;
    const currentVariantExists = variants.some((v) => v.id === selectedVariant.id);

    if (productChanged || !currentVariantExists || (defaultChanged && !userInteractedRef.current)) {
      setSelectedVariant(defaultVariant);
      prevProductIdRef.current = product.id;
      prevDefaultVariantIdRef.current = defaultVariant.id;
      if (productChanged) {
        userInteractedRef.current = false;
      }
    }
  }, [product.id, variants, defaultVariant, selectedVariant.id]);

  // Reset card scroll position to top when this card is no longer active
  useEffect(() => {
    if (!isActive && cardRef.current) {
      cardRef.current.scrollTop = 0;
    }
  }, [isActive]);

  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Facebook Pixel ViewContent: fire when user genuinely dwells on a visible product card
  // for > 5 seconds (paused while an onboarding tour is active or the tab is hidden).
  // Deduplicated per variant in Redux so it does not fire repeatedly in the same session.
  useEffect(() => {
    if (hasFiredVariantView || pauseViewTracking) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let isIntersectingEnough = false;

    const clearDwellTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const fireViewContent = () => {
      dispatch(recordProductView(product.id));
      dispatch(recordVariantView(selectedVariant.id));
      const eventId = trackViewContent({
        productId: product.id,
        variantId: selectedVariant.id,
        productName: product.name,
        price: Number(selectedVariant.price) || 0,
        currency: "BDT",
      });
      const { fbp, fbc } = getClientFbpAndFbc();
      sendCapiClientEvent("ViewContent", {
        eventId,
        productId: product.id,
        variantId: selectedVariant.id,
        productName: product.name,
        price: Number(selectedVariant.price) || 0,
        currency: "BDT",
        url: typeof window !== "undefined" ? window.location.href : undefined,
        fbp,
        fbc,
      });
    };

    const startDwellTimerIfVisible = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        clearDwellTimer();
        return;
      }
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        if (
          typeof document !== "undefined" &&
          document.visibilityState !== "visible"
        ) {
          return;
        }
        fireViewContent();
      }, 5000);
    };

    // Fast path: if active state is explicitly supplied by ProductShowcase scroll tracker
    if (typeof isActive === "boolean") {
      if (!isActive) return;

      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          startDwellTimerIfVisible();
        } else {
          clearDwellTimer();
        }
      };

      startDwellTimerIfVisible();
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        clearDwellTimer();
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }

    // Fallback path: IntersectionObserver with broad threshold
    const el = cardRef.current;
    if (!el) return;

    const handleVisibilityChange = () => {
      if (isIntersectingEnough && document.visibilityState === "visible") {
        startDwellTimerIfVisible();
      } else {
        clearDwellTimer();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isIntersectingEnough =
          entry.isIntersecting && entry.intersectionRatio >= 0.25;
        if (isIntersectingEnough) {
          startDwellTimerIfVisible();
        } else {
          clearDwellTimer();
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    observer.observe(el);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearDwellTimer();
    };
  }, [
    isActive,
    hasFiredVariantView,
    pauseViewTracking,
    product.id,
    product.name,
    selectedVariant.id,
    selectedVariant.price,
    dispatch,
  ]);

  // Check how many units of this variant are in the Redux cart (defaults to 0)
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const matchedCartItem = cartItems.find(
    (item) => item.productId === product.id && item.variantId === selectedVariant.id
  );
  const currentUnit = matchedCartItem?.quantity || 0;
  // Guard with isMounted to prevent SSR / Client hydration mismatch when localStorage already has items
  const displayUnit = isMounted ? currentUnit : 0;

  const imagesList = product.images && product.images.length > 0 ? product.images : [product.image];
  const hasVideo = Boolean(product.videoUrl && parseVideoUrl(product.videoUrl));
  const hasMultipleMedia = imagesList.length > 1 || hasVideo;
  const videoSlideIndex = hasVideo ? imagesList.length : -1;
  const totalSlides = imagesList.length + (hasVideo ? 1 : 0);

  // Autoplay plugin instance with 2 second interval and pause on touch/hover
  const [autoplayPlugin] = useState(() =>
    Autoplay({ delay: 2000, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  const pauseCarouselAutoplay = useCallback(() => {
    try {
      const autoplay = carouselApi?.plugins()?.autoplay as
        | { stop: () => void }
        | undefined;
      autoplay?.stop();
    } catch {}
  }, [carouselApi]);

  const resumeCarouselAutoplay = useCallback(() => {
    if (!isActive) return;
    try {
      const autoplay = carouselApi?.plugins()?.autoplay as
        | { play: () => void }
        | undefined;
      autoplay?.play();
    } catch {}
  }, [carouselApi, isActive]);

  const handleVideoEnded = useCallback(() => {
    if (!carouselApi) return;
    try {
      setTimeout(() => {
        carouselApi.scrollNext();
        const autoplay = carouselApi.plugins()?.autoplay as
          | { play: () => void }
          | undefined;
        autoplay?.play();
      }, 300);
    } catch {}
  }, [carouselApi]);

  // Pause autoplay when product card is not active in the viewport to save CPU and main thread cycles
  useEffect(() => {
    if (!carouselApi || !hasMultipleMedia) return;
    const autoplay = carouselApi.plugins()?.autoplay as
      | { play: () => void; stop: () => void }
      | undefined;
    if (!autoplay || typeof autoplay.play !== "function") return;

    try {
      if (typeof isActive === "boolean") {
        if (isActive) {
          if (currentSlide === videoSlideIndex && hasVideo) {
            autoplay.stop();
          } else {
            autoplay.play();
          }
        } else {
          autoplay.stop();
        }
      }
    } catch {
      // Safe guard against race conditions during unmount or engine re-init
    }
  }, [isActive, carouselApi, hasMultipleMedia, currentSlide, videoSlideIndex, hasVideo]);

  // Track active slide in carousel
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  const unitPrice = Number(selectedVariant.price) || 0;

  const handleSelectVariant = (found: StorefrontVariant) => {
    setSelectedVariant(found);

    // Shallowly update URL to include ?variant= without page reload
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("variant", found.id);
      window.history.replaceState(window.history.state, "", url.toString());
    }

    // Fire ViewContent for newly selected variant if not already viewed in this session
    dispatch(recordProductView(product.id));
    dispatch(recordVariantView(found.id));

    const eventId = trackViewContent({
      productId: product.id,
      variantId: found.id,
      productName: product.name,
      price: Number(found.price) || 0,
      currency: "BDT",
    });

    const { fbp, fbc } = getClientFbpAndFbc();
    sendCapiClientEvent("ViewContent", {
      eventId,
      productId: product.id,
      variantId: found.id,
      productName: product.name,
      price: Number(found.price) || 0,
      currency: "BDT",
      url: typeof window !== "undefined" ? window.location.href : undefined,
      fbp,
      fbc,
    });
  };

  // Update or set unit quantity directly in Redux cart (0 removes, >0 updates/adds)
  const handleSetUnit = (newUnit: number) => {
    const currentActiveImage = imagesList[currentSlide] || product.image;
    if (newUnit <= 0) {
      dispatch(removeFromCart({ productId: product.id, variantId: selectedVariant.id }));
    } else {
      // Whenever quantity increases (adding to cart or increasing pack count), fire AddToCart
      if (newUnit > currentUnit) {
        const eventId = trackAddToCart({
          productId: product.id,
          productName: product.name,
          variantId: selectedVariant.id,
          variantName: selectedVariant.name,
          price: unitPrice,
          quantity: newUnit,
          currency: "BDT",
        });
        const { fbp, fbc } = getClientFbpAndFbc();
        sendCapiClientEvent("AddToCart", {
          eventId,
          productId: product.id,
          variantId: selectedVariant.id,
          productName: product.name,
          price: unitPrice,
          quantity: newUnit,
          currency: "BDT",
          url: typeof window !== "undefined" ? window.location.href : undefined,
          fbp,
          fbc,
        });
      }

      if (currentUnit === 0) {
        const variantWeightKg = effectiveVariantWeightKg;
        dispatch(
          addToCart({
            productId: product.id,
            productName: product.name,
            productNameBn: product.nameBn || product.name,
            variantId: selectedVariant.id,
            variantName: selectedVariant.name,
            variantNameBn: selectedVariant.nameBn || selectedVariant.name,
            unitPrice,
            quantity: newUnit,
            image: currentActiveImage,
            description: product.summary,
            descriptionBn: product.summaryBn,
            isCombo: Boolean(selectedVariant.isCombo),
            comboItems: selectedVariant.comboItems || [],
            weightGrams: effectiveVariantWeightGrams || Math.round(variantWeightKg * 1000),
            weightKg: variantWeightKg,
          })
        );
      } else {
        dispatch(
          updateQuantity({
            productId: product.id,
            variantId: selectedVariant.id,
            quantity: newUnit,
          })
        );
      }
    }
  };

  // Dedicated Buy Now handler for combos: adds 1 combo to cart and scrolls to order form
  const handleBuyNow = () => {
    if (currentUnit === 0) {
      handleSetUnit(1);
    }
    const checkoutEl = document.getElementById("checkout");
    if (checkoutEl) {
      checkoutEl.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.href = "/#checkout";
    }
  };

  // Fly-to-bag animation states and refs
  const [flyingItems, setFlyingItems] = useState<{ id: number; dx: number }[]>([]);
  const [isBagAnimating, setIsBagAnimating] = useState(false);
  const bagRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const flyingIdRef = useRef(0);

  const triggerFlyAnimation = () => {
    let dx = -150;
    if (bagRef.current && plusRef.current) {
      const bagRect = bagRef.current.getBoundingClientRect();
      const plusRect = plusRef.current.getBoundingClientRect();
      dx = (bagRect.left + bagRect.width / 2) - (plusRect.left + plusRect.width / 2);
    }
    const newId = ++flyingIdRef.current;
    setFlyingItems((prev) => [...prev, { id: newId, dx }]);

    setTimeout(() => {
      setIsBagAnimating(true);
    }, 720);

    setTimeout(() => {
      setIsBagAnimating(false);
    }, 1450);

    setTimeout(() => {
      setFlyingItems((prev) => prev.filter((item) => item.id !== newId));
    }, 1000);
  };

  const handleAddQuantityWithAnimation = () => {
    triggerFlyAnimation();
    handleSetUnit(currentUnit + 1);
  };

  const handlePresetClick = (preset: number) => {
    if (preset > currentUnit) {
      triggerFlyAnimation();
    }
    handleSetUnit(preset);
  };

  const displayName = lang === "bn" ? product.nameBn || product.name : product.name;
  const displaySummary =
    lang === "bn"
      ? product.summaryBn || product.summary || "গাছিদের সংগ্রহ করা খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়।"
      : product.summary || "Traditional pure artisanal jaggery crafted by village artisans.";

  const effectiveVariantWeightGrams = (() => {
    if (selectedVariant.isCombo && selectedVariant.comboItems && selectedVariant.comboItems.length > 0) {
      let sum = 0;
      for (const ci of selectedVariant.comboItems) {
        const g =
          typeof ci.weight_grams === "number" && ci.weight_grams > 0
            ? ci.weight_grams
            : typeof ci.weight_kg === "number" && ci.weight_kg > 0
            ? Math.round(ci.weight_kg * 1000)
            : parseGramsFromText(ci.variant_name) ?? parseGramsFromText(ci.variant_name_bn);
        if (g) sum += g * (Number(ci.quantity) || 1);
      }
      if (sum > 0) return sum;
    }
    return selectedVariant.weightGrams;
  })();

  const effectiveVariantWeightKg = (() => {
    if (effectiveVariantWeightGrams && effectiveVariantWeightGrams > 0) {
      return effectiveVariantWeightGrams / 1000;
    }
    return selectedVariant.weightKg || (selectedVariant.netQuantity ? Number(selectedVariant.netQuantity) : 1);
  })();

  const variantWeightText = (() => {
    if (selectedVariant.isCombo) {
      return lang === "bn" ? "কম্বো" : "combo";
    }
    if (effectiveVariantWeightGrams && effectiveVariantWeightGrams > 0) {
      if (effectiveVariantWeightGrams >= 1000) {
        const kg = effectiveVariantWeightGrams / 1000;
        return lang === "bn" ? `${kg.toLocaleString("bn-BD")} কেজি` : `${kg} kg`;
      }
      return lang === "bn" ? `${effectiveVariantWeightGrams.toLocaleString("bn-BD")} গ্রাম` : `${effectiveVariantWeightGrams}g`;
    }
    if (effectiveVariantWeightKg && effectiveVariantWeightKg > 0) {
      return lang === "bn" ? `${effectiveVariantWeightKg.toLocaleString("bn-BD")} কেজি` : `${effectiveVariantWeightKg} kg`;
    }
    return lang === "bn" ? selectedVariant.nameBn || selectedVariant.name : selectedVariant.name;
  })();

  return (
    <div
      ref={cardRef}
      id={index === 0 ? "products" : `product-${product.id}`}
      data-product-card="true"
      data-section-index={index + 1}
      className="absolute inset-0 w-full h-full flex items-center justify-center p-2 sm:p-4 md:p-6 lg:p-8 pointer-events-none select-none"
    >
      <motion.div
        style={{
          opacity: cardOpacity,
          scale: cardScale,
          y: cardY,
          pointerEvents: cardPointerEvents,
        }}
        className="relative w-full max-w-5xl lg:max-w-6xl mx-auto rounded-3xl bg-white/92 dark:bg-stone-900/92 backdrop-blur-md border border-amber-200/70 dark:border-stone-800 shadow-xl overflow-hidden flex flex-col justify-center max-h-[92dvh]"
      >
        {/* Subtle amber gradient line on top edge */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-600/50 to-transparent" />

        {/* Top Header Bar inside the card: Counter on left, Authenticity badge on right */}
        <div className="px-4 sm:px-6 pt-3 sm:pt-4 pb-1 flex items-center justify-between shrink-0 select-none">
          <div className="inline-flex items-center gap-1.5 bg-stone-100/90 dark:bg-stone-800/90 border border-stone-200/80 dark:border-stone-750 px-2.5 py-1 rounded-full text-xs font-semibold text-stone-700 dark:text-stone-300 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
            <span>
              {t.productCounter}{" "}
              <span className="font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                {index + 1}
              </span>{" "}
              / {totalProducts}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-emerald-50/90 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-800 dark:text-emerald-300 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{lang === "bn" ? "১০০% খাঁটি ও প্রাকৃতিক" : "100% Pure & Artisanal"}</span>
          </div>
        </div>

        {/* Main Two-Column Grid: Left Media Carousel, Right Details & Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-3.5 sm:gap-6 md:gap-8 lg:gap-10 px-4 sm:px-6 pb-3 sm:pb-4 pt-1 overflow-y-auto max-h-[calc(92dvh-54px)]">
          {/* ================= LEFT COLUMN: Image Showcase / Carousel ================= */}
          <div className="w-full flex flex-col items-center justify-center">
            <div className="relative w-full max-w-[240px] sm:max-w-[340px] md:max-w-none aspect-square max-h-[240px] sm:max-h-[360px] md:max-h-[420px] lg:max-h-[460px] mx-auto rounded-2xl overflow-hidden border border-stone-200/80 dark:border-stone-800 bg-stone-100 dark:bg-stone-800/80 shadow-md">
              {hasMultipleMedia ? (
                <div className="absolute inset-0 w-full h-full">
                  <Carousel
                    setApi={setCarouselApi}
                    plugins={[autoplayPlugin]}
                    opts={{ loop: true }}
                    className="w-full h-full"
                  >
                    <CarouselContent className="-ml-0 h-full w-full">
                      {imagesList.map((imgSrc, imgIdx) => (
                        <CarouselItem key={`img-${imgIdx}`} className="pl-0 h-full w-full">
                          <div className="relative w-full h-full">
                            <Image
                              src={imgSrc}
                              alt={`${displayName} - ${imgIdx + 1}`}
                              fill
                              priority={priority && imgIdx === 0}
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 512px"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                      {hasVideo && product.videoUrl && (
                        <CarouselItem key="video" className="pl-0 h-full w-full">
                          <ProductVideoPlayer
                            videoUrl={product.videoUrl}
                            productName={displayName}
                            isActive={currentSlide === videoSlideIndex}
                            isSectionActive={isActive}
                            onPauseCarousel={pauseCarouselAutoplay}
                            onResumeCarousel={resumeCarouselAutoplay}
                            onVideoEnded={handleVideoEnded}
                          />
                        </CarouselItem>
                      )}
                    </CarouselContent>
                    <CarouselPrevious className="-left-3 sm:-left-4 h-8 w-8 sm:h-9 sm:w-9 bg-white/95 dark:bg-stone-850/95 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 shadow-sm touch-manipulation hover:bg-stone-100" />
                    <CarouselNext className="-right-3 sm:-right-4 h-8 w-8 sm:h-9 sm:w-9 bg-white/95 dark:bg-stone-850/95 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 shadow-sm touch-manipulation hover:bg-stone-100" />
                  </Carousel>

                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 bg-stone-900/60 dark:bg-black/60 px-2.5 py-1 rounded-full">
                    {Array.from({ length: totalSlides }).map((_, dotIdx) => (
                      <button
                        key={dotIdx}
                        type="button"
                        onClick={() => carouselApi?.scrollTo(dotIdx)}
                        className={`h-1.5 rounded-full transition-all touch-manipulation ${
                          currentSlide === dotIdx
                            ? "w-4 bg-amber-400"
                            : "w-1.5 bg-white/60 hover:bg-white/90"
                        }`}
                        aria-label={`Go to slide ${dotIdx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full">
                  <Image
                    src={product.image}
                    alt={displayName}
                    fill
                    priority={priority}
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 512px"
                  />
                </div>
              )}

              {/* Floating Selected Quantity Badge on Image */}
              {displayUnit > 0 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0, y: -6 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 22 }}
                  className="absolute top-2.5 right-2.5 z-30 bg-emerald-700/95 dark:bg-emerald-800/95 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg shadow-xs border border-emerald-500/40 flex items-center gap-1.5 select-none pointer-events-none"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5] text-emerald-200" />
                  <div className="flex items-center gap-1 font-bold text-sm">
                    <SlidingNumber
                      value={displayUnit}
                      isBengali={false}
                      className="font-mono font-bold"
                    />
                    <span className="text-xs font-medium text-emerald-100">
                      {lang === "bn" ? "টি কার্টে" : "in cart"}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: Info & Controls ================= */}
          <div className="w-full max-w-lg md:max-w-none lg:max-w-xl mx-auto flex flex-col justify-center space-y-3 sm:space-y-3.5">
            {/* Product Title & Short Bio */}
            <div className="text-center md:text-left px-1">
              <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-tight">
                {displayName}
              </h2>
              {!selectedVariant.isCombo && displaySummary && (
                <p className="text-xs sm:text-sm md:text-base text-stone-600 dark:text-stone-300 mt-1 sm:mt-1.5 leading-relaxed font-normal">
                  {displaySummary}
                </p>
              )}
            </div>

            {/* Control Deck: Visual Variant Chips, Price & Quantity Stepper */}
            <div
              data-tour-zone={index === 0 ? "product-controls" : undefined}
              className="w-full bg-stone-50/90 dark:bg-stone-850/90 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-3 sm:p-4 shadow-2xs space-y-2.5"
            >
              {/* Visual Pill Chips for Variant Selection */}
              {sortedVariants.length > 1 && (
                <div className="space-y-1.5 px-0.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-bold text-stone-700 dark:text-stone-300">
                      {t.packSizeLabel}
                    </span>
                    <span className="text-[11px] sm:text-xs text-amber-800/90 dark:text-amber-400/90 font-medium">
                      {lang === "bn" ? "পছন্দের সাইজ চাপুন" : "Tap to choose"}
                    </span>
                  </div>
                  <div
                    data-tour={index === 0 ? "product-variant-select" : undefined}
                    className="flex flex-wrap gap-1.5 sm:gap-2"
                  >
                    {sortedVariants.map((v) => {
                      const isSelected = selectedVariant.id === v.id;
                      const title = lang === "bn" ? v.nameBn || v.name : v.name;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectVariant(v)}
                          className={`group relative flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all touch-manipulation cursor-pointer border ${
                            isSelected
                              ? "bg-amber-800 dark:bg-amber-700 text-white border-amber-900 dark:border-amber-600 shadow-xs ring-2 ring-amber-600/30"
                              : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-750"
                          }`}
                        >
                          <span>{title}</span>
                          <span
                            className={`font-mono text-xs sm:text-sm tabular-nums ${
                              isSelected
                                ? "text-amber-100"
                                : "text-amber-900 dark:text-amber-300 font-bold"
                            }`}
                          >
                            {formatStorePrice(v.price, lang)}
                          </span>
                          {v.compareAtPrice && v.compareAtPrice > v.price && (
                            <span className={`line-through text-[10px] sm:text-xs font-normal ${isSelected ? "text-amber-200/80" : "text-stone-400 dark:text-stone-500"}`}>
                              {formatStorePrice(v.compareAtPrice, lang)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Combo Contents Breakdown Box */}
              {selectedVariant.isCombo && selectedVariant.comboItems && selectedVariant.comboItems.length > 0 && (
                <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50/90 dark:bg-stone-800/80 border border-amber-200/90 dark:border-stone-700/80 space-y-1.5 text-left">
                  <span className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    {lang === "bn" ? "প্যাকেজে যা যা থাকছে:" : "What's in this combo:"}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs sm:text-sm text-stone-700 dark:text-stone-300">
                    {selectedVariant.comboItems.map((ci, idx) => {
                      const prodName = lang === "bn" ? ci.product_name_bn || ci.product_name : ci.product_name;
                      const weightText = formatComboComponentWeight(ci, lang);
                      const shouldShowWeight = Boolean(
                        weightText &&
                        prodName &&
                        !prodName.toLowerCase().includes(weightText.toLowerCase())
                      );
                      const fullTitle = shouldShowWeight ? `${prodName} (${weightText})` : prodName;

                      return (
                        <div
                          key={idx}
                          title={fullTitle}
                          className="flex items-center justify-between gap-1.5 bg-white/80 dark:bg-stone-900/60 px-2 py-1 rounded-md border border-amber-100 dark:border-stone-700 min-w-0"
                        >
                          <div className="flex items-center gap-1.5 truncate min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span className="font-semibold text-foreground truncate">
                              {prodName}
                              {shouldShowWeight && (
                                <span className="font-medium text-stone-600 dark:text-stone-400 ml-1">
                                  ({weightText})
                                </span>
                              )}
                            </span>
                          </div>
                          <span className="text-amber-800 dark:text-amber-300 font-bold text-sm shrink-0 ml-1">
                            ×{ci.quantity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price section: unit price and dynamic total price */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 px-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-amber-800/80 dark:text-amber-400 font-bold">
                  <span className="text-stone-600 dark:text-stone-400 font-semibold">
                    {displayUnit > 0
                      ? lang === "bn"
                        ? "একক দর:"
                        : "Unit Price:"
                      : lang === "bn"
                        ? "মূল্য:"
                        : "Price:"}
                  </span>
                  <span
                    className={`font-mono tabular-nums ${
                      displayUnit > 0
                        ? "text-sm sm:text-base font-bold text-amber-950 dark:text-amber-200"
                        : "text-base sm:text-xl font-bold text-amber-950 dark:text-amber-100"
                    }`}
                  >
                    {formatStorePrice(unitPrice, lang)}
                  </span>
                  {variantWeightText && (
                    <span className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-semibold">
                      / {variantWeightText}
                    </span>
                  )}
                  {selectedVariant.compareAtPrice && selectedVariant.compareAtPrice > unitPrice && (
                    <span className="line-through text-stone-400 dark:text-stone-500 text-xs sm:text-sm font-semibold ml-1">
                      {formatStorePrice(selectedVariant.compareAtPrice, lang)}
                    </span>
                  )}
                </div>

                {/* Total Price: Animated when quantity > 0 */}
                <AnimatePresence>
                  {displayUnit > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -4 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -4 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="flex items-baseline gap-1.5 overflow-hidden"
                    >
                      <span className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300">
                        {lang === "bn" ? "মোট:" : "Total:"}
                      </span>
                      <span className="font-mono text-base sm:text-xl font-bold text-amber-950 dark:text-amber-100 tabular-nums">
                        {formatStorePrice(unitPrice * displayUnit, lang)}
                      </span>
                      <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
                        ({lang === "bn" ? `মোট ${((effectiveVariantWeightKg || 1) * displayUnit).toLocaleString("bn-BD")} কেজি` : `Total ${(effectiveVariantWeightKg || 1) * displayUnit} kg`})
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {selectedVariant.isCombo ? (
                /* Dedicated Buy Now Button for Combo Packages */
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    data-tour={index === 0 ? "product-combo-buy" : undefined}
                    onClick={handleBuyNow}
                    className="w-full h-11 sm:h-12 rounded-xl bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-semibold text-sm sm:text-base shadow-sm flex items-center justify-center gap-2.5 transition-colors touch-manipulation cursor-pointer group"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    <span>{lang === "bn" ? "এখনই অর্ডার করুন" : "Order Combo Now"}</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Quantity Stepper with Minus, Counter, Plus */}
                  <div className="relative">
                    <div className="w-full rounded-xl p-1.5 border border-stone-200 dark:border-stone-700 bg-stone-100/90 dark:bg-stone-800/70 flex items-center justify-between gap-2 shadow-2xs">
                      {/* Left: Minus Button */}
                      {displayUnit === 0 ? (
                        <button
                          type="button"
                          disabled
                          aria-disabled="true"
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-stone-200/50 dark:bg-stone-800 text-stone-400 dark:text-stone-600 flex items-center justify-center font-bold text-lg shrink-0 cursor-not-allowed select-none"
                          aria-label={lang === "bn" ? "পরিমাণ কমান" : "Decrease quantity"}
                        >
                          <Minus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetUnit(currentUnit - 1)}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-white dark:bg-stone-700 hover:bg-stone-50 active:bg-stone-100 flex items-center justify-center text-stone-800 dark:text-stone-100 font-bold text-lg transition-colors touch-manipulation cursor-pointer shrink-0 border border-stone-200/80 dark:border-stone-600 shadow-2xs"
                          aria-label={lang === "bn" ? "পরিমাণ কমান" : "Decrease quantity"}
                        >
                          <Minus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      )}

                      {/* Middle: Large Quantity Display */}
                      <div className="flex-1 flex flex-col items-center justify-center text-center px-1 min-w-0">
                        <div ref={bagRef} className="relative flex items-center justify-center">
                          <div
                            className={`px-4 sm:px-5 py-0.5 rounded-lg border transition-colors flex items-center justify-center min-w-[54px] sm:min-w-[64px] ${
                              displayUnit > 0
                                ? "bg-amber-800 text-white border-amber-900"
                                : "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 border-stone-200 dark:border-stone-600"
                            }`}
                          >
                            <SlidingNumber
                              value={displayUnit}
                              isBengali={false}
                              className="text-xl sm:text-2xl font-bold font-mono tracking-tight flex items-center justify-center tabular-nums"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right: Plus Button */}
                      <button
                        ref={plusRef}
                        data-tour={index === 0 ? "product-plus-btn" : undefined}
                        type="button"
                        onClick={handleAddQuantityWithAnimation}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white flex items-center justify-center font-bold text-lg shadow-sm transition-colors touch-manipulation cursor-pointer shrink-0"
                        aria-label={lang === "bn" ? "পরিমাণ বাড়ান" : "Increase quantity"}
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Preset Quantity Selector Pills: 1, 2, 3, 5, 10 */}
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-stone-500 dark:text-stone-400 mr-0.5">
                        {lang === "bn" ? "দ্রুত পছন্দ:" : "Quick:"}
                      </span>
                      {[1, 2, 3, 5, 10].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          suppressHydrationWarning
                          onClick={() => handlePresetClick(preset)}
                          aria-label={lang === "bn" ? `${preset}টি নির্বাচন করুন` : `Select ${preset}`}
                          aria-pressed={displayUnit === preset}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors touch-manipulation cursor-pointer ${
                            displayUnit === preset
                              ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-100 shadow-2xs"
                              : "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-750"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {/* Direct Buy Now / Order Button if unit > 0 */}
                    {displayUnit > 0 && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        type="button"
                        onClick={onScrollToOrder || handleBuyNow}
                        className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xs transition-colors touch-manipulation cursor-pointer shrink-0"
                      >
                        <span>{lang === "bn" ? "অর্ডার করুন" : "Order"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </motion.button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Scroll Cue */}
            <div className="text-center md:text-left pt-1">
              {index < totalProducts - 1 ? (
                <button
                  type="button"
                  onClick={onScrollToNext}
                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-400 hover:text-amber-900 transition-colors touch-manipulation cursor-pointer group"
                >
                  <span>{t.scrollHint}</span>
                  <motion.span
                    animate={{ y: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                    className="inline-flex items-center justify-center"
                  >
                    <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                  </motion.span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onScrollToOrder}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-400 hover:text-amber-900 transition-colors touch-manipulation cursor-pointer group"
                >
                  <span>{lang === "bn" ? "অর্ডার সম্পন্ন করতে নিচে যান" : "Proceed down to order"}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
