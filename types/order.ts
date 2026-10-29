export interface OrderItem {
  id: string;
  sku: string;
  product_name: string;
  variant_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  variant_id?: string | null;
}

export type OrderNoteType =
  | "internal"
  | "customer"
  | "delivery"
  | "packaging"
  | "internal_staff_note"
  | "delivery_note"
  | "packaging_note";

export interface OrderNote {
  id: string;
  author: string;
  text: string;
  type: OrderNoteType;
  created_at: string;
  order_id?: string;
  order_number?: string;
  updated_at?: string;
}

export interface OrderEvent {
  id: string;
  event_type: string;
  from_value?: string;
  to_value?: string;
  message: string;
  actor: string;
  created_at: string;
}

export interface Order {
  id: string;
  customer: string;
  phone: string;
  email: string;
  address: {
    division: string;
    district: string;
    address_line: string;
  };
  status:
    | "incomplete_order"
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "partially_delivered"
    | "cancelled"
    | "returned";
  payment: "unpaid" | "partially_paid" | "paid" | "partially_refunded" | "refunded";
  fulfillment: "unfulfilled" | "partial" | "fulfilled";
  method: "cod" | "bkash" | "nagad" | "rocket" | "card" | "bank_transfer" | "credit_terms" | "cash";
  channel: "web" | "phone" | "whatsapp" | "admin" | "facebook" | "walk_in";
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  grand_total: number;
  amount_paid: number;
  currency: string;
  date: string;
  customer_note?: string;
  cancel_reason?: string;
  courier_name?: string;
  items: OrderItem[];
  notes: OrderNote[];
  events: OrderEvent[];
  isFromDb?: boolean;
  public_token?: string;
}

export interface CatalogProduct {
  variant_id?: string;
  product_id?: string;
  sku: string;
  product_name: string;
  variant_name: string;
  category: string;
  unit_price: number;
  stock: string;
  image: string;
}
