"""
ml_service/routers/recommendation.py
=====================================
Sprint S3 — Recommandation Personnalisée (SVD + NCF + Hybrid)

FIX Sprint S4 :
  /ml/health unifié → inclut maintenant les modèles S3 ET S4.
  Importation de l'état de segmentation via import différé pour
  éviter les imports circulaires.

Endpoints :
  GET  /ml/health         diagnostic unifié S3 + S4
  GET  /ml/stats          métriques RecSys pour le dashboard
  GET  /ml/trending       tendances publiques
  POST /ml/recommend      personnalisé (auth)
  POST /ml/similar-products
  POST /ml/bought-together
  GET  /ml/products-index
"""
import os, logging, traceback
from pathlib import Path
from typing import Optional
from functools import lru_cache

import numpy as np, pandas as pd, joblib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text

logger = logging.getLogger(__name__)

# ── 1. MODÈLES Sprint 3 ───────────────────────────────────────────────────────
MODELS_DIR = Path(os.getenv("MODELS_DIR",
    str(Path(__file__).parent.parent / "models")))

_SVD = _NCF = _COSINE = _PARAMS = _LE_U = _LE_P = _PRODS = None
_LOADED = False
_LOAD_ERROR: str = ""
R_MIN, R_MAX = 1, 5

REQUIRED = [
    "svd_model.pkl", "ncf_model.keras", "cosine_similarity_v2.pkl",
    "hybrid_params.pkl", "encoder_user.pkl", "encoder_product.pkl",
    "products.parquet",
]

# Métadonnées des métriques réelles (générées par le notebook)
_REC_META: dict = {}

# Modèles Sprint 4 (vérification présence uniquement, chargement dans segmentation.py)
REQUIRED_SEG = [
    "kmeans_rfm.pkl",
    "rfm_scaler.pkl",
    "rfm_meta.pkl",
    "rfm_cluster_stats.pkl",
]


def _try_load_keras(path: str):
    """Essaie tensorflow, puis tf_keras, puis keras standalone."""
    errors = []
    for name, loader in [
        ("tensorflow", lambda p: __import__("tensorflow").keras.models.load_model(p)),
        ("tf_keras",   lambda p: __import__("tf_keras").models.load_model(p)),
        ("keras",      lambda p: __import__("keras").models.load_model(p)),
    ]:
        try:
            model = loader(path)
            logger.info("NCF chargé via %s", name)
            return model
        except Exception as e:
            errors.append(f"{name}: {e}")
            logger.warning("Loader %s échoué: %s", name, e)
    raise RuntimeError(
        "Impossible de charger ncf_model.keras.\n"
        + "\n".join(errors)
        + "\n→ Ajoutez 'tensorflow==2.15.0' dans requirements.txt et rebuilder l'image."
    )


def _load():
    global _SVD, _NCF, _COSINE, _PARAMS, _LE_U, _LE_P, _PRODS, _LOADED, _LOAD_ERROR
    missing = [f for f in REQUIRED if not (MODELS_DIR / f).exists()]
    if missing:
        _LOAD_ERROR = f"Fichiers manquants dans {MODELS_DIR}: {missing}"
        logger.error("models_loaded=false — %s", _LOAD_ERROR)
        return False
    try:
        logger.info("Chargement models depuis %s", MODELS_DIR)
        _SVD    = joblib.load(MODELS_DIR / "svd_model.pkl")
        _COSINE = joblib.load(MODELS_DIR / "cosine_similarity_v2.pkl")
        _PARAMS = joblib.load(MODELS_DIR / "hybrid_params.pkl")
        _LE_U   = joblib.load(MODELS_DIR / "encoder_user.pkl")
        _LE_P   = joblib.load(MODELS_DIR / "encoder_product.pkl")
        _PRODS  = pd.read_parquet(MODELS_DIR / "products.parquet")
        logger.info("SKLearn/Surprise OK — chargement Keras NCF...")
        _NCF    = _try_load_keras(str(MODELS_DIR / "ncf_model.keras"))
        # Charger les métadonnées réelles si disponibles
        meta_path = MODELS_DIR / "rec_metadata.json"
        if meta_path.exists():
            import json as _json
            with open(meta_path) as _f:
                _REC_META.update(_json.load(_f))
            logger.info("rec_metadata.json chargée — version %s", _REC_META.get("version"))
        _LOADED = True
        logger.info("Tous les modeles charges. params=%s", _PARAMS)
        return True
    except Exception as e:
        _LOAD_ERROR = str(e) + "\n" + traceback.format_exc()
        logger.error("Erreur chargement:\n%s", _LOAD_ERROR)
        return False


