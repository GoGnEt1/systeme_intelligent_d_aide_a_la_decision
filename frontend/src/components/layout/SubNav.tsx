// src/components/layout/SubNav.tsx
// ══════════════════════════════════════════════════════════════
// Sous-navigation :
//   • Bouton "Tous nos rayons" → mega-menu (CategoryMegaMenu)
//   • Items statiques (Prime, Ventes Flash, Nouveautés)
//   • Séparateur |
//   • Si ≥5 catégories parentes → affiche les catégories parentes
//     (au survol : mini-panel avec les sous-catégories)
//   • Si <5 catégories parentes → affiche les sous-catégories directement
// ══════════════════════════════════════════════════════════════
import { useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiLoader, FiChevronDown } from "react-icons/fi";
import useCategories from "../../hooks/useCategories";
import type { Category } from "../../types";
import CategoryMegaMenu from "./CategoryMegaMenu";

const STATIC_ITEMS = [
  { label: "Prime", to: null },
  { label: "Ventes Flash", to: "/products?on_sale=true" },
  { label: "Nouveautés", to: "/products?ordering=-created_at" },
];

// ── Dropdown panel pour les sous-catégories au survol d'un item subnav ──────
function SubCatPanel({
  category,
  onClose,
}: {
  category: Category;
  onClose: () => void;
}) {
  const children = category.children ?? [];
  if (children.length === 0) return null;

  return (
    <div
      className="absolute top-full left-0 z-50 bg-white shadow-xl border border-gray-200 rounded-b-lg p-4"
      style={{ minWidth: 320 }}
    >
      <div className="mb-2 pb-1 border-b border-gray-100">
        <Link
          to={`/products?category=${category.slug}`}
          onClick={onClose}
          className="text-[13px] font-bold text-orange-600 hover:underline"
        >
          Tout {category.name}
        </Link>
      </div>
      <div
        className="grid gap-x-6 gap-y-0.5"
        style={{
          gridTemplateColumns: `repeat(${Math.min(Math.ceil(children.length / 5), 3)}, minmax(120px,1fr))`,
        }}
      >
        {children.map((sub) => (
          <Link
            key={sub.slug}
            to={`/products?category=${sub.slug}`}
            onClick={onClose}
            className="block text-[12px] text-gray-700 hover:text-orange-600
                       hover:bg-orange-50 px-2 py-1 rounded transition-colors"
          >
            {sub.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Item cliquable dans la subnav avec dropdown ──────────────────────────────
function NavItem({ cat, onClose }: { cat: Category; onClose: () => void }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const closeRef = useRef<ReturnType<typeof setTimeout>>();
  const hasChildren = (cat.children?.length ?? 0) > 0;

  const open = useCallback(() => {
    clearTimeout(closeRef.current);
    setPanelOpen(true);
  }, []);
  const close = useCallback(() => {
    closeRef.current = setTimeout(() => setPanelOpen(false), 150);
  }, []);
  const keepOpen = useCallback(() => {
    clearTimeout(closeRef.current);
  }, []);

  return (
    <div className="relative" onMouseEnter={open} onMouseLeave={close}>
      <Link
        to={`/products?category=${cat.slug}`}
        onClick={onClose}
        className="flex items-center gap-1 nav-item text-[13px] whitespace-nowrap py-2 px-3
                   hover:text-orange-400 transition-colors"
      >
        {cat.name}
        {hasChildren && (
          <FiChevronDown size={11} className="opacity-60 mt-0.5" />
        )}
      </Link>

      {hasChildren && panelOpen && (
        <div onMouseEnter={keepOpen} onMouseLeave={close}>
          <SubCatPanel
            category={cat}
            onClose={() => {
              setPanelOpen(false);
              onClose();
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── SubNav principal ─────────────────────────────────────────────────────────
export default function SubNav() {
  const { categories, loading } = useCategories();
  const navigate = useNavigate();

  // Catégories parentes uniquement
  const parents = categories.filter((c) => !c.parent);

  const children = parents.flatMap((p) => p.children ?? []);

  const SHOW_PARENTS = parents.length >= 5;

  const navItems = SHOW_PARENTS ? parents : children;
  const close = useCallback(() => {}, []);

  return (
    <div className="bg-gognet-nav-light border-b border-gognet-border relative z-40">
      <div className="flex items-center px-2 max-w-[1600px] mx-auto overflow-x-auto scrollbar-none">
        {/* ── Mega-menu "Tous nos rayons" ── */}
        <CategoryMegaMenu
          categories={categories}
          className="flex-shrink-0 py-1"
        />

        {/* ── Séparateur ── */}
        <span className="text-gray-500 px-2 flex-shrink-0">|</span>

        {/* ── Items statiques ── */}
        {STATIC_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => (item.to ? navigate(item.to) : undefined)}
            className="nav-item flex items-center gap-1.5 flex-shrink-0 py-2 px-3
                       text-[13px] whitespace-nowrap hover:text-orange-400 transition-colors"
          >
            {item.label}
          </button>
        ))}

        {/* ── Séparateur ── */}
        <span className="text-gray-500 px-1 flex-shrink-0">|</span>

        {/* ── Catégories dynamiques ── */}
        {loading ? (
          <span className="nav-item opacity-50 flex items-center gap-1 py-2 px-3 text-[13px]">
            <FiLoader className="animate-spin" size={12} /> Chargement...
          </span>
        ) : (
          <>
            {navItems.slice(0, 10).map((cat) => (
              <NavItem key={cat.slug} cat={cat} onClose={close} />
            ))}
            {navItems.length > 10 && (
              <Link
                to="/products"
                className="nav-item py-2 px-3 text-[13px] text-orange-400 hover:underline whitespace-nowrap"
              >
                + Voir tout
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
