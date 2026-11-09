"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  /** Debounce delay in milliseconds after user stops typing (default: 5000ms / 5 seconds) */
  debounceMs?: number;
}

/**
 * Computes a deterministic canonical string hash representing current form state.
 * Used to ensure background sync requests ONLY execute when form data has actually changed.
 */
function computeFormHash(data: {
  phone: string;
  name: string;
  address: string;
  note: string;
  zone: string;
  items: StorefrontOrderItem[];
}): string {
  return JSON.stringify({
    p: data.phone,
    n: data.name.trim(),
    a: data.address.trim(),
    no: data.note.trim(),
    z: data.zone,
    i: data.items.map((item) => ({
      pid: item.productId,
      vid: item.variantId,
      q: item.quantity,
      pr: item.unitPrice,
    })),
  });
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
  debounceMs = 5000,
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
  const syncMutationRef = useRef(syncMutation);
  syncMutationRef.current = syncMutation;

  const lastSyncedHashRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Parse & validate Bangladeshi phone in all 4 supported formats (+8801..., 8801..., 01..., 1...)
  const parsedPhone = parseBdPhone(customerPhone);
  const isPhoneValid = parsedPhone.isValid;
  const normalizedPhone = parsedPhone.normalized;

  // Keep latest parameters in a ref so background sync closures always access fresh values
  // without triggering spurious re-renders or resetting debounce timers
  const latestPropsRef = useRef({
    customerPhone,
    customerName,
    addressLine,
    customerNote,
    deliveryZone,
    items,
    enabled,
    isSubmitting,
    isPhoneValid,
    normalizedPhone,
  });

  latestPropsRef.current = {
    customerPhone,
    customerName,
    addressLine,
    customerNote,
    deliveryZone,
    items,
    enabled,
    isSubmitting,
    isPhoneValid,
    normalizedPhone,
  };

  // Compute canonical hash of current form state
  const currentHash = useMemo(() => {
    if (!isPhoneValid) return "";
    return computeFormHash({
      phone: normalizedPhone,
      name: customerName,
      address: addressLine,
      note: customerNote,
      zone: deliveryZone,
      items,
    });
  }, [isPhoneValid, normalizedPhone, customerName, addressLine, customerNote, deliveryZone, items]);

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

  // Primary synchronization function: sends data ONLY if data has changed compared to last sync
  const performSync = useCallback(async () => {
    const {
      enabled: isEnabled,
      isSubmitting: isSub,
      isPhoneValid: isValid,
      normalizedPhone: phone,
      customerName: name,
      addressLine: address,
      customerNote: note,
      deliveryZone: zone,
      items: orderItems,
    } = latestPropsRef.current;

    // Guard: Only sync when enabled, not actively submitting order, and phone is valid
    if (!isEnabled || isSub || !isValid || !phone) return;

    // Compute hash for current data snapshot
    const hashToSync = computeFormHash({
      phone,
      name,
      address,
      note,
      zone,
      items: orderItems,
    });

    // Guard: strictly send user data only when form data has changed
    if (hashToSync === lastSyncedHashRef.current) {
      return;
    }

    // Guard: avoid concurrent duplicate in-flight requests
    if (inFlightPromiseRef.current) {
      return;
    }

    const mutation = syncMutationRef.current;
    const currentPromise = mutation.mutateAsync({
      orderId: draftOrderIdRef.current || undefined,
      customerPhone: phone,
      customerName: name.trim() || undefined,
      addressLine: address.trim() || undefined,
      customerNote: note.trim() || undefined,
      deliveryZone: zone,
      items: orderItems,
    });

    inFlightPromiseRef.current = currentPromise;

    try {
      const res = await currentPromise;
      if (res.success) {
        // Mark this hash as synced immediately on success (fixes endless loop when orderId is undefined in Inngest async queue)
        lastSyncedHashRef.current = hashToSync;

        if (res.orderId && res.orderId !== draftOrderIdRef.current) {
          draftOrderIdRef.current = res.orderId;
          setDraftOrderId(res.orderId);
          try {
            sessionStorage.setItem(DRAFT_ORDER_SESSION_KEY, res.orderId);
          } catch {
            // Safe ignore
          }
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
  }, []);

  // Immediate sync trigger (used on field blur, cart quantity changes, or delivery zone toggles)
  const triggerSyncNow = useCallback(() => {
    cancelPendingSync();
    const { isSubmitting: isSub, isPhoneValid: isValid } = latestPropsRef.current;
    if (!isSub && isValid) {
      performSync();
    }
  }, [cancelPendingSync, performSync]);

  // Debounced auto-save: triggers ONLY when phone is valid, form data has changed, and 5 seconds after user stops typing
  useEffect(() => {
    if (!enabled || isSubmitting || !isPhoneValid || !currentHash) {
      cancelPendingSync();
      return;
    }

    // Do nothing if current form state matches what has already been synced to backend
    if (currentHash === lastSyncedHashRef.current) {
      cancelPendingSync();
      return;
    }

    // Form data has changed! Cancel any prior timer and set new debounce timer (5 seconds)
    cancelPendingSync();

    debounceTimerRef.current = setTimeout(() => {
      performSync();
    }, debounceMs);

    return () => {
      cancelPendingSync();
    };
  }, [enabled, isSubmitting, isPhoneValid, currentHash, debounceMs, cancelPendingSync, performSync]);

  // Track discrete cart changes and delivery zone toggles immediately (if data has changed)
  const itemsSerialized = useMemo(
    () =>
      JSON.stringify(
        items.map((i) => ({
          pid: i.productId,
          vid: i.variantId,
          qty: i.quantity,
          price: i.unitPrice,
        }))
      ),
    [items]
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