_LOADED = _load()

# ── 2. BASE DE DONNÉES ────────────────────────────────────────────────────────
def _build_db_url() -> str:
    """
    Construit l'URL PostgreSQL en forçant TCP (host:port explicite)
    pour éviter les connexions socket Unix (@postgres/.s.PGSQL.5432).
    """
    host = os.getenv("DB_HOST", "postgres")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", os.getenv("POSTGRES_DB", "smartshop_db"))
    user = os.getenv("DB_USER", os.getenv("POSTGRES_USER", "smartshop_user"))
    pwd  = os.getenv("DB_PASSWORD", os.getenv("POSTGRES_PASSWORD", "smartshop_pass"))
    # Toujours reconstruire en TCP — ne jamais utiliser DATABASE_URL brute
    # car elle peut référencer un socket Unix (/var/run/postgresql)
    return f"postgresql://{user}:{pwd}@{host}:{port}/{name}"

DB_URL = _build_db_url()

@lru_cache(maxsize=1)
def _eng():
    return create_engine(DB_URL, pool_pre_ping=True, pool_size=5)

def _interactions() -> pd.DataFrame:
    try:
        q = text("""
            SELECT o.user_id::text AS "UserId",
                   oi.product_id::text AS "ProductId",
                   CASE WHEN SUM(oi.quantity)>=2 THEN 5 ELSE 4 END AS "Rating"
            FROM orders_orderitem oi JOIN orders_order o ON o.id=oi.order_id
            WHERE o.status IN ('DELIVERED','SHIPPED','CONFIRMED')
            GROUP BY o.user_id, oi.product_id""")
        with _eng().connect() as c:
            return pd.read_sql(q, c)
    except Exception as e:
        logger.warning("DB interactions error: %s", e)
        return pd.DataFrame(columns=["UserId","ProductId","Rating"])

def _db_stats() -> dict:
    try:
        with _eng().connect() as c:
            n_orders = c.execute(text("SELECT COUNT(*) FROM orders_order")).scalar()
            n_users  = c.execute(text("SELECT COUNT(*) FROM users_user")).scalar()
            n_prods  = c.execute(text("SELECT COUNT(*) FROM products_product")).scalar()
        return {"n_orders": n_orders, "n_users": n_users, "n_products_db": n_prods}
    except Exception as e:
        logger.warning("DB stats error: %s", e)
        return {}

# ── 3. ROUTER ─────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/ml", tags=["Recommandation"])


# ── Sprint 5 : helper pour inclure ForeSys dans /ml/health ──────────────────
def _get_forecast_health() -> dict:
    try:
        from routers.forecast import MODEL_PKL, METADATA_JSON, _PROPHET_MODEL, _MODEL_LOADED_AT
        import json as _json
        metrics = {}
        if METADATA_JSON.exists():
            with open(METADATA_JSON) as f:
                metrics = _json.load(f)
        return {
            "loaded": _PROPHET_MODEL is not None,
            "model_path": str(MODEL_PKL),
            "model_exists": MODEL_PKL.exists(),
            "metrics": metrics,
            "loaded_at": _MODEL_LOADED_AT.isoformat() if _MODEL_LOADED_AT else None,
        }
    except Exception as e:
        return {"loaded": False, "load_error": str(e)}


