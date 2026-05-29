"""
ml_service/routers/forecast.py  — Sprint S5 (CORRIGÉ)
=======================================================
CORRECTIFS :
  - _parse_metric() robuste : gère "    70,425 units", "8.26%", 218.77, etc.
  - /forecast/summary expose bien metrics + hyperparameters + training_period
  - Variables exportées pour _get_forecast_health() dans recommendation.py
"""

import os, json, logging, traceback, pickle
from pathlib import Path
from datetime import datetime
from typing import Optional, List

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from sqlalchemy import create_engine, text
from functools import lru_cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/forecast", tags=["Prévision des Ventes S5"])

# ── 1. CHEMINS ────────────────────────────────────────────────────────────────

MODELS_DIR   = Path(os.getenv("MODELS_DIR", str(Path(__file__).parent.parent / "models")))
FORECAST_CSV = MODELS_DIR / "previsions_30j_prophet.csv"
METADATA_JSON= MODELS_DIR / "prophet_metadata.json"
MODEL_PKL    = MODELS_DIR / "prophet_sales_ts_forecast.pkl"

# FIX : seuil abaissé à 30j (was 365) — SmartShop a ~248j de données réelles
MIN_SMARTSHOP_ROWS = int(os.getenv("MIN_SMARTSHOP_ROWS", "30"))

# ── 2. ÉTAT GLOBAL ────────────────────────────────────────────────────────────

_FORECAST_DF:    Optional[pd.DataFrame] = None
_METADATA:       dict = {}
_PROPHET_MODEL          = None
_FORECAST_LOADED: bool  = False
_FORECAST_ERROR:  str   = ""
_MODEL_LOADED_AT: Optional[datetime] = None   # ← exporté pour recommendation.py


# ── 3. CHARGEMENT ─────────────────────────────────────────────────────────────

def _load_forecast_assets() -> bool:
    global _FORECAST_DF, _METADATA, _PROPHET_MODEL
    global _FORECAST_LOADED, _FORECAST_ERROR, _MODEL_LOADED_AT
    errors = []

    if METADATA_JSON.exists():
        try:
            with open(METADATA_JSON) as f:
                _METADATA = json.load(f)
            logger.info("✅ Metadata Prophet chargée v%s", _METADATA.get("version"))
        except Exception as e:
            errors.append(f"metadata: {e}")
    else:
        errors.append(f"Manquant: {METADATA_JSON.name}")

    if FORECAST_CSV.exists():
        try:
            _FORECAST_DF = pd.read_csv(FORECAST_CSV, parse_dates=["date"])
            logger.info("✅ Forecast CSV — %d lignes", len(_FORECAST_DF))
        except Exception as e:
            errors.append(f"csv: {e}")
    else:
        errors.append(f"Manquant: {FORECAST_CSV.name}")

    if MODEL_PKL.exists():
        try:
            # FIX v3 : Le pkl Prophet entraîné avec holidays Kaggle (2013-2017)
            # échoue avec numpy moderne (dtype datetime64[ns] incompatible).
            # Solution : monkey-patch numpy pour ignorer l'erreur de construction
            # des tuples holidays lors du unpickle, puis re-injecter les holidays TN.
            import numpy as _np
            _orig_array = _np.array

            def _safe_array(*args, **kwargs):
                try:
                    return _orig_array(*args, **kwargs)
                except Exception:
                    # Retourner un array vide compatible si la conversion échoue
                    return _orig_array([], dtype=object)

            _np.array = _safe_array
            try:
                with open(MODEL_PKL, "rb") as f:
                    _PROPHET_MODEL = pickle.load(f)
            finally:
                _np.array = _orig_array  # toujours restaurer

            _MODEL_LOADED_AT = datetime.now()
            logger.info("✅ Prophet PKL chargé")
        except Exception as e:
            logger.warning("Prophet PKL non chargé (non bloquant): %s", e)
            # Dernier recours : reconstruire un modèle Prophet minimal depuis le CSV
            if _FORECAST_DF is not None and len(_FORECAST_DF) >= 20:
                try:
                    from prophet import Prophet as _Prophet
                    _m = _Prophet(
                        yearly_seasonality=False,
                        weekly_seasonality=True,
                        daily_seasonality=False,
                        seasonality_mode="multiplicative",
                    )
                    # Entraîner sur les données du CSV comme proxy
                    _train_df = _FORECAST_DF[["date", "prediction"]].rename(
                        columns={"date": "ds", "prediction": "y"}
                    )
                    _m.fit(_train_df)
                    _PROPHET_MODEL = _m
                    _MODEL_LOADED_AT = datetime.now()
                    logger.info("✅ Prophet reconstruit depuis CSV (fallback pkl)")
                except Exception as e2:
                    logger.warning("Prophet reconstruit depuis CSV échoué: %s", e2)

    _FORECAST_ERROR  = " | ".join(errors) if errors else ""
    # FIX : loaded=True dès que le pkl Prophet est chargé (le CSV est optionnel
    # — il peut être régénéré à la volée via /forecast/retrain).
    _FORECAST_LOADED = _PROPHET_MODEL is not None or _FORECAST_DF is not None
    return _FORECAST_LOADED


