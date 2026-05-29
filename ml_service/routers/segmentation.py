"""
ml_service/routers/segmentation.py
Sprint S4 — Endpoints FastAPI Segmentation RFM/K-Means

Endpoints :
  GET  /ml/segments-stats       → statistiques globales par segment (depuis BD)
  GET  /ml/segment?user_id=X   → segment d'un client (cache BD → temps réel)
  POST /ml/segment/batch        → segmenter une liste de clients
  POST /ml/segment-predict      → prédire segment depuis RFM brut (sans BD)
  GET  /ml/segments-list        → liste complète clients segmentés (admin)
  GET  /ml/top-customers        → top clients par trimestre
  GET  /ml/resegment            → déclencher resegmentation manuelle (admin)
  GET  /ml/segmentation-health  → diagnostic modèles Sprint 4

Architecture :
  FastAPI (8001) ← Django (8000) ← React (5173)
  FastAPI lit PostgreSQL directement via SQLAlchemy
  Les modèles .pkl sont chargés en mémoire au démarrage
"""

import os
import logging
import traceback
from pathlib import Path
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Optional, List

import numpy as np
import pandas as pd
import joblib
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import create_engine, text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ml", tags=["Segmentation RFM"])

# ── 1. CHARGEMENT DES MODÈLES ─────────────────────────────────────────────────

MODELS_DIR = Path(os.getenv("MODELS_DIR",
    str(Path(__file__).parent.parent / "models")))

_KMEANS     = None
_SCALER     = None
_META       = None
_STATS      = None
_SEG_LOADED = False
_SEG_ERROR  = ""

REQUIRED_SEG = [
    "kmeans_rfm.pkl",
    "rfm_scaler.pkl",
    "rfm_meta.pkl",
    "rfm_cluster_stats.pkl",
]


def _load_segmentation_models() -> bool:
    global _KMEANS, _SCALER, _META, _STATS, _SEG_LOADED, _SEG_ERROR

    missing = [f for f in REQUIRED_SEG if not (MODELS_DIR / f).exists()]
    if missing:
        _SEG_ERROR = (
            f"Fichiers manquants dans {MODELS_DIR}: {missing}\n"
            "→ Exécuter le notebook Sprint_4_RFM_KMeans.ipynb\n"
            "→ Copier les .pkl dans ml_service/models/\n"
        )
        logger.error("Segmentation models manquants : %s", missing)
        return False

    try:
        _KMEANS = joblib.load(MODELS_DIR / "kmeans_rfm.pkl")
        _SCALER = joblib.load(MODELS_DIR / "rfm_scaler.pkl")
        _META   = joblib.load(MODELS_DIR / "rfm_meta.pkl")
        _STATS  = joblib.load(MODELS_DIR / "rfm_cluster_stats.pkl")
        _SEG_LOADED = True
        logger.info(
            "✅ Modèles segmentation chargés — version : %s | k=%d | silhouette=%.4f | n_train=%s",
            _META.get("model_version"),
            _META.get("k", 0),
            _META.get("silhouette", 0.0),
            _META.get("n_train_samples", "?"),   # ← clé corrigée
        )
        return True
    except Exception as e:
        _SEG_ERROR = str(e) + "\n" + traceback.format_exc()
        logger.error("Erreur chargement modèles segmentation : %s", e)
        return False


_SEG_LOADED = _load_segmentation_models()

# ── 2. BASE DE DONNÉES ────────────────────────────────────────────────────────
def _build_db_url() -> str:
    host = os.getenv("DB_HOST", "postgres")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", os.getenv("POSTGRES_DB", "smartshop_db"))
    user = os.getenv("DB_USER", os.getenv("POSTGRES_USER", "smartshop_user"))
    pwd  = os.getenv("DB_PASSWORD", os.getenv("POSTGRES_PASSWORD", "smartshop_pass"))

    # Fallback sur DATABASE_URL uniquement si aucune variable individuelle n'est définie
    raw = os.getenv("DATABASE_URL", "")
    if raw and not os.getenv("DB_HOST"):
        # Forcer TCP en réinjectant host:port explicitement depuis l'URL
        import re as _re
        m = _re.search(r'@([^/:]+)(?::(\d+))?/(\S+)', raw)
        if m:
            host = m.group(1) or host
            port = m.group(2) or port
            name = m.group(3) or name
        logger.info("DB URL source: DATABASE_URL parsée → host=%s port=%s db=%s", host, port, name)
    else:
        logger.info("DB URL source: variables individuelles → host=%s port=%s db=%s", host, port, name)

    # Construction avec host:port explicite pour forcer TCP (jamais socket Unix)
    url = f"postgresql://{user}:{pwd}@{host}:{port}/{name}"
    return url

