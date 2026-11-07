"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertStaffRole } from "@/lib/admin-guard";
import { mapDatabaseError } from "@/lib/admin-errors";
import { Database } from "@/types/database.types";
import {
  receiveStockAction,
  adjustStockAction as appendAdjustStockAction,
  writeOffStockAction,
  updateReorderPointAction,
} from "./inventory-ops";
import {
  createBatchAction as baseCreateBatchAction,
  updateBatchStatusAction as baseUpdateBatchStatusAction,
  updateBatchLabResultsAction,
} from "./batch-ops";

export interface InventoryItem {
  id: string;
  variantId: string;
  warehouseId: string;
  variant: string;
  sku: string;
  warehouse: string;
  onHand: number;
  reserved: number;
  available: number;
  reorder: number;
  status: "in_stock" | "low_stock" | "out_of_stock" | "backorder";
  uom?: string;
}

export interface BatchItem {
  id: string;
  batchNo: string;
  productId: string;
  product: string;
  supplierId?: string;
  supplier: string;
  status: "released" | "quarantine" | "blocked" | "expired";
  mfgDate: string;
  expDate: string;
  brix: number | null;
  ph: number | null;
  moisturePct: number | null;
  densityKgPerL: number | null;
  ashPct: number | null;
  purity: number | null;
  notes: string | null;
  remainingQuantity?: number;
}

export interface StockLedgerItem {
  id: number;
  variantId: string;
  variantTitle: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  batchId: string | null;
  lotCode: string | null;
  movementType: Database["public"]["Enums"]["stock_movement_type"];
  quantityDelta: number;
  unitCost: number | null;
  note: string | null;
  orderId: string | null;
  shipmentId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  nameBn?: string;
  division?: string;
  district?: string;
  address: string | null;
  manager?: string;
  phone?: string;
  capacityTons?: number;
  currentStockTons?: number;
  utilization?: number;
  isDefault: boolean;
  isActive: boolean;
  status: "active" | "inactive";
  type?: string;
}

export interface SupplierItem {
  id: string;
  code?: string;
  name: string;
  contactName: string | null;
  contact?: string;
  phone: string | null;
  email?: string;
  district?: string;
  address: string | null;
  tradeLicense?: string;
  tin?: string;
  suppliedProducts?: string;
  totalSuppliedTons?: number;
  isActive: boolean;
  status: "active" | "inactive";
}

/**
 * Loads inventory levels with warehouse and variant info.
 * Enforces staff authentication with RLS.
 */
