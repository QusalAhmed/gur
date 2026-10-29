export interface DbCategory {
  id: string;
  parent_id?: string | null;
  slug: string;
  name: string;
  name_bn?: string | null;
  description?: string | null;
  description_bn?: string | null;
  image_path?: string | null;
  sort_order: number;
  is_active: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbProductVariant {
  id: string;
  product_id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  name_bn?: string | null;
  pack_type: string;
  net_quantity: number;
  net_unit: string;
  weight_grams?: number | null;
  price: number;
  compare_at_price?: number | null;
  min_order_qty: number;
  order_qty_step: number;
  max_order_qty?: number | null;
  track_inventory: boolean;
  allow_backorder: boolean;
  low_stock_threshold: number;
  stock_status: "in_stock" | "low_stock" | "out_of_stock" | "backorder";
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface DbProduct {
  id: string;
  slug: string;
  name: string;
  name_bn?: string | null;
  summary?: string | null;
  summary_bn?: string | null;
  description?: string | null;
  description_bn?: string | null;
  category_id?: string | null;
  status: "draft" | "active" | "archived";
  source: string;
  grade?: string | null;
  uses?: string[];
  origin?: string | null;
  ingredients?: string | null;
  storage_instructions?: string | null;
  shelf_life_days?: number | null;
  nutrition?: Record<string, any> | null;
  specifications?: Record<string, any> | null;
  certifications?: string[];
  tags?: string[];
  tax_rate: number;
  is_featured: boolean;
  sort_order: number;
  rating_avg: number;
  rating_count: number;
  seo_title?: string | null;
  seo_description?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  category?: DbCategory;
  variants?: DbProductVariant[];
  images?: DbProductImage[];
}

export interface DbProductImage {
  id: string;
  product_id: string;
  variant_id?: string | null;
  storage_path: string;
  alt_text?: string | null;
  alt_text_bn?: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at?: string;
  public_url?: string;
}

export interface DbProductCard {
  id: string;
  slug: string;
  name: string;
  name_bn?: string | null;
  summary?: string | null;
  summary_bn?: string | null;
  category_id: string;
  category_slug: string;
  category_name: string;
  category_name_bn?: string | null;
  source: string;
  grade?: string | null;
  uses: string[];
  certifications?: string[];
  is_featured: boolean;
  sort_order: number;
  rating_avg: number;
  rating_count: number;
  published_at?: string | null;
  price_from: number;
  in_stock: boolean;
  image_path?: string | null;
}

export interface DbShippingMethod {
  id: string;
  code: string;
  name: string;
  name_bn?: string | null;
  description?: string | null;
  description_bn?: string | null;
  is_pickup: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface DbShippingRate {
  id: string;
  method_id: string;
  zone_id?: string | null;
  min_weight_grams: number;
  max_weight_grams?: number | null;
  base_rate: number;
  per_kg_rate: number;
  free_above_amount?: number | null;
  estimated_days_min: number;
  estimated_days_max: number;
  is_active: boolean;
}

export interface DbDeliveryZone {
  id: number;
  name: string;
  name_bn?: string | null;
  is_active?: boolean;
}

export interface DbFaq {
  id: string;
  question: string;
  question_bn?: string | null;
  answer: string;
  answer_bn?: string | null;
  topic?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbPost {
  id: string;
  slug: string;
  title: string;
  title_bn?: string | null;
  excerpt?: string | null;
  excerpt_bn?: string | null;
  body: string;
  body_bn?: string | null;
  cover_image_path?: string | null;
  tags?: string[];
  status: "draft" | "published" | "archived";
  published_at?: string | null;
  author_name?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbSiteSetting {
  key: string;
  value: any;
  description?: string | null;
  is_public: boolean;
  updated_at?: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  variant_id?: string | null;
  product_id?: string | null;
  sku: string;
  product_name: string;
  variant_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export type DbOrderNoteType =
  | "internal"
  | "delivery"
  | "packaging"
  | "customer"
  | "staff"
  | "internal_staff_note"
  | "delivery_note"
  | "packaging_note";

export interface DbOrderNote {
  id: string;
  order_id: string;
  order_number?: string;
  type?: DbOrderNoteType;
  author?: string;
  author_id?: string | null;
  author_name?: string;
  note?: string;
  body?: string;
  is_customer_visible?: boolean;
  created_at: string;
}

export interface DbOrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  from_value?: string | null;
  to_value?: string | null;
  message?: string | null;
  actor_id?: string | null;
  created_at: string;
}

export interface DbOrder {
  id: string;
  order_number: string;
  user_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  shipping_address: Record<string, any>;
  billing_address?: Record<string, any> | null;
  status: "incomplete_order" | "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "partially_delivered" | "cancelled" | "returned";
  payment_status: "unpaid" | "partially_paid" | "paid" | "partially_refunded" | "refunded";
  fulfillment_status: "unfulfilled" | "partial" | "fulfilled";
  currency: string;
  subtotal: number;
  shipping_total: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;
  amount_paid: number;
  customer_note?: string | null;
  cancel_reason?: string | null;
  courier_name?: string | null;
  channel: string;
  created_at: string;
  updated_at: string;
  items?: DbOrderItem[];
  notes?: DbOrderNote[];
  events?: DbOrderEvent[];
}

export interface DbGeoDivision {
  id: number;
  name: string;
  name_bn?: string | null;
}

export interface DbGeoDistrict {
  id: number;
  division_id: number;
  zone_id?: number | null;
  name: string;
  name_bn?: string | null;
}

