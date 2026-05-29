import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../hooks/index";
import {
  FiShoppingCart,
  FiSearch,
  FiMapPin,
  FiChevronDown,
  FiUser,
  FiMenu,
  FiX,
  FiLogOut,
  FiBarChart2,
  FiShoppingBag,
} from "react-icons/fi";
import {
  logout,
  selectUser,
  selectIsAuthenticated,
} from "../../store/slices/authSlice";
import { selectCartCount } from "../../store/slices/cartSlice";
import {
  openCart,
  setSearchQuery,
  toggleMobileMenu,
  selectMobileMenuOpen,
} from "../../store/slices/uiSlice";
import toast from "react-hot-toast";
import useCategories from "../../hooks/useCategories";

import NotificationsBox from "./NotificationsBox";

// const CATEGORIES = [
//   "Tout",
//   "Électronique",
//   "Mode",
//   "Maison",
//   "Sports",
//   "Beauté",
//   "Livres",
//   "Jeux vidéo",
// ];

export default function Navbar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector(selectUser);
  const isAuth = useAppSelector(selectIsAuthenticated);
  const cartCount = useAppSelector(selectCartCount);
  const mobileMenuOpen = useAppSelector(selectMobileMenuOpen);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const { categories } = useCategories();

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    // console.log("user role: ", user?.role);
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    dispatch(setSearchQuery(query));

    // inclure la catégories sélectionnée dans la recherche
    const params = new URLSearchParams();
    params.set("search", query);
    if (category) params.set("category", category);

    navigate(`/products?${params.toString()}`);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCategory = e.target.value;
    setCategory(selectedCategory);

    navigate(`/products?category=${selectedCategory}`);
  };
  const handleLogout = () => {
    dispatch(logout());
    toast.success("Déconnexion réussie");
    navigate("/");
    setAccountOpen(false);
  };

  return (
    <nav className="bg-gognet-dark sticky top-0 z-50 shadow-lg">
      {/* ── Ligne principale ── */}
      <div className="flex items-center gap-3 p-3 max-w-[1600px] mx-auto">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-end gap-1 px-2 py-1 transition-all duration-150 flex-shrink-0"
        >
          <span className="text-white font-black text-3xl lg:text-4xl leading-none tracking-tight">
            smart
            <span className="text-gognet-orange">shop</span>{" "}
          </span>
          <span className="bg-gognet-orange text-gognet-dark text-[8px] font-black px-1 rounded mb-0.5 leading-tight">
            ML
          </span>
        </Link>

        {/* Livraison — masqué sur mobile */}
        <div
          className="hidden lg:flex flex-col px-2 py-1 border border-transparent rounded
                        hover:border-white cursor-pointer transition-all flex-shrink-0"
        >
          <span className="text-[13px] text-gray-400 flex items-center gap-0.5">
            <FiMapPin className="text-[12px]" /> Livraison sur
          </span>
          <span className="text-white text-[15px] font-bold">
            Toute la Tunisie
          </span>
        </div>

        {/* Barre de recherche */}
        <form
          onSubmit={handleSearch}
          className="flex flex-1 h-12 lg:h-14 rounded overflow-hidden shadow-md min-w-0"
        >
          {/* Catégories : select groupé (parents + enfants) — max-w contrôlé pour ne pas écraser la searchbar */}
          <select
            title="Filtrer par catégorie"
            value={category}
            onChange={handleCategoryChange}
            className="bg-[#F3F3F3] border-r border-gray-300 text-[13px] text-gray-700
                       pl-2 pr-1 cursor-pointer outline-none hidden sm:block flex-shrink-0
                       w-[130px] lg:w-[175px]"
          >
            <option value="">Toutes catégories</option>
            {categories.map((c) =>
              c.children && c.children.length > 0 ? (
                <optgroup key={c.slug} label={c.name}>
                  <option value={c.slug}>— Tout {c.name}</option>
                  {c.children.map((sub) => (
                    <option key={sub.slug} value={sub.slug}>
                      {sub.name}
                    </option>
                  ))}
                </optgroup>
              ) : (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ),
            )}
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Recherche SmartShop"
            // placeholder="Rechercher produits, marques et plus"
            className="flex-1 px-4 text-[14px] lg:text-[16px] outline-none bg-white text-gray-900 min-w-0"
          />
          <button
            type="submit"
            aria-label="search"
            className="bg-gognet-orange hover:bg-gognet-orange-dark w-12 flex items-center
                       justify-center transition-colors duration-150 flex-shrink-0"
          >
            <FiSearch className="text-gray-900 text-xl" />
          </button>
        </form>

        {/* Compte */}
        <div className="relative hidden sm:block" ref={dropRef}>
          <button
            onClick={() => setAccountOpen((o) => !o)}
            className="flex flex-col px-2 py-1 border border-transparent rounded
                       hover:border-white transition-all duration-100 text-left"
          >
            <span className="text-[14px] text-gray-400 whitespace-nowrap">
              {isAuth
                ? `Bonjour, ${user?.first_name}`
                : "Bonjour, identifiez-vous"}
            </span>
            <span className="text-white text-[15px] font-bold flex items-center gap-0.5 whitespace-nowrap">
              Compte <FiChevronDown className="text-[14px]" />
            </span>
          </button>

          {accountOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-2xl
                            border border-gray-200 z-50 animate-fade-in py-2 overflow-hidden"
            >
              {!isAuth ? (
                <div className="px-4 py-3 border-b">
                  <Link to="/login" onClick={() => setAccountOpen(false)}>
                    <button className="btn-secondary text-[14px] w-full mb-2 text-center py-2 rounded">
                      Se connecter
                    </button>
                  </Link>
                  <p className="text-[14px] text-center text-gray-500">
                    Nouveau ?{" "}
                    <Link
                      to="/register"
                      className="text-gognet-blue hover:underline font-medium"
                      onClick={() => setAccountOpen(false)}
                    >
                      Créer un compte
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="px-4 py-2 border-b bg-gray-50">
                  <p className="text-[13px] text-gray-500">
                    Connecté en tant que
                  </p>
                  <p className="font-bold text-gray-800 truncate">
                    {user?.email}
                  </p>
                </div>
              )}
              <div className="py-1 text-[13px]">
                {isAuth && (
                  <>
                    <Link
                      to="/profile"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-gray-700"
                    >
                      <FiUser className="text-gray-400" /> Mon profil
                    </Link>
                    <Link
                      to="/orders"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-gray-700"
                    >
                      <FiShoppingBag className="text-gray-400" /> Mes commandes
                    </Link>
                    {user?.role === "ADMIN" && (
                      <Link
                        to="/dashboards"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-gognet-blue font-bold"
                      >
                        <FiBarChart2 className="text-gray-400" /> Dashboard
                        Admin
                      </Link>
                    )}
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-3"
                    >
                      <FiLogOut className="text-gray-400" /> Se déconnecter
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Retours & Commandes — desktop si simple utilisateur et dashboard admin pour role==ADMIN */}
        {(isAuth && user?.role !== "ADMIN") ||
          (!isAuth && (
            <Link
              to="/orders"
              className="hidden lg:flex flex-col px-2 py-1 border border-transparent rounded
                     hover:border-white transition-all"
            >
              <span className="text-[14px] text-gray-400">Retours</span>
              <span className="text-white text-[15px] font-bold whitespace-nowrap">
                &amp; Commandes
              </span>
            </Link>
          ))}

        {isAuth && user?.role === "ADMIN" && (
          <Link
            to="/dashboards"
            className="hidden lg:flex flex-col px-2 py-1 border border-transparent rounded
                     hover:border-white transition-all"
          >
            <span className="text-[14px] text-gray-400">Dashboard</span>
            <span className="text-white text-[15px] font-bold whitespace-nowrap">
              Admin
            </span>
          </Link>
        )}

        <NotificationsBox />

        {/* Panier */}
        <button
          onClick={() => dispatch(openCart())}
          className="flex items-end gap-1 px-2 py-1 border border-transparent rounded
                     hover:border-white transition-all duration-100 relative group"
        >
          <div className="relative">
            <FiShoppingCart className="text-white text-3xl lg:text-4xl group-hover:scale-110 transition-transform" />
            {cartCount >= 0 && (
              <span
                className="absolute -top-2 -right-1 bg-gognet-orange text-gognet-dark
                               text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center
                               animate-bounce-sm"
              >
                {cartCount > 99 ? "99+" : cartCount || 0}
              </span>
            )}
          </div>
          {/* <span className="text-white text-[15px] font-bold hidden lg:block">
            Panier
          </span> */}
        </button>

        {/* Menu mobile */}
        <button
          onClick={() => dispatch(toggleMobileMenu())}
          className="sm:hidden p-2 text-white hover:text-gognet-orange transition-colors"
        >
          {mobileMenuOpen ? (
            <FiX className="text-xl" />
          ) : (
            <FiMenu className="text-xl" />
          )}
        </button>
      </div>

      {/* Menu mobile dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-gognet-light border-t border-gray-700 py-3 px-4 space-y-2 animate-fade-in">
          {!isAuth ? (
            <div className="flex gap-2">
              <Link
                to="/login"
                onClick={() => dispatch(toggleMobileMenu())}
                className="flex-1 btn-secondary text-center py-2 rounded text-[15px]"
              >
                Se connecter
              </Link>
              <Link
                to="/register"
                onClick={() => dispatch(toggleMobileMenu())}
                className="flex-1 btn-primary text-center py-2 rounded text-[15px]"
              >
                S&apos;inscrire
              </Link>
            </div>
          ) : (
            <div className="text-white text-[15px] font-medium pb-2 border-b border-gray-600">
              Bonjour, {user?.first_name} 👋
            </div>
          )}
          <Link
            to="/orders"
            onClick={() => dispatch(toggleMobileMenu())}
            className="block text-gray-300 hover:text-white text-[15px] py-1"
          >
            Mes commandes
          </Link>
          {isAuth && (
            <>
              <Link
                to="/profile"
                onClick={() => dispatch(toggleMobileMenu())}
                className="block text-gray-300 hover:text-white text-[15px] py-1"
              >
                Mon profil
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  dispatch(toggleMobileMenu());
                }}
                className="block text-red-400 hover:text-red-300 text-[15px] py-1 text-left"
              >
                Se déconnecter
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
