import type {
  DbGeoDivision,
  DbGeoDistrict,
} from "./types";
import type {
  Order,
  OrderItem,
  OrderEvent,
  OrderNote,
  OrderNoteType,
} from "@/types/order";
import { formatDateTime } from "@/lib/utils";
import {
  parseDatabaseError,
  DatabaseOperationError,
  validateOrderStatusTransition,
  STATUS_WORKFLOW_FLOW,
  type ParsedDatabaseError,
  type TransitionValidationResult,
} from "./error-handler";
import { uploadToImageKitWithProgress } from "@/lib/imagekit/upload";
import {
  normalizeBdPhone,
  parseBdPhone,
  isValidBdPhone,
  toLocalBdPhone,
  BD_PHONE_REGEX,
} from "@/lib/phone";

export {
  parseDatabaseError,
  DatabaseOperationError,
  validateOrderStatusTransition,
  STATUS_WORKFLOW_FLOW,
  normalizeBdPhone,
  parseBdPhone,
  isValidBdPhone,
  toLocalBdPhone,
  BD_PHONE_REGEX,
};
export type { ParsedDatabaseError, TransitionValidationResult };

export interface BulkStatusUpdateResult {
  success: boolean;
  totalRequested: number;
  updatedCount: number;
  skippedCount: number;
  updatedOrderNumbers: string[];
  skippedOrders: { id: string; reason: string }[];
}

export interface BulkCourierUpdateResult {
  success: boolean;
  totalRequested: number;
  updatedCount: number;
  skippedCount: number;
  updatedOrderNumbers: string[];
  skippedOrders: { id: string; reason: string }[];
}

