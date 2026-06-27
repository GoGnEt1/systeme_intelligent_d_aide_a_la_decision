// src/store/slices/forecastSlice.ts — SmartShop Live
import {
  createSlice,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { AppState } from "../index";

const ML_URL = import.meta.env.VITE_ML_URL || "http://localhost:8001";

// ── Types ─────────────────────────────────────────────────────────────────────

// ── NOUVEAUX types SmartShop Live ─────────────────────────────────────────────
export interface ActualsRecord {
  date: string;
  revenue: number;
  nb_orders: number;
  nb_clients: number;
  avg_order_value?: number;
}

export interface ActualsSummary {
  total_revenue_DT: number;
  avg_daily_revenue: number;
  total_orders: number;
  growth_pct: number;
  trend: "hausse" | "baisse";
}

export interface ActualsData {
  source: string;
  granularity: string;
  days_requested: number;
  n_records: number;
  date_range: { start: string; end: string };
  summary: ActualsSummary;
  records: ActualsRecord[];
}

export interface SmartShopKPIs {
  source: string;
  generated: string;
  period_30j: {
    revenue_DT: number;
    nb_orders: number;
    nb_clients: number;
    avg_basket_DT: number;
    revenue_growth_pct: number;
    orders_growth_pct: number;
    revenue_trend: string;
    orders_trend: string;
  };
  all_time: {
    revenue_DT: number;
    nb_orders: number;
    nb_clients: number;
    first_order: string | null;
    last_order: string | null;
  };
}

export interface MetricValue {
  value: number | null;
  unit: string;
  label: string;
  quality?: string;
}

export interface ForecastPoint {
  date: string;
  prediction: number;
  pred_lower: number;
  pred_upper: number;
  trend: number;
  effet_hebdo: number;
  effet_annuel: number;
}

export interface HistoryRecord {
  month: string;
  avg_sales: number;
  total_sales: number;
  n_days: number;
  trend?: number;
}

export interface ComponentPoint {
  date: string;
  trend: number;
  effet_hebdo: number;
  effet_annuel: number;
  day_of_week: string;
  month_name: string;
}

export interface WeeklyProfile {
  day: string;
  effect: number;
}
export interface YearlyProfile {
  month: string;
  effect: number;
}

export interface ForecastMetrics {
  MAE: MetricValue;
  RMSE: MetricValue;
  MAPE: MetricValue;
  R2: MetricValue;
  model_type: string;
  version: string;
  trained_at: string;
  training_start: string;
  training_end: string;
  n_training_days: number;
  hyperparameters: Record<string, unknown>;
}

export interface ForecastSummary {
  generated_at: string;
  model_type: string;
  model_version: string;
  training_period: string;
  n_training_days: number;
  forecast_horizon: number;
  data_source: string;
  data_source_detail: string;
  forecast_period: { start: string; end: string };
  kpis: {
    avg_daily_forecast: number;
    total_30d_forecast: number;
    peak_day: { date: string; value: number };
    trough_day: { date: string; value: number };
    trend_direction: string;
    trend_pct_change: number;
  };
  model_performance: Record<string, string | null>;
  metrics_parsed?: {
    // ← NOUVEAU : métriques déjà parsées
    MAE?: MetricValue;
    RMSE?: MetricValue;
    MAPE?: MetricValue;
    R2?: MetricValue;
  };
  hyperparameters: Record<string, unknown> | null;
  recommendations: string[];
}

export interface DataSourceInfo {
  source: string;
  smartshop_days: number;
  threshold: number;
  using_kaggle_fallback: boolean;
  migration_ready: boolean;
  message: string;
}

export interface ForecastHealth {
  forecast_loaded: boolean;
  load_error: string | null;
  model_type: string | null;
  version: string | null;
  trained_at: string | null;
  training_start: string | null;
  training_end: string | null;
  n_training_days: number | null;
  horizon_days: number | null;
  metrics: Record<string, string>;
  metrics_parsed: {
    MAE: MetricValue;
    RMSE: MetricValue;
    MAPE: MetricValue;
    R2: MetricValue;
  } | null;
  hyperparameters: Record<string, unknown> | null;
  data_source: DataSourceInfo;
}

// ── State ─────────────────────────────────────────────────────────────────────

interface ForecastState {
  predictions: ForecastPoint[];
  predictionsLoading: boolean;
  predictionsError: string | null;
  history: HistoryRecord[];
  historyLoading: boolean;
  historyError: string | null;
  components: ComponentPoint[];
  weeklyProfile: WeeklyProfile[];
  yearlyProfile: YearlyProfile[];
  componentsLoading: boolean;
  componentsError: string | null;
  metrics: ForecastMetrics | null;
  metricsLoading: boolean;
  metricsError: string | null;
  summary: ForecastSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  health: ForecastHealth | null;
  healthLoading: boolean;
  healthError: string | null;
  retrainStatus: "idle" | "running" | "done" | "error";
  retrainMessage: string | null;
  dataSource: DataSourceInfo | null;
  selectedHorizon: number;
  activeTab: "forecast" | "history" | "components" | "metrics";
  // ── SmartShop Live ──────────────────────────────────────────────────────────
  actuals: ActualsData | null;
  actualsLoading: boolean;
  actualsError: string | null;
  kpis: SmartShopKPIs | null;
  kpisLoading: boolean;
  kpisError: string | null;
}

const initialState: ForecastState = {
  predictions: [],
  predictionsLoading: false,
  predictionsError: null,
  history: [],
  historyLoading: false,
  historyError: null,
  components: [],
  weeklyProfile: [],
  yearlyProfile: [],
  componentsLoading: false,
  componentsError: null,
  metrics: null,
  metricsLoading: false,
  metricsError: null,
  summary: null,
  summaryLoading: false,
  summaryError: null,
  health: null,
  healthLoading: false,
  healthError: null,
  retrainStatus: "idle",
  retrainMessage: null,
  dataSource: null,
  selectedHorizon: 30,
  activeTab: "forecast",
  // SmartShop Live
  actuals: null,
  actualsLoading: false,
  actualsError: null,
  kpis: null,
  kpisLoading: false,
  kpisError: null,
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchForecastHealth = createAsyncThunk(
  "forecast/fetchHealth",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(`${ML_URL}/forecast/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ForecastHealth;
    } catch (e) {
      return rejectWithValue(`Service ML inaccessible: ${e}`);
    }
  },
);

export const fetchPredictions = createAsyncThunk(
  "forecast/fetchPredictions",
  async (horizon: number = 30, { rejectWithValue }) => {
    try {
      const res = await fetch(
        `${ML_URL}/forecast/predictions?horizon=${horizon}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as {
        predictions: ForecastPoint[];
        data_source: DataSourceInfo;
      };
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

export const fetchForecastHistory = createAsyncThunk(
  "forecast/fetchHistory",
  async (limitMonths: number = 24, { rejectWithValue }) => {
    try {
      const res = await fetch(
        `${ML_URL}/forecast/history?limit_months=${limitMonths}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).records as HistoryRecord[];
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

export const fetchForecastComponents = createAsyncThunk(
  "forecast/fetchComponents",
  async (nDays: number = 90, { rejectWithValue }) => {
    try {
      const res = await fetch(
        `${ML_URL}/forecast/components?last_n_days=${nDays}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

export const fetchForecastMetrics = createAsyncThunk(
  "forecast/fetchMetrics",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(`${ML_URL}/forecast/metrics`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ForecastMetrics;
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

export const fetchForecastSummary = createAsyncThunk(
  "forecast/fetchSummary",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(`${ML_URL}/forecast/summary`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ForecastSummary;
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

export const triggerRetrain = createAsyncThunk(
  "forecast/retrain",
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${ML_URL}/forecast/retrain`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

// ── Slice ─────────────────────────────────────────────────────────────────────

// ── Thunks SmartShop Live ─────────────────────────────────────────────────────

export const fetchActuals = createAsyncThunk(
  "forecast/fetchActuals",
  async (
    {
      days = 90,
      granularity = "daily",
    }: { days?: number; granularity?: string },
    { rejectWithValue },
  ) => {
    try {
      const res = await fetch(
        `${ML_URL}/forecast/actuals?days=${days}&granularity=${granularity}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ActualsData;
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

export const fetchKPIs = createAsyncThunk(
  "forecast/fetchKPIs",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(`${ML_URL}/forecast/kpis`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as SmartShopKPIs;
    } catch (e) {
      return rejectWithValue(String(e));
    }
  },
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const forecastSlice = createSlice({
  name: "forecast",
  initialState,
  reducers: {
    setSelectedHorizon(state, action: PayloadAction<number>) {
      state.selectedHorizon = action.payload;
    },
    setActiveTab(state, action: PayloadAction<ForecastState["activeTab"]>) {
      state.activeTab = action.payload;
    },
    clearRetrainStatus(state) {
      state.retrainStatus = "idle";
      state.retrainMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchForecastHealth.pending, (s) => {
        s.healthLoading = true;
        s.healthError = null;
      })
      .addCase(fetchForecastHealth.fulfilled, (s, a) => {
        s.healthLoading = false;
        s.health = a.payload;
        s.dataSource = a.payload.data_source;
      })
      .addCase(fetchForecastHealth.rejected, (s, a) => {
        s.healthLoading = false;
        s.healthError = String(a.payload);
      });

    builder
      .addCase(fetchPredictions.pending, (s) => {
        s.predictionsLoading = true;
        s.predictionsError = null;
      })
      .addCase(fetchPredictions.fulfilled, (s, a) => {
        s.predictionsLoading = false;
        s.predictions = a.payload.predictions;
        s.dataSource = a.payload.data_source;
      })
      .addCase(fetchPredictions.rejected, (s, a) => {
        s.predictionsLoading = false;
        s.predictionsError = String(a.payload);
      });

    builder
      .addCase(fetchForecastHistory.pending, (s) => {
        s.historyLoading = true;
      })
      .addCase(fetchForecastHistory.fulfilled, (s, a) => {
        s.historyLoading = false;
        s.history = a.payload;
      })
      .addCase(fetchForecastHistory.rejected, (s, a) => {
        s.historyLoading = false;
        s.historyError = String(a.payload);
      });

    builder
      .addCase(fetchForecastComponents.pending, (s) => {
        s.componentsLoading = true;
      })
      .addCase(fetchForecastComponents.fulfilled, (s, a) => {
        s.componentsLoading = false;
        s.components = a.payload.components;
        s.weeklyProfile = a.payload.weekly_profile;
        s.yearlyProfile = a.payload.yearly_profile;
      })
      .addCase(fetchForecastComponents.rejected, (s, a) => {
        s.componentsLoading = false;
        s.componentsError = String(a.payload);
      });

    builder
      .addCase(fetchForecastMetrics.pending, (s) => {
        s.metricsLoading = true;
      })
      .addCase(fetchForecastMetrics.fulfilled, (s, a) => {
        s.metricsLoading = false;
        s.metrics = a.payload;
      })
      .addCase(fetchForecastMetrics.rejected, (s, a) => {
        s.metricsLoading = false;
        s.metricsError = String(a.payload);
      });

    builder
      .addCase(fetchForecastSummary.pending, (s) => {
        s.summaryLoading = true;
      })
      .addCase(fetchForecastSummary.fulfilled, (s, a) => {
        s.summaryLoading = false;
        s.summary = a.payload;
      })
      .addCase(fetchForecastSummary.rejected, (s, a) => {
        s.summaryLoading = false;
        s.summaryError = String(a.payload);
      });

    builder
      .addCase(triggerRetrain.pending, (s) => {
        s.retrainStatus = "running";
      })
      .addCase(triggerRetrain.fulfilled, (s, a) => {
        s.retrainStatus = "done";
        s.retrainMessage = a.payload?.message ?? "✅ Ré-entraînement lancé.";
      })
      .addCase(triggerRetrain.rejected, (s, a) => {
        s.retrainStatus = "error";
        s.retrainMessage = `❌ ${String(a.payload)}`;
      })
      // ── Actuals SmartShop ──────────────────────────────────────────────────
      .addCase(fetchActuals.pending, (s) => {
        s.actualsLoading = true;
        s.actualsError = null;
      })
      .addCase(fetchActuals.fulfilled, (s, a) => {
        s.actualsLoading = false;
        s.actuals = a.payload;
      })
      .addCase(fetchActuals.rejected, (s, a) => {
        s.actualsLoading = false;
        s.actualsError = String(a.payload);
      })
      // ── KPIs SmartShop ─────────────────────────────────────────────────────
      .addCase(fetchKPIs.pending, (s) => {
        s.kpisLoading = true;
        s.kpisError = null;
      })
      .addCase(fetchKPIs.fulfilled, (s, a) => {
        s.kpisLoading = false;
        s.kpis = a.payload;
      })
      .addCase(fetchKPIs.rejected, (s, a) => {
        s.kpisLoading = false;
        s.kpisError = String(a.payload);
      });
  },
});

export const { setSelectedHorizon, setActiveTab, clearRetrainStatus } =
  forecastSlice.actions;
export default forecastSlice.reducer;

// ── Sélecteurs mémoïsés ───────────────────────────────────────────────────────

const sel = (s: AppState) => s.forecast;

export const selectPredictions = createSelector(sel, (s) => s.predictions);
export const selectPredLoading = createSelector(
  sel,
  (s) => s.predictionsLoading,
);
export const selectForecastHistory = createSelector(sel, (s) => s.history);
export const selectHistoryLoading = createSelector(
  sel,
  (s) => s.historyLoading,
);
export const selectComponents = createSelector(sel, (s) => s.components);
export const selectWeeklyProfile = createSelector(sel, (s) => s.weeklyProfile);
export const selectYearlyProfile = createSelector(sel, (s) => s.yearlyProfile);
export const selectForecastHealth = createSelector(sel, (s) => s.health);
export const selectDataSource = createSelector(sel, (s) => s.dataSource);
export const selectSelectedHorizon = createSelector(
  sel,
  (s) => s.selectedHorizon,
);
export const selectActiveTab = createSelector(sel, (s) => s.activeTab);
export const selectRetrainStatus = createSelector(sel, (s) => s.retrainStatus);
export const selectRetrainMessage = createSelector(
  sel,
  (s) => s.retrainMessage,
);

// Métriques : priorité /forecast/metrics, fallback /forecast/health.metrics_parsed
export const selectForecastMetrics = createSelector(sel, (s) => {
  if (s.metrics) return s.metrics;
  // Fallback depuis health.metrics_parsed
  const hp = s.health?.metrics_parsed;
  if (!hp) return null;
  return {
    MAE: hp.MAE,
    RMSE: hp.RMSE,
    MAPE: hp.MAPE,
    R2: hp.R2,
    model_type: s.health?.model_type ?? null,
    version: s.health?.version ?? null,
    trained_at: s.health?.trained_at ?? null,
    training_start: s.health?.training_start ?? null,
    training_end: s.health?.training_end ?? null,
    n_training_days: s.health?.n_training_days ?? null,
    hyperparameters: s.health?.hyperparameters ?? null,
  } as any;
});

export const selectForecastSummary = createSelector(sel, (s) => {
  if (!s.summary) return null;
  // Enrichir le summary avec metrics_parsed si model_performance contient des nulls
  const sum = { ...s.summary };
  if (
    sum.metrics_parsed &&
    (!sum.model_performance.MAE || sum.model_performance.MAE === "null")
  ) {
    const mp = sum.metrics_parsed;
    sum.model_performance = {
      MAE:
        mp.MAE?.value != null
          ? `${Math.round(mp.MAE.value).toLocaleString()} DT`
          : "N/A",
      RMSE:
        mp.RMSE?.value != null
          ? `${Math.round(mp.RMSE.value).toLocaleString()} DT`
          : "N/A",
      MAPE: mp.MAPE?.value != null ? `${mp.MAPE.value.toFixed(2)}%` : "N/A",
      R2: mp.R2?.value != null ? `${mp.R2.value.toFixed(4)}` : "N/A",
    };
  }
  return sum;
});

export const selectForecastKPIs = createSelector(selectPredictions, (preds) => {
  if (!preds.length) return null;
  const vals = preds.map((p) => p.prediction);
  const sum = vals.reduce((a, b) => a + b, 0);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const pi = vals.indexOf(max);
  const ti = vals.indexOf(min);
  const ts = preds[0].trend;
  const te = preds[preds.length - 1].trend;
  const tp = ((te - ts) / Math.max(Math.abs(ts), 1)) * 100;
  return {
    avg: Math.round(sum / vals.length),
    total: Math.round(sum),
    peak: { date: preds[pi].date, value: Math.round(max) },
    trough: { date: preds[ti].date, value: Math.round(min) },
    trendPct: Math.round(tp * 100) / 100,
    trendUp: tp >= 0,
  };
});

// ── Sélecteurs SmartShop Live ─────────────────────────────────────────────────
export const selectActuals = createSelector(sel, (s) => s.actuals);
export const selectActualsLoading = createSelector(
  sel,
  (s) => s.actualsLoading,
);
export const selectActualsError = createSelector(sel, (s) => s.actualsError);
export const selectKPIs = createSelector(sel, (s) => s.kpis);
export const selectKPIsLoading = createSelector(sel, (s) => s.kpisLoading);
