"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Plus, Minus, ShoppingBag, Sparkles, Check, ChevronDown, Award } from "lucide-react";
import { StorefrontLang, STOREFRONT_TEXT, formatStorePrice, toBnNumber } from "@/lib/storefront-i18n";
import { SelectedProductData } from "./quick-order-sheet";
import { useAppDispatch } from "@/lib/redux/hooks";
import { addToCart } from "@/lib/redux/slices/cart-slice";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

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
  const [selectedVariant, setSelectedVariant] = useState<StorefrontVariant>(initialVariant);
  const [quantity, setQuantity] = useState<number>(1);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  const imagesList = product.images && product.images.length > 0 ? product.images : [product.image];
  const hasMultipleImages = imagesList.length > 1;

  // Autoplay plugin instance with 5 second interval and pause on touch/hover
  const autoplayPlugin = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true, stopOnMouseEnter: true })
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
  const totalPrice = unitPrice * quantity;

  const handleDecrease = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncrease = () => {
    setQuantity((prev) => Math.min(20, prev + 1));
  };

  const handleAddToCart = () => {
    const currentActiveImage = imagesList[currentSlide] || product.image;
    dispatch(
      addToCart({
        productId: product.id,
        productName: product.name,
        productNameBn: product.nameBn || product.name,
        variantId: selectedVariant.id,
        variantName: selectedVariant.name,
        variantNameBn: selectedVariant.nameBn || selectedVariant.name,
        unitPrice,
        quantity,
        image: currentActiveImage,
      })
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2200);
  };

  const handleTriggerOrder = () => {
    const currentActiveImage = imagesList[currentSlide] || product.image;
    // Keep Redux cart synced
    dispatch(
      addToCart({
        productId: product.id,
        productName: product.name,
        productNameBn: product.nameBn || product.name,
        variantId: selectedVariant.id,
        variantName: selectedVariant.name,
        variantNameBn: selectedVariant.nameBn || selectedVariant.name,
        unitPrice,
        quantity,
        image: currentActiveImage,
      })
    );
    onOrderClick(
      {
        productId: product.id,
        productName: product.name,
        productNameBn: product.nameBn || product.name,
        variantId: selectedVariant.id,
        variantName: selectedVariant.name,
        variantNameBn: selectedVariant.nameBn || selectedVariant.name,
        unitPrice,
        image: currentActiveImage,
      },
      quantity
    );
  };

  const displayName = lang === "bn" ? product.nameBn || product.name : product.name;
  const displaySummary =
    lang === "bn"
      ? product.summaryBn || product.summary || "গাছিদের সংগ্রহ করা খাঁটি ও নির্ভেজাল ঐতিহ্যবাহী গুড়।"
      : product.summary || "Traditional pure artisanal jaggery crafted by village artisans.";

  return (
    <section className="h-[100dvh] min-h-[580px] w-full snap-start snap-always flex flex-col justify-between pt-15 sm:pt-18 pb-3 sm:pb-4 px-2.5 xs:px-3 sm:px-6 md:px-12 relative overflow-y-auto sm:overflow-hidden bg-gradient-to-b from-[#fdfbf7] via-[#fbf5eb] to-[#f5ebd8] dark:from-stone-950 dark:via-[#1c1611] dark:to-[#261b12] text-stone-900 dark:text-stone-100 select-none">
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
        </motion.div>

        {/* Artisanal Clay/Wood Shelf Pedestal Bar */}
        <div className="w-56 xs:w-64 sm:w-80 h-2 sm:h-2.5 bg-gradient-to-r from-transparent via-[#b47137] to-transparent rounded-full shadow-md mt-2 opacity-80" />
        <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-400 font-medium tracking-wide mt-1 flex items-center gap-1">
          <span>🌿 {t.heritageBadge}</span>
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

      {/* Bottom Control Deck: Pack Sizes + Quantity + Sticky Buy Action */}
      <div className="relative z-10 w-full max-w-lg mx-auto bg-amber-100/90 dark:bg-stone-900/90 backdrop-blur-md border border-amber-300/80 dark:border-stone-800 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 shadow-xl shadow-amber-950/10 space-y-2 sm:space-y-3">
        {/* 1. Pack Size Pills (Visual Weight Selector) */}
        <div>
          <span className="block text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200 mb-1">
            {t.packSizeLabel}
          </span>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {sortedVariants.map((v) => {
              const isSelected = selectedVariant.id === v.id;
              const vName = lang === "bn" ? v.nameBn || v.name : v.name;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariant(v)}
                  className={`flex-1 min-w-[85px] py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all flex items-center justify-center gap-1 touch-manipulation ${isSelected
                      ? "bg-amber-900 text-amber-50 border-amber-950 dark:bg-amber-500 dark:text-stone-950 dark:border-amber-400 shadow-md ring-2 ring-amber-600/30"
                      : "bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-amber-200 dark:border-stone-700 hover:border-amber-400"
                    }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />}
                  <span className="truncate">{vName}</span>
                  <span className="text-[11px] opacity-85 shrink-0">({formatStorePrice(v.price, lang)})</span>
                </button>
              );
            })}
          </div>
        </div>

          {/* 2. Quantity Stepper + Add To Cart + Order Now CTA */}
          <div className="pt-0.5 flex items-center gap-1.5 sm:gap-2.5">
            {/* Quantity Controls: Big (+ / -) for Aged Shoppers */}
            <div className="flex items-center bg-white dark:bg-stone-800 border-2 border-amber-300 dark:border-stone-700 rounded-xl sm:rounded-2xl p-0.5 sm:p-1 shadow-sm shrink-0">
              <button
                type="button"
                onClick={handleDecrease}
                disabled={quantity <= 1}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-stone-700 dark:hover:bg-stone-600 active:scale-95 disabled:opacity-40 flex items-center justify-center text-amber-950 dark:text-amber-100 font-bold transition-all touch-manipulation"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </button>
                <div className="w-7 sm:w-10 text-center font-bold text-sm sm:text-lg text-amber-950 dark:text-amber-100">
                  {lang === "bn" ? toBnNumber(quantity) : quantity}
                </div>
                <button
                  type="button"
                  onClick={handleIncrease}
                  disabled={quantity >= 20}
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-stone-700 dark:hover:bg-stone-600 active:scale-95 disabled:opacity-40 flex items-center justify-center text-amber-950 dark:text-amber-100 font-bold transition-all touch-manipulation"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Add to Redux Cart Button */}
              <motion.button
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={handleAddToCart}
                className={`h-10 sm:h-12 px-2.5 sm:px-3.5 rounded-xl sm:rounded-2xl border-2 font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all shadow-sm touch-manipulation shrink-0 ${justAdded
                    ? "bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-600"
                    : "bg-white hover:bg-amber-50 dark:bg-stone-800 dark:hover:bg-stone-700 text-amber-950 dark:text-amber-100 border-amber-300 dark:border-stone-700"
                  }`}
                title={t.addToCartBtn}
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    <span className="text-[11px] sm:text-xs">{t.addedToCartNotice}</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                    <span className="hidden xs:inline">{t.addToCartBtn}</span>
                  </>
                )}
              </motion.button>

              {/* Big Green Order Button with Live Price */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleTriggerOrder}
                className="flex-1 min-w-0 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs sm:text-base py-2.5 sm:py-3.5 px-2.5 sm:px-4 rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-700/25 transition-all flex items-center justify-center gap-1 sm:gap-1.5 group touch-manipulation"
              >
                <span className="truncate">{t.orderNowBtn}</span>
                  <span className="bg-emerald-700/80 px-1.5 py-0.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-mono shrink-0">
                    {formatStorePrice(totalPrice, lang)}
                  </span>
              </motion.button>
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
