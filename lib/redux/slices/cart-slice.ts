import { createSlice, createSelector, PayloadAction } from "@reduxjs/toolkit";

export interface CartItem {
  id: string; // `${productId}-${variantId}`
  productId: string;
  productName: string;
  productNameBn?: string;
  variantId: string;
  variantName: string;
  variantNameBn?: string;
  unitPrice: number;
  quantity: number;
  image: string;
  description?: string;
  descriptionBn?: string;
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  isHydrated: boolean;
}

const initialState: CartState = {
  items: [],
  isOpen: false,
  isHydrated: false,
};

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (
      state,
      action: PayloadAction<Omit<CartItem, "id"> | CartItem>
    ) => {
      const payload = action.payload;
      const itemId = `${payload.productId}-${payload.variantId}`;
      const existingIndex = state.items.findIndex((i) => i.id === itemId);

      if (existingIndex > -1) {
        // Increment quantity (capped at 50 for safety)
        const newQty = state.items[existingIndex].quantity + (payload.quantity || 1);
        state.items[existingIndex].quantity = Math.min(50, newQty);
        // Update price or image if changed
        state.items[existingIndex].unitPrice = payload.unitPrice;
        if (payload.image) state.items[existingIndex].image = payload.image;
      } else {
        state.items.push({
          ...payload,
          id: itemId,
          quantity: Math.min(50, Math.max(1, payload.quantity || 1)),
        });
      }
    },
    removeFromCart: (
      state,
      action: PayloadAction<{ productId: string; variantId: string } | string>
    ) => {
      const idToRemove =
        typeof action.payload === "string"
          ? action.payload
          : `${action.payload.productId}-${action.payload.variantId}`;
      state.items = state.items.filter((item) => item.id !== idToRemove);
    },
    updateQuantity: (
      state,
      action: PayloadAction<{
        productId: string;
        variantId: string;
        quantity: number;
      }>
    ) => {
      const targetId = `${action.payload.productId}-${action.payload.variantId}`;
      const item = state.items.find((i) => i.id === targetId);
      if (item) {
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter((i) => i.id !== targetId);
        } else {
          item.quantity = Math.min(50, Math.max(1, action.payload.quantity));
        }
      }
    },
    incrementQuantity: (
      state,
      action: PayloadAction<{ productId: string; variantId: string }>
    ) => {
      const targetId = `${action.payload.productId}-${action.payload.variantId}`;
      const item = state.items.find((i) => i.id === targetId);
      if (item && item.quantity < 50) {
        item.quantity += 1;
      }
    },
    decrementQuantity: (
      state,
      action: PayloadAction<{ productId: string; variantId: string }>
    ) => {
      const targetId = `${action.payload.productId}-${action.payload.variantId}`;
      const item = state.items.find((i) => i.id === targetId);
      if (item) {
        if (item.quantity > 1) {
          item.quantity -= 1;
        } else {
          // Remove if decreased from 1
          state.items = state.items.filter((i) => i.id !== targetId);
        }
      }
    },
    clearCart: (state) => {
      state.items = [];
    },
    openCart: (state) => {
      state.isOpen = true;
    },
    closeCart: (state) => {
      state.isOpen = false;
    },
    toggleCart: (state) => {
      state.isOpen = !state.isOpen;
    },
    hydrateCart: (state, action: PayloadAction<CartItem[]>) => {
      state.items = action.payload || [];
      state.isHydrated = true;
    },
  },
});

export const {
  addToCart,
  removeFromCart,
  updateQuantity,
  incrementQuantity,
  decrementQuantity,
  clearCart,
  openCart,
  closeCart,
  toggleCart,
  hydrateCart,
} = cartSlice.actions;

// Selectors
export const selectCartState = (state: { cart: CartState }) => state.cart;
export const selectCartItems = (state: { cart: CartState }) => state.cart.items;
export const selectIsCartOpen = (state: { cart: CartState }) => state.cart.isOpen;
export const selectIsCartHydrated = (state: { cart: CartState }) => state.cart.isHydrated;

export const selectCartTotalQuantity = createSelector(
  [selectCartItems],
  (items) => items.reduce((total, item) => total + (item.quantity || 0), 0)
);

export const selectCartSubtotal = createSelector(
  [selectCartItems],
  (items) =>
    items.reduce(
      (total, item) => total + (item.quantity || 0) * (Number(item.unitPrice) || 0),
      0
    )
);

export const selectCartItemByVariant = (productId: string, variantId: string) =>
  createSelector([selectCartItems], (items) => {
    const targetId = `${productId}-${variantId}`;
    return items.find((item) => item.id === targetId);
  });

export default cartSlice.reducer;