DB_URL = _build_db_url()

@lru_cache(maxsize=1)
def _get_engine():
    return create_engine(DB_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)


# ── 3. CONSTANTES MÉTIER ──────────────────────────────────────────────────────

CLUSTER_LABELS = {
    0: "🏆 Champions",
    1: "💙 Loyaux",
    2: "⚠️ À risque / Perdus",
}
CLUSTER_NAMES = {
    0: "champions",
    1: "loyaux",
    2: "a_risque_perdus",
}
CLUSTER_COLORS = {
    0: "#10B981",
    1: "#3B82F6",
    2: "#F59E0B",
}
CLUSTER_ACTIONS = {
    0: "Programme VIP, récompenses exclusives, early access nouveautés",
    1: "Newsletter personnalisée, offres fidélité, cross-sell",
    2: "Campagne réactivation (risque modéré) ou offre réengagement 30% (clients perdus), email 'Vous nous manquez'",
}


# ── 4. FONCTIONS UTILITAIRES ──────────────────────────────────────────────────

def _predict_segment(recency: int, frequency: int, monetary: float) -> dict:
    """Prédit le segment d'un client à partir de ses métriques RFM brutes."""
    if not _SEG_LOADED:
        raise HTTPException(503, "Modèles de segmentation non chargés — voir /ml/segmentation-health")

    features    = np.array([[-recency, frequency, monetary]])  # R inversé
    X_scaled    = _SCALER.transform(features)
    cluster_raw = int(_KMEANS.predict(X_scaled)[0])

    remap   = {int(k): v for k, v in _META.get("remap", {}).items()}
    cluster = remap.get(cluster_raw, cluster_raw)

    centroid = _KMEANS.cluster_centers_[cluster_raw]
    distance = float(np.linalg.norm(X_scaled[0] - centroid))

    return {
        "cluster_id":           cluster,
        "segment":              CLUSTER_NAMES.get(cluster, "unknown"),
        "segment_label":        CLUSTER_LABELS.get(cluster, "Inconnu"),
        "color":                CLUSTER_COLORS.get(cluster, "#9CA3AF"),
        "action_crm":           CLUSTER_ACTIONS.get(cluster, ""),
        "distance_to_centroid": round(distance, 4),
    }


def _fetch_client_rfm(user_id: str) -> Optional[dict]:
    """Récupère les métriques RFM d'un client depuis PostgreSQL."""
    SQL = text("""
        SELECT
            o.user_id::text                  AS user_id,
            MAX(o.created_at)                AS last_order_date,
            COUNT(DISTINCT o.id)             AS frequency,
            COALESCE(SUM(o.total_amount), 0)::float AS monetary,
            COALESCE(AVG(o.total_amount), 0)::float AS avg_order_value
        FROM orders_order o
        WHERE o.user_id::text = :uid
          AND o.status IN ('DELIVERED', 'SHIPPED', 'CONFIRMED', 'PAID')
        GROUP BY o.user_id
    """)
    try:
        with _get_engine().connect() as conn:
            row = conn.execute(SQL, {"uid": user_id}).fetchone()
        if not row:
            return None
        ref_date  = datetime.now()
        last_date = row.last_order_date
        if hasattr(last_date, "tzinfo") and last_date.tzinfo:
            import pytz
            ref_date = datetime.now(pytz.utc)
        recency = (ref_date - last_date).days
        return {
            "user_id":         user_id,
            "recency":         recency,
            "frequency":       int(row.frequency),
            "monetary":        float(row.monetary),
            "avg_order_value": float(row.avg_order_value),
        }
    except Exception as e:
        logger.error("Erreur fetch RFM user %s : %s", user_id, e)
        return None


