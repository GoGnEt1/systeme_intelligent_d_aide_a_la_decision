// ============================================================
// Sections :
//   1. Hero carousel
//   2. Tendances (visiteur, ML)
//   3. Catégories rapides
//   4. Recommandé pour vous (ML)
//   5. Produits populaires (rating)
//   6. Ventes Flash chronométrées
//   7. Vous aimerez aussi (CB)
//   8. Nouveautés
//   9. ML Insights (Sprint S4 preview)
// ============================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import ProductCard from "../components/product/ProductCard";
import RecommendationSection from "../components/product/RecommendationSection";
import type { Product } from "../types/index";
import { buildImageUrl } from "../store/slices/images";
import { useAppSelector } from "../hooks";
import { selectIsAuthenticated } from "../store/slices/authSlice";

import img1 from "../assets/apple_macbook_air.jpg";
import img2 from "../assets/Samsung-Galaxy-S24-Ultra-1.webp";
import img3 from "../assets/Sony.jpg";
import img4 from "../assets/apple-watch.jpg";
import img5 from "../assets/canon-eos-r50.jpeg";
import img6 from "../assets/lg-ultragear-27.webp";
import img7 from "../assets/nike-air-max-270.webp";
import img8 from "../assets/playstation-5.jpg";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

// ─────────────────────────────────────────────────────────────
// Données statiques
// ─────────────────────────────────────────────────────────────
const MOCK: Product[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  name: [
    'MacBook Air M2 13"',
    "Samsung Galaxy S24 Ultra",
    "Sony WH-1000XM5",
    "Apple Watch Series 9",
    "Canon EOS R50",
    'LG UltraGear 27"',
    "Nike Air Max 270",
    "PlayStation 5",
  ][i],
  slug: [
    "macbook-air-m2",
    "samsung-galaxy-s24",
    "sony-wh1000xm5",
    "apple-watch-s9",
    "canon-eos-r50",
    "lg-ultragear-27",
    "nike-air-max-270",
    "playstation-5",
  ][i],
  price: [1149, 999.99, 279, 449, 699, 349.99, 129.99, 499.99][i],
  original_price: [1699, null, 340, null, 929, 429.99, 159.99, null][i],
  average_rating: [4.2, 4.8, 4.9, 4.1, 4.5, 4.7, 4.3, 4.6][i],
  review_count: [2847, 4521, 8103, 1205, 672, 3411, 1893, 12044][i],
  stock_quantity: [10, 5, 23, 2, 8, 15, 0, 30][i],
  category: i + 1,
  category_name: [
    "Électronique",
    "Électronique",
    "Électronique",
    "Électronique",
    "Électronique",
    "Électronique",
    "Mode",
    "Jeux vidéo",
  ][i],
  image: [img1, img2, img3, img4, img5, img6, img7, img8][i],
  sku: `MOCK-00${i + 1}`,
  status: "ACTIVE" as const,
  is_featured: i < 4,
  discount_percentage: 0,
}));

const HERO_SLIDES = [
  {
    bg: "from-[#0f2027] via-[#203a43] to-[#2c5364]",
    title: "Votre boutique",
    accent: "intelligente",
    sub: "pilotée par Machine Learning",
    badge: "Système IA Activé",
    // cta: "Découvrir nos offres",
    // href: "/products",
  },
  {
    bg: "from-[#0d1b2a] via-[#1b263b] to-[#415a77]",
    title: "Prévisions des ventes",
    accent: "en temps réel",
    sub: "Algorithme Prophet",
    badge: "ML Live",
    // cta: "Dashboard ML Administration",
    // href: "/admin",
  },
  {
    bg: "from-[#1a0a2e] via-[#4a1068] to-[#7b2d8b]",
    title: "Recommandations",
    accent: "personnalisées",
    sub: "RMSE Hybride 0.614 · MAE NCF 0.311",
    badge: "IA Recommande",
    // cta: "Mes produits",
    // href: "/products",
  },
];

