# 🛒 SmartShop — Système Intelligent d'Aide à la Décision E-Commerce

> **PFE LGLSI3 — FSG Tunisie 2026**  
> Système e-commerce intelligent basé sur le Machine Learning

---

## 🏗️ Architecture

```
smartshop/
├── backend/          # Django 4.2 + DRF (API REST)
├── frontend/         # React 18 + Vite + TailwindCSS
├── ml_service/       # FastAPI + Scikit-learn + Prophet
├── docker/           # Config Nginx + PostgreSQL
├── docker-compose.yml
└── .env
```

## 🚀 Démarrage rapide (5 minutes)

### Prérequis

- Docker Desktop installé
- Git

### Étapes

```bash
# 1. Cloner le projet
git clone <repo-url>
cd smartshop

# 2. Configurer les variables d'environnement
cp .env.example .env
# (modifier les mots de passe dans .env)

# 3. Lancer tous les services
docker compose up --build

# 4. En attendant le build, ouvrir un 2e terminal :
# Créer un superadmin Django
docker compose exec django python manage.py createsuperuser
```

### Accès aux interfaces

| Service           | URL                             | Description          |
| ----------------- | ------------------------------- | -------------------- |
| 🌐 Frontend React | http://localhost:5173           | Interface e-commerce |
| ⚙️ API Django     | http://localhost:8000/api/      | REST API principale  |
| 📖 Swagger UI     | http://localhost:8000/api/docs/ | Doc API interactive  |
| 🧠 FastAPI ML     | http://localhost:8001/docs      | Doc API ML           |
| 🐘 PostgreSQL     | localhost:5432                  | Base de données      |
| 🔧 Admin Django   | http://localhost:8000/admin/    | Back-office          |

---

## 📦 Modules ML

### Sprint S2 — Segmentation Client (RFM + K-Means)

```bash
cd ml_service/notebooks
jupyter notebook 01_segmentation_rfm_kmeans.ipynb
```

### Sprint S3 — Prévision des Ventes (Prophet)

```bash
cd ml_service/notebooks
jupyter notebook 02_forecast_prophet.ipynb
```

### Sprint S4 — Recommandation (SVD Hybride)

```bash
cd ml_service/notebooks
jupyter notebook 03_recommendation_svd.ipynb
```

---

## 🔑 Endpoints API principaux

### Authentification

```
POST /api/auth/register/       Inscription
POST /api/auth/login/          Connexion → JWT tokens
POST /api/auth/logout/         Déconnexion
POST /api/auth/token/refresh/  Renouvellement token
GET  /api/auth/profile/        Mon profil
```

### Produits

```
GET  /api/products/            Liste + filtres + recherche
GET  /api/products/<id>/       Détail produit
GET  /api/products/categories/ Liste catégories
```

### Commandes

```
GET  /api/orders/cart/         Mon panier
POST /api/orders/cart/items/   Ajouter au panier
POST /api/orders/              Passer commande
GET  /api/orders/              Mes commandes
```

### ML

```
GET  /api/recommendations/     Recommandations personnalisées
GET  /api/analytics/forecast/  Prévision des ventes (admin)
GET  /api/analytics/dashboard/ Dashboard KPIs (admin)
GET  /api/analytics/segments/  Segments clients (admin)
```

---

## 🗂️ Structure base de données

```
users           → Utilisateurs (clients + admins)
user_addresses  → Carnet d'adresses
categories      → Catégories produits (hiérarchique)
products        → Produits
product_images  → Galerie produits
product_reviews → Avis clients
carts           → Paniers
cart_items      → Lignes de panier
orders          → Commandes
order_items     → Lignes de commande
payments        → Paiements
```

---

## 🤖 Stack Technique

| Couche           | Technologie                | Version    |
| ---------------- | -------------------------- | ---------- |
| Frontend         | React + Vite + TailwindCSS | 18 / 5 / 3 |
| Backend          | Django + DRF               | 4.2 / 3.14 |
| Auth             | JWT (SimpleJWT)            | 5.3        |
| ML Service       | FastAPI + Uvicorn          | 0.109      |
| Segmentation     | Scikit-learn (K-Means)     | 1.4        |
| Prévision        | Prophet / ARIMA            | 1.1.5      |
| Recommandation   | Surprise (SVD)             | 1.1.3      |
| Base de données  | PostgreSQL                 | 15         |
| Proxy            | Nginx                      | Alpine     |
| Conteneurisation | Docker + Compose           | -          |
