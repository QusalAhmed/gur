"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertStaffRole, getActorUuid } from "@/lib/admin-guard";
import { isValidUuid } from "@/lib/security";
import { mapDatabaseError } from "@/lib/admin-errors";
import { normalizeBDPhone } from "@/lib/admin-format";
import {
  computePurchaseSettlement,
  computePurchaseTotals,
  PurchaseSettlementStatus,
  roundMoney,
  SupplierType,
  SupplierLedgerStatus,
} from "@/lib/supplier-ledger";
import { Database } from "@/types/database.types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export interface HubSupplier {
  id: string;
  name: string;
  supplierType: SupplierType;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  openingBalance: number;
  isActive: boolean;
  totalPurchased: number;
  totalPaid: number;
  netBalance: number;
  purchaseCount: number;
  paymentCount: number;
  lastActivityDate: string | null;
}

export interface HubPurchaseItem {
  id: string;
  purchaseId: string;
  productId: string | null;
  variantId: string | null;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  stockMovementId: number | null;
}

export interface HubPurchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  purchaseDate: string;
  subtotal: number;
  extraCharges: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingDue: number;
  settlementStatus: PurchaseSettlementStatus;
  notes: string | null;
  status: SupplierLedgerStatus;
  voidReason: string | null;
  voidedAt: string | null;
  createdAt: string;
  items: HubPurchaseItem[];
}

export interface HubPayment {
  id: string;
  paymentNumber: string;
  supplierId: string;
  supplierName: string;
  purchaseId: string | null;
  purchaseNumber: string | null;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidBy: string | null;
  reference: string | null;
  notes: string | null;
  status: SupplierLedgerStatus;
  voidReason: string | null;
  voidedAt: string | null;
  createdAt: string;
}

export interface CatalogProductOption {
  productId: string;
  name: string;
}

export interface SupplierHubData {
  canManage: boolean;
  suppliers: HubSupplier[];
  purchases: HubPurchase[];
  payments: HubPayment[];
  products: CatalogProductOption[];
}

const VALID_SUPPLIER_TYPES = new Set<SupplierType>([
  "gachi",
  "mill",
  "packaging",
  "trader",
  "other",
]);

function isIsoDate(val: unknown): val is string {
  return typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
}

