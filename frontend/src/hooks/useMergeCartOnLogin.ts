// src/hooks/useMergeCartOnLogin.ts
//
// Rôle : fusionner le panier local (non-connecté) avec le panier serveur
//        dès que l'utilisateur se connecte.
//
// Comportement :
//   - si l'utilisateur avait des articles dans le panier local →
//       1. resetCart() immédiatement (évite le décompte visuel pendant le merge)
//       2. addToCart() pour chaque item local côté serveur
//       3. fetchCart() final pour synchroniser le state Redux
//   - sinon → fetchCart() directement
//
// Ce hook est déclenché uniquement quand isAuth passe de false → true.

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "./index";
import { selectIsAuthenticated } from "../store/slices/authSlice";
import {
  selectCartItems,
  addToCart,
  fetchCart,
  resetCart,
} from "../store/slices/cartSlice";

export function useMergeCartOnLogin() {
  const dispatch = useAppDispatch();
  const isAuth = useAppSelector(selectIsAuthenticated);
  const localItems = useAppSelector(selectCartItems);

  // Mémorise la valeur précédente pour détecter la transition false → true
  const prevIsAuth = useRef(isAuth);

  useEffect(() => {
    const wasAuth = prevIsAuth.current;
    prevIsAuth.current = isAuth;

    // Ne traiter que la transition false → true (pas le mount initial si déjà connecté)
    if (!isAuth || wasAuth === isAuth) return;

    const mergeAndFetch = async () => {
      // Capturer un snapshot des items locaux AVANT toute mutation du state Redux
      const snapshot = [...localItems];

      if (snapshot.length > 0) {
        // Vider le panier Redux local immédiatement → le compteur passe à 0
        // de façon nette, sans décompte progressif
        dispatch(resetCart());

        // Merger chaque article local vers le serveur (silencieux)
        for (const item of snapshot) {
          try {
            await dispatch(
              addToCart({
                productId: Number(item.product),
                quantity: item.quantity,
              }),
            ).unwrap();
          } catch {
            // Item hors-stock ou erreur réseau → on continue sans bloquer
          }
        }
      }

      // Synchroniser une seule fois depuis le serveur
      dispatch(fetchCart());
    };

    mergeAndFetch();
  }, [isAuth]); // eslint-disable-line react-hooks/exhaustive-deps
}
