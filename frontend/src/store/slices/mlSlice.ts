// src/store/slices/mlSlice.ts
// State global ML — RecSys (Sprint S3) + BehaSys (Sprint S4)
// Optimisé : Redux Toolkit, createAsyncThunk, sélecteurs mémoïsés
import {
  createSlice,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";
import type { AppState } from "../index";
import type { PayloadAction } from "@reduxjs/toolkit";

const ML_URL = import.meta.env.VITE_ML_URL || "http://localhost:8001";

// ── Types ──────────────────────────────────────────────────────────────────
export interface RecSysHealth {
  loaded: boolean;
  load_error: string | null;
  hybrid_params: { alpha_svd: number; alpha_cf: number } | null;
  files: Record<string, boolean>;
}
export interface SegSysHealth {
  loaded: boolean;
  load_error: string | null;
  model_meta: {
    model_version: string;
    k: number;
    silhouette: number;
    trained_at: string;
    n_train: number;
  } | null;
  files: Record<string, boolean>;
}
export interface ForeSysHealth {
  loaded: boolean;
  model_path: string;
  model_exists: boolean;
  metrics: {
    MAE?: number | null;
    RMSE?: number | null;
    MAPE?: number | null;
    R2?: number | null;
    trained_at?: string | null;
  };
  loaded_at: string | null;
  load_error?: string | null;
}
export interface MLHealth {
  status: "ok" | "partial" | "error";
  rec_sys: RecSysHealth;
  models_dir: string;
  db_url_host: string;
  seg_sys: SegSysHealth;
  forecast_sys?: ForeSysHealth;
}
//
export interface SegmentStat {
  cluster_id: number;
  segment: string;
  segment_label: string;
  color: string;
  action_crm: string;
  n_clients: number;
  pct_clients: number;
  recency_avg: number;
  frequency_avg: number;
  monetary_avg: number;
  monetary_total: number;
  pct_revenue: number;
}
//
export interface GlobalStats {
  total_clients: number;
  total_revenue: number;
  segments: SegmentStat[];
  model_version: string;
  silhouette_score: number;
  k: number;
  source?: string;
}
//
export interface GiftOffer {
  id: number;
  user_email: string;
  user_name: string;
  segment: string;
  gift_type: string;
  gift_value: string;
  gift_details: string;
  status: string;
  valid_days: number;
  sent_at: string | null;
  expires_at: string | null;
  responded_at: string | null;
  is_expired: boolean;
}

interface MLState {
  // Santé globale
  health: MLHealth | null;
  healthLoading: boolean;
  healthError: string | null;
  stats: Record<string, unknown> | null;

  // Segmentation stats
  segStats: GlobalStats | null;
  segStatsLoading: boolean;
  segStatsError: string | null;

  // Resegmentation
  resegLoading: boolean;
  resegMessage: string | null;

  // Offres cadeaux
  gifts: GiftOffer[];
  giftsLoading: boolean;
  giftsError: string | null;
  giftCreating: boolean;
  giftCreateError: string | null;
}

const initialState: MLState = {
  health: null,
  healthLoading: false,
  healthError: null,
  stats: null,

  segStats: null,
  segStatsLoading: false,
  segStatsError: null,

  resegLoading: false,
  resegMessage: null,

  gifts: [],
  giftsLoading: false,
  giftsError: null,
  giftCreating: false,
  giftCreateError: null,
};

// ── Thunks ─────────────────────────────────────────────────────────────────
export const fetchMLHealth = createAsyncThunk(
  "ml/fetchHealth",
  async (_, { rejectWithValue }) => {
    try {
      const [hRes, sRes] = await Promise.all([
        fetch(`${ML_URL}/ml/health`),
        fetch(`${ML_URL}/ml/stats`).catch(() => null),
      ]);
      const health: MLHealth = await hRes.json();
      const stats = sRes?.ok ? await sRes.json() : null;
      return { health, stats };
    } catch (e) {
      return rejectWithValue(`Service ML inaccessible : ${ML_URL}`);
    }
  },
);
export const fetchSegStats = createAsyncThunk(
  "ml/fetchSegStats",
  async (_, { rejectWithValue }) => {
    try {
      // Essayer Django d'abord (auth admin), sinon fallback FastAPI direct
      const djangoToken = localStorage.getItem("access");
      if (djangoToken) {
        const res = await fetch("/api/analytics/segments-stats/", {
          headers: { Authorization: `Bearer ${djangoToken}` },
        });
        if (res.ok) return (await res.json()) as GlobalStats;
      }
      // Fallback direct FastAPI
      const res = await fetch(`${ML_URL}/ml/segments-stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as GlobalStats;
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

export const triggerResegment = createAsyncThunk(
  "ml/resegment",
  async (_, { rejectWithValue }) => {
    try {
      const djangoToken = localStorage.getItem("access");
      if (djangoToken) {
        const res = await fetch("/api/analytics/resegment/", {
          method: "POST",
          headers: { Authorization: `Bearer ${djangoToken}` },
        });
        if (res.ok) return await res.json();
      }
      const res = await fetch(`${ML_URL}/ml/resegment`);
      return await res.json();
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

export const fetchGifts = createAsyncThunk(
  "ml/fetchGifts",
  async (statusFilter: string | undefined, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("access");
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/analytics/gifts/${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.gifts as GiftOffer[];
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

export interface CreateGiftPayload {
  user_id: string;
  gift_type: string;
  gift_value: number;
  gift_details: string;
  valid_days?: number;
  admin_note?: string;
}

export const createGiftOffer = createAsyncThunk(
  "ml/createGift",
  async (payload: CreateGiftPayload, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("access");
      const res = await fetch("/api/analytics/gifts/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

// ── Slice ───────────────────────────────────────────────────────────────────
const mlSlice = createSlice({
  name: "ml",
  initialState,
  reducers: {
    clearMLHealth(state) {
      state.health = null;
      state.stats = null;
      state.healthError = null;
    },
    clearResegMessage(state) {
      state.resegMessage = null;
    },
    clearGiftError(state) {
      state.giftCreateError = null;
    },
  },
  extraReducers: (builder) => {
    // Health
    builder
      .addCase(fetchMLHealth.pending, (s) => {
        s.healthLoading = true;
        s.healthError = null;
      })
      .addCase(
        fetchMLHealth.fulfilled,
        (s, a: PayloadAction<{ health: MLHealth; stats: unknown }>) => {
          s.healthLoading = false;
          s.health = a.payload.health as MLHealth | null;
          s.stats = a.payload.stats as Record<string, unknown> | null;
          // s.lastRefresh = new Date().toISOString();
        },
      )
      .addCase(fetchMLHealth.rejected, (s, a) => {
        s.healthLoading = false;
        s.healthError = String(a.payload);
      });

    // Seg Stats
    builder
      .addCase(fetchSegStats.pending, (s) => {
        s.segStatsLoading = true;
        s.segStatsError = null;
      })
      .addCase(fetchSegStats.fulfilled, (s, a) => {
        s.segStatsLoading = false;
        s.segStats = a.payload;
      })
      .addCase(fetchSegStats.rejected, (s, a) => {
        s.segStatsLoading = false;
        s.segStatsError = String(a.payload);
      });

    // Resegment
    builder
      .addCase(triggerResegment.pending, (s) => {
        s.resegLoading = true;
        s.resegMessage = null;
      })
      .addCase(triggerResegment.fulfilled, (s, a) => {
        s.resegLoading = false;
        s.resegMessage = `✅ ${a.payload?.message ?? "Resegmentation déclenchée."}`;
      })
      .addCase(triggerResegment.rejected, (s, a) => {
        s.resegLoading = false;
        s.resegMessage = `❌ ${String(a.payload)}`;
      });

    // Gifts
    builder
      .addCase(fetchGifts.pending, (s) => {
        s.giftsLoading = true;
        s.giftsError = null;
      })
      .addCase(fetchGifts.fulfilled, (s, a) => {
        s.giftsLoading = false;
        s.gifts = a.payload;
      })
      .addCase(fetchGifts.rejected, (s, a) => {
        s.giftsLoading = false;
        s.giftsError = String(a.payload);
      });

    builder
      .addCase(createGiftOffer.pending, (s) => {
        s.giftCreating = true;
        s.giftCreateError = null;
      })
      .addCase(createGiftOffer.fulfilled, (s) => {
        s.giftCreating = false;
      })
      .addCase(createGiftOffer.rejected, (s, a) => {
        s.giftCreating = false;
        s.giftCreateError = String(a.payload);
      });
  },
});

export const { clearResegMessage, clearGiftError } = mlSlice.actions;
export default mlSlice.reducer;

// ── Sélecteurs mémoïsés ────────────────────────────────────────────────────
const selectML = (s: AppState) => s.ml;

export const selectMLHealth = createSelector(selectML, (s) => s.health);
export const selectRecSysLoaded = createSelector(
  selectML,
  (s) => s.health?.rec_sys?.loaded ?? false,
);
export const selectSegSysLoaded = createSelector(
  selectML,
  (s) => s.health?.seg_sys?.loaded ?? false,
);
export const selectSegStats = createSelector(selectML, (s) => s.segStats);
export const selectSegments = createSelector(
  selectML,
  (s) => s.segStats?.segments ?? [],
);
export const selectGifts = createSelector(selectML, (s) => s.gifts);
export const selectResegLoading = createSelector(
  selectML,
  (s) => s.resegLoading,
);
export const selectResegMessage = createSelector(
  selectML,
  (s) => s.resegMessage,
);
export const selectGiftCreating = createSelector(
  selectML,
  (s) => s.giftCreating,
);
export const selectGiftError = createSelector(
  selectML,
  (s) => s.giftCreateError,
);

export const selectForeSysLoaded = createSelector(
  selectML,
  (s) => s.health?.forecast_sys?.loaded ?? false,
);
export const selectMLStats = (s: AppState) => s.ml.stats;
export const selectMLHealthLoading = (s: AppState) => s.ml.healthLoading;
export const selectMLError = (s: AppState) => s.ml.healthError;
export const selectLastRefresh = (s: AppState) => s.ml.resegLoading;