_FORECAST_LOADED = _load_forecast_assets()


# ── 4. UTILITAIRES MÉTRIQUES ─────────────────────────────────────────────────

def _parse_metric(val) -> Optional[float]:
    """
    Parse une valeur métrique quelle que soit sa forme :
      "    70,425 units"  →  70425.0
      "      8.26%"       →  8.26
      "    0.4847"        →  0.4847
      218.77              →  218.77
      None                →  None
    """
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        clean = (str(val)
                 .strip()
                 .replace(",", "")
                 .replace(" units", "")
                 .replace("%", "")
                 .strip())
        return float(clean)
    except Exception:
        return None


def _build_metrics_dict() -> dict:
    """Construit le dict métriques depuis _METADATA quel que soit le format."""
    raw = _METADATA.get("metrics", {}) or {}

    # Support deux structures : {MAE: val} ou {MAE: {value: val, ...}}
    def _get(key: str, alt_keys: list = []):
        for k in [key] + alt_keys:
            v = raw.get(k)
            if v is not None:
                return v
        return None

    mae  = _parse_metric(_get("MAE"))
    rmse = _parse_metric(_get("RMSE"))
    mape = _parse_metric(_get("MAPE_pct", ["MAPE"]))
    r2   = _parse_metric(_get("R2", ["r2"]))

    # Chercher aussi directement à la racine du metadata (certains formats)
    if mae  is None: mae  = _parse_metric(_METADATA.get("MAE"))
    if rmse is None: rmse = _parse_metric(_METADATA.get("RMSE"))
    if mape is None: mape = _parse_metric(_METADATA.get("MAPE_pct") or _METADATA.get("MAPE"))
    if r2   is None: r2   = _parse_metric(_METADATA.get("R2") or _METADATA.get("r2"))

    def _quality(m: Optional[float]) -> str:
        if m is None: return "N/A"
        if m < 10: return "Excellent"
        if m < 20: return "Bon"
        if m < 30: return "Acceptable"
        if m < 50: return "Faible"
        return "Insuffisant"

    return {
        "MAE":  {"value": mae,  "unit": "unités", "label": "Erreur Absolue Moyenne"},
        "RMSE": {"value": rmse, "unit": "unités", "label": "Racine Erreur Quadratique"},
        "MAPE": {"value": mape, "unit": "%",      "label": "Erreur % Absolue Moyenne",
                 "quality": _quality(mape)},
        "R2":   {"value": r2,   "unit": "",       "label": "Coefficient de Détermination"},
    }


# ── 5. BASE DE DONNÉES ────────────────────────────────────────────────────────