export async function getSupplierHubDataAction(): Promise<{
  success: boolean;
  data: SupplierHubData;
  error?: string;
}> {
  const empty: SupplierHubData = {
    canManage: false,
    suppliers: [],
    purchases: [],
    payments: [],
    products: [],
  };

  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const canManage = ["owner", "admin", "manager"].includes(session.role);
    const supabase = getSupabaseAdmin();

    const { data: rawSuppliers, error: supErr } = await supabase
      .from("suppliers")
      .select("id, name, supplier_type, contact_name, phone, address, notes, opening_balance, is_active")
      .order("name", { ascending: true });

    if (supErr) throw supErr;

    if (!canManage) {
      return {
        success: true,
        data: {
          ...empty,
          canManage: false,
          suppliers: (rawSuppliers || []).map((s) => ({
            id: s.id,
            name: s.name,
            supplierType: VALID_SUPPLIER_TYPES.has(s.supplier_type as SupplierType)
              ? (s.supplier_type as SupplierType)
              : "gachi",
            contactName: s.contact_name,
            phone: s.phone,
            address: s.address,
            notes: s.notes,
            openingBalance: 0,
            isActive: Boolean(s.is_active),
            totalPurchased: 0,
            totalPaid: 0,
            netBalance: 0,
            purchaseCount: 0,
            paymentCount: 0,
            lastActivityDate: null,
          })),
        },
      };
    }

    const [balRes, purRes, payRes, prodRes] = await Promise.all([
      supabase.from("supplier_balances").select("*"),
      supabase
        .from("supplier_purchases")
        .select(
          `
          id, purchase_number, supplier_id, purchase_date, subtotal, extra_charges,
          discount_amount, total_amount, notes, status, void_reason, voided_at, created_at,
          supplier_purchase_items (
            id, purchase_id, product_id, variant_id, item_name, quantity, unit, unit_price, line_total, stock_movement_id
          )
        `
        )
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("supplier_payments")
        .select(
          "id, payment_number, supplier_id, purchase_id, payment_date, amount, payment_method, paid_by, reference, notes, status, void_reason, voided_at, created_at"
        )
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("products")
        .select("id, name")
        .eq("status", "active")
        .order("name", { ascending: true }),
    ]);

    if (balRes.error) throw balRes.error;
    if (purRes.error) throw purRes.error;
    if (payRes.error) throw payRes.error;
    if (prodRes.error) throw prodRes.error;

    const supplierNameMap = new Map<string, string>();
    (rawSuppliers || []).forEach((s) => supplierNameMap.set(s.id, s.name));

    const balMap = new Map<string, (typeof balRes.data)[number]>();
    (balRes.data || []).forEach((b) => {
      if (b.supplier_id) balMap.set(b.supplier_id, b);
    });

    const suppliers: HubSupplier[] = (rawSuppliers || []).map((s) => {
      const b = balMap.get(s.id);
      const opening = roundMoney(Number(s.opening_balance || 0));
      const purchased = roundMoney(Number(b?.total_purchased || 0));
      const paid = roundMoney(Number(b?.total_paid || 0));
      const net = roundMoney(
        b?.net_balance !== null && b?.net_balance !== undefined
          ? Number(b.net_balance)
          : opening + purchased - paid
      );

      return {
        id: s.id,
        name: s.name,
        supplierType: VALID_SUPPLIER_TYPES.has(s.supplier_type as SupplierType)
          ? (s.supplier_type as SupplierType)
          : "gachi",
        contactName: s.contact_name,
        phone: s.phone,
        address: s.address,
        notes: s.notes,
        openingBalance: opening,
        isActive: Boolean(s.is_active),
        totalPurchased: purchased,
        totalPaid: paid,
        netBalance: net,
        purchaseCount: Number(b?.purchase_count || 0),
        paymentCount: Number(b?.payment_count || 0),
        lastActivityDate: b?.last_activity_date || null,
      };
    });

    type PurchaseItemRow = Database["public"]["Tables"]["supplier_purchase_items"]["Row"];
    type PurchaseQueryRow = Database["public"]["Tables"]["supplier_purchases"]["Row"] & {
      supplier_purchase_items: PurchaseItemRow[] | null;
    };

    const linkedPaidByPurchase = new Map<string, number>();
    (payRes.data || []).forEach((pay) => {
      if (pay.status === "active" && pay.purchase_id) {
        linkedPaidByPurchase.set(
          pay.purchase_id,
          roundMoney((linkedPaidByPurchase.get(pay.purchase_id) || 0) + Number(pay.amount || 0))
        );
      }
    });

    const purchaseNumberMap = new Map<string, string>();
    const purchases: HubPurchase[] = ((purRes.data || []) as PurchaseQueryRow[]).map((p) => {
      purchaseNumberMap.set(p.id, p.purchase_number);
      const rawItems = Array.isArray(p.supplier_purchase_items) ? p.supplier_purchase_items : [];
      const totalAmount = roundMoney(
        Number(
          p.total_amount ??
            Number(p.subtotal || 0) + Number(p.extra_charges || 0) - Number(p.discount_amount || 0)
        )
      );
      const status: SupplierLedgerStatus = p.status === "voided" ? "voided" : "active";
      const settlement = computePurchaseSettlement(
        totalAmount,
        linkedPaidByPurchase.get(p.id) || 0,
        status
      );

      return {
        id: p.id,
        purchaseNumber: p.purchase_number,
        supplierId: p.supplier_id,
        supplierName: supplierNameMap.get(p.supplier_id) || "Supplier",
        purchaseDate: p.purchase_date,
        subtotal: roundMoney(Number(p.subtotal || 0)),
        extraCharges: roundMoney(Number(p.extra_charges || 0)),
        discountAmount: roundMoney(Number(p.discount_amount || 0)),
        totalAmount,
        paidAmount: settlement.paidAmount,
        remainingDue: settlement.remainingDue,
        settlementStatus: settlement.settlementStatus,
        notes: p.notes,
        status,
        voidReason: p.void_reason,
        voidedAt: p.voided_at,
        createdAt: p.created_at,
        items: rawItems.map((it) => ({
          id: it.id,
          purchaseId: it.purchase_id,
          productId: it.product_id,
          variantId: it.variant_id,
          itemName: it.item_name,
          quantity: Number(it.quantity),
          unit: it.unit,
          unitPrice: roundMoney(Number(it.unit_price)),
          lineTotal: roundMoney(Number(it.line_total ?? Number(it.quantity) * Number(it.unit_price))),
          stockMovementId: it.stock_movement_id ?? null,
        })),
      };
    });

    const payments: HubPayment[] = (payRes.data || []).map((pay) => ({
      id: pay.id,
      paymentNumber: pay.payment_number,
      supplierId: pay.supplier_id,
      supplierName: supplierNameMap.get(pay.supplier_id) || "Supplier",
      purchaseId: pay.purchase_id,
      purchaseNumber: pay.purchase_id ? purchaseNumberMap.get(pay.purchase_id) || null : null,
      paymentDate: pay.payment_date,
      amount: roundMoney(Number(pay.amount)),
      paymentMethod: pay.payment_method,
      paidBy: pay.paid_by,
      reference: pay.reference,
      notes: pay.notes,
      status: pay.status === "voided" ? "voided" : "active",
      voidReason: pay.void_reason,
      voidedAt: pay.voided_at,
      createdAt: pay.created_at,
    }));

    const products: CatalogProductOption[] = (prodRes.data || []).map((p) => ({
      productId: p.id,
      name: p.name,
    }));

    return {
      success: true,
      data: {
        canManage,
        suppliers,
        purchases,
        payments,
        products,
      },
    };
  } catch (err: unknown) {
    const friendly = mapDatabaseError(err);
    return { success: false, data: empty, error: friendly.message };
  }
}

