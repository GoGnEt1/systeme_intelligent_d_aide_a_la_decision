/**
 * useCategories — CORRIGÉ v3
 *
 * Utilise une instance Axios publique (sans intercepteur JWT) car les catégories
 * sont une ressource publique (IsAdminOrReadOnly → GET autorisé sans auth).
 * L'ancienne version utilisait l'instance `api` qui ajoute un header Authorization
 * vide → 401 côté DRF quand aucun token n'est présent → catégories absentes
 * dans SubNav/Navbar avant connexion et sans refresh.
 */
import { useEffect, useState } from "react";
import axios from "axios";
import type { Category } from "../types";

const API_BASE =
  (import.meta.env.VITE_API_URL as string) ?? "http://localhost:8000/api";

// Instance publique sans intercepteur d'authentification
const publicApi = axios.create({ baseURL: API_BASE });

export default function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicApi
      .get("/products/categories/")
      .then(({ data }) => setCategories(data.results ?? data))
      .catch((err) => console.error("useCategories:", err))
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading };
}