export interface BulkDeleteResult {
  success: boolean;
  totalRequested: number;
  deletedCount: number;
  skippedCount: number;
  deletedOrderNumbers: string[];
  skippedOrders: { id: string; reason: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS & VARIANTS TYPES + IMAGEKIT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface UiProductVariantItem {
  id: string;
  productId: string;
  sku: string;
  barcode?: string | null;
  name: string;
  nameBn?: string | null;
  packType: string;
  netQuantity: number;
  netUnit: string;
  weightGrams?: number;
  price: number;
  compareAtPrice?: number | null;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock" | "backorder";
  stockQty?: number;
  isActive: boolean;
  isDefault?: boolean;
  isCombo?: boolean;
  comboItems?: Array<{
    id?: string;
    component_variant_id: string;
    quantity: number;
    sort_order?: number;
    product_name?: string;
    product_name_bn?: string;
    variant_name?: string;
    variant_name_bn?: string;
    unit_price?: number;
    weight_grams?: number;
    pack_type?: string;
  }>;
}

export interface UiProductItem {
  id: string;
  name: string;
  nameBn: string;
  slug: string;
  category: string;
  categoryId?: string | null;
  status: "active" | "draft" | "archived";
  variants: number;
  variantList?: UiProductVariantItem[];
  stock: "in_stock" | "low_stock" | "out_of_stock" | "backorder";
  rating: number;
  reviews: number;
  featured: boolean;
  sortOrder: number;
  basePrice?: number;
  maxPrice?: number;
  imageUrl?: string | null;
  grade?: string | null;
  createdAt?: string;
}

export async function uploadProductImageToStorage(
  file: File,
  productId?: string
): Promise<{ path: string; publicUrl: string }> {
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "webp";
  const cleanBaseName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 30);
  const targetId = productId || "temp";
  const folder = `products/${targetId}`;
  const fileName = `${Date.now()}-${cleanBaseName}.${fileExt}`;

  const result = await uploadToImageKitWithProgress(file, {
    folder,
    fileName,
  });

  return {
    path: result.url,
    publicUrl: result.url,
  };
}

export async function deleteProductImageFromStorage(_storagePath: string): Promise<boolean> {
  // Storage is completely hosted on ImageKit CDN
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES TYPES + IMAGEKIT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface UiCategoryItem {
  id: string;
  name: string;
  nameBn: string;
  slug: string;
  parentId?: string | null;
  parent: string;
  description?: string | null;
  descriptionBn?: string | null;
  imagePath?: string | null;
  imageUrl?: string | null;
  productsCount: number;
  displayOrder: number;
  status: "active" | "draft";
  isActive: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export async function uploadCategoryImageToStorage(
  file: File,
  categoryId?: string
): Promise<{ path: string; publicUrl: string }> {
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "webp";
  const cleanBaseName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 30);
  const targetId = categoryId || "general";
  const folder = `categories/${targetId}`;
  const fileName = `${Date.now()}-${cleanBaseName}.${fileExt}`;

  const result = await uploadToImageKitWithProgress(file, {
    folder,
    fileName,
  });

  return {
    path: result.url,
    publicUrl: result.url,
  };
}

export async function deleteCategoryImageFromStorage(_imagePath: string): Promise<boolean> {
  // Category storage is completely hosted on ImageKit CDN
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQS, SHIPPING & POSTS UI TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UiFaqItem {
  id: string;
  category: string;
  question: string;
  questionBn: string;
  answer: string;
  displayOrder: number;
  status: string;
}

export interface UiShippingMethodItem {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  carrier: string;
  baseCost: string;
  perKgCost: string;
  freeAbove: string;
  transitDays: string;
  status: "active" | "inactive";
  type: string;
}

export interface UiDeliveryZoneItem {
  id: string;
  name: string;
  nameBn: string;
  coverage: string;
  divisions: string;
  districtsCount: number;
  baseRate: string;
  extraPerKg: string;
  transitDays: string;
  codAvailable: boolean;
  status: string;
}

export interface UiPostItem {
  id: string;
  title: string;
  titleBn: string;
  slug: string;
  category: string;
  author: string;
  views: number;
  status: "published" | "draft" | "archived";
  publishedDate: string;
  tags: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// GEO DIVISIONS & DISTRICTS (BANGLADESH) FALLBACKS
// ─────────────────────────────────────────────────────────────────────────────

export const fallbackDivisions: DbGeoDivision[] = [
  { id: 1, name: "Barishal", name_bn: "বরিশাল" },
  { id: 2, name: "Chattogram", name_bn: "চট্টগ্রাম" },
  { id: 3, name: "Dhaka", name_bn: "ঢাকা" },
  { id: 4, name: "Khulna", name_bn: "খুলনা" },
  { id: 5, name: "Mymensingh", name_bn: "ময়মনসিংহ" },
  { id: 6, name: "Rajshahi", name_bn: "রাজশাহী" },
  { id: 7, name: "Rangpur", name_bn: "রংপুর" },
  { id: 8, name: "Sylhet", name_bn: "সিলেট" },
];

export const fallbackDistricts: DbGeoDistrict[] = [
  { id: 40, division_id: 4, zone_id: 4, name: "Bagerhat", name_bn: "বাগেরহাট" },
  { id: 17, division_id: 2, zone_id: 2, name: "Bandarban", name_bn: "বান্দরবান" },
  { id: 6, division_id: 1, zone_id: 1, name: "Barguna", name_bn: "বরগুনা" },
  { id: 5, division_id: 1, zone_id: 1, name: "Barishal", name_bn: "বরিশাল" },
  { id: 4, division_id: 1, zone_id: 1, name: "Bhola", name_bn: "ভোলা" },
  { id: 52, division_id: 6, zone_id: 6, name: "Bogura", name_bn: "বগুড়া" },
  { id: 16, division_id: 2, zone_id: 2, name: "Brahmanbaria", name_bn: "ব্রাহ্মণবাড়িয়া" },
  { id: 15, division_id: 2, zone_id: 2, name: "Chandpur", name_bn: "চাঁদপুর" },
  { id: 51, division_id: 6, zone_id: 6, name: "Chapai Nawabganj", name_bn: "চাঁপাইনবাবগঞ্জ" },
  { id: 14, division_id: 2, zone_id: 2, name: "Chattogram", name_bn: "চট্টগ্রাম" },
  { id: 39, division_id: 4, zone_id: 4, name: "Chuadanga", name_bn: "চুয়াডাঙ্গা" },
  { id: 13, division_id: 2, zone_id: 2, name: "Cox's Bazar", name_bn: "কক্সবাজার" },
  { id: 12, division_id: 2, zone_id: 2, name: "Cumilla", name_bn: "কুমিল্লা" },
  { id: 30, division_id: 3, zone_id: 3, name: "Dhaka", name_bn: "ঢাকা" },
  { id: 60, division_id: 7, zone_id: 7, name: "Dinajpur", name_bn: "দিনাজপুর" },
  { id: 29, division_id: 3, zone_id: 3, name: "Faridpur", name_bn: "ফরিদপুর" },
  { id: 11, division_id: 2, zone_id: 2, name: "Feni", name_bn: "ফেনী" },
  { id: 59, division_id: 7, zone_id: 7, name: "Gaibandha", name_bn: "গাইবান্ধা" },
  { id: 28, division_id: 3, zone_id: 3, name: "Gazipur", name_bn: "গাজীপুর" },
  { id: 27, division_id: 3, zone_id: 3, name: "Gopalganj", name_bn: "গোপালগঞ্জ" },
  { id: 64, division_id: 8, zone_id: 8, name: "Habiganj", name_bn: "হবিগঞ্জ" },
  { id: 44, division_id: 5, zone_id: 5, name: "Jamalpur", name_bn: "জামালপুর" },
  { id: 38, division_id: 4, zone_id: 4, name: "Jashore", name_bn: "যশোর" },
  { id: 3, division_id: 1, zone_id: 1, name: "Jhalokathi", name_bn: "ঝালকাঠি" },
  { id: 37, division_id: 4, zone_id: 4, name: "Jhenaidah", name_bn: "ঝিনাইদহ" },
  { id: 50, division_id: 6, zone_id: 6, name: "Joypurhat", name_bn: "জয়পুরহাট" },
  { id: 10, division_id: 2, zone_id: 2, name: "Khagrachhari", name_bn: "খাগড়াছড়ি" },
  { id: 36, division_id: 4, zone_id: 4, name: "Khulna", name_bn: "খুলনা" },
  { id: 26, division_id: 3, zone_id: 3, name: "Kishoreganj", name_bn: "কিশোরগঞ্জ" },
  { id: 58, division_id: 7, zone_id: 7, name: "Kurigram", name_bn: "কুড়িগ্রাম" },
  { id: 35, division_id: 4, zone_id: 4, name: "Kushtia", name_bn: "কুষ্টিয়া" },
  { id: 9, division_id: 2, zone_id: 2, name: "Lakshmipur", name_bn: "লক্ষ্মীপুর" },
  { id: 57, division_id: 7, zone_id: 7, name: "Lalmonirhat", name_bn: "লালমনিরহাট" },
  { id: 25, division_id: 3, zone_id: 3, name: "Madaripur", name_bn: "মাদারীপুর" },
  { id: 34, division_id: 4, zone_id: 4, name: "Magura", name_bn: "মাগুরা" },
  { id: 24, division_id: 3, zone_id: 3, name: "Manikganj", name_bn: "মানিকগঞ্জ" },
  { id: 33, division_id: 4, zone_id: 4, name: "Meherpur", name_bn: "মেহেরপুর" },
  { id: 63, division_id: 8, zone_id: 8, name: "Moulvibazar", name_bn: "মৌলভীবাজার" },
  { id: 23, division_id: 3, zone_id: 3, name: "Munshiganj", name_bn: "মুন্সীগঞ্জ" },
  { id: 43, division_id: 5, zone_id: 5, name: "Mymensingh", name_bn: "ময়মনসিংহ" },
  { id: 49, division_id: 6, zone_id: 6, name: "Naogaon", name_bn: "নওগাঁ" },
  { id: 32, division_id: 4, zone_id: 4, name: "Narail", name_bn: "নড়াইল" },
  { id: 22, division_id: 3, zone_id: 3, name: "Narayanganj", name_bn: "নারায়ণগঞ্জ" },
  { id: 21, division_id: 3, zone_id: 3, name: "Narsingdi", name_bn: "নরসিংদী" },
  { id: 48, division_id: 6, zone_id: 6, name: "Natore", name_bn: "নাটোর" },
  { id: 42, division_id: 5, zone_id: 5, name: "Netrokona", name_bn: "নেত্রকোণা" },
  { id: 56, division_id: 7, zone_id: 7, name: "Nilphamari", name_bn: "নীলফামারী" },
  { id: 8, division_id: 2, zone_id: 2, name: "Noakhali", name_bn: "নোয়াখালী" },
  { id: 47, division_id: 6, zone_id: 6, name: "Pabna", name_bn: "পাবনা" },
  { id: 55, division_id: 7, zone_id: 7, name: "Panchagarh", name_bn: "পঞ্চগড়" },
  { id: 2, division_id: 1, zone_id: 1, name: "Patuakhali", name_bn: "পটুয়াখালী" },
  { id: 1, division_id: 1, zone_id: 1, name: "Pirojpur", name_bn: "পিরোজপুর" },
  { id: 20, division_id: 3, zone_id: 3, name: "Rajbari", name_bn: "রাজবাড়ী" },
  { id: 46, division_id: 6, zone_id: 6, name: "Rajshahi", name_bn: "রাজশাহী" },
  { id: 7, division_id: 2, zone_id: 2, name: "Rangamati", name_bn: "রাঙ্গামাটি" },
  { id: 54, division_id: 7, zone_id: 7, name: "Rangpur", name_bn: "রংপুর" },
  { id: 31, division_id: 4, zone_id: 4, name: "Satkhira", name_bn: "সাতক্ষীরা" },
  { id: 19, division_id: 3, zone_id: 3, name: "Shariatpur", name_bn: "শরীয়তপুর" },
  { id: 41, division_id: 5, zone_id: 5, name: "Sherpur", name_bn: "শেরপুর" },
  { id: 45, division_id: 6, zone_id: 6, name: "Sirajganj", name_bn: "সিরাজগঞ্জ" },
  { id: 62, division_id: 8, zone_id: 8, name: "Sunamganj", name_bn: "সুনামগঞ্জ" },
  { id: 61, division_id: 8, zone_id: 8, name: "Sylhet", name_bn: "সিলেট" },
  { id: 18, division_id: 3, zone_id: 3, name: "Tangail", name_bn: "টাঙ্গাইল" },
  { id: 53, division_id: 7, zone_id: 7, name: "Thakurgaon", name_bn: "ঠাকুরগাঁও" },
];

// ─────────────────────────────────────────────────────────────────────────────
// PURE DB-TO-DOMAIN RECORD MAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function formatDbOrderRecord(data: any): Order {
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 16);
  const rawItems = data.order_items || data.items || [];
  const items: OrderItem[] = rawItems.map((it: any, idx: number) => {
    const weightGrams = Number(it.weight_grams) || 0;
    return {
      id: it.id || `item-db-${idx}-${it.sku}`,
      sku: it.sku || "",
      product_name: it.product_name || "",
      variant_name: it.variant_name || "",
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      line_total: Number(it.line_total) || Number(it.quantity) * Number(it.unit_price),
      variant_id: it.variant_id,
      product_id: it.product_id || null,
      image: it.image || null,
      product_name_bn: it.product_name_bn || it.products?.name_bn || null,
      variant_name_bn: it.variant_name_bn || it.product_variants?.name_bn || null,
      is_combo: Boolean(it.is_combo),
      combo_components: Array.isArray(it.combo_components) ? it.combo_components : [],
      weight_grams: weightGrams,
      weight_kg: weightGrams > 0 ? Number((weightGrams / 1000).toFixed(2)) : undefined,
    };
  });

  const rawEvents = data.order_events || data.timeline || [];
  const events: OrderEvent[] = rawEvents.map((ev: any, idx: number) => ({
    id: String(ev.id || `ev-db-${idx}`),
    event_type: ev.event_type || ev.event || "placed",
    message: ev.message || `Order ${ev.event_type || "updated"}`,
    actor: "Admin Staff",
    created_at: formatDateTime(ev.created_at || ev.at) || formatDateTime(nowStr),
  }));

  const custPhone = data.customer_phone || data.shipping_address?.phone || "";
  const shipPhone = data.shipping_phone || data.shipping_address?.phone || custPhone;
  const recipName = data.shipping_address?.recipient_name || data.customer_name || "";

  return {
    id: data.order_number || data.id,
    uuid: data.id,
    db_id: data.id,
    order_number: data.order_number || data.id,
    customer: data.customer_name || "",
    phone: custPhone,
    alternative_phone: data.customer_alternative_phone || data.shipping_address?.alternative_phone || "",
    shipping_phone: shipPhone,
    recipient_name: recipName,
    email: data.customer_email || "",
    address: {
      division: data.shipping_address?.division || "",
      district: data.shipping_address?.district || "",
      address_line: data.shipping_address?.address_line || "",
      recipient_name: recipName,
      phone: shipPhone,
    },
    status: (data.status as any) || "pending",
    payment: (data.payment_status as any) || "unpaid",
    fulfillment: (data.fulfillment_status as any) || "unfulfilled",
    method: (data.payment_method as any) || "cod",
    channel: data.channel || "web",
    subtotal: Number(data.subtotal) || 0,
    discount_total: Number(data.discount_total) || 0,
    shipping_total: Number(data.shipping_total) || 0,
    grand_total: Number(data.grand_total) || 0,
    amount_paid: Number(data.amount_paid) || 0,
    currency: data.currency || "BDT",
    date: data.placed_at || data.created_at || nowStr,
    customer_note:
      data.customer_note ||
      (() => {
        if (Array.isArray(data.order_notes)) {
          const custNote = data.order_notes.find((n: any) => n && n.type === "customer");
          return custNote ? (custNote.note || custNote.text || "").trim() : "";
        }
        return "";
      })(),
    cancel_reason: data.cancel_reason || "",
    courier_name: data.shipping_method_name || "",
    courier_consignment_id: data.courier_consignment_id ? String(data.courier_consignment_id) : undefined,
    courier_tracking_code: data.courier_tracking_code || undefined,
    courier_tracking_url: data.courier_tracking_url || undefined,
    courier_invoice: data.courier_invoice || undefined,
    courier_delivery_charge:
      data.courier_delivery_charge !== undefined && data.courier_delivery_charge !== null
        ? Number(data.courier_delivery_charge)
        : null,
    courier_payload_snapshot: data.courier_payload_snapshot || null,
    printed_at: data.printed_at || null,
    printed_courier_snapshot: data.printed_courier_snapshot || null,
    total_weight_kg: (() => {
      if (data.total_weight_kg !== undefined && data.total_weight_kg !== null && Number(data.total_weight_kg) > 0) {
        return Number(Number(data.total_weight_kg).toFixed(2));
      }
      const sumGrams = items.reduce((acc, it) => acc + ((it.weight_grams || 0) * (it.quantity || 1)), 0);
      return sumGrams > 0 ? Number((sumGrams / 1000).toFixed(2)) : undefined;
    })(),
    items,
    notes: Array.isArray(data.order_notes)
      ? data.order_notes
          .filter((n: any) => n && (n.note || n.text))
          .sort((a: any, b: any) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            if (timeA !== timeB) return timeB - timeA;
            return String(b.id || "").localeCompare(String(a.id || ""));
          })
          .map((n: any, idx: number) => {
            const rawText = (n.note || n.text || "").trim();
            let parsedType: OrderNoteType = "internal";
            let parsedText = rawText;

            if (n.type === "customer") {
              parsedType = "customer";
            } else if (n.type === "delivery" || n.type === "delivery_note") {
              parsedType = "delivery";
            } else if (n.type === "packaging" || n.type === "packaging_note") {
              parsedType = "packaging";
            } else if (n.type === "system" || n.type === "system_note") {
              parsedType = "system";
            } else {
              parsedType = "internal";
            }

            if (rawText.startsWith("[Delivery Note] ")) {
              parsedText = rawText.replace("[Delivery Note] ", "").trim();
            } else if (rawText.startsWith("[Packaging Note] ")) {
              parsedText = rawText.replace("[Packaging Note] ", "").trim();
            } else if (rawText.startsWith("[Internal Note] ")) {
              parsedText = rawText.replace("[Internal Note] ", "").trim();
            } else if (rawText.startsWith("[System Note] ")) {
              parsedText = rawText.replace("[System Note] ", "").trim();
            }

            return {
              id: String(n.id || `note-${idx}`),
              order_id: String(n.order_id || data.id || ""),
              order_number: String(n.order_number || data.order_number || ""),
              author: n.author || "Admin Staff",
              text: parsedText,
              type: parsedType,
              created_at: formatDateTime(n.created_at || nowStr),
            };
          })
          .filter((n: OrderNote) => n.type !== "customer")
      : [],
    events:
      events.length > 0
        ? events
        : [
            {
              id: `ev-${data.id || data.order_number}`,
              event_type: "placed",
              message: "Order placed",
              actor: "System Checkout",
              created_at: formatDateTime(data.placed_at) || formatDateTime(nowStr),
            },
          ],
    isFromDb: true,
    public_token: data.public_token,
    attribution: data.attribution || null,
  };
}