export async function getAdminInventoryAction(): Promise<{
  success: boolean;
  data: {
    inventory: InventoryItem[];
    kpis: {
      totalOnHand: number;
      totalReserved: number;
      totalAvailable: number;
      lowStockCount: number;
      outOfStockCount: number;
    };
  };
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const supabase = await createClient();

    const { data: rawLevels, error } = await supabase
      .from("inventory_levels")
      .select(
        `
        variant_id,
        warehouse_id,
        on_hand,
        reserved,
        reorder_point,
        available,
        warehouses:warehouse_id (
          id,
          name
        ),
        product_variants:variant_id (
          id,
          title,
          sku,
          uom,
          products:product_id (
            name
          )
        )
      `
      );

    if (error) throw error;

    const inventory: InventoryItem[] = (rawLevels || []).map((lvl: any) => {
      const variantInfo = Array.isArray(lvl.product_variants) ? lvl.product_variants[0] : lvl.product_variants;
      const productInfo = Array.isArray(variantInfo?.products) ? variantInfo?.products[0] : variantInfo?.products;
      const warehouseInfo = Array.isArray(lvl.warehouses) ? lvl.warehouses[0] : lvl.warehouses;

      const variantTitle = variantInfo?.title ? `${productInfo?.name || "Molasses"} - ${variantInfo.title}` : (productInfo?.name || "Molasses Item");
      const sku = variantInfo?.sku || "SKU-N/A";
      const warehouse = warehouseInfo?.name || "Main Warehouse";
      const onHand = Number(lvl.on_hand || 0);
      const reserved = Number(lvl.reserved || 0);
      const available = Number(lvl.available !== null && lvl.available !== undefined ? lvl.available : onHand - reserved);
      const reorder = Number(lvl.reorder_point || 10);

      let status: InventoryItem["status"] = "in_stock";
      if (available <= 0) status = "out_of_stock";
      else if (available <= reorder) status = "low_stock";

      return {
        id: `${lvl.variant_id}_${lvl.warehouse_id}`,
        variantId: lvl.variant_id,
        warehouseId: lvl.warehouse_id,
        variant: variantTitle,
        sku,
        warehouse,
        onHand,
        reserved,
        available,
        reorder,
        status,
        uom: variantInfo?.uom,
      };
    });

    const totalOnHand = inventory.reduce((sum, item) => sum + item.onHand, 0);
    const totalReserved = inventory.reduce((sum, item) => sum + item.reserved, 0);
    const totalAvailable = inventory.reduce((sum, item) => sum + item.available, 0);
    const lowStockCount = inventory.filter((item) => item.status === "low_stock").length;
    const outOfStockCount = inventory.filter((item) => item.status === "out_of_stock").length;

    return {
      success: true,
      data: {
        inventory,
        kpis: {
          totalOnHand,
          totalReserved,
          totalAvailable,
          lowStockCount,
          outOfStockCount,
        },
      },
    };
  } catch (error: any) {
    const friendly = mapDatabaseError(error);
    return {
      success: false,
      error: friendly.message,
      data: {
        inventory: [],
        kpis: {
          totalOnHand: 0,
          totalReserved: 0,
          totalAvailable: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        },
      },
    };
  }
}

/**
 * Loads batches with remaining quantity from admin_batch_stock view.
 */
