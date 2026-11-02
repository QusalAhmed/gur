import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface PixelState {
  viewedProductIds: string[];
}

const initialState: PixelState = {
  viewedProductIds: [],
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
    resetProductViews: (state) => {
      state.viewedProductIds = [];
    },
  },
});

export const { recordProductView, resetProductViews } = pixelSlice.actions;

export const selectViewedProductIds = (state: { pixel: PixelState }) =>
  state.pixel.viewedProductIds;

export const selectHasViewedProduct = (productId: string) => (state: { pixel: PixelState }) =>
  state.pixel.viewedProductIds.includes(productId);

export default pixelSlice.reducer;

