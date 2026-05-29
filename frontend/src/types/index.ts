// ============================================================
//  types/index.ts — Tous les types TypeScript de SmartShop
// ============================================================

// ── Utilisateur ─────────────────────────────────────────────
export type UserRole = "CLIENT" | "ADMIN";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: UserRole;
  address?: string;
  city?: string;
  postal_code?: string;
  rfm_segment?: string;
  rfm_score?: number | null;
  date_joined?: string;
  profile_image?: string;
}

export interface Address {
  id: number;
  label: string;
  full_name: string;
  phone: string;
  address_line: string;
  city: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

// ── Auth ──────────────────────────────────────────────────
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  password2: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user: User;
}

// ── Produits ──────────────────────────────────────────────
export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent?: number | null;
  parent_name?: string | null;
  parent_slug?: string | null;
  children?: Category[];
  is_active: boolean;
  order: number;
  product_count?: number;
}

export interface ProductImage {
  id: number;
  image: string;
  alt_text?: string;
  is_primary: boolean;
  order: number;
}

export interface Review {
  id: number;
  user_name: string;
  rating: number;
  title?: string;
  comment: string;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description?: string;
  sku: string;
  category: number;
  category_name: string;
  category_slug?: string;
  price: number | string;
  original_price?: number | string | null;
  stock_quantity: number;
  image?: string | null;
  images?: ProductImage[];
  view_count?: number;
  purchase_count?: number;
  status: "ACTIVE" | "INACTIVE" | "DRAFT";
  is_featured: boolean;
  average_rating: number;
  review_count: number;
  discount_percentage?: number;
  is_in_stock?: boolean;
  reviews?: Review[];
  created_at?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ── Panier ────────────────────────────────────────────────
export interface CartItem {
  id: number;
  product: number;
  product_id: number;
  product_name: string;
  product_image?: string | null;
  // product_images?: ProductImage[];
  product_slug?: string;
  unit_price: number | string;
  quantity: number;
  subtotal: number | string;
}

export interface Cart {
  id: number;
  items: CartItem[];
  total: number | string;
  item_count: number;
  shipping_cost: number | string;
  tva_timbre: number | string;
  grand_total: number | string;
}

// ── Paiement ─────────────────────────────────────────────
export type PaymentMethod = "COD" | "MOBILE" | "CARD";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export interface Payment {
  id: number;
  method: PaymentMethod;
  method_display: string;
  status: PaymentStatus;
  status_display: string;
  amount: number | string;
  idinar_number?: string;
  card_last4?: string;
  card_brand?: string;
  transaction_ref?: string;
  created_at: string;
}

// ── Historique statut commande ────────────────────────────
export interface OrderStatusHistory {
  id: number;
  old_status: string;
  old_status_display: string;
  new_status: string;
  new_status_display: string;
  changed_by_name: string;
  changed_at: string;
  note?: string;
}

// ── Commandes ─────────────────────────────────────────────
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export interface OrderItem {
  id: number;
  product: number;
  product_name: string;
  product_image?: string | null;
  product_slug?: string;
  unit_price: number | string;
  quantity: number;
  subtotal?: number | string;
}

export interface Order {
  id: number;
  order_number: string;
  status: OrderStatus;
  status_display?: string;
  can_cancel?: boolean;
  items: OrderItem[];
  payment?: Payment;
  status_history?: OrderStatusHistory[];

  subtotal: number | string;
  shipping_cost: number | string;
  tva_timbre?: number | string;
  discount_amount: number | string;
  total_amount: number | string;

  notes?: string;
  shipping_address?: Address | null;

  // Snapshot adresse
  shipping_full_name?: string;
  shipping_address_line?: string;
  shipping_city?: string;
  shipping_postal_code?: string;
  shipping_phone?: string;
  shipping_country?: string;

  // Livraison — gestion des absences
  delivery_date?: string | null; // "2026-04-10" (YYYY-MM-DD)
  delivery_attempts?: number; // 0 | 1 | 2
  no_more_delivery?: boolean; // true = épuisé ses chances

  created_at: string;
  updated_at: string;
  delivered_at?: string | null;
}

export interface CreateOrderPayload {
  shipping_address_id?: number;
  notes?: string;
  // Pour les utilisateurs sans compte, on passe les infos directement
  guest_email?: string;
  guest_phone?: string;
  shipping_info?: {
    full_name: string;
    address_line: string;
    city: string;
    postal_code: string;
    phone: string;
  };
}

// ── Redux State ───────────────────────────────────────────
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: Record<string, string[]> | string | null;
}

export interface CartState {
  items: CartItem[];
  total: number;
  count: number;
  loading: boolean;
  error: string | null;
}

export interface UIState {
  cartOpen: boolean;
  searchQuery: string;
  mobileMenuOpen: boolean;
}

export interface RootState {
  auth: AuthState;
  cart: CartState;
  ui: UIState;
}

// ── ML ───────────────────────────────────────────────────
export interface MLStat {
  icon: string;
  label: string;
  value: string;
}

export interface ForecastBar {
  value: number;
  isPrediction: boolean;
}

export interface RFMSegment {
  name: string;
  pct: number;
  color: string;
  count: string;
}
