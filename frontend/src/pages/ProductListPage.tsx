// src/pages/ProductListPage.tsx FiChevronDown
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../services/api";
import ProductCard from "../components/product/ProductCard";
import Spinner from "../components/common/Spinner";
import type { Product, PaginatedResponse } from "../types";
import { FiFilter, FiX } from "react-icons/fi";
import useCategories from "../hooks/useCategories";

const SORT_OPTIONS = [
  { value: "-created_at", label: "Nouveautés" },
  { value: "price", label: "Prix croissant" },
  { value: "-price", label: "Prix décroissant" },
  { value: "-view_count", label: "Popularité" },
  { value: "-purchase_count", label: "Meilleures ventes" },
];

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { categories } = useCategories();

  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const category_name = searchParams.get("category_name") || "";
  const sort = searchParams.get("ordering") || "-created_at";
  const inStock = searchParams.get("in_stock") === "true";
  const onSale = searchParams.get("on_sale") === "true";
  const priceMin = searchParams.get("price_min") || "";
  const priceMax = searchParams.get("price_max") || "";

  // récupérer le prix minimum et maximum des produits
  // const minPrice = products.reduce((min, product) => Math.min(min, Number(product.price)), Infinity);
  // const maxPrice = products.reduce((max, product) => Math.max(max, Number(product.price)), -Infinity);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (category) params.append("category", category);
      if (category_name) params.append("category_name", category_name);
      if (sort) params.append("ordering", sort);
      if (inStock) params.append("in_stock", "true");
      if (onSale) params.append("on_sale", "true");
      if (priceMin) params.append("price_min", priceMin);
      if (priceMax) params.append("price_max", priceMax);
      params.append("page", String(page));

      const { data } = await api.get<PaginatedResponse<Product>>(
        `/products/?${params}&status=ACTIVE`,
      );
      setProducts(data.results || []);
      setCount(data.count || 0);
    } catch {
      // Produits de démonstration si API non disponible
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, category, sort, inStock, onSale, priceMin, priceMax, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
    setPage(1);
  };

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-4">
      {/* Breadcrumb */}
      <div className="text-[14px] text-gognet-blue mb-3">
        <Link to="/" className="hover:underline">
          Accueil
        </Link>{" "}
        ›
        {category && (
          <>
            {" "}
            <span className="hover:underline cursor-pointer capitalize">
              {category}
            </span>{" "}
            ›
          </>
        )}
        {search && (
          <>
            {" "}
            Résultats pour &quot;<span className="font-bold">{search}</span>
            &quot;
          </>
        )}
        {!search && !category && (
          <span className="text-gray-600"> Tous les produits</span>
        )}
      </div>

      <div className="flex gap-4">
        {/* ── Sidebar Filtres ── */}
        <aside
          className={`
          fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-2xl transform transition-transform duration-300
          md:relative md:inset-auto md:transform-none md:shadow-none md:z-auto md:w-56 md:flex-shrink-0
          ${filtersOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        >
          {/* Header mobile */}
          <div className="flex items-center justify-between p-4 border-b md:hidden">
            <h3 className="font-bold">Filtres</h3>
            <button title="Fermer" onClick={() => setFiltersOpen(false)}>
              <FiX />
            </button>
          </div>

          <div className="p-4 space-y-5 overflow-y-auto max-h-full">
            <h3 className="hidden md:block font-bold text-[16px] border-b pb-2">
              Affiner par
            </h3>

            {/* Prix */}
            <div>
              <h4 className="font-bold text-[15px] mb-2">Prix (DT)</h4>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  max={priceMax}
                  value={priceMin}
                  onChange={(e) => updateParam("price_min", e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-[13px] outline-none focus:border-gognet-orange"
                  onWheel={(e) => e.currentTarget.blur()}
                />
                <input
                  type="number"
                  placeholder="Max"
                  min={priceMin}
                  value={priceMax}
                  onChange={(e) => updateParam("price_max", e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-[13px] outline-none focus:border-gognet-orange"
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
            </div>

            {/* En stock */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStock}
                  onChange={(e) =>
                    updateParam("in_stock", e.target.checked ? "true" : null)
                  }
                  className="w-4 h-4 accent-gognet-orange"
                />
                <span className="text-[14px]">Disponible en stock</span>
              </label>
            </div>

            {/* En promo */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onSale}
                  onChange={(e) =>
                    updateParam("on_sale", e.target.checked ? "true" : null)
                  }
                  className="w-4 h-4 accent-gognet-orange"
                />
                <span className="text-[14px]">En promotion</span>
              </label>
            </div>

            {/* Catégories hiérarchiques */}
            <div>
              <h4 className="font-bold text-[15px] mb-2">Catégorie</h4>
              {categories
                .filter((c) => !c.parent)
                .map((parent) => (
                  <div key={parent.slug}>
                    {/* Parent */}
                    <button
                      onClick={() =>
                        updateParam(
                          "category",
                          category === parent.slug ? null : parent.slug,
                        )
                      }
                      className={`block w-full text-left text-[13px] px-2 py-1.5 rounded capitalize transition-colors font-semibold
                        ${
                          category === parent.slug
                            ? "bg-orange-50 text-orange-600"
                            : "hover:bg-gray-100 text-gray-800"
                        }`}
                    >
                      {parent.name}
                      {parent.product_count != null && (
                        <span className="ml-1 text-[11px] text-gray-400 font-normal">
                          ({parent.product_count})
                        </span>
                      )}
                    </button>
                    {/* Children */}
                    {(parent.children ?? []).map((child) => (
                      <button
                        key={child.slug}
                        onClick={() =>
                          updateParam(
                            "category",
                            category === child.slug ? null : child.slug,
                          )
                        }
                        className={`block w-full text-left text-[12px] pl-6 pr-2 py-1 rounded capitalize transition-colors
                          ${
                            category === child.slug
                              ? "text-orange-600 font-semibold bg-orange-50"
                              : "hover:bg-gray-100 text-gray-600"
                          }`}
                      >
                        └ {child.name}
                        {child.product_count != null && (
                          <span className="ml-1 text-[10px] text-gray-400">
                            ({child.product_count})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
            </div>

            {/* Reset */}
            <button
              onClick={() => setSearchParams(new URLSearchParams())}
              className="w-full text-[13px] text-gognet-blue hover:underline text-left"
            >
              Effacer tous les filtres
            </button>
          </div>
        </aside>

        {/* Overlay mobile */}
        {filtersOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setFiltersOpen(false)}
          />
        )}

        {/* ── Contenu principal ── */}
        <div className="flex-1 min-w-0">
          {/* Barre de tri */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setFiltersOpen(true)}
              className="md:hidden flex items-center gap-2 text-[15px] border rounded px-3 py-1.5"
            >
              <FiFilter /> Filtres
            </button>

            {search && (
              <span className="text-[15px] text-gray-600">
                Résultats pour &quot;<strong>{search}</strong>&quot; — {count}{" "}
                produit{count !== 1 ? "s" : ""}
              </span>
            )}
            {!search && (
              <span className="text-[15px] text-gray-600">
                {count} produit{count !== 1 ? "s" : ""}
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-[14px] text-gray-500 hidden sm:block">
                Trier par :
              </span>
              <select
                title="Trier par"
                value={sort}
                onChange={(e) => updateParam("ordering", e.target.value)}
                className="border rounded px-3 py-1.5 text-[13px] outline-none focus:border-gognet-orange cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grille produits */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg shadow-card">
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-gray-500 font-medium mb-2">
                Aucun produit trouvé
              </p>
              <p className="text-[14px] text-gray-400 mb-4">
                Essayez de modifier vos filtres ou votre recherche
              </p>
              <button
                onClick={() => setSearchParams(new URLSearchParams())}
                className="btn-primary px-6 py-2 rounded text-[13px]"
              >
                Voir tous les produits
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {count > 20 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 border rounded text-[13px] disabled:opacity-50 hover:bg-gray-50 transition-colors"
              >
                ← Précédent
              </button>
              <span className="px-4 py-2 text-[13px] text-gray-600">
                Page {page} / {Math.ceil(count / 20)}
              </span>
              <button
                disabled={page >= Math.ceil(count / 20)}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 border rounded text-[13px] disabled:opacity-50 hover:bg-gray-50 transition-colors"
              >
                Suivant →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
