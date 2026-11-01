"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Minus, Sparkles, Check, ChevronDown, Award, Leaf } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT, formatStorePrice, toBnNumber } from "@/lib/storefront-i18n";
import { SelectedProductData } from "./quick-order-sheet";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  addToCart,
  updateQuantity,
  removeFromCart,
  selectCartItems,
} from "@/lib/redux/slices/cart-slice";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { SlidingNumber } from "@/components/ui/sliding-number";

export interface StorefrontVariant {
  id: string;
  name: string;
  nameBn?: string;
  price: number;
  netQuantity?: number;
  netUnit?: string;
  stockStatus?: string;
}

export interface StorefrontProduct {
  id: string;
  name: string;
  nameBn?: string;
  summary?: string;
  summaryBn?: string;
  image: string;
  images?: string[];
  category?: string;
  origin?: string;
  ratingAvg?: number;
  ratingCount?: number;
  variants: StorefrontVariant[];
}

interface ProductCardProps {
  product: StorefrontProduct;
  index: number;
  totalProducts: number;
  lang: StorefrontLang;
  onOrderClick: (selectedData: SelectedProductData, quantity: number) => void;
}

export function ProductCard({
  product,
  index,
  totalProducts,
  lang,
  onOrderClick,
}: ProductCardProps) {
  const t = STOREFRONT_TEXT[lang];

  // Sort variants by price ascending (low to high)
  const sortedVariants = [...product.variants].sort((a, b) => Number(a.price) - Number(b.price));
  const initialVariant = sortedVariants[0] || {
    id: "var-default",
    name: "1 Pack",
    nameBn: "১ প্যাক",
    price: 700,
  };

  const dispatch = useAppDispatch();
  const cartItems = useAppSelector(selectCartItems);
  const [selectedVariant, setSelectedVariant] = useState<StorefrontVariant>(initialVariant);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check how many units of this variant are in the Redux cart (defaults to 0)
  const matchedCartItem = cartItems.find(
    (item) => item.productId === product.id && item.variantId === selectedVariant.id
  );
  const currentUnit = matchedCartItem?.quantity || 0;
  // Guard with mounted to prevent SSR / Client hydration mismatch when localStorage already has items
  const displayUnit = mounted ? currentUnit : 0;

  const imagesList = product.images && product.images.length > 0 ? product.images : [product.image];
  const hasMultipleImages = imagesList.length > 1;

  // Autoplay plugin instance with 2 second interval and pause on touch/hover
  const autoplayPlugin = useRef(
    Autoplay({ delay: 2000, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  // Track active slide in carousel
  useEffect(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap());
    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  const unitPrice = Number(selectedVariant.price) || 0;

  // Update or set unit quantity directly in Redux cart (0 removes, >0 updates/adds)
  const handleSetUnit = (newUnit: number) => {
    const currentActiveImage = imagesList[currentSlide] || product.image;
    if (newUnit <= 0) {
      dispatch(removeFromCart({ productId: product.id, variantId: selectedVariant.id }));
    } else if (currentUnit === 0) {
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
        })
      );
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    } else {
      dispatch(
        updateQuantity({
          productId: product.id,
          variantId: selectedVariant.id,
          quantity: newUnit,
        })
      );
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1500);
    }
  };

  // Fly-to-bag animation states and refs
  const [flyingItems, setFlyingItems] = useState<{ id: number; dx: number }[]>([]);
  const [isBagAnimating, setIsBagAnimating] = useState(false);
  const bagRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);

  const triggerFlyAnimation = () => {
    let dx = -150;
    if (bagRef.current && plusRef.current) {
      const bagRect = bagRef.current.getBoundingClientRect();
      const plusRect = plusRef.current.getBoundingClientRect();
      dx = (bagRect.left + bagRect.width / 2) - (plusRect.left + plusRect.width / 2);
    }
    const newId = Date.now() + Math.random();
    setFlyingItems((prev) => [...prev, { id: newId, dx }]);

    setTimeout(() => {
      setIsBagAnimating(true);
    }, 320);

    setTimeout(() => {
      setIsBagAnimating(false);
    }, 850);

    setTimeout(() => {
      setFlyingItems((prev) => prev.filter((item) => item.id !== newId));
    }, 650);
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

  return (
    <section
      id={index === 0 ? "products" : `product-${product.id}`}
      data-product-card="true"
      data-section-index={index + 1}
      className="h-[100dvh] max-h-[100dvh] min-h-[580px] w-full snap-start snap-always shrink-0 flex flex-col justify-between pt-3.5 sm:pt-18 pb-16 sm:pb-4 px-2.5 xs:px-3 sm:px-6 md:px-12 relative overflow-y-auto sm:overflow-hidden bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 select-none"
    >
      {/* Subtle Rustic Texture Backdrop Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply dark:opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Meta Header: Product Counter + Quality Badge */}
      <div className="relative z-10 w-full max-w-xl mx-auto flex items-center justify-between text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-300">
        <div className="inline-flex items-center gap-1.5 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-700/60 px-3 py-1 rounded-full shadow-sm text-xs sm:text-sm">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            {t.productCounter}{" "}
            <span className="font-bold">
              {lang === "bn" ? toBnNumber(index + 1) : index + 1}
            </span>{" "}
            / {lang === "bn" ? toBnNumber(totalProducts) : totalProducts}
          </span>
        </div>

        <div className="inline-flex items-center gap-1 bg-emerald-100/90 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300/70 px-2.5 sm:px-3 py-1 rounded-full shadow-sm text-xs sm:text-sm">
          <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{t.authenticityBadge}</span>
        </div>
      </div>

      {/* Center Showcase: Enlarged Hero Display with Shadcn Carousel */}
      <div className="relative z-10 w-full max-w-lg mx-auto flex-1 flex flex-col items-center justify-center my-0.5 sm:my-1">
        {/* Full-width Responsive Showcase Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[440px] sm:max-w-md md:max-w-lg aspect-[4/3] mx-auto"
        >
          {/* Subtle Warm Glow Behind Jar */}
          <div className="absolute inset-0 bg-amber-400/20 dark:bg-amber-600/15 rounded-full blur-3xl transform scale-90 pointer-events-none" />

          {/* Multiple Images with Shadcn Carousel */}
          {hasMultipleImages ? (
            <div className="absolute inset-0 w-full h-full">
              <Carousel
                setApi={setCarouselApi}
                plugins={[autoplayPlugin.current]}
                opts={{ loop: true }}
                className="w-full h-full"
              >
                <CarouselContent className="-ml-0 h-full w-full">
                  {imagesList.map((imgSrc, imgIdx) => (
                    <CarouselItem key={imgIdx} className="pl-0 h-full w-full">
                      <div className="relative w-full h-full rounded-2xl sm:rounded-3xl overflow-hidden drop-shadow-[0_15px_22px_rgba(120,53,15,0.22)] bg-amber-100/50">
                        <Image
                          src={imgSrc}
                          alt={`${displayName} - ${imgIdx + 1}`}
                          fill
                          priority={index === 0 && imgIdx === 0}
                          className="object-cover transition-transform duration-700 hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 512px"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {/* Touch-Friendly Nav Arrows */}
                <CarouselPrevious className="left-2 sm:-left-4 h-9 w-9 sm:h-10 sm:w-10 bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm border-2 border-amber-300 dark:border-stone-700 text-amber-950 dark:text-amber-100 shadow-md touch-manipulation hover:bg-amber-100" />
                <CarouselNext className="right-2 sm:-right-4 h-9 w-9 sm:h-10 sm:w-10 bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm border-2 border-amber-300 dark:border-stone-700 text-amber-950 dark:text-amber-100 shadow-md touch-manipulation hover:bg-amber-100" />
              </Carousel>

              {/* Dot Indicators */}
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 bg-black/35 dark:bg-black/55 backdrop-blur-md px-2.5 py-1 rounded-full">
                {imagesList.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    onClick={() => carouselApi?.scrollTo(dotIdx)}
                    className={`h-2 rounded-full transition-all touch-manipulation ${currentSlide === dotIdx
                      ? "w-6 bg-amber-400"
                      : "w-2 bg-white/60 hover:bg-white/90"
                      }`}
                    aria-label={`Go to slide ${dotIdx + 1}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Single Image Showcase */
            <div className="absolute inset-0 w-full h-full rounded-2xl sm:rounded-3xl overflow-hidden drop-shadow-[0_15px_22px_rgba(120,53,15,0.22)] bg-amber-100/50">
              <Image
                src={product.image}
                alt={displayName}
                fill
                priority={index === 0}
                className="object-cover transition-transform duration-700 hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 512px"
              />
            </div>
          )}

          {/* Eye-Catching Floating Selected Quantity Badge on Image */}
          {displayUnit > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: -6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className="absolute top-2.5 right-2.5 z-30 bg-emerald-600/95 dark:bg-emerald-700/95 backdrop-blur-md text-white px-3 py-1 rounded-full shadow-[0_6px_16px_rgba(5,150,105,0.4)] border border-emerald-300/80 flex items-center gap-1.5 select-none pointer-events-none"
            >
              <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-200" />
              <div className="flex items-center gap-1 font-black text-xs sm:text-sm">
                <SlidingNumber
                  value={displayUnit}
                  isBengali={lang === "bn"}
                  className="font-mono font-black"
                />
                <span className="text-[11px] sm:text-xs font-bold text-emerald-100">
                  {lang === "bn" ? "টি কার্টে" : "in cart"}
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Artisanal Clay/Wood Shelf Pedestal Bar */}
        <div className="w-56 xs:w-64 sm:w-80 h-2 sm:h-2.5 bg-gradient-to-r from-transparent via-[#b47137] to-transparent rounded-full shadow-md mt-2 opacity-80" />
        <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-400 font-medium tracking-wide mt-1 flex items-center justify-center gap-1.5">
          <Leaf className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{t.heritageBadge}</span>
        </p>

        {/* Product Title & Short Bio */}
        <div className="text-center mt-1 px-2 max-w-sm sm:max-w-md">
          <h2 className="text-base sm:text-2xl md:text-3xl font-extrabold text-[#451a03] dark:text-amber-100 tracking-tight leading-tight">
            {displayName}
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 mt-0.5 line-clamp-1 sm:line-clamp-2 leading-relaxed">
            {displaySummary}
          </p>
        </div>
      </div>

      {/* Bottom Control Deck: Clean Quantity Selector (Default 0, auto-sync to cart) */}
      <div className="relative z-10 w-full max-w-lg mx-auto bg-amber-100/90 dark:bg-stone-900/90 backdrop-blur-md border border-amber-300/80 dark:border-stone-800 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl shadow-amber-950/10 space-y-2.5">
        {/* Price & Pack Size Selector: Shows Unit Price on Top & Total Price Below */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div>
            {/* Unit Price */}
            <div className="flex items-center gap-1 text-[11px] sm:text-xs text-amber-800/80 dark:text-amber-400 font-bold">
              <span>{lang === "bn" ? "একক দর:" : "Unit Price:"}</span>
              <span className="font-mono">{formatStorePrice(unitPrice, lang)}</span>
              {selectedVariant.name && (
                <span className="text-[10px] sm:text-[11px] text-amber-700/70 dark:text-amber-400/70 font-normal">
                  / {lang === "bn" ? selectedVariant.nameBn || selectedVariant.name : selectedVariant.name}
                </span>
              )}
            </div>

            {/* Total Price (Displayed directly below Unit Price) */}
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300">
                {lang === "bn" ? "মোট মূল্য:" : "Total Price:"}
              </span>
              <span className="font-mono text-base sm:text-xl font-extrabold text-amber-950 dark:text-amber-100">
                {formatStorePrice(unitPrice * (displayUnit > 0 ? displayUnit : 1), lang)}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400">
                ({lang === "bn" ? `${toBnNumber(displayUnit > 0 ? displayUnit : 1)}টি` : `${displayUnit > 0 ? displayUnit : 1} ${displayUnit > 1 ? "packs" : "pack"}`})
              </span>
            </div>
          </div>

          {sortedVariants.length > 1 && (
            <div className="relative">
              <select
                value={selectedVariant.id}
                onChange={(e) => {
                  const found = sortedVariants.find((v) => v.id === e.target.value);
                  if (found) setSelectedVariant(found);
                }}
                className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold text-xs sm:text-sm py-1.5 px-3 pr-7 rounded-xl border border-amber-300 dark:border-stone-700 shadow-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {sortedVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {lang === "bn" ? v.nameBn || v.name : v.name} ({formatStorePrice(v.price, lang)})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-amber-800 dark:text-amber-300 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Redesigned Cart Button: Minus on Left, Quantity & Animated Bag in Middle, Plus on Right */}
        <div className="relative">
          {/* Flying Miniature Product Animation into Bag */}
          <AnimatePresence>
            {flyingItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ x: 0, y: 0, scale: 0.7, opacity: 1, rotate: 0 }}
                animate={{
                  x: [0, item.dx * 0.45, item.dx],
                  y: [0, -42, 2],
                  scale: [0.7, 1.2, 0.2],
                  rotate: [0, -18, 22],
                  opacity: [1, 1, 0.15],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-300 dark:border-amber-400 shadow-[0_4px_14px_rgba(217,119,6,0.6)] bg-white relative flex items-center justify-center">
                  <Image
                    src={imagesList[currentSlide] || product.image}
                    alt="flying product"
                    fill
                    className="object-cover"
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div
            className={`w-full rounded-2xl p-2 sm:p-2.5 border-2 transition-all flex items-center justify-between gap-2 shadow-lg ${
              displayUnit > 0
                ? "bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-600 text-white border-emerald-400 shadow-emerald-950/20"
                : "bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white border-amber-300/80 shadow-amber-950/20"
            }`}
          >
            {/* Left: Minus Button */}
            {displayUnit === 0 ? (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-black/15 text-white/40 flex items-center justify-center font-black text-xl shrink-0 cursor-not-allowed select-none"
                aria-label={lang === "bn" ? "পরিমাণ কমান" : "Decrease quantity"}
              >
                <Minus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
              </button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.85 }}
                type="button"
                onClick={() => handleSetUnit(currentUnit - 1)}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/20 hover:bg-white/30 active:bg-white/40 flex items-center justify-center text-white font-black text-xl transition-all touch-manipulation cursor-pointer shrink-0 shadow-sm"
                aria-label={lang === "bn" ? "পরিমাণ কমান" : "Decrease quantity"}
              >
                <Minus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
              </motion.button>
            )}

            {/* Middle: Large Quantity Display & Instruction Text */}
            <div className="flex-1 flex flex-col items-center justify-center text-center px-1 min-w-0">
              {/* Prominent Large Quantity Box with Fly-in Impact Feedback */}
              <div ref={bagRef} className="relative flex items-center justify-center">
                {/* Impact Ripple Shockwave */}
                {isBagAnimating && (
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0.95 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="absolute inset-0 rounded-2xl border-2 border-amber-300 bg-amber-300/30 pointer-events-none"
                  />
                )}

                {/* Floating +1 / +১ indicator */}
                {isBagAnimating && (
                  <motion.span
                    initial={{ y: 0, opacity: 1, scale: 0.7 }}
                    animate={{ y: -24, opacity: 0, scale: 1.25 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="absolute -top-3 font-mono font-black text-xs sm:text-sm text-amber-200 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  >
                    +{lang === "bn" ? "১" : "1"}
                  </motion.span>
                )}

                {/* Large Quantity Box with SlidingNumber */}
                <motion.div
                  animate={
                    isBagAnimating
                      ? {
                          scale: [1, 1.22, 0.92, 1.06, 1],
                        }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.45 }}
                  className={`px-4 sm:px-6 py-0.5 sm:py-1 rounded-xl border transition-all flex items-center justify-center min-w-[56px] sm:min-w-[68px] ${
                    displayUnit > 0
                      ? "bg-black/35 border-white/25 text-white shadow-inner"
                      : "bg-amber-900/40 border-amber-300/40 text-white"
                  }`}
                >
                  <SlidingNumber
                    value={displayUnit}
                    isBengali={lang === "bn"}
                    className="text-2xl sm:text-3xl font-black font-mono tracking-tight flex items-center justify-center"
                  />
                </motion.div>
              </div>

              {/* Button Text Requested by User: "tab on plus button to add quantity" */}
              <span className="text-[11px] sm:text-xs font-semibold text-amber-100 dark:text-amber-200 tracking-tight leading-tight mt-1 truncate max-w-full">
                {lang === "bn"
                  ? "পরিমাণ যোগ করতে + বাটনে চাপুন"
                  : "Tab on plus button to add quantity"}
              </span>
            </div>

            {/* Right: Plus Button */}
            <motion.button
              ref={plusRef}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.05 }}
              type="button"
              onClick={handleAddQuantityWithAnimation}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white flex items-center justify-center font-black text-xl shadow-md transition-all touch-manipulation cursor-pointer shrink-0 ${
                displayUnit > 0
                  ? "text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100"
                  : "text-amber-900 hover:bg-amber-50 active:bg-amber-100"
              }`}
              aria-label={lang === "bn" ? "পরিমাণ বাড়ান" : "Increase quantity"}
            >
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
            </motion.button>
          </div>
        </div>

        {/* Quick Preset Quantity Selector Pills: 1, 2, 3, 5, 10 */}
        <div className="flex items-center justify-center gap-1.5 pt-0.5">
          <span className="text-[10px] sm:text-[11px] font-semibold text-amber-900/70 dark:text-amber-400/70 mr-1">
            {lang === "bn" ? "দ্রুত পছন্দ:" : "Quick Select:"}
          </span>
          {[1, 2, 3, 5, 10].map((preset) => (
            <button
              key={preset}
              type="button"
              suppressHydrationWarning
              onClick={() => handlePresetClick(preset)}
              className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border transition-all touch-manipulation cursor-pointer ${
                displayUnit === preset
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-white/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-amber-200 dark:border-stone-700 hover:bg-amber-100"
              }`}
            >
              {lang === "bn" ? `${toBnNumber(preset)}টি` : preset}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Scroll Hint: If not last product */}
      <div className="relative z-10 w-full text-center py-1">
        {index < totalProducts - 1 ? (
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-amber-800/80 dark:text-amber-400/80"
          >
            <span>{t.scrollHint}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.div>
        ) : (
          <div className="text-[11px] text-amber-900/60 dark:text-amber-400/60 font-medium">
            {t.guaranteeBadge}
          </div>
        )}
      </div>
    </section>
  );
}