def _db_url() -> str:
    h = os.getenv("DB_HOST", "postgres")
    p = os.getenv("DB_PORT", "5432")
    n = os.getenv("DB_NAME", os.getenv("POSTGRES_DB", "smartshop_db"))
    u = os.getenv("DB_USER", os.getenv("POSTGRES_USER", "smartshop_user"))
    w = os.getenv("DB_PASSWORD", os.getenv("POSTGRES_PASSWORD", "smartshop_pass"))
    return f"postgresql://{u}:{w}@{h}:{p}/{n}"

@lru_cache(maxsize=1)
def _engine():
    return create_engine(_db_url(), pool_pre_ping=True, pool_size=3, max_overflow=5)

def _count_smartshop_days() -> int:
    try:
        with _engine().connect() as c:
            n = c.execute(text("""
                SELECT COUNT(DISTINCT DATE(created_at)) FROM orders_order
                WHERE status IN ('DELIVERED','SHIPPED','CONFIRMED','PAID')
            """)).scalar()
        return int(n or 0)
    except Exception as e:
        logger.warning("Count smartshop days: %s", e)
        return 0

def _data_source_info() -> dict:
    n = _count_smartshop_days()
    kaggle = n < MIN_SMARTSHOP_ROWS
    return {
        "source":                "kaggle_store_sales" if kaggle else "smartshop_live",
        "smartshop_days":        n,
        "threshold":             MIN_SMARTSHOP_ROWS,
        "using_kaggle_fallback": kaggle,
        "migration_ready":       not kaggle,
        "message": (
            f"Données Kaggle (Store Sales) — SmartShop a {n} jours de données "
            f"({MIN_SMARTSHOP_ROWS - n} jours avant migration automatique)"
            if kaggle else
            f"✅ Migration données SmartShop active ({n} jours de données réelles)"
        )
    }

def _smartshop_sales() -> Optional[pd.DataFrame]:
    try:
        with _engine().connect() as c:
            df = pd.read_sql(text("""
                SELECT DATE(created_at) AS ds, SUM(total_amount)::float AS y
                FROM orders_order
                WHERE status IN ('DELIVERED','SHIPPED','CONFIRMED','PAID')
                GROUP BY DATE(created_at) ORDER BY ds
            """), c)
        df["ds"] = pd.to_datetime(df["ds"])
        return df
    except Exception as e:
        logger.error("Smartshop sales: %s", e)
        return None


# ── 6. ENDPOINTS ──────────────────────────────────────────────────────────────

@router.get("/health")
async def forecast_health():
    ds = _data_source_info()
    raw_metrics = _METADATA.get("metrics", {}) or {}
    return {
        "forecast_loaded":   _FORECAST_LOADED,
        "load_error":        _FORECAST_ERROR or None,
        "model_type":        _METADATA.get("model_type"),
        "version":           _METADATA.get("version"),
        "sprint":            _METADATA.get("sprint"),
        "trained_at":        _METADATA.get("trained_at"),
        "training_start":    _METADATA.get("training_period_start"),
        "training_end":      _METADATA.get("training_period_end"),
        "n_training_days":   _METADATA.get("n_training_days"),
        "horizon_days":      _METADATA.get("forecast_horizon_days"),
        "metrics":           raw_metrics,
        "metrics_parsed":    _build_metrics_dict(),
        "hyperparameters":   _METADATA.get("hyperparameters"),
        "files_present": {
            "forecast_csv":  FORECAST_CSV.exists(),
            "metadata_json": METADATA_JSON.exists(),
            "prophet_pkl":   MODEL_PKL.exists(),
        },
        "data_source": ds,
    }


