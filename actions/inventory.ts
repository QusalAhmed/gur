"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

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
  batch: string;
}

export interface BatchItem {
  id: string;
  batchNo: string;
  product: string;
  productId: string;
  supplier: string;
  supplierId?: string;
  mfgDate: string;
  expDate: string;
  brix: number | null;
  ph: number | null;
  purity: number | null;
  status: "released" | "quarantine" | "blocked" | "expired";
  quantity: string;
  warehouse: string;
}

export interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  nameBn: string;
  division: string;
  district: string;
  address: string;
  manager: string;
  phone: string;
  capacityTons: number;
  currentStockTons: number;
  utilization: number;
  status: "active" | "inactive";
  type: string;
}

export interface SupplierItem {
  id: string;
  code: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  district: string;
  address: string;
  tradeLicense: string;
  tin: string;
  suppliedProducts: string;
  totalSuppliedTons: number;
  status: "active" | "inactive";
}

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
    const { data: rawLevels, error } = await supabaseAdmin
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
          name
        ),
        product_variants:variant_id (
          title,
          sku,
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
      const available = Number(lvl.available || onHand - reserved);
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
        batch: "Standard Lot",
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
    console.error("getAdminInventoryAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to load inventory",
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

export async function adjustStockAction(payload: {
  variantId: string;
  warehouseId: string;
  onHand: number;
  reorderPoint?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("inventory_levels").upsert({
      variant_id: payload.variantId,
      warehouse_id: payload.warehouseId,
      on_hand: payload.onHand,
      reorder_point: payload.reorderPoint ?? 10,
      updated_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to adjust stock" };
  }
}

export async function getAdminBatchesAction(): Promise<{
  success: boolean;
  data: BatchItem[];
  error?: string;
}> {
  try {
    const { data: rawBatches, error } = await supabaseAdmin
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
        mfgDate: b.produced_on || "",
        expDate: b.best_before || "",
        brix: b.brix ? Number(b.brix) : null,
        ph: b.ph ? Number(b.ph) : null,
        purity: b.total_sugar_pct ? Number(b.total_sugar_pct) : null,
        status: (b.status as any) || "quarantine",
        quantity: "Standard Tanker",
        warehouse: "Main Facility",
      };
    });

    return { success: true, data: batches };
  } catch (error: any) {
    console.error("getAdminBatchesAction error:", error);
    return { success: false, error: error.message || "Failed to load batches", data: [] };
  }
}

export async function createBatchAction(payload: {
  lotCode: string;
  productId: string;
  supplierId?: string;
  producedOn?: string;
  bestBefore?: string;
  brix?: number;
  ph?: number;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("batches").insert({
      lot_code: payload.lotCode.trim().toUpperCase(),
      product_id: payload.productId,
      supplier_id: payload.supplierId || null,
      produced_on: payload.producedOn || null,
      best_before: payload.bestBefore || null,
      brix: payload.brix || null,
      ph: payload.ph || null,
      notes: payload.notes || null,
      status: "quarantine",
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create batch" };
  }
}

export async function updateBatchStatusAction(payload: {
  id: string;
  status: "released" | "quarantine" | "blocked" | "expired";
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("batches")
      .update({
        status: payload.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update batch status" };
  }
}

export async function getAdminWarehousesAction(): Promise<{
  success: boolean;
  data: WarehouseItem[];
  error?: string;
}> {
  try {
    const { data: rawWarehouses, error } = await supabaseAdmin
      .from("warehouses")
      .select("id, code, name, address, is_active, is_default, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const warehouses: WarehouseItem[] = (rawWarehouses || []).map((w: any) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      nameBn: w.name,
      division: "Dhaka",
      district: "Dhaka",
      address: w.address || "Industrial Facility",
      manager: "Operations Manager",
      phone: "+880 1700-000000",
      capacityTons: 500,
      currentStockTons: 120,
      utilization: 24,
      status: w.is_active ? "active" : "inactive",
      type: w.is_default ? "Central Distribution" : "Regional Depot",
    }));

    return { success: true, data: warehouses };
  } catch (error: any) {
    console.error("getAdminWarehousesAction error:", error);
    return { success: false, error: error.message || "Failed to load warehouses", data: [] };
  }
}

export async function createWarehouseAction(payload: {
  code: string;
  name: string;
  address?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("warehouses").insert({
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      address: payload.address?.trim() || null,
      is_active: true,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create warehouse" };
  }
}

export async function deleteWarehouseAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("warehouses").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete warehouse" };
  }
}

export async function getAdminSuppliersAction(): Promise<{
  success: boolean;
  data: SupplierItem[];
  error?: string;
}> {
  try {
    const { data: rawSuppliers, error } = await supabaseAdmin
      .from("suppliers")
      .select("id, name, contact_name, phone, address, is_active, notes, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const suppliers: SupplierItem[] = (rawSuppliers || []).map((s: any, idx: number) => ({
      id: s.id,
      code: `SUP-${String(idx + 1).padStart(3, "0")}`,
      name: s.name,
      contact: s.contact_name || "Factory Rep",
      phone: s.phone || "N/A",
      email: "supply@sugar-mill.bd",
      district: "Sugar Belt Region",
      address: s.address || "Factory Mill Compound",
      tradeLicense: "TL-REGISTERED",
      tin: "TIN-TAX-ID",
      suppliedProducts: "Sugarcane Molasses",
      totalSuppliedTons: 250,
      status: s.is_active ? "active" : "inactive",
    }));

    return { success: true, data: suppliers };
  } catch (error: any) {
    console.error("getAdminSuppliersAction error:", error);
    return { success: false, error: error.message || "Failed to load suppliers", data: [] };
  }
}

export async function createSupplierAction(payload: {
  name: string;
  contactName?: string;
  phone?: string;
  address?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("suppliers").insert({
      name: payload.name.trim(),
      contact_name: payload.contactName?.trim() || null,
      phone: payload.phone?.trim() || null,
      address: payload.address?.trim() || null,
      is_active: true,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create supplier" };
  }
}

export async function deleteSupplierAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("suppliers").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete supplier" };
  }
}

