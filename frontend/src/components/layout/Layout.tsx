// src/components/layout/Layout.tsx
import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/index";
import { fetchCart } from "../../store/slices/cartSlice";
import { selectIsAuthenticated } from "../../store/slices/authSlice";
import Navbar from "./Navbar";
import SubNav from "./SubNav";
import Footer from "./Footer";
import CartDrawer from "../../components/cart/CartDrawer";
import { selectCartOpen, closeCart } from "../../store/slices/uiSlice";

export default function Layout() {
  const dispatch = useAppDispatch();
  const isAuth = useAppSelector(selectIsAuthenticated);
  const cartOpen = useAppSelector(selectCartOpen);

  // Charger le panier si connecté
  useEffect(() => {
    if (isAuth) dispatch(fetchCart());
  }, [isAuth, dispatch]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Navbar />
      <SubNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer open={cartOpen} onClose={() => dispatch(closeCart())} />
    </div>
  );
}