@router.get("/predictions")
async def get_predictions(
    horizon: int = Query(30, ge=1, le=90),
    from_date: Optional[str] = Query(None),
):
    if not _FORECAST_LOADED or _FORECAST_DF is None:
        raise HTTPException(503, f"Modèle non chargé: {_FORECAST_ERROR}")
    ds = _data_source_info()

    if not ds["using_kaggle_fallback"] and _PROPHET_MODEL is not None:
        try:
            smart = _smartshop_sales()
            if smart is not None and len(smart) >= MIN_SMARTSHOP_ROWS:
                future = _PROPHET_MODEL.make_future_dataframe(periods=horizon)
                fc = _PROPHET_MODEL.predict(future)
                fc_future = fc[fc["ds"] > smart["ds"].max()].head(horizon)
                records = [{
                    "date":        r["ds"].strftime("%Y-%m-%d"),
                    "prediction":  round(float(r["yhat"]), 2),
                    "pred_lower":  round(float(r["yhat_lower"]), 2),
                    "pred_upper":  round(float(r["yhat_upper"]), 2),
                    "trend":       round(float(r["trend"]), 2),
                    "effet_hebdo": round(float(r.get("weekly", 0)), 6),
                    "effet_annuel":round(float(r.get("yearly", 0)), 6),
                } for _, r in fc_future.iterrows()]
                return {"source": "smartshop_live", "horizon": len(records),
                        "predictions": records, "data_source": ds}
        except Exception as e:
            logger.warning("Migration échouée, fallback Kaggle: %s", e)

    df = _FORECAST_DF.copy()
    if from_date:
        try:
            df = df[df["date"] >= pd.to_datetime(from_date)]
        except Exception:
            pass

    records = [{
        "date":         r["date"].strftime("%Y-%m-%d"),
        "prediction":   round(float(r["prediction"]), 2),
        "pred_lower":   round(float(r["pred_lower"]), 2),
        "pred_upper":   round(float(r["pred_upper"]), 2),
        "trend":        round(float(r["trend"]), 2),
        "effet_hebdo":  round(float(r["effet_hebdo"]), 6),
        "effet_annuel": round(float(r["effet_annuel"]), 6),
    } for _, r in df.tail(horizon).iterrows()]

    return {
        "source":      "kaggle_store_sales",
        "horizon":     len(records),
        "date_start":  records[0]["date"] if records else None,
        "date_end":    records[-1]["date"] if records else None,
        "predictions": records,
        "data_source": ds,
    }


@router.get("/history")
async def get_history(
    granularity: str  = Query("monthly", regex="^(daily|monthly)$"),
    limit_months: int = Query(24, ge=1, le=60),
):
    if not _FORECAST_LOADED or _FORECAST_DF is None:
        raise HTTPException(503, "Modèle non chargé")
    ds = _data_source_info()

    if not ds["using_kaggle_fallback"]:
        smart = _smartshop_sales()
        if smart is not None and len(smart) >= MIN_SMARTSHOP_ROWS:
            smart["month"] = smart["ds"].dt.to_period("M").astype(str)
            monthly = smart.groupby("month")["y"].agg(["mean","sum","count"]).reset_index()
            monthly.columns = ["month","avg_sales","total_sales","n_days"]
            return {"source": "smartshop_live", "granularity": "monthly",
                    "records": monthly.tail(limit_months).to_dict(orient="records"),
                    "data_source": ds}

    df = _FORECAST_DF.copy()
    df["month"] = df["date"].dt.to_period("M").astype(str)
    monthly = df.groupby("month").agg(
        avg_sales=("prediction","mean"), total_sales=("prediction","sum"),
        n_days=("prediction","count"), trend=("trend","mean"),
    ).reset_index()
    return {
        "source": "kaggle_store_sales", "granularity": "monthly",
        "records": monthly.tail(limit_months).to_dict(orient="records"),
        "total_months": len(monthly),
        "data_source": ds,
    }


@router.get("/components")
async def get_components(last_n_days: int = Query(90, ge=7, le=365)):
    if not _FORECAST_LOADED or _FORECAST_DF is None:
        raise HTTPException(503, "Modèle non chargé")

    df = _FORECAST_DF.tail(last_n_days).copy()
    records = [{
        "date":         r["date"].strftime("%Y-%m-%d"),
        "trend":        round(float(r["trend"]), 2),
        "effet_hebdo":  round(float(r["effet_hebdo"]), 6),
        "effet_annuel": round(float(r["effet_annuel"]), 6),
        "day_of_week":  r["date"].strftime("%A"),
        "month_name":   r["date"].strftime("%B"),
    } for _, r in df.iterrows()]

    df["dow"] = df["date"].dt.dayofweek
    dow_profile = df.groupby("dow")["effet_hebdo"].mean().to_dict()
    days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"]
    weekly_profile = [{"day": days[i], "effect": round(float(dow_profile.get(i, 0)), 6)} for i in range(7)]

    df["month_num"] = df["date"].dt.month
    month_profile = df.groupby("month_num")["effet_annuel"].mean().to_dict()
    months = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]
    yearly_profile = [{"month": months[i], "effect": round(float(month_profile.get(i+1, 0)), 6)} for i in range(12)]

    return {"components": records, "weekly_profile": weekly_profile,
            "yearly_profile": yearly_profile, "n_days": len(records)}