# ── /ml/health — UNIFIÉ Sprint 3 + Sprint 4 ──────────────────────────────────
@router.get("/health")
async def health():
    """
    Diagnostic unifié de l'état de tous les modèles ML.

    Retourne :
    - rec_sys  : état des modèles Sprint 3 (SVD, NCF, Cosine...)
    - seg_sys  : état des modèles Sprint 4 (K-Means RFM)
    - files    : présence de TOUS les fichiers .pkl/.keras dans models/
    """
    # ── Sprint 3 : état du RecSys ─────────────────────────────────────────────
    rec_files = {f: (MODELS_DIR / f).exists() for f in REQUIRED}

    # ── Sprint 4 : import différé pour éviter import circulaire ──────────────
    seg_loaded = False
    seg_files  = {}
    seg_meta   = {}
    seg_error  = None
    try:
        from routers.segmentation import (
            _SEG_LOADED as _sl,
            _META       as _sm,
            REQUIRED_SEG as _sr,
        )
        seg_loaded = _sl
        seg_files  = {f: (MODELS_DIR / f).exists() for f in _sr}
        if _sm:
            seg_meta = {
                "model_version": _sm.get("model_version"),
                "k":             _sm.get("k"),
                "silhouette":    _sm.get("silhouette"),
                "trained_at":    _sm.get("trained_at"),
                "n_train":       _sm.get("n_train_samples"),
            }
    except Exception as e:
        seg_error = str(e)

    return {
        # ── Résumé global ─────────────────────────────────────────────────────
        "status":          "ok" if (_LOADED and seg_loaded) else
                           "partial" if (_LOADED or seg_loaded) else "error",
        "models_dir":      str(MODELS_DIR),
        "db_url_host":     DB_URL.split("@")[-1] if "@" in DB_URL else "unknown",

        # ── Sprint 3 : RecSys ─────────────────────────────────────────────────
        "rec_sys": {
            "loaded":        _LOADED,
            "load_error":    _LOAD_ERROR if not _LOADED else None,
            "hybrid_params": _PARAMS,
            "version":       _REC_META.get("version"),
            "n_users":       _REC_META.get("n_users"),
            "n_products":    _REC_META.get("n_products"),
            "trained_at":    _REC_META.get("trained_at"),
            "metrics":       _REC_META.get("metrics"),
            "files":         rec_files,
        },

        # ── Sprint 4 : SegSys ─────────────────────────────────────────────────
        "seg_sys": {
            "loaded":       seg_loaded,
            "load_error":   seg_error,
            "model_meta":   seg_meta,
            "files":        seg_files,
        },

        # ── Sprint 5 : ForeSys (Prophet) ──────────────────────────────────────
        "forecast_sys": _get_forecast_health(),
    }


@router.get("/stats")
async def stats():
    """Métriques pour le dashboard AnalyticDashboard."""
    if not _LOADED:
        raise HTTPException(503, f"Modèles non chargés — voir /ml/health")
    n_prods  = len(_PRODS) if _PRODS is not None else 0
    n_users  = len(_LE_U.classes_) if _LE_U is not None else 0
    n_pitems = len(_LE_P.classes_) if _LE_P is not None else 0
    db = _db_stats()
    # Utiliser les vraies métriques du notebook si disponibles
    _m = _REC_META.get("metrics", {})
    metrics_out = {
        "svd":    _m.get("svd",    {"rmse": 0.7116, "mae": 0.4637}),
        "ncf":    _m.get("ncf",    {"rmse": 0.7475, "mae": 0.3792}),
        "hybrid": _m.get("hybrid", {"rmse": 0.5820}),
        "cb":     {"precision_10": 0.781, "coverage": 0.921},
        "_source": "rec_metadata.json" if _m else "fallback_hardcoded",
        "_version": _REC_META.get("version", "unknown"),
    }
    return {
        "metrics": metrics_out,
        "hybrid_params": _PARAMS,
        "catalog": {
            "n_products_kaggle":   n_prods,
            "n_users_encoded":     n_users,
            "n_products_encoded":  n_pitems,
            "cosine_matrix_shape": list(_COSINE.shape) if _COSINE is not None else [],
        },
        "real_db": db,
        "categories": (
            _PRODS["category"].value_counts().head(10).to_dict()
            if _PRODS is not None and "category" in _PRODS.columns else {}
        ),
    }


@router.get("/trending")
async def trending(n: int = 12):
    """Top N produits tendance (public, sans auth)."""
    if not _LOADED:
        raise HTTPException(503, "Modèles non chargés")
    try:
        df = _interactions()
        if df.empty:
            raise ValueError("No interactions")
        top = df.groupby("ProductId")["Rating"].count().nlargest(n).index.tolist()
        prods = _PRODS[_PRODS["product_id"].astype(str).isin(top)] if _PRODS is not None else pd.DataFrame()
        return {"trending": prods.to_dict(orient="records") if not prods.empty else top}
    except Exception as e:
        logger.warning("trending fallback: %s", e)
        if _PRODS is not None:
            return {"trending": _PRODS.head(n).to_dict(orient="records")}
        return {"trending": []}


class RecommendRequest(BaseModel):
    user_id: str
    n: int = Field(default=10, ge=1, le=50)
    exclude_purchased: bool = True


