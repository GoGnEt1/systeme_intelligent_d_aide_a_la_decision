// src/pages/NotFoundPage.tsx
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-8xl mb-4">🔍</p>
        <h1 className="text-5xl font-black text-gray-800 mb-2">404</h1>
        <p className="text-xl text-gray-500 mb-6">Page introuvable</p>
        <p className="text-[14px] text-gray-400 mb-8">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link to="/">
          <button className="btn-primary px-8 py-3 rounded-full text-[15px] hover:scale-105 transition-transform">
            ← Retour à l&apos;accueil
          </button>
        </Link>
      </div>
    </div>
  )
}
