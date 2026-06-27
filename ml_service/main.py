"""
ml_service/main.py  (version Sprint 3 — complète)
===================================================
SmartShop ML Service — FastAPI

CE SERVICE fait quoi ?
  - Expose des endpoints HTTP que Django appelle
  - Exécute les modèles ML (scikit-learn, scikit-surprise)
  - Lit les données réelles de PostgreSQL (SQLAlchemy)
  - Charge les modèles entraînés depuis models/*.pkl

ARCHITECTURE :
  Django (port 8000) ──HTTP──▶ FastAPI (port 8001)
                               ├── /ml/recommend        ← Sprint 3
                               ├── /ml/similar-products ← Sprint 3
                               ├── /ml/forecast         ← Sprint 5
                               └── /ml/segment          ← Sprint 4

DÉMARRAGE RAPIDE :
  1. cd ml_service
  2. pip install -r requirements.txt
  3. uvicorn main:app --host 0.0.0.0 --port 8001 --reload

  Swagger UI disponible sur : http://localhost:8001/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ── Routers ──────────────────────────────────────────────────────────────────
from routers.recommendation import router as recommendation_router  # Sprint 3
from routers.forecast        import router as forecast_router        # Sprint 5
from routers.segmentation import router as segmentation_router   # Sprint 4

# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SmartShop ML Service",
    description=(
        "Microservice d'apprentissage automatique pour le système e-commerce intelligent.\n\n"
        "**Sprint 3** : Recommandation personnalisée (SVD + TF-IDF Hybride)\n"
        "**Sprint 4** : Segmentation des clients (RFM + K-Means)\n"
        "**Sprint 5** : Prévision des ventes (Prophet) + Segmentation (K-Means)"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Autorise React (5173) et Django (8000) à appeler ce service
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",   # Django
        "http://localhost:5173",   # React + Vite
        "http://localhost:3000",   # React + Vite
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Inclusion des routers ────────────────────────────────────────────────────
app.include_router(recommendation_router)
app.include_router(forecast_router)
app.include_router(segmentation_router)


# ── Routes de base ───────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "SmartShop ML Service",
        "version": "2.0.0",
        "status": "running",
        "sprint": "S3 — Recommandation Intelligente",
        "endpoints": {
            "health":         "GET  /health",
            "ml_health":      "GET  /ml/health",
            "trending":       "GET  /ml/trending?n=12  [PUBLIC]",
            "recommend":      "POST /ml/recommend      [AUTH]",
            "similar":        "POST /ml/similar-products [PUBLIC]",
            "bought_together":"POST /ml/bought-together  [PUBLIC]",
            "docs":           "GET  /docs",

            # endpoints Sprint 4
            
            "segments_stats":         "GET  /ml/segments-stats",
            "segment":                "GET  /ml/segment?user_id=X",
            "segment_batch":          "POST /ml/segment/batch",
            "segment_predict":        "POST /ml/segment-predict",
            "segments_list":          "GET  /ml/segments-list",
            "top_customers":          "GET  /ml/top-customers",
            "resegment":              "GET  /ml/resegment",
            "segmentation_health":    "GET  /ml/segmentation-health",
        },
    }


@app.get("/health")
async def health():
    """Vérifié par Docker healthcheck"""
    return {"status": "healthy"}


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)