export async function getAdminBatchesAction(): Promise<{
  success: boolean;
  data: BatchItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const supabase = await createClient();

    // Query batches and join supplier and product
    const { data: rawBatches, error } = await supabase
      .from("batches")
      .select(
        `
        id,
        lot_code,
        product_id,
        supplier_id,
        status,
        produced_on,
        best_before,
        brix,
        ph,
        moisture_pct,
        density_kg_per_l,
        ash_pct,
        total_sugar_pct,
        notes,
        products:product_id (
          name
        ),
        suppliers:supplier_id (
          name
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch batch remaining stock from admin_batch_stock view
    const { data: batchStocks } = await supabase
      .from("admin_batch_stock")
      .select("batch_id, remaining_quantity");

    const stockMap = new Map<string, number>();
    if (batchStocks) {
      batchStocks.forEach((b: any) => {
        stockMap.set(b.batch_id, Number(b.remaining_quantity || 0));
      });
    }

    const batches: BatchItem[] = (rawBatches || []).map((b: any) => {
      const prod = Array.isArray(b.products) ? b.products[0] : b.products;
      const supp = Array.isArray(b.suppliers) ? b.suppliers[0] : b.suppliers;

      return {
        id: b.id,
        batchNo: b.lot_code,
        productId: b.product_id,
        product: prod?.name || "Molasses Batch",
        supplier: supp?.name || "Sugar Mill Source",
        supplierId: b.supplier_id || undefined,
        status: b.status,
        mfgDate: b.produced_on || "",
        expDate: b.best_before || "",
        brix: b.brix !== null ? Number(b.brix) : null,
        ph: b.ph !== null ? Number(b.ph) : null,
        moisturePct: b.moisture_pct !== null ? Number(b.moisture_pct) : null,
        densityKgPerL: b.density_kg_per_l !== null ? Number(b.density_kg_per_l) : null,
        ashPct: b.ash_pct !== null ? Number(b.ash_pct) : null,
        purity: b.total_sugar_pct !== null ? Number(b.total_sugar_pct) : null,
        notes: b.notes,
        remainingQuantity: stockMap.get(b.id) ?? 0,
      };
    });

    return { success: true, data: batches };
  } catch (error: any) {
    const friendly = mapDatabaseError(error);
    return { success: false, error: friendly.message, data: [] };
  }
}

/**
 * Loads stock ledger movements (append-only history).
 */
export async function getAdminStockLedgerAction(params?: {
  movementType?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  data: StockLedgerItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const supabase = await createClient();

    let query = supabase
      .from("stock_movements")
      .select(
        `
        id,
        variant_id,
        warehouse_id,
        batch_id,
        movement_type,
        quantity_delta,
        unit_cost,
        note,
        order_id,
        shipment_id,
        created_by,
        created_at,
        product_variants:variant_id (
          title,
          sku,
          products:product_id (
            name
          )
        ),
        warehouses:warehouse_id (
          name
        ),
        batches:batch_id (
          lot_code
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(params?.limit || 100);

    if (params?.movementType && params.movementType !== "all") {
      query = query.eq("movement_type", params.movementType as Database["public"]["Enums"]["stock_movement_type"]);
    }

    const { data, error } = await query;
    if (error) throw error;

    const ledger: StockLedgerItem[] = (data || []).map((m: any) => {
      const variant = Array.isArray(m.product_variants) ? m.product_variants[0] : m.product_variants;
      const prod = Array.isArray(variant?.products) ? variant?.products[0] : variant?.products;
      const wh = Array.isArray(m.warehouses) ? m.warehouses[0] : m.warehouses;
      const batch = Array.isArray(m.batches) ? m.batches[0] : m.batches;

      return {
        id: m.id,
        variantId: m.variant_id,
        variantTitle: variant?.title ? `${prod?.name || "Molasses"} - ${variant.title}` : (prod?.name || "Molasses Item"),
        sku: variant?.sku || "SKU-N/A",
        warehouseId: m.warehouse_id,
        warehouseName: wh?.name || "Warehouse",
        batchId: m.batch_id,
        lotCode: batch?.lot_code || null,
        movementType: m.movement_type,
        quantityDelta: Number(m.quantity_delta),
        unitCost: m.unit_cost !== null ? Number(m.unit_cost) : null,
        note: m.note,
        orderId: m.order_id,
        shipmentId: m.shipment_id,
        createdBy: m.created_by,
        createdAt: m.created_at,
      };
    });

    return { success: true, data: ledger };
  } catch (error: any) {
    const friendly = mapDatabaseError(error);
    return { success: false, error: friendly.message, data: [] };
  }
}

/**
 * Adjust stock: delegates to append-only stock_movements entry.
 */
export async function adjustStockAction(payload: {
  variantId: string;
  warehouseId: string;
  quantityDelta: number;
  reason: string;
  batchId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const res = await appendAdjustStockAction({
    variantId: payload.variantId,
    warehouseId: payload.warehouseId,
    quantityDelta: payload.quantityDelta,
    reason: payload.reason,
    batchId: payload.batchId,
  });

  if (!res.ok) {
    return { success: false, error: res.message };
  }
  return { success: true };
}

/**
 * Updates reorder point for a variant at a warehouse.
 */
export async function updateReorderPointDirectAction(payload: {
  variantId: string;
  warehouseId: string;
  reorderPoint: number;
}): Promise<{ success: boolean; error?: string }> {
  const res = await updateReorderPointAction({
    variantId: payload.variantId,
    warehouseId: payload.warehouseId,
    reorderPoint: payload.reorderPoint,
  });

  if (!res.ok) {
    return { success: false, error: res.message };
  }
  return { success: true };
}

/**
 * Create batch action wrapper.
 */
export async function createBatchAction(payload: {
  lotCode: string;
  productId: string;
  supplierId?: string;
  producedOn?: string;
  bestBefore?: string;
  brix?: number;
  ph?: number;
  moisturePct?: number;
  densityKgPerL?: number;
  ashPct?: number;
  totalSugarPct?: number;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const res = await baseCreateBatchAction({
    lotCode: payload.lotCode,
    productId: payload.productId,
    supplierId: payload.supplierId,
    producedOn: payload.producedOn,
    bestBefore: payload.bestBefore,
    brix: payload.brix,
    ph: payload.ph,
    moisturePct: payload.moisturePct,
    densityKgPerL: payload.densityKgPerL,
    ashPct: payload.ashPct,
    totalSugarPct: payload.totalSugarPct,
    notes: payload.notes,
  });

  if (!res.ok) {
    return { success: false, error: res.message };
  }
  return { success: true };
}

/**
 * Update batch status action wrapper.
 */
export async function updateBatchStatusAction(payload: {
  id: string;
  status: "released" | "quarantine" | "blocked" | "expired";
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const res = await baseUpdateBatchStatusAction({
    batchId: payload.id,
    status: payload.status,
    reason: payload.reason,
  });

  if (!res.ok) {
    return { success: false, error: res.message };
  }
  return { success: true };
}

/**
 * Load warehouses with staff session.
 */
export async function getAdminWarehousesAction(): Promise<{
  success: boolean;
  data: WarehouseItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("warehouses")
      .select("id, code, name, address, is_default, is_active")
      .order("is_default", { ascending: false });

    if (error) throw error;

    const warehouses: WarehouseItem[] = (data || []).map((w: any) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      nameBn: w.name,
      division: "Dhaka",
      district: "Dhaka",
      address: w.address,
      manager: "Warehouse Lead",
      phone: "+880 1700-000000",
      capacityTons: 500,
      currentStockTons: 120,
      utilization: 24,
      isDefault: Boolean(w.is_default),
      isActive: Boolean(w.is_active),
      status: w.is_active ? "active" : "inactive",
      type: w.is_default ? "Central Distribution" : "Regional Depot",
    }));

    return { success: true, data: warehouses };
  } catch (error: any) {
    const friendly = mapDatabaseError(error);
    return { success: false, error: friendly.message, data: [] };
  }
}

export async function createWarehouseAction(payload: {
  code: string;
  name: string;
  address?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    const supabase = await createClient();

    const { error } = await supabase.from("warehouses").insert({
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      address: payload.address?.trim() || null,
      is_active: true,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/inventory");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create warehouse" };
  }
}

export async function deleteWarehouseAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    const supabase = await createClient();

    const { error } = await supabase.from("warehouses").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/inventory");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete warehouse" };
  }
}