export async function upsertSupplierAction(payload: {
  id?: string;
  name: string;
  supplierType?: SupplierType;
  contactName?: string;
  phone?: string;
  address?: string;
  notes?: string;
  openingBalance?: number;
  isActive?: boolean;
}): Promise<{ ok: boolean; supplierId?: string; message?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    const name = payload.name?.trim();
    if (!name || name.length < 2 || name.length > 200) {
      return { ok: false, message: "Supplier name must be between 2 and 200 characters." };
    }

    let normalizedPhone: string | null = null;
    if (payload.phone?.trim()) {
      normalizedPhone = normalizeBDPhone(payload.phone.trim());
      if (!normalizedPhone) {
        return { ok: false, message: "Enter a valid Bangladeshi phone number (e.g. 017XXXXXXXX)." };
      }
    }

    const supplierType: SupplierType =
      payload.supplierType && VALID_SUPPLIER_TYPES.has(payload.supplierType)
        ? payload.supplierType
        : "gachi";

    const openingBalance = Number(payload.openingBalance ?? 0);
    if (!Number.isFinite(openingBalance)) {
      return { ok: false, message: "Opening balance must be a valid number." };
    }

    const supabase = getSupabaseAdmin();
    const record = {
      name,
      supplier_type: supplierType,
      contact_name: payload.contactName?.trim() || null,
      phone: normalizedPhone,
      address: payload.address?.trim() || null,
      notes: payload.notes?.trim() || null,
      opening_balance: roundMoney(openingBalance),
      is_active: payload.isActive ?? true,
    };

    if (payload.id) {
      if (!isValidUuid(payload.id)) return { ok: false, message: "Invalid supplier ID." };
      const { error } = await supabase.from("suppliers").update(record).eq("id", payload.id);
      if (error) return { ok: false, message: mapDatabaseError(error).message };
      revalidatePath("/admin/suppliers");
      revalidatePath("/admin/batches");
      return { ok: true, supplierId: payload.id };
    }

    const { data, error } = await supabase.from("suppliers").insert(record).select("id").single();
    if (error) return { ok: false, message: mapDatabaseError(error).message };

    revalidatePath("/admin/suppliers");
    revalidatePath("/admin/batches");
    return { ok: true, supplierId: data.id };
  } catch (err: unknown) {
    return { ok: false, message: mapDatabaseError(err).message };
  }
}

