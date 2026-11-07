"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  recordProductView,
  recordVariantView,
  selectHasViewedVariant,
} from "@/lib/redux/slices/pixel-slice";
import {
  trackViewContent,
  getClientFbpAndFbc,
} from "@/lib/facebook-pixel";
import { sendCapiViewContentAction } from "@/actions/facebook-capi";
import type { StorefrontProduct } from "./product-card";

interface ProductPixelTrackerProps {
  product: StorefrontProduct | null;
  variantId?: string;
}

/**
 * Fires Facebook Pixel and Conversions API (CAPI) ViewContent event
 * as soon as a visitor lands on a dedicated product page.
 * Uses the specific variation ID (or default variant) and deduplicates per variant.
 */
export function ProductPixelTracker({ product, variantId }: ProductPixelTrackerProps) {
  const dispatch = useAppDispatch();
  const productId = product?.id;

  // Resolve target variant based on variantId or default variant
  const variants = product?.variants || [];
  const matchedVariant = variantId ? variants.find((v) => v.id === variantId) : undefined;
  const targetVariant =
    matchedVariant ||
    variants.find((v) => v.isDefault) ||
    [...variants].sort((a, b) => Number(a.price) - Number(b.price))[0];

  const targetVariantId = targetVariant?.id || productId;
  const hasFired = useAppSelector(
    targetVariantId ? selectHasViewedVariant(targetVariantId) : () => false
  );
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!product || !productId || !targetVariantId) return;
    if (hasFired || firedRef.current === targetVariantId) return;

    firedRef.current = targetVariantId;
    dispatch(recordProductView(productId));
    if (targetVariant?.id) {
      dispatch(recordVariantView(targetVariant.id));
    }

    const price = Number(targetVariant?.price) || 0;

    const eventId = trackViewContent({
      productId: product.id,
      variantId: targetVariant?.id,
      productName: product.name,
      price,
      currency: "BDT",
    });

    const { fbp, fbc } = getClientFbpAndFbc();
    sendCapiViewContentAction({
      eventId,
      productId: product.id,
      variantId: targetVariant?.id,
      productName: product.name,
      price,
      currency: "BDT",
      url: typeof window !== "undefined" ? window.location.href : undefined,
      fbp,
      fbc,
    }).catch(() => {});
  }, [product, productId, targetVariantId, targetVariant, hasFired, dispatch]);

  return null;
}