/**
 * Load suppliers with staff session.
 */
export async function getAdminSuppliersAction(): Promise<{
  success: boolean;
  data: SupplierItem[];
  error?: string;
}> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "editor", "support"]);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, contact_name, phone, address, is_active")
      .order("name", { ascending: true });

    if (error) throw error;

    const suppliers: SupplierItem[] = (data || []).map((s: any, idx: number) => ({
      id: s.id,
      code: `SUP-${String(idx + 1).padStart(3, "0")}`,
      name: s.name,
      contactName: s.contact_name,
      contact: s.contact_name || "Factory Rep",
      phone: s.phone,
      email: "supply@sugar-mill.bd",
      district: "Sugar Belt Region",
      address: s.address,
      tradeLicense: "TL-REGISTERED",
      tin: "TIN-TAX-ID",
      suppliedProducts: "Sugarcane Molasses",
      totalSuppliedTons: 250,
      isActive: Boolean(s.is_active),
      status: s.is_active ? "active" : "inactive",
    }));

    return { success: true, data: suppliers };
  } catch (error: any) {
    const friendly = mapDatabaseError(error);
    return { success: false, error: friendly.message, data: [] };
  }
}

export async function createSupplierAction(payload: {
  name: string;
  contactName?: string;
  phone?: string;
  address?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin", "manager"]);
    const supabase = await createClient();

    const { error } = await supabase.from("suppliers").insert({
      name: payload.name.trim(),
      contact_name: payload.contactName?.trim() || null,
      phone: payload.phone?.trim() || null,
      address: payload.address?.trim() || null,
      is_active: true,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/batches");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create supplier" };
  }
}

export async function deleteSupplierAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertStaffRole(["owner", "admin"]);
    const supabase = await createClient();

    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/admin/batches");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete supplier" };
  }
}
