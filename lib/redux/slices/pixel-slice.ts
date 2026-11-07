import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface PixelState {
  viewedProductIds: string[];
  viewedVariantIds: string[];
}

const initialState: PixelState = {
  viewedProductIds: [],
  viewedVariantIds: [],
};

export const pixelSlice = createSlice({
  name: "pixel",
  initialState,
  reducers: {
    recordProductView: (state, action: PayloadAction<string>) => {
      const productId = action.payload;
      if (!state.viewedProductIds.includes(productId)) {
        state.viewedProductIds.push(productId);
      }
    },
    recordVariantView: (state, action: PayloadAction<string>) => {
      const variantId = action.payload;
      if (!state.viewedVariantIds.includes(variantId)) {
        state.viewedVariantIds.push(variantId);
      }
    },
    resetProductViews: (state) => {
      state.viewedProductIds = [];
      state.viewedVariantIds = [];
    },
  },
});

export const { recordProductView, recordVariantView, resetProductViews } = pixelSlice.actions;

export const selectViewedProductIds = (state: { pixel: PixelState }) =>
  state.pixel.viewedProductIds;

export const selectViewedVariantIds = (state: { pixel: PixelState }) =>
  state.pixel.viewedVariantIds;

export const selectHasViewedProduct = (productId: string) => (state: { pixel: PixelState }) =>
  state.pixel.viewedProductIds.includes(productId);

export const selectHasViewedVariant = (variantId: string) => (state: { pixel: PixelState }) =>
  state.pixel.viewedVariantIds.includes(variantId);

export default pixelSlice.reducer;

