// src/components/layout/Footer.tsx
import { Link } from "react-router-dom";

const COLUMNS = [
  {
    title: "À propos de SmartShop",
    links: {
      labels: ["Qui sommes-nous", "Carrières", "Presse", "Technologie ML"],
      urls: ["", "", "", ""],
      // urls: ["/about", "/careers", "/press", "/ml"],
    },
  },
  {
    title: "Aide & Services",
    links: {
      labels: [
        "Aide & FAQ",
        "Retours & Remboursements",
        "Livraison & Délais",
        "Paiements sécurisés",
      ],
      urls: ["", "", "", ""],
    },
  },
  {
    title: "Vendeurs",
    links: {
      labels: [
        "Vendre sur SmartShop",
        "Publicité",
        "Outils vendeur",
        "Dashboard Analytique",
      ],
      urls: ["", "", "", "/dashboards"],
    },
  },
  {
    title: "SmartShop Pro",
    links: {
      labels: [
        "Prime",
        "Business",
        // "Dashboard Décisionnel",
        "API Recommandations",
      ],
      urls: ["", "", "", ""],
    },
  },
];

export default function Footer() {
  return (
    <footer className="bg-gognet-dark text-gray-300 mt-8">
      {/* Colonnes */}
      <div className="max-w-[1200px] mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="text-white font-bold text-[15px] mb-3">
              {col.title}
            </h4>
            <ul className="space-y-2">
              {col.links.labels.map((l, i) => (
                <li key={i}>
                  <Link
                    to={col.links.urls[i] ?? "#"}
                    className="text-[14px] text-gray-400 hover:text-white hover:underline transition-colors"
                  >
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Logo & copyright */}
      <div className="border-t border-gray-700 py-6 text-center">
        <div className="flex items-center justify-center gap-1 mb-3">
          <span className="text-white font-black text-2xl">
            smart
            <span className="text-gognet-orange">shop</span>
          </span>
          <span className="bg-gognet-orange text-gognet-dark text-[8px] font-black px-1 rounded ml-0.5">
            ML
          </span>
        </div>
        <p className="text-[13px] text-gray-500">
          &copy; 2026, Tous droit reservés.
        </p>
      </div>
    </footer>
  );
}

{
  /* <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="w-full bg-gognet-nav-light hover:bg-gray-700 text-white text-[13px] py-3
                   text-center transition-colors duration-150"
      >
        Revenir en haut de page
      </button> 
      <p className="text-[12px] text-gray-600 mt-1">
          SmartShop — PFE LGLSI3 FSG Tunisie · Système intelligent
          d&apos;aide à la décision e-commerce
          Django REST · React TypeScript · FastAPI · PostgreSQL · ML: Prophet ·
          K-Means · Collaborative Filtering
        </p>
      */
}