const CATS = [
  {
    icon: "💻",
    name: "Ordinateurs",
    slug: "electronique",
    count: "2 340 produits",
  },
  {
    icon: "📱",
    name: "Smartphones",
    slug: "electronique",
    count: "1 890 produits",
  },
  { icon: "🎧", name: "Audio", slug: "electronique", count: "567 produits" },
  {
    icon: "📷",
    name: "Photo & Vidéo",
    slug: "electronique",
    count: "340 produits",
  },
  {
    icon: "🎮",
    name: "Jeux vidéo",
    slug: "jeux-video",
    count: "1 200 produits",
  },
  {
    icon: "🏠",
    name: "Maison",
    slug: "maison-cuisine",
    count: "3 400 produits",
  },
  { icon: "👟", name: "Mode", slug: "mode", count: "4 500 produits" },
  { icon: "⚽", name: "Sports", slug: "sports", count: "2 100 produits" },
];

const ML_BADGES = [
  { label: "RMSE Hybride", val: "0.614" },
  { label: "MAE NCF", val: "0.311" },
  { label: "NDCG@10", val: "0.851" },
  { label: "Précision CB", val: "66.5%" },
  { label: "Interactions", val: "65 780" },
  { label: "Algo", val: "SVD+NCF+CB" },
];

// ─────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────

function CountdownTimer({ targetMs }: { targetMs: number }) {
  const [left, setLeft] = useState(targetMs - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(targetMs - Date.now()), 1000);
    return () => clearInterval(t);
  }, [targetMs]);
  if (left <= 0)
    return (
      <span className="text-gognet-red font-bold text-[13px]">Expiré</span>
    );
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex items-center gap-1 font-mono">
      {[pad(h), pad(m), pad(s)].map((v, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="bg-gognet-dark text-gognet-orange text-[13px] font-bold px-1.5 py-0.5 rounded">
            {v}
          </span>
          {i < 2 && <span className="text-gray-500 text-[13px]">:</span>}
        </span>
      ))}
    </div>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className="w-3 h-3"
          viewBox="0 0 20 20"
          fill={i <= Math.round(rating) ? "#ff9900" : "#d1d5db"}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-[11px] text-gognet-blue ml-1">
        ({rating.toFixed(1)})
      </span>
    </div>
  );
}

function SectionHeader({
  title,
  badge,
  href,
}: {
  title: string;
  badge?: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between my-4">
      <h2 className="font-bold text-[20px] text-gray-900">
        {title}
        {badge && (
          <span className="ml-2 text-[11px] font-normal bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full align-middle">
            {badge}
          </span>
        )}
      </h2>
      {href && (
        <Link
          to={href}
          className="text-gognet-blue text-[14px] hover:underline hover:text-gognet-red transition-colors"
        >
          Voir tout →
        </Link>
      )}
    </div>
  );
}

