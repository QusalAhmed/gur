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
}

export function useAutoSyncIncompleteOrder({
  customerPhone,
  customerName = "",
  addressLine = "",
  customerNote = "",
  deliveryZone,
  items,
  enabled = true,
}: UseAutoSyncIncompleteOrderProps) {
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null);
  const draftOrderIdRef = useRef<string | null>(null);

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

  // Parse & validate Bangladeshi phone in all 4 supported formats (+8801..., 8801..., 01..., 1...)
  const parsedPhone = parseBdPhone(customerPhone);
  const isPhoneValid = parsedPhone.isValid;

  // Clear draft from memory and sessionStorage upon completed order placement
  const clearDraft = useCallback(() => {
    draftOrderIdRef.current = null;
    setDraftOrderId(null);
    lastSyncedHashRef.current = "";
    try {
      sessionStorage.removeItem(DRAFT_ORDER_SESSION_KEY);
    } catch {
      // Safe ignore
    }
  }, []);

  // Primary synchronization function
  const performSync = useCallback(async () => {
    if (!enabled || !parsedPhone.isValid) return;

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

    try {
      const res = await syncMutation.mutateAsync({
        orderId: draftOrderIdRef.current || undefined,
        customerPhone: parsedPhone.normalized,
        customerName: customerName.trim() || undefined,
        addressLine: addressLine.trim() || undefined,
        customerNote: customerNote.trim() || undefined,
        deliveryZone,
        items,
      });

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
    }
  }, [
    enabled,
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
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    performSync();
  }, [performSync]);

  // Trigger sync on text typing with 600ms debounce
  useEffect(() => {
    if (!enabled || !isPhoneValid) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSync();
    }, 600);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, isPhoneValid, performSync]);

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
    if (!enabled || !isPhoneValid) return;

    const hasZoneChanged = prevZoneRef.current !== deliveryZone;
    const hasItemsChanged = prevItemsSerializedRef.current !== itemsSerialized;

    if (hasZoneChanged || hasItemsChanged) {
      prevZoneRef.current = deliveryZone;
      prevItemsSerializedRef.current = itemsSerialized;
      triggerSyncNow();
    }
  }, [enabled, isPhoneValid, deliveryZone, itemsSerialized, triggerSyncNow]);

  return {
    draftOrderId,
    isSyncing: syncMutation.isPending,
    triggerSyncNow,
    clearDraft,
  };
}