# ── 5. SCHÉMAS PYDANTIC ───────────────────────────────────────────────────────

class BatchSegmentRequest(BaseModel):
    user_ids: List[str]


class DirectPredictRequest(BaseModel):
    """Prédiction directe sans accès BD — pour tests et intégration."""
    recency:   int
    frequency: int
    monetary:  float


# ── 6. ENDPOINTS ──────────────────────────────────────────────────────────────

@router.get("/segments-stats")
async def get_segments_stats():
    """
    Statistiques globales de segmentation depuis analytics_customersegment.
    Utilisé par le dashboard admin React.
    """
    if not _SEG_LOADED:
        raise HTTPException(503, "Modèles non chargés — exécuter le notebook Sprint 4")

    SQL = text("""
        SELECT
            cluster_id,
            segment,
            segment_label,
            COUNT(*)                      AS n_clients,
            AVG(recency_days)::float      AS recency_avg,
            AVG(frequency)::float         AS frequency_avg,
            AVG(monetary)::float          AS monetary_avg,
            SUM(monetary)::float          AS monetary_total,
            MAX(computed_at)              AS last_computed
        FROM analytics_customersegment
        GROUP BY cluster_id, segment, segment_label
        ORDER BY cluster_id
    """)

    try:
        with _get_engine().connect() as conn:
            rows          = conn.execute(SQL).fetchall()
            total_clients = conn.execute(
                text("SELECT COUNT(*) FROM analytics_customersegment")
            ).scalar() or 1
            total_revenue = conn.execute(
                text("SELECT COALESCE(SUM(monetary), 0) FROM analytics_customersegment")
            ).scalar() or 1

        segments = []
        for row in rows:
            cid = row.cluster_id
            segments.append({
                "cluster_id":    cid,
                "segment":       row.segment,
                "segment_label": row.segment_label,
                "color":         CLUSTER_COLORS.get(cid, "#9CA3AF"),
                "action_crm":    CLUSTER_ACTIONS.get(cid, ""),
                "n_clients":     int(row.n_clients),
                "pct_clients":   round(row.n_clients / total_clients * 100, 1),
                "recency_avg":   round(row.recency_avg, 1),
                "frequency_avg": round(row.frequency_avg, 1),
                "monetary_avg":  round(row.monetary_avg, 2),
                "monetary_total":round(row.monetary_total, 2),
                "pct_revenue":   round(row.monetary_total / total_revenue * 100, 1),
                "last_computed": row.last_computed.isoformat() if row.last_computed else None,
            })

        return {
            "total_clients":    total_clients,
            "total_revenue":    round(float(total_revenue), 2),
            "segments":         segments,
            "model_version":    _META.get("model_version"),
            "silhouette_score": _META.get("silhouette"),
            "k":                _META.get("k"),
        }

    except Exception as e:
        logger.warning("BD indisponible pour segments-stats : %s — fallback .pkl", e)
        # Fallback sur les stats sauvegardées dans le .pkl
        total_cli = sum(s.get("n_clients", s.get("count", 0)) for s in (_STATS or []))
        total_rev = sum(s.get("monetary_total", s.get("M_total", 0)) for s in (_STATS or []))
        return {
            "total_clients": total_cli,
            "total_revenue": round(float(total_rev), 2),
            "segments": [
                {
                    **s,
                    "color":      CLUSTER_COLORS.get(s.get("cluster_id", s.get("cluster", 0)), "#9CA3AF"),
                    "action_crm": CLUSTER_ACTIONS.get(s.get("cluster_id", s.get("cluster", 0)), ""),
                }
                for s in (_STATS or [])
            ],
            "model_version":    _META.get("model_version"),
            "silhouette_score": _META.get("silhouette"),
            "k":                _META.get("k"),
            "source":           "pkl_cache",
        }