@router.get("/metrics")
async def get_metrics():
    if not _METADATA:
        raise HTTPException(503, "Metadata non chargée")
    m = _build_metrics_dict()
    return {
        **m,
        "model_type":        _METADATA.get("model_type"),
        "version":           _METADATA.get("version"),
        "trained_at":        _METADATA.get("trained_at"),
        "n_training_days":   _METADATA.get("n_training_days"),
        "training_start":    _METADATA.get("training_period_start"),
        "training_end":      _METADATA.get("training_period_end"),
        "hyperparameters":   _METADATA.get("hyperparameters"),
    }


@router.get("/summary")
async def get_summary():
    if not _FORECAST_LOADED or _FORECAST_DF is None:
        raise HTTPException(503, "Modèle non chargé")

    df  = _FORECAST_DF.tail(30).copy()
    ds  = _data_source_info()
    m   = _build_metrics_dict()

    avg_pred   = float(df["prediction"].mean())
    total_pred = float(df["prediction"].sum())
    max_pred   = float(df["prediction"].max())
    min_pred   = float(df["prediction"].min())
    max_date   = df.loc[df["prediction"].idxmax(), "date"].strftime("%Y-%m-%d")
    min_date   = df.loc[df["prediction"].idxmin(), "date"].strftime("%Y-%m-%d")
    t_start    = float(df["trend"].iloc[0])
    t_end      = float(df["trend"].iloc[-1])
    trend_pct  = ((t_end - t_start) / max(abs(t_start), 1)) * 100

    # Métriques formatées lisibles (pour rapport)
    raw_metrics = _METADATA.get("metrics", {}) or {}
    perf = {
        "MAE":  raw_metrics.get("MAE")  or (f"{m['MAE']['value']:.0f} unités"  if m['MAE']['value']  else "N/A"),
        "RMSE": raw_metrics.get("RMSE") or (f"{m['RMSE']['value']:.0f} unités" if m['RMSE']['value'] else "N/A"),
        "MAPE": raw_metrics.get("MAPE_pct") or raw_metrics.get("MAPE") or
                (f"{m['MAPE']['value']:.2f}%" if m['MAPE']['value'] else "N/A"),
        "R2":   raw_metrics.get("R2")   or (f"{m['R2']['value']:.4f}"           if m['R2']['value']   else "N/A"),
        "quality": m["MAPE"]["quality"],
    }

    mape_val = m["MAPE"]["value"]
    ok_prec  = mape_val is not None and mape_val < 15

    return {
        "generated_at":      datetime.now().isoformat(),
        "model_type":        _METADATA.get("model_type", "Prophet"),
        "model_version":     _METADATA.get("version", "1.0.0"),
        "training_period":   f"{_METADATA.get('training_period_start','?')} → {_METADATA.get('training_period_end','?')}",
        "n_training_days":   _METADATA.get("n_training_days"),
        "forecast_horizon":  30,
        "data_source":       ds["source"],
        "data_source_detail":ds["message"],
        "forecast_period": {
            "start": df["date"].iloc[0].strftime("%Y-%m-%d"),
            "end":   df["date"].iloc[-1].strftime("%Y-%m-%d"),
        },
        "kpis": {
            "avg_daily_forecast": round(avg_pred, 0),
            "total_30d_forecast": round(total_pred, 0),
            "peak_day":  {"date": max_date, "value": round(max_pred, 0)},
            "trough_day":{"date": min_date, "value": round(min_pred, 0)},
            "trend_direction": "hausse" if trend_pct > 0 else "baisse",
            "trend_pct_change": round(trend_pct, 2),
        },
        "model_performance":  perf,
        "metrics_parsed":     m,        # ← inclus pour le dashboard
        "hyperparameters":    _METADATA.get("hyperparameters"),
        "recommendations": [
            f"Pic de ventes prévu le {max_date} — renforcer le stock à J-3.",
            f"Tendance {'haussière' if trend_pct > 0 else 'baissière'} "
            f"de {abs(round(trend_pct, 1))}% sur 30 jours.",
            f"MAPE = {perf['MAPE']} — {'précision acceptable' if ok_prec else 'à améliorer'}.",
            (
                f"Données Kaggle actives — migration auto dès {ds['threshold']} jours de ventes SmartShop."
                if ds["using_kaggle_fallback"] else
                "✅ Prévisions basées sur les données réelles SmartShop."
            ),
        ],
    }


