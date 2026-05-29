// src/components/layout/CategoryMegaMenu.tsx
// ══════════════════════════════════════════════════════════════
// Menu mega "Tous nos rayons" style Mytek :
//   - Panel gauche  : catégories parentes
//   - Panel droite  : sous-catégories de la catégorie survolée
//   - Fermeture automatique au clic extérieur ou à la souris
// ══════════════════════════════════════════════════════════════
import { useRef, useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { FiMenu, FiChevronRight, FiGrid } from "react-icons/fi";
import type { Category } from "../../types";

interface Props {
  categories: Category[]; // catégories parentes (parent === null)
  className?: string;
}

// Emoji par nom de catégorie parente (fallback : 📦)
const CAT_ICONS: Record<string, string> = {
  électronique: "💻",
  informatique: "🖥️",
  smartphones: "📱",
  téléphonie: "📱",
  gaming: "🎮",
  audio: "🎧",
  "photo & vidéo": "📷",
  photographie: "📷",
  tv: "📺",
  "tv & son": "📺",
  maison: "🏠",
  "maison & cuisine": "🍳",
  cuisine: "🍳",
  sports: "⚽",
  mode: "👗",
  beauté: "💄",
  livres: "📚",
  jardinage: "🌿",
  jardin: "🌿",
  automobile: "🚗",
  "auto & moto": "🚗",
  jouets: "🧸",
  "jeux & jouets": "🧸",
  "jeux vidéo": "🕹️",
  bureau: "🖨️",
  bureautique: "🖨️",
  santé: "💊",
  "santé & bien-être": "💊",
  alimentation: "🛒",
  "alimentation & épicerie": "🛒",
  électroménager: "🏠",
  réseau: "🌐",
  sécurité: "🔒",
};

function getCatIcon(name: string): string {
  const key = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(CAT_ICONS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return "📦";
}

// Nombre de colonnes pour les sous-catégories
function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function CategoryMegaMenu({ categories, className }: Props) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<Category | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  // Catégories parentes uniquement
  const parents = categories.filter(
    (c) => c.parent === null || c.parent === undefined,
  );

  const handleMouseEnterTrigger = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(true);
    if (parents.length > 0 && !hovered) setHovered(parents[0]);
  }, [parents, hovered]);

  const handleMouseLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setHovered(null);
    }, 180);
  }, []);

  const handleMouseEnterMenu = useCallback(() => {
    clearTimeout(closeTimer.current);
  }, []);

  // Fermer au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setHovered(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sous-catégories de la catégorie survolée
  const children = hovered?.children ?? [];

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className ?? ""}`}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Bouton déclencheur ── */}
      <button
        onMouseEnter={handleMouseEnterTrigger}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2.5 font-bold text-[13px]
                   bg-orange-500 hover:bg-orange-600 text-white rounded-sm
                   transition-colors whitespace-nowrap"
      >
        <FiMenu size={16} />
        <span>Tous nos rayons</span>
      </button>

      {/* ── Panneau mega-menu ── */}
      {open && (
        <div
          className="absolute top-full left-0 z-[200] shadow-2xl border border-gray-200 bg-white
                     flex"
          style={{ minWidth: 700, maxWidth: "90vw" }}
          onMouseEnter={handleMouseEnterMenu}
          onMouseLeave={handleMouseLeave}
        >
          {/* ── Panel gauche : catégories parentes ── */}
          <div className="w-52 flex-shrink-0 bg-gray-50 border-r border-gray-200 py-1">
            {parents.map((cat) => (
              <div
                key={cat.slug}
                onMouseEnter={() => setHovered(cat)}
                className={`flex items-center justify-between px-4 py-2.5 cursor-pointer
                            text-[13px] font-medium transition-colors
                            ${
                              hovered?.slug === cat.slug
                                ? "bg-orange-50 text-orange-600 border-l-2 border-orange-500"
                                : "text-gray-700 hover:bg-gray-100 border-l-2 border-transparent"
                            }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base">{getCatIcon(cat.name)}</span>
                  {cat.name}
                  {cat.product_count != null && cat.product_count > 0 && (
                    <span className="text-[10px] text-gray-400">
                      ({cat.product_count})
                    </span>
                  )}
                </span>
                {(cat.children?.length ?? 0) > 0 && (
                  <FiChevronRight
                    size={13}
                    className="text-gray-400 flex-shrink-0"
                  />
                )}
              </div>
            ))}
          </div>

          {/* ── Panel droite : sous-catégories ── */}
          <div className="flex-1 p-6 bg-white min-h-[300px]">
            {hovered ? (
              <>
                {/* Titre + lien "Voir tout" */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                  <Link
                    to={`/products?category=${hovered.slug}`}
                    onClick={() => setOpen(false)}
                    className="text-[15px] font-bold text-orange-600 hover:underline flex items-center gap-2"
                  >
                    {getCatIcon(hovered.name)} {hovered.name}
                  </Link>
                  <Link
                    to={`/products?category=${hovered.slug}`}
                    onClick={() => setOpen(false)}
                    className="text-[12px] text-blue-600 hover:underline font-medium"
                  >
                    Voir tout ({hovered.product_count ?? 0} produits)
                  </Link>
                </div>

                {children.length > 0 ? (
                  // Grille de sous-catégories en colonnes
                  <div
                    className="grid gap-x-8 gap-y-1"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(Math.ceil(children.length / 6), 4)}, minmax(0, 1fr))`,
                    }}
                  >
                    {chunkArray(
                      children,
                      Math.ceil(
                        children.length /
                          Math.min(Math.ceil(children.length / 6), 4),
                      ),
                    ).map((col, ci) => (
                      <div key={ci} className="space-y-0.5">
                        {col.map((sub) => (
                          <Link
                            key={sub.slug}
                            to={`/products?category=${sub.slug}`}
                            onClick={() => setOpen(false)}
                            className="block text-[13px] text-gray-700 hover:text-orange-600
                                         hover:bg-orange-50 px-2 py-1.5 rounded transition-colors"
                          >
                            {sub.name}
                            {sub.product_count != null &&
                              sub.product_count > 0 && (
                                <span className="ml-1 text-[10px] text-gray-400">
                                  ({sub.product_count})
                                </span>
                              )}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <FiGrid size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">Aucune sous-catégorie</p>
                    <Link
                      to={`/products?category=${hovered.slug}`}
                      onClick={() => setOpen(false)}
                      className="mt-3 text-[13px] text-blue-600 hover:underline"
                    >
                      Voir les produits →
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Survolez une catégorie
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
