// src/store/slices/cartSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import api from "../../services/api";
import type { CartState, Cart, RootState } from "../../types";
import type { AppDispatch } from "../index";

export const fetchCart = createAsyncThunk(
  "cart/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get<Cart>("/orders/cart/");
      return data;
    } catch (err: unknown) {
      return rejectWithValue("Impossible de charger le panier");
    }
  },
);

export const addToCart = createAsyncThunk(
  "cart/add",
  async (
    { productId, quantity = 1 }: { productId: number; quantity?: number },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await api.post<Cart>("/orders/cart/items/", {
        product_id: productId,
        quantity,
      });
      return data;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      return rejectWithValue(
        e.response?.data?.error || "Erreur lors de l'ajout au panier",
      );
    }
  },
);

export const updateCartItem = createAsyncThunk(
  "cart/update",
  async (
    { itemId, quantity }: { itemId: number; quantity: number },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await api.put<Cart>(`/orders/cart/items/${itemId}/`, {
        quantity,
      });
      return data;
    } catch (err: unknown) {
      return rejectWithValue("Erreur lors de la mise à jour");
    }
  },
);

// FIX: DELETE renvoie maintenant le panier complet mis à jour
export const removeCartItem = createAsyncThunk(
  "cart/remove",
  async (itemId: number, { rejectWithValue }) => {
    try {
      const { data } = await api.delete<Cart>(`/orders/cart/items/${itemId}/`);
      return data; // le backend renvoie le panier mis à jour
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Item déjà supprimé — resynchroniser depuis le serveur
        const { data } = await api.get("/orders/cart/");
        return data; // retourner l'état réel de la BD
      }
      return rejectWithValue("Erreur lors de la suppression");
    }
  },
);

export const mergeCartThunk =
  () => async (dispatch: AppDispatch, getState: () => RootState) => {
    const localItems = getState().cart.items; // ← toujours frais

    if (localItems.length > 0) {
      for (const item of localItems) {
        await dispatch(
          addToCart({
            productId: Number(item.product),
            quantity: item.quantity,
          }),
        );
      }
      dispatch(resetCart());
    } else {
      dispatch(fetchCart());
    }
  };

export const clearCart = createAsyncThunk("cart/clear", async () => {
  const { data } = await api.delete("/orders/cart/clear/");
  return data;
});

// src/store/slices/cartSlice.ts — fusion panier local → serveur après login

// Nouveau thunk : fusionne le panier local avec le serveur
export const mergeLocalCartToServer = createAsyncThunk(
  "cart/mergeLocal",
  async (_, { getState }) => {
    const state = getState() as RootState;
    const localItems = state.cart.items; // items du panier local (non-auth)

    // Envoyer chaque item local au serveur
    for (const item of localItems) {
      try {
        await api.post("/orders/cart/items/", {
          product_id: item.product_id,
          quantity: item.quantity,
        });
      } catch {
        // Item peut-être plus en stock, on continue
      }
    }

    // Récupérer le panier serveur fusionné
    const { data } = await api.get("/orders/cart/");
    return data;
  },
);
// ── Panier local (non-connecté) ──────────────────────────────
export interface LocalCartItem {
  id: number;
  product: number;
  product_name: string;
  product_image?: string | null;
  product_slug?: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

const initialState: CartState = {
  items: [],
  total: 0,
  count: 0,
  loading: false,
  error: null,
};

const toFloat = (v: number | string | undefined): number =>
  typeof v === "string" ? parseFloat(v) : (v ?? 0);

const setCartFromResponse = (state: CartState, data: Cart) => {
  state.loading = false;
  state.error = null;
  state.items = data.items || [];
  state.total = toFloat(data.total);
  state.count = data.item_count || 0;
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    resetCart(state) {
      state.items = [];
      state.total = 0;
      state.count = 0;
      state.error = null;
    },
    // Panier local pour utilisateurs non-connectés
    addLocalItem(
      state,
      action: PayloadAction<{
        product_id: number;
        product_name: string;
        product_image?: string | null;
        product_slug?: string;
        price: number;
        quantity?: number;
      }>,
    ) {
      const {
        product_id,
        product_name,
        product_image,
        product_slug,
        price,
        quantity = 1,
      } = action.payload;
      const existing = state.items.find((i) => i.product_id === product_id);
      if (existing) {
        existing.quantity += quantity;
        existing.subtotal = existing.quantity * toFloat(existing.unit_price);
      } else {
        state.items.push({
          id: Date.now(),
          product: product_id,
          product_id: product_id,
          product_name,
          product_image,
          product_slug,
          unit_price: price,
          quantity,
          subtotal: price * quantity,
        });
      }
      state.count = state.items.reduce((acc, i) => acc + i.quantity, 0);
      state.total = state.items.reduce(
        (acc, i) => acc + toFloat(i.subtotal),
        0,
      );
    },
    updateLocalItem(
      state,
      action: PayloadAction<{ id: number; quantity: number }>,
    ) {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) {
        item.quantity = action.payload.quantity;
        item.subtotal = toFloat(item.unit_price) * action.payload.quantity;
      }
      state.count = state.items.reduce((acc, i) => acc + i.quantity, 0);
      state.total = state.items.reduce(
        (acc, i) => acc + toFloat(i.subtotal),
        0,
      );
    },
    removeLocalItem(state, action: PayloadAction<number>) {
      state.items = state.items.filter((i) => i.id !== action.payload);
      state.count = state.items.reduce((acc, i) => acc + i.quantity, 0);
      state.total = state.items.reduce(
        (acc, i) => acc + toFloat(i.subtotal),
        0,
      );
    },
  },
  extraReducers: (b) => {
    // Loading states
    b.addCase(fetchCart.pending, (s) => {
      s.loading = true;
    });
    b.addCase(addToCart.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(updateCartItem.pending, (s) => {
      s.loading = true;
    });
    b.addCase(removeCartItem.pending, (s) => {
      s.loading = true;
    });

    // Success — tous retournent le panier complet
    b.addCase(fetchCart.fulfilled, (s, a) => setCartFromResponse(s, a.payload));
    b.addCase(addToCart.fulfilled, (s, a) => setCartFromResponse(s, a.payload));
    b.addCase(updateCartItem.fulfilled, (s, a) =>
      setCartFromResponse(s, a.payload),
    );
    b.addCase(removeCartItem.fulfilled, (s, a) =>
      setCartFromResponse(s, a.payload),
    ); // FIX

    // Errors
    b.addCase(fetchCart.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload as string;
    });
    b.addCase(addToCart.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload as string;
    });
    b.addCase(updateCartItem.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload as string;
    });
    b.addCase(removeCartItem.rejected, (s, a) => {
      s.loading = false;
      s.error = a.payload as string;
    });

    // clearCart → vider le state immédiatement
    b.addCase(clearCart.pending, (s) => {
      s.loading = true;
    });
    b.addCase(clearCart.fulfilled, (s) => {
      s.loading = false;
      s.items = [];
      s.total = 0;
      s.count = 0;
      s.error = null;
    });
    b.addCase(clearCart.rejected, (s) => {
      s.loading = false;
    });
  },
});

export const { resetCart, addLocalItem, updateLocalItem, removeLocalItem } =
  cartSlice.actions;
export const selectCart = (s: { cart: CartState }) => s.cart;
export const selectCartCount = (s: { cart: CartState }) => s.cart.count || 0;
export const selectCartItems = (s: { cart: CartState }) => s.cart.items;
export const selectCartTotal = (s: { cart: CartState }) => s.cart.total;
export const selectCartLoading = (s: { cart: CartState }) => s.cart.loading;
export default cartSlice.reducer;
