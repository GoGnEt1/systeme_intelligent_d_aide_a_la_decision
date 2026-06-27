import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import ProductGallery from "../components/product/ProductGallery";
import ProductInfo from "../components/product/ProductInfo";
import ProductPurchaseBox from "../components/product/ProductPurchaseBox";
import ProductReviews from "../components/product/ProductReviews";
import ReviewForm from "../components/product/ReviewForm";
import Spinner from "../components/common/Spinner";
import ProductCard from "../components/product/ProductCard";
import type { Product } from "../types";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

const MOCK_PRODUCT: Product = {
  id: 1,
  slug: "produit-demo",
  name: "Produit de Démonstration Premium",
  price: 299.99,
  original_price: 399.99,
  description:
    "Description complète du produit. Ce produit de démonstration illustre toutes les fonctionnalités du système SmartShop.",
  average_rating: 4.5,
  review_count: 1234,
  stock_quantity: 10,
  category: 1,
  category_name: "Électronique",
  sku: "DEMO-001",
  status: "ACTIVE",
  is_featured: true,
  images: [],
};

// ── Carousel horizontal pour les produits similaires ─────────────────────────
function SimilarCarousel({ products }: { products: Product[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? 280 : -280, behavior: "smooth" });
  };

  if (products.length === 0) return null;

  return (
    <div className="relative">
      {/* Left arrow */}
      {products.length > 3 && (
        <button
          title="Scroll left"
          onClick={() => scroll("left")}
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <FiChevronLeft size={16} className="text-gray-600" />
        </button>
      )}
      {/* Cards strip */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {products.map((p) => (
          <div key={p.id} className="flex-shrink-0 w-[220px]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
      {/* Right arrow */}
      {products.length > 3 && (
        <button
          title="Scroll right"
          onClick={() => scroll("right")}
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <FiChevronRight size={16} className="text-gray-600" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProduct = useCallback(async () => {
    if (!slug) return;
    try {
      const { data } = await api.get<Product>(`/products/${slug}/`);
      setProduct(data);
      // Load similar products from same category
      try {
        const { data: sim } = await api.get<Product[]>(
          `/products/${slug}/similar/`,
        );
        setSimilar(Array.isArray(sim) ? sim : []);
      } catch {
        // similar endpoint optional — fail silently
        setSimilar([]);
      }
    } catch {
      setProduct({ ...MOCK_PRODUCT, slug: slug || "demo" });
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    setSimilar([]);
    loadProduct();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [loadProduct]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!product) {
    return <div>Produit introuvable</div>;
  }

  // category_slug: prefer flat field, fallback to nested object slug
  const categorySlug: string | null =
    product.category_slug ??
    (typeof product.category === "object" && product.category !== null
      ? ((product.category as { slug?: string })?.slug ?? null)
      : null);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-4">
      {/* Breadcrumb */}
      <div className="text-[14px] text-gognet-blue mb-6 flex items-center gap-1 flex-wrap">
        <Link to="/" className="hover:underline">
          Accueil
        </Link>{" "}
        ›
        {categorySlug ? (
          <Link
            to={`/products?category=${categorySlug}`}
            className="hover:underline capitalize"
          >
            {product.category_name}
          </Link>
        ) : (
          <span className="capitalize">{product.category_name}</span>
        )}{" "}
        ›<span className="text-gray-600 line-clamp-1">{product.name}</span>
      </div>

      {/* Main product grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[auto_1fr_auto] gap-6">
        <ProductGallery product={product} />
        <ProductInfo product={product} />
        <ProductPurchaseBox product={product} />

        {/* FIX v2 : afficher la section reviews pour tous (auth ou non)
             ProductReviews gère lui-même l'affichage "Aucun avis" */}
        <ProductReviews product={product} />

        <ReviewForm
          slug={slug ?? ""}
          reviews={product.reviews ?? []}
          onReviewAdded={(updated) => setProduct(updated)}
        />
      </div>

      {/* ── Produits similaires (même catégorie) ─────────────────────────── */}
      {similar.length > 0 && (
        <section className="mt-12 border-t border-gray-200 pt-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[18px] font-bold text-gray-900">
                Produits similaires
              </h2>
              <p className="text-[13px] text-gray-500 mt-0.5">
                D'autres produits dans{" "}
                <span className="font-medium">{product.category_name}</span>
              </p>
            </div>
            {categorySlug && similar.length > 5 && (
              <Link
                to={`/products?category=${categorySlug}`}
                className="text-[13px] text-blue-600 hover:underline font-medium flex items-center gap-1"
              >
                Voir tout <FiChevronRight size={14} />
              </Link>
            )}
          </div>
          <SimilarCarousel products={similar} />
        </section>
      )}

      {/* ── Recommandations personnalisées ───────────────────────────────── */}
      <RecommendedForYou currentProductId={product.id} />
    </div>
  );
}

// ── Bloc recommandations personnalisées ──────────────────────────────────────
function RecommendedForYou({ currentProductId }: { currentProductId: number }) {
  const [recs, setRecs] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get<{ recommendations?: Product[]; results?: Product[] }>(
        "/recommendations/",
      )
      .then(({ data }) => {
        const list =
          data.recommendations ??
          data.results ??
          (Array.isArray(data) ? (data as unknown as Product[]) : []);
        // Exclude the current product
        setRecs(list.filter((p) => p.id !== currentProductId).slice(0, 8));
      })
      .catch(() => setRecs([]))
      .finally(() => setLoaded(true));
  }, [currentProductId]);

  if (!loaded || recs.length === 0) return null;

  return (
    <section className="mt-10 border-t border-gray-200 pt-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[18px] font-bold text-gray-900">
            Recommandé pour vous
          </h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Sélectionnés selon vos habitudes d'achat
          </p>
        </div>
        <span className="text-[11px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-1 rounded-full font-semibold">
          🤖 IA
        </span>
      </div>
      <SimilarCarousel products={recs} />
    </section>
  );
}