@router.get("/segment")
async def get_client_segment(user_id: str = Query(..., description="ID du client")):
    """
    Retourne le segment RFM d'un client spécifique.

    Stratégie en cascade :
    1. Cache analytics_customersegment (BD) — le plus rapide
    2. Calcul temps réel depuis orders_order — si absent du cache
    3. Nouveau client — si aucune commande
    """
    # 1. Cache BD
    try:
        with _get_engine().connect() as conn:
            row = conn.execute(
                text("SELECT * FROM analytics_customersegment WHERE user_id = :uid"),
                {"uid": user_id}
            ).fetchone()
        if row:
            cid = row.cluster_id
            return {
                "user_id":         user_id,
                "source":          "cache_db",
                "cluster_id":      cid,
                "segment":         row.segment,
                "segment_label":   row.segment_label,
                "color":           CLUSTER_COLORS.get(cid, "#9CA3AF"),
                "action_crm":      CLUSTER_ACTIONS.get(cid, ""),
                "recency_days":    row.recency_days,
                "frequency":       row.frequency,
                "monetary":        float(row.monetary),
                "avg_order_value": float(row.avg_order_value) if row.avg_order_value else 0.0,
                "computed_at":     row.computed_at.isoformat(),
            }
    except Exception as e:
        logger.warning("Cache BD inaccessible pour user %s : %s", user_id, e)

    # 2. Calcul temps réel
    rfm = _fetch_client_rfm(user_id)
    if not rfm:
        return {
            "user_id":       user_id,
            "source":        "no_orders",
            "cluster_id":    None,
            "segment":       "nouveau",
            "segment_label": "🆕 Nouveau client",
            "color":         "#6B7280",
            "action_crm":    "Bienvenue — première recommandation personnalisée",
            "recency_days":  None,
            "frequency":     0,
            "monetary":      0.0,
        }

    seg = _predict_segment(rfm["recency"], rfm["frequency"], rfm["monetary"])
    return {"user_id": user_id, "source": "realtime", **rfm, **seg}