export interface SavePurchaseLineInput {
  productId?: string | null;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export async function saveSupplierPurchaseAction(payload: {
  id?: string;
  supplierId: string;
  purchaseDate: string;
  extraCharges?: number;
  discountAmount?: number;
  notes?: string;
  items: SavePurchaseLineInput[];
  // Optional create-time conveniences
  paidNowAmount?: number;
  paidNowBy?: string;
}): Promise<{ ok: boolean; purchaseId?: string; message?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager"]);
    if (!isValidUuid(payload.supplierId)) {
      return { ok: false, message: "Please select a valid supplier." };
    }
    if (!isIsoDate(payload.purchaseDate)) {
      return { ok: false, message: "Please choose a valid purchase date." };
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return { ok: false, message: "Add at least one product line item." };
    }

    const cleanItems = payload.items.map((item) => ({
      productId: item.productId && isValidUuid(item.productId) ? item.productId : null,
      variantId: null,
      itemName: String(item.itemName || "").trim(),
      quantity: Number(item.quantity),
      unit: "kg",
      unitPrice: Number(item.unitPrice),
    }));

    for (const it of cleanItems) {
      if (!it.itemName || it.itemName.length > 200) {
        return { ok: false, message: "Every item needs a valid product name." };
      }
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
        return { ok: false, message: `Quantity for "${it.itemName}" must be greater than zero.` };
      }
      if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) {
        return { ok: false, message: `Unit price for "${it.itemName}" cannot be negative.` };
      }
    }

    const extraCharges = Number(payload.extraCharges ?? 0);
    const discountAmount = Number(payload.discountAmount ?? 0);
    if (!Number.isFinite(extraCharges) || extraCharges < 0) {
      return { ok: false, message: "Extra charges cannot be negative." };
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      return { ok: false, message: "Discount cannot be negative." };
    }

    const totals = computePurchaseTotals(cleanItems, extraCharges, discountAmount);
    if (!totals.isDiscountValid) {
      return { ok: false, message: "Discount cannot exceed subtotal plus extra charges." };
    }

    const paidNowAmount = Number(payload.paidNowAmount ?? 0);
    if (!Number.isFinite(paidNowAmount) || paidNowAmount < 0) {
      return { ok: false, message: "Cash paid amount cannot be negative." };
    }

    const supabase = getSupabaseAdmin();
    const actorId = getActorUuid(session);

    if (payload.id) {
      if (!isValidUuid(payload.id)) return { ok: false, message: "Invalid purchase ID." };
      const { data: existing, error: fetchErr } = await supabase
        .from("supplier_purchases")
        .select("id, status")
        .eq("id", payload.id)
        .single();
      if (fetchErr || !existing) return { ok: false, message: "Purchase record not found." };
      if (existing.status === "voided") {
        return { ok: false, message: "Voided purchases cannot be edited." };
      }

      const { data: oldItems } = await supabase
        .from("supplier_purchase_items")
        .select("id")
        .eq("purchase_id", payload.id);

      const { error: updErr } = await supabase
        .from("supplier_purchases")
        .update({
          supplier_id: payload.supplierId,
          purchase_date: payload.purchaseDate,
          extra_charges: totals.extraCharges,
          discount_amount: totals.discountAmount,
          notes: payload.notes?.trim() || null,
        })
        .eq("id", payload.id);
      if (updErr) return { ok: false, message: mapDatabaseError(updErr).message };

      const { error: insErr } = await supabase.from("supplier_purchase_items").insert(
        cleanItems.map((it) => ({
          purchase_id: payload.id!,
          product_id: it.productId,
          variant_id: it.variantId,
          item_name: it.itemName,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: roundMoney(it.unitPrice),
        }))
      );
      if (insErr) return { ok: false, message: mapDatabaseError(insErr).message };

      const oldIds = (oldItems || []).map((r) => r.id);
      if (oldIds.length > 0) {
        const { error: delErr } = await supabase
          .from("supplier_purchase_items")
          .delete()
          .in("id", oldIds);
        if (delErr) return { ok: false, message: mapDatabaseError(delErr).message };
      }

      revalidatePath("/admin/suppliers");
      return { ok: true, purchaseId: payload.id };
    }

    // Create new purchase
    const { data: createdPurchase, error: purErr } = await supabase
      .from("supplier_purchases")
      .insert({
        supplier_id: payload.supplierId,
        purchase_date: payload.purchaseDate,
        extra_charges: totals.extraCharges,
        discount_amount: totals.discountAmount,
        notes: payload.notes?.trim() || null,
        created_by: actorId,
      })
      .select("id, purchase_number")
      .single();

    if (purErr || !createdPurchase) {
      return { ok: false, message: mapDatabaseError(purErr).message };
    }

    const itemRows: Database["public"]["Tables"]["supplier_purchase_items"]["Insert"][] =
      cleanItems.map((it) => ({
        purchase_id: createdPurchase.id,
        product_id: it.productId,
        variant_id: null,
        item_name: it.itemName,
        quantity: it.quantity,
        unit: "kg",
        unit_price: roundMoney(it.unitPrice),
        stock_movement_id: null,
      }));

    const { error: itemsErr } = await supabase.from("supplier_purchase_items").insert(itemRows);
    if (itemsErr) {
      return { ok: false, message: mapDatabaseError(itemsErr).message };
    }

    if (paidNowAmount > 0) {
      const { error: payErr } = await supabase.from("supplier_payments").insert({
        supplier_id: payload.supplierId,
        purchase_id: createdPurchase.id,
        payment_date: payload.purchaseDate,
        amount: roundMoney(paidNowAmount),
        payment_method: "cash",
        paid_by: payload.paidNowBy?.trim() || session.user.name,
        notes: `Cash paid on purchase ${createdPurchase.purchase_number}`,
        created_by: actorId,
      });
      if (payErr) {
        return { ok: false, message: `Purchase saved, but payment failed: ${mapDatabaseError(payErr).message}` };
      }
    }

    revalidatePath("/admin/suppliers");
    return { ok: true, purchaseId: createdPurchase.id };
  } catch (err: unknown) {
    return { ok: false, message: mapDatabaseError(err).message };
  }
}