function DealCard({
  product,
  sold,
  endMs,
}: {
  product: Product;
  sold: number;
  endMs: number;
}) {
  const price =
    typeof product.price === "string"
      ? parseFloat(product.price)
      : product.price;
  const orig = product.original_price
    ? typeof product.original_price === "string"
      ? parseFloat(product.original_price)
      : product.original_price
    : null;
  const disc = orig ? Math.round((1 - price / orig) * 100) : 0;
  const thumb =
    buildImageUrl(product.image) ??
    buildImageUrl(product.images?.[0]?.image) ??
    null;

  return (
    <Link
      to={`/products/${product.slug}`}
      className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-gognet-orange/30 transition-all duration-200 block group"
    >
      <div className="relative h-44 bg-gray-50 flex items-center justify-center overflow-hidden">
        {disc > 0 && (
          <span className="absolute top-2 left-2 bg-gognet-red text-white text-[11px] font-bold px-2 py-0.5 rounded z-10">
            -{disc}%
          </span>
        )}
        {thumb ? (
          <img
            src={thumb}
            alt={product.name}
            className="h-36 w-36 object-contain group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <span className="text-5xl">📦</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-[13px] text-gray-800 line-clamp-2 mb-2 min-h-[2.5em]">
          {product.name}
        </p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[18px] font-bold text-gray-900">
            {price.toFixed(3)}{" "}
            <span className="text-[12px] font-normal">DT</span>
          </span>
          {orig && disc > 0 && (
            <span className="text-[12px] text-gray-400 line-through">
              {orig.toFixed(3)} DT
            </span>
          )}
        </div>
        <div className="mb-1">
          <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
            <span>Vendu à {sold}%</span>
            <CountdownTimer targetMs={endMs} />
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gognet-orange rounded-full"
              style={{ width: `${sold}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

function TrendingSection({ products }: { products: Product[] }) {
  if (!products.length) return null;
  return (
    <section className="mb-6">
      <SectionHeader
        title="Tendances du moment"
        badge="ML · Popularité"
        href="/products?ordering=-view_count"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {products.slice(0, 6).map((p, i) => (
          <Link
            key={p.id}
            to={`/products/${p.slug}`}
            className="group border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gognet-orange/30 transition-all duration-200 block"
          >
            <div className="relative h-32 bg-gray-50 flex items-center justify-center overflow-hidden">
              <span className="absolute top-2 left-2 bg-gray-900 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {i + 1}
              </span>
              {(buildImageUrl(p.image) ??
              buildImageUrl(p.images?.[0]?.image)) ? (
                <img
                  src={
                    buildImageUrl(p.image) ??
                    buildImageUrl(p.images?.[0]?.image) ??
                    undefined
                  }
                  alt={p.name}
                  className="h-24 w-24 object-contain group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <span className="text-4xl">📦</span>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-[12px] text-gray-800 line-clamp-2 min-h-[2.2em] mb-1">
                {p.name}
              </p>
              <RatingStars rating={p.average_rating || 4.0} />
              <p className="text-[14px] font-bold text-gray-900 mt-1">
                {(typeof p.price === "string"
                  ? parseFloat(p.price)
                  : p.price
                ).toFixed(3)}{" "}
                DT
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const [heroIdx, setHeroIdx] = useState(0);
  const [products, setProducts] = useState<Product[]>(MOCK);
  const [trending, setTrending] = useState<Product[]>([]);
  const isAuth = useAppSelector(selectIsAuthenticated);

  // les produits tendances
  const [tendances, setTendances] = useState<Product[]>([]);
  useEffect(() => {
    api
      .get("/products?ordering=-view_count")
      .then(({ data }) => {
        if (data.results?.length) setTendances(data.results);
      })
      .catch(() => {});
  }, []);
  // les ventes flash
  const [ventesFlash, setVentesFlash] = useState<Product[]>([]);
  useEffect(() => {
    api
      .get("/products/?on_sale=true")
      .then(({ data }) => {
        if (data.results?.length) setVentesFlash(data.results);
      })
      .catch(() => {});
  }, []);
  // les nouveautés
  const [nouveautes, setNouveautes] = useState<Product[]>([]);
  useEffect(() => {
    api
      .get("/products?ordering=-created_at")
      .then(({ data }) => {
        if (data.results?.length) setNouveautes(data.results);
      })
      .catch(() => {});
  }, []);
  // les meilleures ventes
  const [meilleuresVentes, setMeilleuresVentes] = useState<Product[]>([]);
  useEffect(() => {
    api
      .get("/products?ordering=-purchase_count")
      .then(({ data }) => {
        if (data.results?.length) setMeilleuresVentes(data.results);
      })
      .catch(() => {});
  }, []);

  // Charger les produits vedette
  useEffect(() => {
    api
      .get("/products/?is_featured=true")
      .then(({ data }) => {
        if (data.results?.length) setProducts(data.results);
      })
      .catch(() => {});
  }, []);

  // Charger les tendances (public) — endpoint AllowAny, pas besoin d'auth
  useEffect(() => {
    api
      .get("/recommendations/trending/?n=6")
      .then(({ data }) => {
        if (data.results?.length) setTrending(data.results);
      })
      .catch(() => {});
  }, [isAuth]);

  // Auto-rotate hero
  useEffect(() => {
    const t = setInterval(
      () => setHeroIdx((i) => (i + 1) % HERO_SLIDES.length),
      5000,
    );
    return () => clearInterval(t);
  }, []);

  const slide = HERO_SLIDES[heroIdx];
  const flashEnd = Date.now() + 3 * 3600 * 1000; // dans 3h

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ── HERO CAROUSEL ── */}
      <div
        className={`relative bg-gradient-to-br ${slide.bg} overflow-hidden`}
        style={{ minHeight: "380px" }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-[-80px] right-[-80px] w-96 h-96 bg-white rounded-full" />
          <div className="absolute bottom-[-40px] left-[5%] w-60 h-60 bg-white rounded-full" />
        </div>
        <div className="relative z-10 max-w-[1500px] mx-auto px-6 py-16 flex flex-col items-center text-center">
          <span className="inline-block bg-gognet-orange text-gognet-dark text-[12px] font-black px-4 py-1 rounded-full uppercase tracking-widest mb-5">
            {slide.badge}
          </span>
          <h1 className="text-white text-3xl md:text-4xl font-black mb-3 leading-tight">
            {slide.title}{" "}
            <span className="text-gognet-orange">{slide.accent}</span>
          </h1>
          <p className="text-blue-200 text-[14px] mb-8 max-w-lg">{slide.sub}</p>
          <Link to="/products">
            <button className="btn-primary px-8 py-3 text-[15px] rounded-full shadow-lg hover:scale-105 transition-transform">
              {/* <button className="bg-gognet-orange text-gognet-dark font-black px-10 py-3.5 text-[15px] rounded-full hover:bg-gognet-orange/90 hover:scale-105 transition-all"> */}
              Découvrir nos offres →
            </button>
          </Link>
        </div>

        {/* Indicateurs */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              title="slide suivant"
              onClick={() => setHeroIdx(i)}
              className={`rounded-full transition-all ${i === heroIdx ? "w-6 h-2 bg-gognet-orange" : "w-2 h-2 bg-white/40"}`}
            />
          ))}
        </div>

        <button
          title="slide précédent"
          onClick={() =>
            setHeroIdx((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)
          }
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/60 text-white w-10 h-16 rounded-lg transition-colors text-xl"
        >
          {/* <FiChevronLeft className="text-xl" /> */}
          &lt;
        </button>
        <button
          title="slide suivant"
          onClick={() => setHeroIdx((i) => (i + 1) % HERO_SLIDES.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/60 text-white w-10 h-16 rounded-lg transition-colors text-xl"
        >
          {/* <FiChevronRight className="text-xl" /> */}
          &gt;
        </button>
      </div>

      {/* ── ML LIVE BAR ── */}
      <div className="bg-gognet-dark py-2.5">
        <div className="max-w-[1500px] mx-auto px-4 flex items-center gap-3 overflow-x-auto scrollbar-hide">
          <span className="text-gognet-orange text-[12px] font-black uppercase tracking-widest whitespace-nowrap flex-shrink-0">
            ML Live
          </span>
          {ML_BADGES.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-1.5 bg-white/5 border border-gognet-orange/20 rounded-full px-3 py-1 whitespace-nowrap flex-shrink-0"
            >
              <span className="text-[11px] text-gray-400">{b.label}</span>
              <span className="text-[12px] font-bold text-gognet-orange">
                {b.val}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto px-4 py-6">
        {/* ── TENDANCES (visiteur) ── */}
        <TrendingSection
          products={trending.length ? trending : tendances.slice(0, 6)}
        />

        {/* ── CATÉGORIES ── */}
        <section className="mb-6">
          <SectionHeader title="Parcourir les catégories" href="/products" />
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {CATS.map((cat) => (
              <Link
                key={cat.slug + cat.name}
                to={`/products?category=${cat.slug}`}
                className="flex flex-col items-center p-3 bg-white border border-gray-200 rounded-xl hover:border-gognet-orange/40 hover:shadow-sm transition-all group text-center"
              >
                <span className="text-3xl mb-1.5 group-hover:scale-110 transition-transform">
                  {cat.icon}
                </span>
                <span className="text-[11px] font-semibold text-gray-800">
                  {cat.name}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5">
                  {cat.count}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── RECOMMANDATIONS ML (connecté / visiteur incité) ── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <RecommendationSection count={6} showWhenGuest={true} />
        </div>

        {/* ── VENTES FLASH ── */}
        {ventesFlash.length && flashEnd > Date.now() && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-[20px] text-gray-900">
                  Ventes Flash
                </h2>
                <div className="bg-gognet-red/10 border border-gognet-red/30 rounded-full px-3 py-1 flex items-center gap-2">
                  <span className="text-[11px] text-gognet-red font-semibold">
                    Fin dans
                  </span>
                  <CountdownTimer targetMs={flashEnd} />
                </div>
              </div>
              <Link
                to="/products?on_sale=true"
                className="text-gognet-blue text-[14px] hover:underline"
              >
                Voir tout →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {ventesFlash.slice(0, 4).map((p, i) => (
                <DealCard
                  key={p.id}
                  product={p}
                  sold={[78, 45, 91, 34][i]}
                  endMs={flashEnd}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── POPULAIRES PAR NOTE ── */}
        {meilleuresVentes.length && (
          <section className="mb-6">
            <SectionHeader
              title="Meilleures ventes"
              badge="Top notés"
              href="/products?ordering=-purchase_count"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[...meilleuresVentes]
                .sort(
                  (a, b) => (b.average_rating || 0) - (a.average_rating || 0),
                )
                .slice(0, 5)
                .map((p) => (
                  <div
                    key={p.id}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gognet-orange/30 transition-all duration-200"
                  >
                    <ProductCard product={p} />
                  </div>
                ))}
            </div>
          </section>
        )}
        {/* ── NOUVEAUTÉS ── */}
        {nouveautes.length && (
          <section className="mb-6">
            <SectionHeader
              title="Nouveautés"
              href="/products?ordering=-created_at"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {nouveautes.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gognet-orange/30 transition-all duration-200"
                >
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </section>
        )}
        {/* ── ML PREVIEW SPRINT S4 ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            {
              icon: "📈",
              title: "Prévision des ventes",
              sub: "Algorithme Prophet",
              val: "+1.5% tendance",
              color: "bg-amber-50 border-amber-200",
            },
            {
              icon: "👥",
              title: "Segmentation clients",
              sub: "K-Means RFM · 4 segments",
              val: "28% Champions",
              color: "bg-blue-50 border-blue-200",
            },
            {
              icon: "🎯",
              title: "Taux de recommandation",
              sub: "Precision@10 SVD",
              val: "76.9%",
              color: "bg-green-50 border-green-200",
            },
          ].map((w) => (
            <div key={w.title} className={`border rounded-xl p-4 ${w.color}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{w.icon}</span>
                <div>
                  <p className="font-semibold text-[14px] text-gray-800">
                    {w.title}
                  </p>
                  <p className="text-[11px] text-gray-500">{w.sub}</p>
                </div>
              </div>
              <p className="text-[22px] font-black text-gray-900">{w.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER BANDE ── */}
      <div className="bg-gognet-dark py-6 mt-4">
        <div className="max-w-[1500px] mx-auto px-4 grid grid-cols-2 md:grid-cols-3 gap-6 text-[13px] text-gray-400">
          {[
            { t: "Livraison rapide", i: "🚚", s: "Sur toute la Tunisie 24h" },
            // { t: "Paiement sécurisé", i: "🔒", s: "À la livaison • i-Dinar" },
            { t: "Retour 14 jours", i: "↩️", s: "Remboursement garanti" },
            { t: "Support 7j/7", i: "💬", s: "+216 48 191 937" },
          ].map((f) => (
            <div key={f.t} className="flex items-center gap-3">
              <span className="text-2xl">{f.i}</span>
              <div>
                <p className="text-white font-semibold text-[13px]">{f.t}</p>
                <p className="text-[11px]">{f.s}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