@router.post("/segment/batch")
async def batch_segment(request: BatchSegmentRequest):
    """Segmenter plusieurs clients en une seule requête (vue liste admin)."""
    if not request.user_ids:
        return {"results": [], "total": 0}

    results = []
    try:
        with _get_engine().connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT cs.*, u.email, u.first_name, u.last_name
                    FROM analytics_customersegment cs
                    LEFT JOIN users_user u ON u.id::text = cs.user_id
                    WHERE cs.user_id = ANY(:uids)
                    ORDER BY cs.cluster_id, cs.monetary DESC
                """),
                {"uids": request.user_ids}
            ).fetchall()

        for row in rows:
            cid = row.cluster_id
            results.append({
                "user_id":       row.user_id,
                "email":         row.email,
                "first_name":    row.first_name,
                "last_name":     row.last_name,
                "cluster_id":    cid,
                "segment":       row.segment,
                "segment_label": row.segment_label,
                "color":         CLUSTER_COLORS.get(cid, "#9CA3AF"),
                "action_crm":    CLUSTER_ACTIONS.get(cid, ""),
                "recency_days":  row.recency_days,
                "frequency":     row.frequency,
                "monetary":      float(row.monetary),
                "computed_at":   row.computed_at.isoformat(),
            })
    except Exception as e:
        logger.error("Batch segment DB error : %s", e)

    return {"results": results, "total": len(results)}


@router.post("/segment-predict")
async def predict_from_rfm(request: DirectPredictRequest):
    """
    Prédiction directe à partir de métriques RFM brutes — sans accès BD.
    Utile pour : tests, intégration externe, formulaires admin.
    """
    seg = _predict_segment(request.recency, request.frequency, request.monetary)
    return {
        "input": {
            "recency":   request.recency,
            "frequency": request.frequency,
            "monetary":  request.monetary,
        },
        **seg,
    }


@router.get("/segments-list")
async def list_all_segments(
    segment: Optional[str] = Query(None, description="Filtrer : champions | loyaux | a_risque | perdus"),
    page:      int = Query(1,  ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """
    Liste paginée de tous les clients segmentés.
    Utilisée par le tableau de bord admin pour afficher/filtrer les clients.
    """
    offset = (page - 1) * page_size

    where_clause = "WHERE cs.user_id IS NOT NULL"
    params: dict = {"limit": page_size, "offset": offset}
    if segment:
        where_clause += " AND cs.segment = :segment"
        params["segment"] = segment

    SQL = text(f"""
        SELECT
            cs.user_id,
            cs.cluster_id,
            cs.segment,
            cs.segment_label,
            cs.recency_days,
            cs.frequency,
            cs.monetary,
            cs.avg_order_value,
            cs.computed_at,
            cs.model_version,
            u.email,
            u.first_name,
            u.last_name
        FROM analytics_customersegment cs
        LEFT JOIN users_user u ON u.id::text = cs.user_id
        {where_clause}
        ORDER BY cs.cluster_id ASC, cs.monetary DESC
        LIMIT :limit OFFSET :offset
    """)

    SQL_COUNT = text(f"""
        SELECT COUNT(*) FROM analytics_customersegment cs {where_clause}
    """)

    try:
        with _get_engine().connect() as conn:
            rows  = conn.execute(SQL,       params).fetchall()
            total = conn.execute(SQL_COUNT, {k: v for k, v in params.items()
                                             if k != "limit" and k != "offset"}).scalar() or 0

        customers = []
        for row in rows:
            cid = row.cluster_id
            customers.append({
                "user_id":         row.user_id,
                "email":           row.email,
                "first_name":      row.first_name,
                "last_name":       row.last_name,
                "cluster_id":      cid,
                "segment":         row.segment,
                "segment_label":   row.segment_label,
                "color":           CLUSTER_COLORS.get(cid, "#9CA3AF"),
                "action_crm":      CLUSTER_ACTIONS.get(cid, ""),
                "recency_days":    row.recency_days,
                "frequency":       row.frequency,
                "monetary":        float(row.monetary),
                "avg_order_value": float(row.avg_order_value) if row.avg_order_value else 0.0,
                "computed_at":     row.computed_at.isoformat() if row.computed_at else None,
            })

        return {
            "customers":  customers,
            "total":      total,
            "page":       page,
            "page_size":  page_size,
            "total_pages":(-(-total // page_size)),  # ceiling division
        }

    except Exception as e:
        logger.error("segments-list DB error : %s", e)
        # Pas de fallback pkl pour segments-list (données individuelles non stockées en pkl)
        # Retourner liste vide pour éviter le 500 qui bloque l'UI
        return {
            "customers":   [],
            "total":       0,
            "page":        page,
            "page_size":   page_size,
            "total_pages": 1,
            "warning":     "Base de données inaccessible — données individuelles indisponibles",
        }


@router.get("/top-customers")
async def get_top_customers(
    segment:        Optional[str] = Query(None),
    sort_by:        Optional[str] = Query("segment"),
    quarter_offset: int           = Query(0),
    limit:          int           = Query(100, le=500),
):
    """
    Liste des clients par trimestre, jointure avec le segment RFM.
    Alimenté par les commandes DELIVERED + cache analytics_customersegment.
    """
    now               = datetime.now()
    qm_start          = ((now.month - 1) // 3) * 3 + 1
    quarter_start     = datetime(now.year, qm_start, 1) + timedelta(days=quarter_offset * 91)
    quarter_end       = quarter_start + timedelta(days=91)

    # FIX : La fenêtre trimestrielle retournait 0 résultats quand les commandes
    # du seeding étaient hors du trimestre courant (T2 2026 = avril-juin 2026).
    # Solution : 12 mois glissants en priorité, filtre trimestriel supprimé.
    SQL_TOP = text("""
        SELECT
            o.user_id::text                         AS user_id,
            u.email, u.first_name, u.last_name, u.phone,
            COUNT(DISTINCT o.id)                    AS order_count,
            SUM(o.total_amount)::float              AS total_spent,
            AVG(o.total_amount)::float              AS avg_order,
            MAX(o.created_at)                       AS last_order_date,
            cs.cluster_id,
            cs.segment, cs.segment_label,
            cs.recency_days,
            cs.frequency AS rfm_frequency,
            cs.monetary  AS rfm_monetary
        FROM orders_order o
        JOIN users_user u ON u.id = o.user_id
        LEFT JOIN analytics_customersegment cs ON cs.user_id = o.user_id::text
        WHERE o.status IN ('DELIVERED', 'SHIPPED', 'CONFIRMED', 'PROCESSING')
          AND o.created_at >= NOW() - INTERVAL '12 months'
        GROUP BY
            o.user_id, u.email, u.first_name, u.last_name, u.phone,
            cs.cluster_id, cs.segment, cs.segment_label,
            cs.recency_days, cs.frequency, cs.monetary
        ORDER BY
            CASE WHEN :sort_by = 'segment'  THEN COALESCE(cs.cluster_id, 99) END ASC,
            CASE WHEN :sort_by = 'monetary' THEN SUM(o.total_amount) END DESC,
            CASE WHEN :sort_by = 'orders'   THEN COUNT(DISTINCT o.id) END DESC
        LIMIT :lim
    """)

    try:
        with _get_engine().connect() as conn:
            rows = conn.execute(SQL_TOP, {
                "sort_by": sort_by,
                "lim":     limit,
            }).fetchall()
            # Si encore vide → fenêtre ALL TIME (pas de borne de date)
            if not rows:
                rows = conn.execute(text("""
                    SELECT o.user_id::text AS user_id,
                           u.email, u.first_name, u.last_name, u.phone,
                           COUNT(DISTINCT o.id)::int    AS order_count,
                           SUM(o.total_amount)::float   AS total_spent,
                           AVG(o.total_amount)::float   AS avg_order,
                           MAX(o.created_at)            AS last_order_date,
                           cs.cluster_id, cs.segment, cs.segment_label,
                           cs.recency_days,
                           cs.frequency AS rfm_frequency,
                           cs.monetary  AS rfm_monetary
                    FROM orders_order o
                    JOIN users_user u ON u.id = o.user_id
                    LEFT JOIN analytics_customersegment cs ON cs.user_id = o.user_id::text
                    WHERE o.status IN ('DELIVERED','SHIPPED','CONFIRMED','PROCESSING','PAID')
                    GROUP BY o.user_id, u.email, u.first_name, u.last_name, u.phone,
                             cs.cluster_id, cs.segment, cs.segment_label,
                             cs.recency_days, cs.frequency, cs.monetary
                    ORDER BY cs.cluster_id ASC NULLS LAST, SUM(o.total_amount) DESC
                    LIMIT :lim
                """), {"lim": limit}).fetchall()

        customers = []
        for i, row in enumerate(rows):
            if segment and row.segment != segment:
                continue
            cid = row.cluster_id if row.cluster_id is not None else 3
            customers.append({
                "rank":          i + 1,
                "user_id":       row.user_id,
                "email":         row.email,
                "first_name":    row.first_name,
                "last_name":     row.last_name,
                "phone":         row.phone,
                "order_count":   int(row.order_count),
                "total_spent":   round(float(row.total_spent), 2),
                "avg_order":     round(float(row.avg_order), 2),
                "last_order":    row.last_order_date.isoformat() if row.last_order_date else None,
                "cluster_id":    cid,
                "segment":       row.segment or CLUSTER_NAMES.get(cid, "inconnu"),
                "segment_label": row.segment_label or CLUSTER_LABELS.get(cid, ""),
                "color":         CLUSTER_COLORS.get(cid, "#9CA3AF"),
                "recency_days":  row.recency_days,
            })

        return {
            "quarter_start": quarter_start.isoformat(),
            "quarter_end":   quarter_end.isoformat(),
            "sort_by":       sort_by,
            "total":         len(customers),
            "customers":     customers,
        }

    except Exception as e:
        logger.error("top-customers error : %s", e)
        # Fallback: retourner liste vide plutôt qu'un 500 qui bloque l'UI
        return {
            "quarter_start": quarter_start.isoformat(),
            "quarter_end":   quarter_end.isoformat(),
            "sort_by":       sort_by,
            "total":         0,
            "customers":     [],
            "warning":       f"Base de données temporairement inaccessible — vérifier DB_HOST dans docker-compose",
        }


@router.get("/resegment")
async def trigger_resegmentation(background_tasks: BackgroundTasks):
    """
    Déclenche une resegmentation complète en arrière-plan (admin).
    Lit orders_order → calcule RFM → prédit avec K-Means → upsert BD.
    """
    if not _SEG_LOADED:
        raise HTTPException(503, "Modèles non chargés — voir /ml/segmentation-health")

    def _do_resegment():
        logger.info("🔄 Démarrage resegmentation...")
        SQL_ALL = text("""
            SELECT
                o.user_id::text          AS user_id,
                MAX(o.created_at)        AS last_order_date,
                COUNT(DISTINCT o.id)     AS frequency,
                SUM(o.total_amount)::float AS monetary,
                AVG(o.total_amount)::float AS avg_order_value
            FROM orders_order o
            WHERE o.status IN ('DELIVERED', 'SHIPPED', 'CONFIRMED', 'PAID')
            GROUP BY o.user_id
            HAVING COUNT(DISTINCT o.id) >= 1
        """)
        try:
            engine = _get_engine()
            with engine.connect() as conn:
                df = pd.read_sql(SQL_ALL, conn)
            if df.empty:
                logger.warning("Aucun client à resegmenter")
                return

            ref           = datetime.now()
            df["recency"] = (ref - pd.to_datetime(df["last_order_date"])).dt.days
            df["frequency"]= df["frequency"].astype(int)
            df["monetary"] = df["monetary"].astype(float)

            features   = np.column_stack([-df["recency"], df["frequency"], df["monetary"]])
            X_scaled   = _SCALER.transform(features)
            labels_raw = _KMEANS.predict(X_scaled)

            remap               = {int(k): v for k, v in _META.get("remap", {}).items()}
            df["cluster_raw"]   = labels_raw
            df["cluster_id"]    = df["cluster_raw"].map(remap)
            df["segment"]       = df["cluster_id"].map(CLUSTER_NAMES)
            df["segment_label"] = df["cluster_id"].map(CLUSTER_LABELS)
            df["computed_at"]   = ref
            df["model_version"] = _META.get("model_version", "kmeans_olist_v1_k4")
            df["recency_days"]  = df["recency"]

            UPSERT = text("""
                INSERT INTO analytics_customersegment
                    (user_id, recency_days, frequency, monetary, avg_order_value,
                     cluster_id, segment, segment_label, computed_at, model_version)
                VALUES
                    (:user_id, :recency_days, :frequency, :monetary, :avg_order_value,
                     :cluster_id, :segment, :segment_label, :computed_at, :model_version)
                ON CONFLICT (user_id) DO UPDATE SET
                    recency_days    = EXCLUDED.recency_days,
                    frequency       = EXCLUDED.frequency,
                    monetary        = EXCLUDED.monetary,
                    avg_order_value = EXCLUDED.avg_order_value,
                    cluster_id      = EXCLUDED.cluster_id,
                    segment         = EXCLUDED.segment,
                    segment_label   = EXCLUDED.segment_label,
                    computed_at     = EXCLUDED.computed_at,
                    model_version   = EXCLUDED.model_version
            """)
            records = df[[
                "user_id", "recency_days", "frequency", "monetary", "avg_order_value",
                "cluster_id", "segment", "segment_label", "computed_at", "model_version"
            ]].to_dict(orient="records")

            with engine.begin() as conn:
                conn.execute(UPSERT, records)

            logger.info("✅ Resegmentation terminée : %d clients mis à jour", len(records))

        except Exception as e:
            logger.error("❌ Erreur resegmentation : %s", e)

    background_tasks.add_task(_do_resegment)
    return {
        "status":       "started",
        "message":      "Resegmentation lancée en arrière-plan",
        "triggered_at": datetime.now().isoformat(),
    }


# ── DIAGNOSTIC SEGMENTATION ── (corrigé : plus de double préfixe /ml/ml/health)
@router.get("/segmentation-health")
async def segmentation_health():
    """
    Diagnostic de l'état des modèles de segmentation Sprint 4.
    Accessible sur GET /ml/segmentation-health
    (l'ancien /ml/ml/health était un bug de double préfixe)
    """
    return {
        "segmentation_loaded": _SEG_LOADED,
        "load_error":          _SEG_ERROR if not _SEG_LOADED else None,
        "models_dir":          str(MODELS_DIR),
        "models_present":      {f: (MODELS_DIR / f).exists() for f in REQUIRED_SEG},
        "model_version":       _META.get("model_version") if _META else None,
        "k":                   _META.get("k")             if _META else None,
        "silhouette":          _META.get("silhouette")    if _META else None,
        "n_train_samples":     _META.get("n_train_samples") if _META else None,  # clé corrigée
        "trained_at":          _META.get("trained_at")    if _META else None,
    }