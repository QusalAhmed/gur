"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSyncIncompleteOrderMutation } from "./use-order";
import { StorefrontOrderItem } from "@/actions/storefront-order";
import { parseBdPhone } from "@/lib/phone";

const DRAFT_ORDER_SESSION_KEY = "gur_draft_order_id";

export interface UseAutoSyncIncompleteOrderProps {
  customerPhone: string;
  customerName?: string;
  addressLine?: string;
  customerNote?: string;
  deliveryZone: "inside_dhaka" | "outside_dhaka";
  items: StorefrontOrderItem[];
  enabled?: boolean;
  isSubmitting?: boolean;
}

export function useAutoSyncIncompleteOrder({
  customerPhone,
  customerName = "",
  addressLine = "",
  customerNote = "",
  deliveryZone,
  items,
  enabled = true,
  isSubmitting = false,
}: UseAutoSyncIncompleteOrderProps) {
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null);
  const draftOrderIdRef = useRef<string | null>(null);
  const inFlightPromiseRef = useRef<Promise<any> | null>(null);

  // Read initial draft order ID from sessionStorage on client mount
  useEffect(() => {
    try {
      const savedId = sessionStorage.getItem(DRAFT_ORDER_SESSION_KEY);
      if (savedId) {
        draftOrderIdRef.current = savedId;
        setDraftOrderId(savedId);
      }
    } catch {
      // Safe fallback if sessionStorage is restricted
    }
  }, []);

  const syncMutation = useSyncIncompleteOrderMutation();
  const lastSyncedHashRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cancel any scheduled debounced sync
  const cancelPendingSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Wait for any in-flight sync mutation to settle before completing order
  const awaitInFlightSync = useCallback(async () => {
    cancelPendingSync();
    if (inFlightPromiseRef.current) {
      try {
        await inFlightPromiseRef.current;
      } catch {
        // Safe ignore
      }
    }
  }, [cancelPendingSync]);

  // Parse & validate Bangladeshi phone in all 4 supported formats (+8801..., 8801..., 01..., 1...)
  const parsedPhone = parseBdPhone(customerPhone);
  const isPhoneValid = parsedPhone.isValid;

  // Clear draft from memory and sessionStorage upon completed order placement
  const clearDraft = useCallback(() => {
    cancelPendingSync();
    draftOrderIdRef.current = null;
    setDraftOrderId(null);
    lastSyncedHashRef.current = "";
    try {
      sessionStorage.removeItem(DRAFT_ORDER_SESSION_KEY);
    } catch {
      // Safe ignore
    }
  }, [cancelPendingSync]);

  // Primary synchronization function
  const performSync = useCallback(async () => {
    if (!enabled || isSubmitting || !parsedPhone.isValid) return;

    // Generate hash of current state to prevent duplicate calls
    const currentHash = JSON.stringify({
      phone: parsedPhone.normalized,
      name: customerName.trim(),
      address: addressLine.trim(),
      note: customerNote.trim(),
      zone: deliveryZone,
      items: items.map((i) => ({
        pid: i.productId,
        vid: i.variantId,
        qty: i.quantity,
        price: i.unitPrice,
      })),
    });

    if (currentHash === lastSyncedHashRef.current) {
      return;
    }

    const currentPromise = syncMutation.mutateAsync({
      orderId: draftOrderIdRef.current || undefined,
      customerPhone: parsedPhone.normalized,
      customerName: customerName.trim() || undefined,
      addressLine: addressLine.trim() || undefined,
      customerNote: customerNote.trim() || undefined,
      deliveryZone,
      items,
    });

    inFlightPromiseRef.current = currentPromise;

    try {
      const res = await currentPromise;
      if (res.success && res.orderId) {
        draftOrderIdRef.current = res.orderId;
        setDraftOrderId(res.orderId);
        lastSyncedHashRef.current = currentHash;
        try {
          sessionStorage.setItem(DRAFT_ORDER_SESSION_KEY, res.orderId);
        } catch {
          // Safe ignore
        }
      }
    } catch (err) {
      // Silent error: do not block or interrupt the customer's checkout flow
      console.warn("Background incomplete order sync failed silently:", err);
    } finally {
      if (inFlightPromiseRef.current === currentPromise) {
        inFlightPromiseRef.current = null;
      }
    }
  }, [
    enabled,
    isSubmitting,
    parsedPhone.isValid,
    parsedPhone.normalized,
    customerName,
    addressLine,
    customerNote,
    deliveryZone,
    items,
    syncMutation,
  ]);

  // Immediate sync trigger (for blur events, cart modifications, or delivery zone toggles)
  const triggerSyncNow = useCallback(() => {
    cancelPendingSync();
    if (!isSubmitting) {
      performSync();
    }
  }, [cancelPendingSync, isSubmitting, performSync]);

  // Trigger sync on text typing with 600ms debounce
  useEffect(() => {
    if (!enabled || isSubmitting || !isPhoneValid) {
      cancelPendingSync();
      return;
    }

    cancelPendingSync();

    debounceTimerRef.current = setTimeout(() => {
      performSync();
    }, 600);

    return () => {
      cancelPendingSync();
    };
  }, [enabled, isSubmitting, isPhoneValid, performSync, cancelPendingSync]);

  // Track discrete cart changes and delivery zone toggles immediately
  const itemsSerialized = JSON.stringify(
    items.map((i) => ({
      pid: i.productId,
      vid: i.variantId,
      qty: i.quantity,
      price: i.unitPrice,
    }))
  );
  const prevItemsSerializedRef = useRef(itemsSerialized);
  const prevZoneRef = useRef(deliveryZone);

  useEffect(() => {
    if (!enabled || isSubmitting || !isPhoneValid) return;

    const hasZoneChanged = prevZoneRef.current !== deliveryZone;
    const hasItemsChanged = prevItemsSerializedRef.current !== itemsSerialized;

    if (hasZoneChanged || hasItemsChanged) {
      prevZoneRef.current = deliveryZone;
      prevItemsSerializedRef.current = itemsSerialized;
      triggerSyncNow();
    }
  }, [enabled, isSubmitting, isPhoneValid, deliveryZone, itemsSerialized, triggerSyncNow]);

  return {
    draftOrderId,
    isSyncing: syncMutation.isPending,
    triggerSyncNow,
    cancelPendingSync,
    awaitInFlightSync,
    clearDraft,
  };
}