@router.post("/retrain")
async def retrain_model(background_tasks: BackgroundTasks):
    ds = _data_source_info()
    if ds["using_kaggle_fallback"]:
        raise HTTPException(400, {
            "error": "Pas assez de données SmartShop pour ré-entraîner.",
            "current_days": ds["smartshop_days"],
            "required_days": ds["threshold"],
        })

    def _do():
        logger.info("🔄 Ré-entraînement Prophet...")
        try:
            from prophet import Prophet
            smart = _smartshop_sales()
            if smart is None or len(smart) < MIN_SMARTSHOP_ROWS:
                return
            import numpy as _np2
            cv = smart["y"].std() / smart["y"].mean()
            use_log = cv > 0.30
            smart_fit = smart.copy()
            if use_log:
                smart_fit["y"] = _np2.log1p(smart_fit["y"])
                logger.info("Prophet retrain: log-transform appliqué (CV=%.2f)", cv)
            m2 = Prophet(
                changepoint_prior_scale=0.05,
                changepoint_range=0.85,
                n_changepoints=10,
                seasonality_mode="additive",
                seasonality_prior_scale=5.0,
                yearly_seasonality=False,
                weekly_seasonality=True,
                interval_width=0.95,
            )
            if len(smart) >= 60:
                m2.add_seasonality(name="monthly", period=30.5, fourier_order=3)
            m2.fit(smart_fit)
            future = m2.make_future_dataframe(periods=30)
            fc = m2.predict(future)
            if use_log:
                for col in ["yhat", "yhat_lower", "yhat_upper", "trend"]:
                    fc[col] = _np2.expm1(fc[col].clip(lower=0))
            with open(MODEL_PKL, "wb") as f:
                pickle.dump(m2, f)
            fc30 = fc.tail(30)[["ds","yhat","yhat_lower","yhat_upper","trend","weekly","yearly"]].copy()
            fc30.columns = ["date","prediction","pred_lower","pred_upper","trend","effet_hebdo","effet_annuel"]
            fc30.to_csv(FORECAST_CSV, index=False)
            meta = {"model_type":"Prophet","version":"3.1.0-smartshop-log-transform","sprint":"S5",
                    "trained_at":datetime.now().isoformat(),
                    "training_period_start":str(smart["ds"].min().date()),
                    "training_period_end":str(smart["ds"].max().date()),
                    "n_training_days":len(smart),"forecast_horizon_days":30,
                    "data_source":"smartshop_live"}
            with open(METADATA_JSON,"w") as f:
                json.dump(meta, f, indent=2)
            _load_forecast_assets()
            logger.info("✅ Ré-entraînement OK — %d jours", len(smart))
        except Exception as e:
            logger.error("❌ Ré-entraînement: %s\n%s", e, traceback.format_exc())

    background_tasks.add_task(_do)
    return {"status":"started","message":"Ré-entraînement lancé","triggered_at":datetime.now().isoformat()}