@router.post("/recommend")
async def recommend(req: RecommendRequest):
    """Recommandations personnalisées hybrides (SVD + NCF)."""
    if not _LOADED:
        raise HTTPException(503, f"Modèles non chargés — voir /ml/health")

    user_id = str(req.user_id)
    if user_id not in _LE_U.classes_:
        # Cold-start : retour aux tendances
        return await trending(n=req.n)

    uid_enc = _LE_U.transform([user_id])[0]
    df      = _interactions()
    purchased = set(df[df["UserId"] == user_id]["ProductId"].astype(str)) if req.exclude_purchased else set()

    all_pids = _LE_P.classes_
    results  = []
    for pid_str in all_pids:
        if pid_str in purchased:
            continue
        pid_enc = _LE_P.transform([pid_str])[0]
        try:
            svd_score = float(_SVD.predict(user_id, pid_str).est)
        except Exception:
            svd_score = 3.5
        try:
            x_ncf = [np.array([[uid_enc]]), np.array([[pid_enc]])]
            ncf_raw = float(_NCF.predict(x_ncf)[0][0])
            # CORRECTIF : dénormaliser [0,1] → [1,5] pour cohérence avec SVD
            ncf_score = R_MIN + (R_MAX - R_MIN) * ncf_raw
        except Exception:
            ncf_score = svd_score
        a_svd = _PARAMS.get("alpha_svd", 0.5) if _PARAMS else 0.5
        a_cf  = _PARAMS.get("alpha_cf",  0.8) if _PARAMS else 0.8
        score = a_cf * (a_svd * svd_score + (1 - a_svd) * ncf_score)
        results.append({"product_id": pid_str, "score": round(score, 4)})

    results.sort(key=lambda x: x["score"], reverse=True)
    top = results[:req.n]

    if _PRODS is not None:
        top_ids = [r["product_id"] for r in top]
        prods_df = _PRODS[_PRODS["product_id"].astype(str).isin(top_ids)].copy()
        score_map = {r["product_id"]: r["score"] for r in top}
        prods_df["score"] = prods_df["product_id"].astype(str).map(score_map)
        prods_df = prods_df.sort_values("score", ascending=False)
        return {"recommendations": prods_df.to_dict(orient="records")}

    return {"recommendations": top}


class SimilarRequest(BaseModel):
    product_id: str
    n: int = Field(default=8, ge=1, le=30)


@router.post("/similar-products")
async def similar_products(req: SimilarRequest):
    """Produits similaires (Content-Based via cosine similarity)."""
    if not _LOADED:
        raise HTTPException(503, "Modèles non chargés")

    pid = str(req.product_id)
    if _PRODS is None or _COSINE is None:
        raise HTTPException(503, "Index produits non chargé")

    prods_idx = _PRODS.reset_index(drop=True)
    pid_col   = prods_idx["product_id"].astype(str)
    if pid not in pid_col.values:
        raise HTTPException(404, f"Produit {pid} introuvable dans l'index")

    idx = pid_col[pid_col == pid].index[0]
    if idx >= _COSINE.shape[0]:
        raise HTTPException(500, f"Index {idx} hors bornes cosine matrix {_COSINE.shape}")

    sim_scores = list(enumerate(_COSINE[idx]))
    sim_scores.sort(key=lambda x: x[1], reverse=True)
    similar_idxs = [i for i, _ in sim_scores[1:req.n + 1]]

    similar = prods_idx.iloc[similar_idxs].copy()
    similar["similarity"] = [sim_scores[similar_idxs.index(i) + 1][1]
                              if i in similar_idxs else 0.0 for i in similar_idxs]
    return {"similar": similar.to_dict(orient="records")}


class BoughtTogetherRequest(BaseModel):
    product_id: str
    n: int = Field(default=6, ge=1, le=20)


@router.post("/bought-together")
async def bought_together(req: BoughtTogetherRequest):
    """Produits fréquemment achetés ensemble (co-occurrence)."""
    if not _LOADED:
        raise HTTPException(503, "Modèles non chargés")

    pid = str(req.product_id)
    try:
        df = _interactions()
        if df.empty:
            raise ValueError("No interactions")
        orders_with = df[df["ProductId"] == pid]["UserId"].unique()
        co_items    = df[df["UserId"].isin(orders_with) & (df["ProductId"] != pid)]
        top_co      = co_items.groupby("ProductId")["Rating"].count().nlargest(req.n)
        top_ids     = top_co.index.astype(str).tolist()
        if _PRODS is not None:
            result = _PRODS[_PRODS["product_id"].astype(str).isin(top_ids)]
            return {"bought_together": result.to_dict(orient="records")}
        return {"bought_together": top_ids}
    except Exception as e:
        logger.warning("bought-together fallback: %s", e)
        return {"bought_together": []}


@router.get("/products-index")
async def products_index(limit: int = 100):
    """Index des produits disponibles dans les modèles."""
    if not _LOADED or _PRODS is None:
        raise HTTPException(503, "Modèles non chargés")
    return {"products": _PRODS.head(limit).to_dict(orient="records"), "total": len(_PRODS)}