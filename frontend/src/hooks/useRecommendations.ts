// src/hooks/useRecommendations.ts
import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import type { Product } from "../types/index";

export interface MLResult {
  id: number;
  name: string;
  slug: string;
  price: string;
  image: string | null;
  category: string | null;
  average_rating: number;
  review_count: number;
  stock_quantity: number;
  ml_score: number | null;
  recommendation_reason: string;
}

export interface RecApiResponse {
  user_id?: string;
  user_known?: boolean;
  alpha_svd?: number;
  alpha_cf?: number;
  data_source: string;
  count: number;
  results: MLResult[];
}

export function toProduct(r: MLResult): Product {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    sku: `ML-${r.id}`,
    category: 0,
    category_name: r.category ?? "Divers",
    price: parseFloat(r.price),
    stock_quantity: r.stock_quantity,
    image: r.image ?? null,
    status: "ACTIVE",
    is_featured: false,
    average_rating: r.average_rating,
    review_count: r.review_count,
  };
}

let _cache: { products: Product[]; meta: RecApiResponse; ts: number } | null =
  null;
const TTL = 5 * 60 * 1000;

export function useRecommendations({
  n = 10,
  enabled = true,
  category,
}: {
  n?: number;
  enabled?: boolean;
  category?: string;
} = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<RecApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fid = useRef(0);

  const fetch = async (force = false) => {
    if (!enabled) return;
    if (!force && _cache && Date.now() - _cache.ts < TTL) {
      setProducts(_cache.products);
      setMeta(_cache.meta);
      return;
    }
    setIsLoading(true);
    setError(null);
    const id = ++fid.current;
    try {
      const params: Record<string, string | number> = { n };
      if (category) params.category = category;
      const { data } = await api.get<RecApiResponse>("/recommendations/", {
        params,
      });
      if (id !== fid.current) return;
      const converted = data.results.map(toProduct);
      _cache = { products: converted, meta: data, ts: Date.now() };
      setProducts(converted);
      setMeta(data);
    } catch {
      if (id !== fid.current) return;
      try {
        const { data } = await api.get(
          "/products/?is_featured=true&page_size=10",
        );
        setProducts(data.results ?? []);
      } catch {
        setError("Recommandations indisponibles");
      }
    } finally {
      if (id === fid.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [enabled, n, category]); // eslint-disable-line
  return { products, meta, isLoading, error, refetch: () => fetch(true) };
}

export function useSimilarProducts(productId: number | null, n = 5) {
  const [similar, setSimilar] = useState<
    Array<{ product_idx: number; category: string; similarity: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!productId) return;
    setIsLoading(true);
    api
      .get(`/recommendations/similar/?product_id=${productId}&n=${n}`)
      .then(({ data }) => setSimilar(data.results ?? []))
      .catch(() => setSimilar([]))
      .finally(() => setIsLoading(false));
  }, [productId, n]);
  return { similar, isLoading };
}

export function useBoughtTogether(productId: number | null, n = 5) {
  const [together, setTogether] = useState<
    Array<{ product_id?: string; product_idx?: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!productId) return;
    setIsLoading(true);
    api
      .get(`/recommendations/bought-together/?product_id=${productId}&n=${n}`)
      .then(({ data }) => setTogether(data.together ?? []))
      .catch(() => setTogether([]))
      .finally(() => setIsLoading(false));
  }, [productId, n]);
  return { together, isLoading };
}
