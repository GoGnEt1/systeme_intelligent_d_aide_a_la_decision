// src/App.tsx
//
// Point d'entrée de l'application React.
// Responsabilités :
//   1. Définir toutes les routes (React Router v6)
//   2. Protéger les routes privées (PrivateRoute) et admin (AdminRoute)
//   3. Lancer les effets globaux au démarrage (merge panier au login)

import { Routes, Route, Navigate } from "react-router-dom";
import { useAppSelector } from "./hooks";
import { selectIsAuthenticated, selectIsAdmin } from "./store/slices/authSlice";
import { useMergeCartOnLogin } from "./hooks/useMergeCartOnLogin";

// ── Layout ────────────────────────────────────────────────────────────────────
import Layout from "./components/layout/Layout";
import ScrollToTop from "./components/ScrollToTop";

// ── Pages publiques ───────────────────────────────────────────────────────────
import HomePage from "./pages/HomePage";
import ProductListPage from "./pages/ProductListPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import VerifyCodePage from "./pages/VerifyCodePage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import NotFoundPage from "./pages/NotFoundPage";

// ── Pages privées (authentification requise) ──────────────────────────────────
import CheckoutPage from "./pages/CheckoutPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";

// ── Pages admin ───────────────────────────────────────────────────────────────
import AdminDashboards from "./pages/admin/AdminDashboards";
import AnalyticDashboard from "./pages/admin/AnalyticDashboard";
import SegmentDashboard from "./pages/admin/SegmentationDashboard";
import ForeSysDashboard from "./pages/admin/ForeSysDashboard";
import DashboardTab from "./pages/admin/DashboardTab";
// Note: ForeSysDashboard est accessible via l'onglet "ForeSys ML (S5)" dans AdminDashboards (/dashboards)

// ─────────────────────────────────────────────────────────────────────────────
//  Guards de navigation
// ─────────────────────────────────────────────────────────────────────────────

interface GuardProps {
  children: React.ReactNode;
}

/**
 * PrivateRoute — redirige vers /login si l'utilisateur n'est pas connecté.
 * La redirection vers /checkout après login est gérée dans CartDrawer
 * (navigate vers /login avec state.from = "/checkout").
 */
const PrivateRoute: React.FC<GuardProps> = ({ children }) => {
  const isAuth = useAppSelector(selectIsAuthenticated);
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
};

/**
 * AdminRoute — redirige vers / si l'utilisateur n'est pas admin.
 */
const AdminRoute: React.FC<GuardProps> = ({ children }) => {
  const isAdmin = useAppSelector(selectIsAdmin);
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Composant racine
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  // Fusionne le panier local avec le panier serveur dès la connexion
  useMergeCartOnLogin();

  return (
    <div>
      <Routes>
        {/*
         * Toutes les pages partagent le même Layout (Navbar + Footer).
         * <Outlet /> dans Layout.tsx affiche la page enfant active.
         */}
        <Route path="/" element={<Layout />}>
          {/* ── Routes publiques ── */}
          <Route index element={<HomePage />} />
          <Route path="products" element={<ProductListPage />} />
          <Route path="products/:slug" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="verify-code" element={<VerifyCodePage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />

          {/* ── Routes privées (connexion requise) ── */}
          <Route
            path="checkout"
            element={
              <PrivateRoute>
                <CheckoutPage />
              </PrivateRoute>
            }
          />
          <Route
            path="orders"
            element={
              <PrivateRoute>
                <OrdersPage />
              </PrivateRoute>
            }
          />
          <Route
            path="profile"
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />

          {/* ── Routes admin ── */}
          <Route
            path="recommendations"
            element={
              <AdminRoute>
                <AnalyticDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="segmentation"
            element={
              <AdminRoute>
                <SegmentDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="forecast"
            element={
              <AdminRoute>
                <ForeSysDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="dash-home"
            element={
              <AdminRoute>
                <DashboardTab />
              </AdminRoute>
            }
          />
          <Route
            path="dashboards"
            element={
              <AdminRoute>
                <AdminDashboards />
              </AdminRoute>
            }
          />
          {/* ── 404 ── */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>

      {/* Scroll en haut à chaque changement de route */}
      <ScrollToTop />
    </div>
  );
}
