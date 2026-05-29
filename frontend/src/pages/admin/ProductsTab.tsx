import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import Spinner from "../../components/common/Spinner";
import toast from "react-hot-toast";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiCheck,
  FiSearch,
} from "react-icons/fi";
import type { Category, Product } from "../../types";
import Modal from "../../components/ui/Modal";
import { buildImageUrl } from "../../store/slices/images";

import {
  DndContext,
  closestCenter,
  PointerSensor, // ← détecte le début du drag (évite drag accidentel)
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy, // ← stratégie grille (mieux que vertical pour des vignettes)

  // verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableImage from "../../components/product/SortableImage";
import { useAdminTheme } from "./AdminDashboards";

// ─────────────────────────────────────────────────────────────
//  TAB: GESTION PRODUITS
// ─────────────────────────────────────────────────────────────

interface AdminProduct extends Product {
  sku: string;
  status: "ACTIVE" | "INACTIVE" | "DRAFT";
}
interface ProductFormData {
  name: string;
  sku: string;
  description: string;
  price: string;
  original_price: string;
  stock_quantity: string;
  category: string;
  is_featured: boolean;
  status: "ACTIVE" | "INACTIVE" | "DRAFT";
  image?: File | null;
  images_to_add?: File[]; // nouvelles images à uploader
  images_to_delete?: number[]; // IDs des images existantes à supprimer
}

const EMPTY_PRODUCT: ProductFormData = {
  name: "",
  sku: "",
  description: "",
  price: "",
  original_price: "",
  stock_quantity: "0",
  category: "",
  is_featured: false,
  status: "ACTIVE",
  image: null,
  images_to_add: [],
  images_to_delete: [],
};

export default function ProductsTab() {
  const T = useAdminTheme();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );
  const [uploadProgress, setUploadProgress] = useState(0);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  const loadData = useCallback(
    async (pg = page, q = search) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          ordering: "-created_at",
          page: String(pg),
          page_size: String(PAGE_SIZE),
        });
        if (q.trim()) params.set("search", q.trim());
        const [pRes, cRes] = await Promise.all([
          // FIX: endpoint admin → tous statuts (ACTIVE + INACTIVE + DRAFT)
          api.get(`/products/?${params}`),
          api.get("/products/categories/?page_size=200"),
        ]);
        const d = pRes.data;
        setProducts(d.results ?? d);
        setTotalCount(d.count ?? (d.results ?? d).length);
        setTotalPages(
          Math.ceil((d.count ?? (d.results ?? d).length) / PAGE_SIZE) || 1,
        );
        setCategories(cRes.data.results ?? cRes.data);
      } catch {
        toast.error("Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    },
    [page, search],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);

    setForm((f) => ({
      ...f,
      images_to_add: arrayMove(f.images_to_add ?? [], oldIndex, newIndex),
    }));
  };
  const generateSKU = (name: string) => {
    const clean = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);

    const rand = Math.floor(Math.random() * 9000 + 1000);

    return `${clean}-${rand}`;
  };

  const openCreate = () => {
    setEditProduct(null);
    setForm(EMPTY_PRODUCT);
    setShowModal(true);
  };

  const openEdit = (p: AdminProduct) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      sku: p.sku || generateSKU(p.name),
      description: p.description || "",
      price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      stock_quantity: String(p.stock_quantity),
      category: String(p.category),
      is_featured: p.is_featured,
      status: p.status,
      image: null,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (
      !form.name.trim() ||
      !form.price ||
      !form.category ||
      !form.sku.trim()
    ) {
      toast.error("Nom, SKU, prix et catégorie sont requis");
      return;
    }

    setSaving(true);

    try {
      const payload = new FormData();

      payload.append("name", form.name);
      payload.append("sku", form.sku);
      payload.append("description", form.description);
      payload.append("price", form.price);
      payload.append("stock_quantity", form.stock_quantity);
      payload.append("category", form.category);
      payload.append("is_featured", String(form.is_featured));
      payload.append("status", form.status);

      if (form.original_price) {
        payload.append("original_price", form.original_price);
      }

      if (form.image instanceof File) {
        payload.append("image", form.image);
      }

      const config = {
        headers: { "Content-Type": "multipart/form-data" },
      };

      let productSlug = editProduct?.slug;

      // UPDATE
      if (editProduct) {
        await api.patch(`/products/${editProduct.slug}/`, payload, config);
        toast.success("Produit mis à jour !");
      }

      // CREATE
      else {
        const res = await api.post("/products/", payload, config);
        productSlug = res.data.slug;
        toast.success("Produit créé !");
      }

      // Upload nouvelles images
      if (productSlug && form.images_to_add?.length) {
        for (const file of form.images_to_add) {
          const fd = new FormData();
          fd.append("image", file);
          fd.append("is_primary", "false");

          await api.post(`/products/${productSlug}/images/`, fd, {
            headers: { "Content-Type": "multipart/form-data" },

            onUploadProgress: (progressEvent) => {
              const percent = Math.round(
                (progressEvent.loaded * 100) / (progressEvent.total || 1),
              );

              setUploadProgress(percent);
            },
          });
        }
      }

      // Supprimer images
      if (form.images_to_delete?.length) {
        for (const id of form.images_to_delete) {
          await api.delete(`/products/images/${id}/`);
        }
      }

      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string[]> } };

      if (e.response?.data) {
        Object.entries(e.response.data).forEach(([k, v]) =>
          toast.error(`${k}: ${v[0]}`),
        );
      } else {
        toast.error("Erreur lors de la sauvegarde");
      }
    } finally {
      setSaving(false);
    }
  };

  const markForDeletion = (id: number) => {
    setForm((f) => ({
      ...f,
      images_to_delete: [...(f.images_to_delete || []), id],
    }));
  };

  const handleDelete = async (slug: string) => {
    try {
      await api.delete(`/products/${slug}/`);
      // FIX: Le backend peut soft-delete (INACTIVE) si le produit a des commandes.
      // Un 204 signifie succès dans tous les cas.
      toast.success("Produit archivé / supprimé avec succès");
      setDeleteConfirm(null);
      loadData(page);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(msg ?? "Erreur lors de la suppression");
    }
  };

  // FIX: Recherche server-side — `products` est déjà filtré par le backend.
  const filtered = products;

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    INACTIVE: "bg-gray-100 text-gray-600",
    DRAFT: "bg-yellow-100 text-yellow-700",
  };
  const STATUS_LABELS: Record<string, string> = {
    ACTIVE: "Actif",
    INACTIVE: "Inactif",
    DRAFT: "Brouillon",
  };

  return (
    <div
      className="admin-prod-root"
      style={{
        padding: "28px 20px",
        fontFamily: "'Inter', -apple-system, sans-serif",
        // background: T.bg,
        minHeight: "100vh",
        color: T.text,
      }}
    >
      <style>{`
        .admin-prod-root .text-gray-800, .admin-prod-root .text-gray-700 { color: ${T.text} !important; }
        .admin-prod-root .text-gray-600, .admin-prod-root .text-gray-500 { color: ${T.muted} !important; }
        .admin-prod-root .text-gray-400, .admin-prod-root .text-gray-300 { color: ${T.muted}99 !important; }
        .admin-prod-root .bg-white { background: ${T.card} !important; }
        .admin-prod-root .bg-gray-50 { background: ${T.active} !important; }
        .admin-prod-root .bg-gray-100 { background: ${T.active} !important; }
        .admin-prod-root .border-gray-100, .admin-prod-root .border-gray-200, .admin-prod-root .border-gray-300 { border-color: ${T.border} !important; }
        .admin-prod-root input, .admin-prod-root textarea, .admin-prod-root select {
          background: ${T.inputBg} !important; color: ${T.text} !important; border-color: ${T.border} !important;
        }
        .admin-prod-root .input-field { background: ${T.inputBg} !important; color: ${T.text} !important; border-color: ${T.border} !important; }
        .admin-prod-root .hover\\:bg-gray-100:hover { background: ${T.active} !important; }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
        // className="flex flex-col gap-3 flex-wrap mb-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>
          Gestion des produits
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            flex: 1,
            justifyContent: "flex-end",
          }}
          // className="flex flex-1 justify-end gap-3 flex-wrap sm:justify-between sm:items-center sm:flex-nowrap sm:gap-0"
        >
          <div style={{ position: "relative" }}>
            <FiSearch
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: T.muted,
              }}
              size={14}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                loadData(1, e.target.value);
              }}
              placeholder="Rechercher un produit ou SKU…"
              style={{
                paddingLeft: 32,
                paddingRight: 14,
                paddingTop: 8,
                paddingBottom: 8,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                fontSize: 13,
                background: T.inputBg,
                color: T.text,
                outline: "none",
                width: 220,
              }}
            />
          </div>
          <button
            onClick={openCreate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: T.accent,
              color: "white",
              fontWeight: 700,
              padding: "9px 18px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            <FiPlus size={14} /> Nouveau produit
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div
          style={{
            background: T.card,
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            overflow: "hidden",
          }}
        >
          <div className="overflow-x-auto">
            <table
              style={{
                width: "100%",
                fontSize: 13,
                borderCollapse: "collapse",
                minWidth: 700,
              }}
            >
              <thead
                style={{
                  background: T.active,
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <tr style={{ height: 44 }}>
                  {["Produit", "SKU", "Prix", "Stock", "Statut", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 14px",
                          textAlign:
                            h === "Prix" || h === "Stock"
                              ? "right"
                              : h === "Statut" || h === "Actions"
                                ? "center"
                                : "left",
                          fontSize: 11,
                          fontWeight: 700,
                          color: T.muted,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        padding: "60px 0",
                        color: T.muted,
                        fontSize: 14,
                      }}
                    >
                      Aucun produit trouvé
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const thumbnail =
                      buildImageUrl(p.image) ??
                      buildImageUrl(p.images?.[0]?.image) ??
                      null;

                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: `1px solid ${T.border}`,
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            T.active)
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "transparent")
                        }
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-3">
                            {thumbnail ? (
                              <img
                                src={thumbnail}
                                alt={p.name}
                                className="w-10 h-10 object-contain rounded border"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center text-lg">
                                📦
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-800 text-[13px] line-clamp-1 max-w-[200px]">
                                {p.name}
                              </p>
                              <p className="text-[13px] text-gray-400">
                                {p.category_name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-500 font-mono text-[13px]">
                          {p.sku}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-[13px] text-gray-700">
                          DT {parseFloat(String(p.price)).toFixed(2)}
                          {p.original_price && (
                            <div className="text-[11px] text-gray-400 line-through">
                              DT{" "}
                              {parseFloat(String(p.original_price)).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`text-[13px] font-medium ${p.stock_quantity === 0 ? "text-red-500" : p.stock_quantity < 5 ? "text-orange-500" : "text-green-600"}`}
                          >
                            {p.stock_quantity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-[13px] font-bold ${STATUS_COLORS[p.status] || ""}`}
                          >
                            {STATUS_LABELS[p.status] || p.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEdit(p)}
                              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <FiEdit2 size={15} />
                            </button>
                            {deleteConfirm === p.slug ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(p.slug)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Confirmer"
                                >
                                  <FiCheck size={15} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                                  title="Annuler"
                                >
                                  <FiX size={15} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(p.slug)}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <FiTrash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 flex items-center justify-between border-t">
            <span className="text-[13px] text-gray-400">
              {totalCount} produit{totalCount !== 1 ? "s" : ""} · page {page}/
              {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  const p = page - 1;
                  setPage(p);
                  loadData(p);
                }}
                className="px-3 py-1 rounded text-[13px] border disabled:opacity-30 hover:bg-gray-50 transition"
              >
                ← Préc.
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  const p = page + 1;
                  setPage(p);
                  loadData(p);
                }}
                className="px-3 py-1 rounded text-[13px] border disabled:opacity-30 hover:bg-gray-50 transition"
              >
                Suiv. →
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <Modal
          title={
            editProduct
              ? `Modifier un produit: ${editProduct.name}`
              : "Ajouter un produit"
          }
          onClose={() => setShowModal(false)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            {" "}
            {/* Nom */}
            <div>
              <label className="block text-[14px] font-semibold mb-1.5">
                Nom du produit <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    sku: generateSKU(e.target.value),
                  })
                }
                className="input-field w-full focus:ring-green-400 focus:border-green-400"
                placeholder="Ex: MacBook Air M3"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* SKU */}
              <div>
                <label className="block text-[14px] font-semibold mb-1.5">
                  SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="sku"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="input-field focus:ring-green-400 focus:border-green-400 w-full font-mono"
                  placeholder="Ex: PROD-12345"
                />
              </div>

              {/* Stock */}
              <div>
                <label className="block text-[14px] font-semibold mb-1.5">
                  Stock <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="stock_quantity"
                  min="0"
                  value={form.stock_quantity}
                  onChange={(e) =>
                    setForm({ ...form, stock_quantity: e.target.value })
                  }
                  className="input-field w-full focus:ring-green-400 focus:border-green-400"
                  placeholder="Ex: 10"
                />
              </div>
            </div>
            {/* Prix */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[14px] font-semibold mb-1.5">
                  Prix TTC (DT) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="input-field w-full focus:ring-green-400 focus:border-green-400"
                  placeholder="DT 1200.00"
                />
              </div>
              <div>
                <label className="block text-[14px] font-semibold mb-1.5">
                  Prix barré (DT)
                </label>
                <input
                  type="number"
                  name="original_price"
                  step="0.01"
                  min="0"
                  value={form.original_price}
                  onChange={(e) =>
                    setForm({ ...form, original_price: e.target.value })
                  }
                  className="input-field w-full focus:ring-green-400 focus:border-green-400"
                  placeholder="DT 1500.00"
                />
              </div>
            </div>
            {/* Catégorie */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[14px] font-semibold mb-1.5">
                  Catégorie <span className="text-red-500">*</span>
                </label>
                <select
                  title="Liste de catégories"
                  className="input-field w-full focus:ring-green-400 focus:border-green-400"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  <option value="">— Choisir —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* Statut */}
              <div>
                <label className="block text-[14px] font-semibold mb-1.5">
                  Statut <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  title="Statut du produit"
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as ProductFormData["status"],
                    })
                  }
                  className="input-field w-full focus:ring-green-400 focus:border-green-400"
                >
                  <option value="ACTIVE">Actif</option>
                  <option value="INACTIVE">Inactif</option>
                  <option value="DRAFT">Brouillon</option>
                </select>
              </div>
            </div>
            {/* Description */}
            <div>
              <label className="block text-[14px] font-semibold mb-1.5">
                Description
              </label>
              <textarea
                className="input-field focus:ring-green-400 focus:border-green-400 resize-none overflow-y-auto"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Description du produit…"
              />
            </div>
            {/* Image */}
            <div>
              <label className="block text-[14px] font-semibold mb-1.5">
                Images du produit
                <span className="text-[12px] text-gray-400 font-normal ml-2">
                  (glisser-déposer pour réordonner)
                </span>
              </label>

              {/* ── Images existantes en mode édition ── */}
              {editProduct?.images && editProduct.images.length > 0 && (
                <div className="mb-3">
                  <p className="text-[12px] text-gray-500 mb-1">
                    Images actuelles :
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {editProduct.images.map((img) => {
                      const isMarked = form.images_to_delete?.includes(img.id);
                      return (
                        <div
                          key={img.id}
                          className={`relative w-20 h-20 border-2 rounded overflow-hidden transition-all
                            ${isMarked ? "opacity-40 border-red-400" : "border-gray-200"}`}
                        >
                          <img
                            src={buildImageUrl(img.image) ?? undefined}
                            alt={img.alt_text || "image produit"}
                            className="w-full h-full object-cover"
                          />
                          {/* Badge "Principal" */}
                          {img.is_primary && !isMarked && (
                            <span
                              className="absolute bottom-0 left-0 bg-gognet-orange
                                             text-white text-[9px] px-1 leading-5"
                            >
                              Principal
                            </span>
                          )}
                          {/* Bouton : marquer pour suppression ou annuler */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isMarked) {
                                // annuler la suppression
                                setForm((f) => ({
                                  ...f,
                                  images_to_delete: f.images_to_delete?.filter(
                                    (id) => id !== img.id,
                                  ),
                                }));
                              } else {
                                markForDeletion(img.id);
                              }
                            }}
                            className={`absolute top-0 right-0 w-5 h-5 text-xs flex items-center
                                        justify-center text-white transition-colors
                                        ${isMarked ? "bg-gray-500 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"}`}
                            title={
                              isMarked ? "Annuler la suppression" : "Supprimer"
                            }
                          >
                            {isMarked ? "↩" : "×"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Input upload multiple ── */}
              <input
                type="file"
                accept="image/*"
                placeholder="Image"
                title="Ajouter des images"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  // Réinitialise l'input pour permettre de re-sélectionner les mêmes fichiers
                  e.target.value = "";
                  setForm((f) => ({
                    ...f,
                    images_to_add: [...(f.images_to_add ?? []), ...files],
                  }));
                }}
                className="border px-2 py-1 file:cursor-pointer file:mr-4 file:py-2
                           file:px-3 file:rounded-lg file:text-sm file:font-semibold
                           file:border-green-200 hover:file:bg-green-200 text-[13px]"
              />

              {/* ── Barre de progression upload ── */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-2">
                  <div className="text-xs mb-1 text-gray-500">
                    Upload en cours… {uploadProgress}%
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* ── Prévisualisation draggable des nouvelles images ── */}
              {form.images_to_add && form.images_to_add.length > 0 && (
                <>
                  <p className="text-[12px] text-gray-500 mt-3 mb-1">
                    Nouvelles images — glisser pour réordonner :
                  </p>
                  {/*
                    DndContext  : fournit le contexte global du drag (événements, collisions)
                    sensors     : avec PointerSensor(distance:8) pour éviter les faux drags
                    onDragEnd   : appelé quand l'utilisateur lâche l'item → arrayMove
            
                    SortableContext : connaît la liste ordonnée des ids
                    items       : tableau des ids (strings) dans l'ordre actuel
                    strategy    : rectSortingStrategy adapté à une grille de vignettes
            
                    SortableImage : chaque item s'enregistre via useSortable(id)
                    id          : doit correspondre exactement à l'id dans items[]
                  */}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={form.images_to_add.map((_, i) => i.toString())}
                      strategy={rectSortingStrategy}
                    >
                      <div className="flex gap-2 flex-wrap mt-1">
                        {form.images_to_add.map((file, i) => (
                          <SortableImage
                            key={i}
                            id={i.toString()} // ← doit matcher items[] ci-dessus
                            src={URL.createObjectURL(file)}
                            name={file.name}
                            onRemove={() =>
                              setForm((f) => ({
                                ...f,
                                images_to_add: f.images_to_add?.filter(
                                  (_, j) => j !== i,
                                ),
                              }))
                            }
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              )}
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="featured"
                checked={form.is_featured}
                onChange={(e) =>
                  setForm({ ...form, is_featured: e.target.checked })
                }
                className="w-5 h-5 accent-green-300"
                placeholder="Description"
              />
              <label
                htmlFor="featured"
                className="text-[14px] text-gray-700 cursor-pointer"
              >
                Mettre en avant (homepage)
              </label>
            </div>
            {/* </div> */}
            <div className="flex justify-center gap-2 mt-8">
              <button
                type="reset"
                className="w-1/5 px-4 py-2 text-[14px] bg-red-400 rounded hover:bg-red-500 text-white transition-colors"
                // className="w-1/2 sm:w-2/5 py-2 text-[14px] px-4 bg-red-600  rounded hover:bg-red-700"
                onClick={() => setShowModal(false)}
              >
                Annuler
              </button>

              <button
                type="submit"
                // onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 py-2 px-4 text-[14px] font-semibold bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Spinner /> : <FiCheck />}
                {editProduct ? "Mettre à jour" : "Créer le produit"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