export async function voidSupplierPurchaseAction(payload: {
  id: string;
  reason: string;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager"]);
    if (!isValidUuid(payload.id)) return { ok: false, message: "Invalid purchase ID." };
    const reason = payload.reason?.trim();
    if (!reason) return { ok: false, message: "A void reason is required." };

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("supplier_purchases")
      .update({
        status: "voided",
        void_reason: reason.slice(0, 500),
        voided_at: new Date().toISOString(),
        voided_by: getActorUuid(session),
      })
      .eq("id", payload.id)
      .eq("status", "active");

    if (error) return { ok: false, message: mapDatabaseError(error).message };
    revalidatePath("/admin/suppliers");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, message: mapDatabaseError(err).message };
  }
}

export async function saveSupplierPaymentAction(payload: {
  id?: string;
  supplierId: string;
  purchaseId?: string | null;
  paymentDate: string;
  amount: number;
  paymentMethod?: PaymentMethod;
  paidBy?: string;
  reference?: string;
  notes?: string;
}): Promise<{ ok: boolean; paymentId?: string; message?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager"]);
    if (!isValidUuid(payload.supplierId)) {
      return { ok: false, message: "Please select a valid supplier." };
    }
    if (payload.purchaseId && !isValidUuid(payload.purchaseId)) {
      return { ok: false, message: "Invalid linked purchase ID." };
    }
    if (!isIsoDate(payload.paymentDate)) {
      return { ok: false, message: "Please choose a valid payment date." };
    }

    const amount = roundMoney(Number(payload.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: "Payment amount must be greater than zero." };
    }

    const supabase = getSupabaseAdmin();
    const record = {
      supplier_id: payload.supplierId,
      purchase_id: payload.purchaseId || null,
      payment_date: payload.paymentDate,
      amount,
      payment_method: (payload.paymentMethod || "cash") as PaymentMethod,
      paid_by: payload.paidBy?.trim() || null,
      reference: payload.reference?.trim() || null,
      notes: payload.notes?.trim() || null,
    };

    if (payload.id) {
      if (!isValidUuid(payload.id)) return { ok: false, message: "Invalid payment ID." };
      const { data: existing } = await supabase
        .from("supplier_payments")
        .select("id, status")
        .eq("id", payload.id)
        .single();
      if (!existing) return { ok: false, message: "Payment record not found." };
      if (existing.status === "voided") {
        return { ok: false, message: "Voided payments cannot be edited." };
      }

      const { error } = await supabase
        .from("supplier_payments")
        .update(record)
        .eq("id", payload.id);
      if (error) return { ok: false, message: mapDatabaseError(error).message };

      revalidatePath("/admin/suppliers");
      return { ok: true, paymentId: payload.id };
    }

    const { data, error } = await supabase
      .from("supplier_payments")
      .insert({
        ...record,
        created_by: getActorUuid(session),
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, message: mapDatabaseError(error).message };
    }

    revalidatePath("/admin/suppliers");
    return { ok: true, paymentId: data.id };
  } catch (err: unknown) {
    return { ok: false, message: mapDatabaseError(err).message };
  }
}

export async function voidSupplierPaymentAction(payload: {
  id: string;
  reason: string;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager"]);
    if (!isValidUuid(payload.id)) return { ok: false, message: "Invalid payment ID." };
    const reason = payload.reason?.trim();
    if (!reason) return { ok: false, message: "A void reason is required." };

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("supplier_payments")
      .update({
        status: "voided",
        void_reason: reason.slice(0, 500),
        voided_at: new Date().toISOString(),
        voided_by: getActorUuid(session),
      })
      .eq("id", payload.id)
      .eq("status", "active");

    if (error) return { ok: false, message: mapDatabaseError(error).message };
    revalidatePath("/admin/suppliers");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, message: mapDatabaseError(err).message };
  }
}
