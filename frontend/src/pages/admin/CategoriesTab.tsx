import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import Spinner from "../../components/common/Spinner";
import toast from "react-hot-toast";
import {
  FiPlus,
  FiTag,
  FiEdit2,
  FiTrash2,
  FiX,
  FiCheck,
  FiChevronRight,
} from "react-icons/fi";
import type { Category } from "../../types";
import Modal from "../../components/ui/Modal";
import { useAdminTheme } from "./AdminDashboards";

// ─────────────────────────────────────────────────────────────
//  TAB: GESTION CATÉGORIES (avec support hiérarchie parent/enfant)
// ─────────────────────────────────────────────────────────────
interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  order: string;
  parent: number | null; // ← NOUVEAU : ID de la catégorie parente
}

const EMPTY_CATEGORY: CategoryFormData = {
  name: "",
  slug: "",
  description: "",
  is_active: true,
  order: "0",
  parent: null,
};

export default function CategoriesTab() {
  const T = useAdminTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormData>(EMPTY_CATEGORY);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // toutes les catégories pour le sélecteur de parent (parentes uniquement)
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      // Catégories admin : toutes en une requête (rarement > 50 catégories)
      const { data } = await api.get(
        "/products/categories/?page_size=200&ordering=name",
      );
      const list: Category[] = data.results || data;
      setCategories(list);
      setAllCategories(list.filter((c) => !c.parent)); // parents uniquement pour le select
    } catch {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const toSlug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const openCreate = () => {
    setEditCat(null);
    setForm(EMPTY_CATEGORY);
    setShowModal(true);
  };

  const openEdit = (c: Category) => {
    setEditCat(c);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      is_active: c.is_active,
      order: String(c.order),
      parent: typeof c.parent === "number" ? c.parent : null,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug || toSlug(form.name),
        description: form.description,
        is_active: form.is_active,
        order: parseInt(form.order) || 0,
        parent: form.parent ?? null,
      };
      if (editCat) {
        await api.patch(`/products/categories/${editCat.slug}/`, payload);
        toast.success("Catégorie mise à jour ✅");
      } else {
        await api.post("/products/categories/", payload);
        toast.success("Catégorie créée ✅");
      }
      setShowModal(false);
      loadCategories();
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown } };
      toast.error(`Erreur : ${JSON.stringify(e.response?.data ?? "Inconnue")}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    try {
      await api.delete(`/products/categories/${slug}/`);
      toast.success("Catégorie supprimée");
      setDeleteConfirm(null);
      loadCategories();
    } catch {
      toast.error("Impossible de supprimer");
    }
  };

  // Aplatir la hiérarchie pour l'affichage : parents puis enfants indentés
  const flattenedCats: Array<{ cat: Category; depth: number }> = [];

  const matchesSearch = (c: Category) =>
    c.name.toLowerCase().includes(catSearch.toLowerCase()) ||
    c.slug.toLowerCase().includes(catSearch.toLowerCase());

  const rootCats = categories.filter((c) => !c.parent);

  for (const root of rootCats) {
    const rootMatch = matchesSearch(root);

    const matchingChildren = root.children?.filter(matchesSearch) ?? [];

    // afficher le parent si lui OU un enfant match
    if (!catSearch.trim() || rootMatch || matchingChildren.length > 0) {
      flattenedCats.push({ cat: root, depth: 0 });

      for (const child of matchingChildren.length > 0
        ? matchingChildren
        : (root.children ?? [])) {
        flattenedCats.push({ cat: child, depth: 1 });
      }
    }
  }

  // name: form.name.trim(),
  const filteredCats = catSearch.trim()
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(catSearch.toLowerCase()) ||
          c.slug.toLowerCase().includes(catSearch.toLowerCase()),
      )
    : categories;

  return (
    <div
      className="admin-cat-root"
      style={{
        padding: "28px 20px",
        fontFamily: "'Inter', -apple-system, sans-serif",
        background: T.bg,
        minHeight: "100vh",
        color: T.text,
      }}
    >
      <style>{`
        .admin-cat-root input, .admin-cat-root textarea, .admin-cat-root select {
          background: ${T.inputBg} !important; color: ${T.text} !important;
          border-color: ${T.border} !important;
        }
        .admin-cat-root .input-field {
          background: ${T.inputBg} !important; color: ${T.text} !important;
          border-color: ${T.border} !important;
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: 0 }}
          >
            Catégories
          </h2>
          <p style={{ fontSize: 12, color: T.muted, margin: "4px 0 0" }}>
            {categories.length} catégories enregistrées
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: T.success,
            color: "white",
            fontWeight: 700,
            padding: "9px 18px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          <FiPlus size={14} /> Nouvelle catégorie
        </button>
      </div>

      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "60px 0",
          }}
        >
          <Spinner />
        </div>
      ) : categories.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
          <FiTag style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }} />
          <p>Aucune catégorie</p>
        </div>
      ) : (
        <>
          {/* Desktop table — always rendered, cards shown below on mobile via CSS */}
          <div
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Barre de recherche catégories */}
            <div className="p-3 border-b">
              <input
                type="text"
                placeholder="Rechercher une catégorie…"
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none border"
                style={{
                  background: T.inputBg,
                  color: T.text,
                  borderColor: T.border,
                }}
              />
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead style={{ background: T.active }}>
                <tr>
                  {[
                    "Nom / Hiérarchie",
                    "Slug",
                    "Catégorie parente",
                    "Ordre",
                    "Statut",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 700,
                        color: T.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        borderBottom: `1px solid ${T.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flattenedCats.map(({ cat: c, depth }) => (
                  <tr
                    key={c.id}
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
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: depth === 0 ? 700 : 500,
                        color: T.text,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          paddingLeft: depth * 20,
                        }}
                      >
                        {depth > 0 && (
                          <FiChevronRight
                            size={12}
                            style={{ color: T.muted, flexShrink: 0 }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: depth === 0 ? 14 : 13,
                            color: depth === 0 ? T.text : T.muted,
                          }}
                        >
                          {c.name}
                        </span>
                        {depth === 0 && (c.children?.length ?? 0) > 0 && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 10,
                              background: `${T.accent}22`,
                              color: T.accent,
                              marginLeft: 4,
                            }}
                          >
                            {c.children!.length} sous-cat.
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: T.muted,
                      }}
                    >
                      {c.slug}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        color: T.muted,
                        fontSize: 12,
                      }}
                    >
                      {depth === 0
                        ? "—"
                        : ((c as Category & { parent_name?: string })
                            .parent_name ?? "—")}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        color: T.muted,
                      }}
                    >
                      {c.order}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          background: c.is_active
                            ? "#10B98118"
                            : `${T.muted}18`,
                          color: c.is_active ? T.success : T.muted,
                          border: `1px solid ${c.is_active ? T.success + "44" : T.border}`,
                        }}
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <button
                          onClick={() => openEdit(c)}
                          title="Modifier"
                          style={{
                            padding: 6,
                            borderRadius: 7,
                            border: `1px solid ${T.border}`,
                            background: T.active,
                            color: "#3B82F6",
                            cursor: "pointer",
                          }}
                        >
                          <FiEdit2 size={13} />
                        </button>
                        {deleteConfirm === c.slug ? (
                          <>
                            <button
                              onClick={() => handleDelete(c.slug)}
                              title="Confirmer"
                              style={{
                                padding: 6,
                                borderRadius: 7,
                                border: "1px solid #EF444444",
                                background: "#EF444418",
                                color: T.danger,
                                cursor: "pointer",
                              }}
                            >
                              <FiCheck size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              title="Annuler"
                              style={{
                                padding: 6,
                                borderRadius: 7,
                                border: `1px solid ${T.border}`,
                                background: T.active,
                                color: T.muted,
                                cursor: "pointer",
                              }}
                            >
                              <FiX size={13} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(c.slug)}
                            title="Supprimer"
                            style={{
                              padding: 6,
                              borderRadius: 7,
                              border: "1px solid #EF444444",
                              background: "#EF444418",
                              color: T.danger,
                              cursor: "pointer",
                            }}
                          >
                            <FiTrash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — only on narrow screens */}
          <div className="block sm:hidden">
            {filteredCats.map((c) => (
              <div
                key={c.id}
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 700, color: T.text, fontSize: 14 }}>
                      {c.name}
                    </p>
                    <p
                      style={{
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: T.muted,
                        marginTop: 2,
                      }}
                    >
                      {c.slug}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: c.is_active ? "#10B98118" : `${T.muted}18`,
                      color: c.is_active ? T.success : T.muted,
                    }}
                  >
                    {c.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                {c.description && (
                  <p style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>
                    {c.description}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => openEdit(c)}
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: T.active,
                      color: "#3B82F6",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <FiEdit2 size={12} /> Modifier
                  </button>
                  {deleteConfirm === c.slug ? (
                    <>
                      <button
                        onClick={() => handleDelete(c.slug)}
                        style={{
                          flex: 1,
                          padding: "7px 0",
                          borderRadius: 8,
                          border: "1px solid #EF444444",
                          background: "#EF444418",
                          color: T.danger,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Confirmer
                      </button>
                      <button
                        title="Annuler"
                        onClick={() => setDeleteConfirm(null)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 8,
                          border: `1px solid ${T.border}`,
                          background: T.active,
                          color: T.muted,
                          cursor: "pointer",
                        }}
                      >
                        <FiX size={13} />
                      </button>
                    </>
                  ) : (
                    <button
                      title="Supprimer"
                      onClick={() => setDeleteConfirm(c.slug)}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 8,
                        border: "1px solid #EF444444",
                        background: "#EF444418",
                        color: T.danger,
                        cursor: "pointer",
                      }}
                    >
                      <FiTrash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <Modal
          title={editCat ? `Modifier : ${editCat.name}` : "Nouvelle catégorie"}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4">
            {/* Catégorie parente */}
            <div>
              <label className="block text-[14px] font-semibold mb-1.5">
                Catégorie parente{" "}
                <span className="text-[12px] text-gray-400 font-normal">
                  (laisser vide pour catégorie racine)
                </span>
              </label>
              <select
                title="Catégorie parente"
                className="input-field w-full focus:ring-blue-400 focus:border-blue-400"
                value={form.parent ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    parent: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">— Catégorie racine —</option>
                {allCategories
                  .filter((c) => !editCat || c.id !== editCat.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[14px] font-semibold mb-1.5">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  className="input-field w-full focus:ring-blue-400 focus:border-blue-400"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                      slug: toSlug(e.target.value),
                    })
                  }
                  placeholder={
                    form.parent ? "Ex: Smartphones" : "Ex: Électronique"
                  }
                />
              </div>
              <div>
                <label className="block text-[14px] font-semibold mb-1.5">
                  Slug (auto-généré) <span className="text-red-500">*</span>
                </label>
                <input
                  className="input-field w-full focus:ring-blue-400 focus:border-blue-400"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="Ex: smartphones"
                />
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-semibold mb-1.5">
                Description
              </label>
              <textarea
                className="input-field focus:ring-blue-400 focus:border-blue-400 resize-none overflow-y-auto"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Description de la catégorie..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cat_active"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                  className="w-5 h-5 accent-green-300"
                />
                <label
                  htmlFor="cat_active"
                  className="text-[14px] text-gray-700 mb-0 cursor-pointer"
                >
                  Active
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="block text-[14px] font-semibold mb-0">
                  Ordre
                </label>
                <input
                  type="number"
                  className="input-field w-full focus:ring-blue-400 focus:border-blue-400"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: e.target.value })}
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-8">
            <button
              type="reset"
              className="w-1/5 px-4 py-2 text-[14px] bg-red-400 rounded hover:bg-red-500 text-white transition-colors"
              onClick={() => setShowModal(false)}
            >
              Annuler
            </button>
            <button
              type="submit"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 py-2 px-4 text-[14px] font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Spinner /> : <FiCheck />}
              {editCat ? "Mettre à jour" : "Créer"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
