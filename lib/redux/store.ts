import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "./slices/cart-slice";

export const makeStore = () => {
  // During Next.js 16 prerendering, Redux internal ActionTypes.INIT invokes Math.random().
  // Temporarily stubbing Math.random avoids the Next.js "unstable value Math.random() in Client Component" error.
  const isServer = typeof window === "undefined";
  const origRandom = Math.random;
  if (isServer) {
    Math.random = () => 0.42;
  }

  try {
    return configureStore({
      reducer: {
        cart: cartReducer,
      },
      devTools: process.env.NODE_ENV !== "production",
    });
  } finally {
    if (isServer) {
      Math.random = origRandom;
    }
  }
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
