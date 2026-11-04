export interface OrderItem {
  id: string;
  sku: string;
  product_name: string;
  variant_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  variant_id?: string | null;
  product_id?: string | null;
  image?: string | null;
}

export type OrderNoteType =
  | "internal"
  | "customer"
  | "delivery"
  | "packaging"
  | "system"
  | "internal_staff_note"
  | "delivery_note"
  | "packaging_note"
  | "system_note";

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
  order_number?: string;
  customer: string;
  phone: string;
  alternative_phone?: string;
  shipping_phone?: string;
  recipient_name?: string;
  email: string;
  address: {
    division: string;
    district: string;
    address_line: string;
    recipient_name?: string;
    phone?: string;
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
  courier_consignment_id?: string;
  courier_tracking_code?: string;
  courier_tracking_url?: string;
  courier_invoice?: string;
  courier_payload_snapshot?: Record<string, any> | null;
  items: OrderItem[];
  notes: OrderNote[];
  events: OrderEvent[];
  isFromDb?: boolean;
  public_token?: string;
  attribution?: Record<string, any> | null;
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

export interface OtherOrderInsight {
  statusText: string;
  note: string;
  badgeStyle: string;
  dotColor: string;
}

export function getOtherOrderInsight(status: string | undefined | null): OtherOrderInsight {
  const s = (status || "").toLowerCase().trim();
  switch (s) {
    case "delivered":
      return {
        statusText: "delivered",
        note: "old customer",
        badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
        dotColor: "bg-emerald-500",
      };
    case "returned":
      return {
        statusText: "returned",
        note: "returned order",
        badgeStyle: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 font-semibold",
        dotColor: "bg-rose-500",
      };
    case "cancelled":
      return {
        statusText: "cancelled",
        note: "cancelled order",
        badgeStyle: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900/50 dark:text-stone-300 dark:border-stone-800",
        dotColor: "bg-stone-400",
      };
    case "shipped":
      return {
        statusText: "shipped",
        note: "order in transit",
        badgeStyle: "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800",
        dotColor: "bg-sky-500",
      };
    case "processing":
      return {
        statusText: "processing",
        note: "processing order",
        badgeStyle: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
        dotColor: "bg-blue-500",
      };
    case "confirmed":
      return {
        statusText: "confirmed",
        note: "confirmed order",
        badgeStyle: "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800",
        dotColor: "bg-teal-500",
      };
    case "pending":
      return {
        statusText: "pending",
        note: "pending order",
        badgeStyle: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
        dotColor: "bg-amber-500",
      };
    case "incomplete_order":
    case "incomplete":
      return {
        statusText: "incomplete",
        note: "incomplete order",
        badgeStyle: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800",
        dotColor: "bg-slate-400",
      };
    default:
      return {
        statusText: s || "previous",
        note: "previous order",
        badgeStyle: "bg-muted text-muted-foreground border-border",
        dotColor: "bg-muted-foreground",
      };
  }
}

