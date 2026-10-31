"use client";

import React, { useRef, useEffect } from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "@/lib/redux/store";
import { hydrateCart, CartItem } from "@/lib/redux/slices/cart-slice";

const CART_STORAGE_KEY = "gur_store_cart_v1";

interface StoreProviderProps {
  children: React.ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps) {
  const storeRef = useRef<AppStore | null>(null);

  if (!storeRef.current) {
    // Create the store instance the first time this renders
    storeRef.current = makeStore();
  }

  // Safe client-side persistence synchronization
  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;

    // 1. Initial hydration from localStorage
    try {
      const stored = window.localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          store.dispatch(hydrateCart(parsed as CartItem[]));
        } else {
          store.dispatch(hydrateCart([]));
        }
      } else {
        store.dispatch(hydrateCart([]));
      }
    } catch (e) {
      console.warn("Could not read cart from localStorage:", e);
      store.dispatch(hydrateCart([]));
    }

    // 2. Subscribe to store changes to persist cart items
    let prevItemsJson = "";
    const unsubscribe = store.subscribe(() => {
      try {
        const state = store.getState();
        // Only persist if the cart has finished initial hydration
        if (state.cart.isHydrated) {
          const currentItemsJson = JSON.stringify(state.cart.items);
          if (currentItemsJson !== prevItemsJson) {
            prevItemsJson = currentItemsJson;
            window.localStorage.setItem(CART_STORAGE_KEY, currentItemsJson);
          }
        }
      } catch (err) {
        console.warn("Could not persist cart to localStorage:", err);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}

