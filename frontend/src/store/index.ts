// src/store/index.ts
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import cartReducer from "./slices/cartSlice";
import uiReducer from "./slices/uiSlice";
import mlReducer from "./slices/mlSlice"; // ← Sprint S3/S4
import forecastReducer from "./slices/forecastSlice"; // ← SPRINT 5

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    ui: uiReducer,
    ml: mlReducer, // ← ML state global
    forecast: forecastReducer, // ← SPRINT 5
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignorer les timestamps ML dans le check de sérialisabilité
        ignoredPaths: ["ml.health", "ml.segStats"],
        // Ignorer les dates dans les payloads ML
        ignoredActions: [
          "forecast/fetchPredictions/fulfilled",
          "forecast/fetchHistory/fulfilled",
          "forecast/fetchComponents/fulfilled",
        ],
      },
    }),
});

export type AppDispatch = typeof store.dispatch;
export type AppState = ReturnType<typeof store.getState>;
