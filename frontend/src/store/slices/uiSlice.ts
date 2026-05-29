// src/store/slices/uiSlice.ts
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { UIState } from "../../types";

const initialState: UIState = {
  cartOpen: false,
  searchQuery: "",
  mobileMenuOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    openCart(state) {
      state.cartOpen = true;
    },
    closeCart(state) {
      state.cartOpen = false;
    },
    toggleCart(state) {
      state.cartOpen = !state.cartOpen;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    toggleMobileMenu(state) {
      state.mobileMenuOpen = !state.mobileMenuOpen;
    },
    closeMobileMenu(state) {
      state.mobileMenuOpen = false;
    },
  },
});

export const {
  openCart,
  closeCart,
  toggleCart,
  setSearchQuery,
  toggleMobileMenu,
  closeMobileMenu,
} = uiSlice.actions;
export const selectCartOpen = (s: { ui: UIState }) => s.ui.cartOpen;
export const selectSearchQuery = (s: { ui: UIState }) => s.ui.searchQuery;
export const selectMobileMenuOpen = (s: { ui: UIState }) => s.ui.mobileMenuOpen;
export default uiSlice.reducer;
