"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  recordProductView,
  selectHasViewedProduct,
} from "@/lib/redux/slices/pixel-slice";
import {
  trackViewContent,
  getClientFbpAndFbc,
} from "@/lib/facebook-pixel";
import { sendCapiViewContentAction } from "@/actions/facebook-capi";
import type { StorefrontProduct } from "./product-card";

interface ProductPixelTrackerProps {
  product: StorefrontProduct | null;
}

/**
 * Fires Facebook Pixel and Conversions API (CAPI) ViewContent event
 * as soon as a visitor lands on a dedicated product page.
 * Deduplicated per product in Redux so it does not fire repeatedly in the same session.
 */
export function ProductPixelTracker({ product }: ProductPixelTrackerProps) {
  const dispatch = useAppDispatch();
  const productId = product?.id;
  const hasFired = useAppSelector(
    productId ? selectHasViewedProduct(productId) : () => false
  );
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!product || !productId) return;
    if (hasFired || firedRef.current === productId) return;

    firedRef.current = productId;
    dispatch(recordProductView(productId));

    // Get lowest or default variant price
    const variants = product.variants || [];
    const sortedVariants = [...variants].sort(
      (a, b) => Number(a.price) - Number(b.price)
    );
    const defaultVariant = sortedVariants[0];
    const price = Number(defaultVariant?.price) || 0;

    const eventId = trackViewContent({
      productId: product.id,
      productName: product.name,
      price,
      currency: "BDT",
    });

    const { fbp, fbc } = getClientFbpAndFbc();
    sendCapiViewContentAction({
      eventId,
      productId: product.id,
      productName: product.name,
      price,
      currency: "BDT",
      url: typeof window !== "undefined" ? window.location.href : undefined,
      fbp,
      fbc,
    }).catch(() => {});
  }, [product, productId, hasFired, dispatch]);

  return null;
}

