import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeBdPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/utils";
import { isValidUuid } from "@/lib/security";
import { parseDatabaseError, DatabaseOperationError } from "@/lib/supabase/error-handler";
import { triggerCapiPurchaseInternal } from "@/lib/capi-service";
import type { Order, OrderNote, OrderNoteType } from "@/types/order";

export function parseDbNoteToDomainInternal(
  n: any,
  defaultOrderNumber: string
): OrderNote {
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
    id: String(n.id),
    order_id: String(n.order_id || ""),
    order_number: String(n.order_number || defaultOrderNumber || ""),
    author: n.author || "Admin Staff",
    text: parsedText,
    type: parsedType,
    created_at: formatDateTime(n.created_at || new Date().toISOString()),
  };
}

export async function persistOrderUpdateInternal(
  updatedOrder: Order,
  syncItems: boolean = true,
  authorName: string = "Admin Staff"
): Promise<Order> {
  const client = getSupabaseAdmin();
  const orderId = updatedOrder.id;

  const dbStatus =
    updatedOrder.status === "partially_delivered"
      ? "delivered"
      : updatedOrder.status;

  const calculatedSubtotal = (updatedOrder.items || []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  );
  const subtotal =
    updatedOrder.subtotal !== undefined ? Number(updatedOrder.subtotal) : calculatedSubtotal;
  const shippingTotal = Number(updatedOrder.shipping_total) || 0;
  const discountTotal = Number(updatedOrder.discount_total) || 0;
  const grandTotal =
    updatedOrder.grand_total !== undefined
      ? Number(updatedOrder.grand_total)
      : Math.max(0, subtotal - discountTotal + shippingTotal);

  const seenSaveKeys = new Set<string>();
  const deduplicatedNotes = (updatedOrder.notes || []).filter((n) => {
    const key = `${n.type || "internal"}:${(n.text || "").trim()}`;
    if (!n.text?.trim() || seenSaveKeys.has(key)) return false;
    seenSaveKeys.add(key);
    return true;
  });
  const resultOrder: Order = {
    ...updatedOrder,
    notes: deduplicatedNotes,
  };

  const normalizedPhone = updatedOrder.phone ? normalizeBdPhone(updatedOrder.phone) : null;
  const normalizedAltPhone = updatedOrder.alternative_phone
    ? normalizeBdPhone(updatedOrder.alternative_phone)
    : null;
  const rawShippingPhone =
    updatedOrder.address?.phone || updatedOrder.shipping_phone || updatedOrder.phone;
  const normalizedShippingPhone = rawShippingPhone
    ? normalizeBdPhone(rawShippingPhone)
    : normalizedPhone;

  const updatePayload: Record<string, any> = {
    customer_name: updatedOrder.customer ? updatedOrder.customer.trim() : null,
    customer_phone: normalizedPhone,
    customer_alternative_phone: normalizedAltPhone,
    shipping_phone: normalizedShippingPhone,
    customer_email: updatedOrder.email ? updatedOrder.email.trim() : null,
    status: dbStatus,
    payment_status: updatedOrder.payment,
    payment_method: updatedOrder.method || "cod",
    channel: updatedOrder.channel || "web",
    fulfillment_status: updatedOrder.fulfillment,
    shipping_total: shippingTotal,
    discount_total: discountTotal,
    subtotal: subtotal,
    grand_total: grandTotal,
    amount_paid: updatedOrder.amount_paid ?? 0,
    customer_note: updatedOrder.customer_note || null,
    ...(updatedOrder.date ? { placed_at: updatedOrder.date } : {}),
    ...(updatedOrder.attribution ? { attribution: updatedOrder.attribution } : {}),
    cancel_reason: updatedOrder.cancel_reason || null,
    shipping_method_name: updatedOrder.courier_name || null,
    ...(updatedOrder.courier_consignment_id !== undefined
      ? { courier_consignment_id: updatedOrder.courier_consignment_id || null }
      : {}),
    ...(updatedOrder.courier_tracking_code !== undefined
      ? { courier_tracking_code: updatedOrder.courier_tracking_code || null }
      : {}),
    ...(updatedOrder.courier_tracking_url !== undefined
      ? { courier_tracking_url: updatedOrder.courier_tracking_url || null }
      : {}),
    ...(updatedOrder.courier_invoice !== undefined
      ? { courier_invoice: updatedOrder.courier_invoice || null }
      : {}),
    ...(updatedOrder.courier_payload_snapshot !== undefined
      ? { courier_payload_snapshot: updatedOrder.courier_payload_snapshot || null }
      : {}),
    shipping_address: updatedOrder.address
      ? {
          division: updatedOrder.address.division || "",
          district: updatedOrder.address.district || "",
          address_line: updatedOrder.address.address_line || "",
          phone: normalizedPhone || updatedOrder.phone || "",
          alternative_phone:
            normalizedAltPhone || updatedOrder.alternative_phone || "",
          recipient_name: updatedOrder.customer || "",
        }
      : undefined,
  };

  const { data: updatedDbOrders, error: updateErr } = await client
    .from("orders")
    .update(updatePayload)
    .eq("order_number", orderId)
    .select("id");

  if (updateErr) {
    console.error("[OrderService] Supabase update error:", updateErr);
    throw new DatabaseOperationError(parseDatabaseError(updateErr));
  }

  let orderUuid = updatedDbOrders?.[0]?.id;
  if (!orderUuid) {
    const { data: existingOrder } = await client
      .from("orders")
      .select("id")
      .eq("order_number", orderId)
      .maybeSingle();
    orderUuid = existingOrder?.id;
  }

  if (syncItems && Array.isArray(updatedOrder.items) && orderUuid) {
    const { error: delErr } = await client
      .from("order_items")
      .delete()
      .eq("order_id", orderUuid);

    if (delErr) {
      console.warn("[OrderService] Notice deleting existing order_items:", delErr);
    }

    if (updatedOrder.items.length > 0) {
      const candidateVarIds = updatedOrder.items
        .map((it) => it.variant_id || (it as any).variantId)
        .filter((id) => isValidUuid(id));

      const varToProdMap = new Map<string, string>();
      if (candidateVarIds.length > 0) {
        const { data: varsData } = await client
          .from("product_variants")
          .select("id, product_id")
          .in("id", candidateVarIds);
        (varsData || []).forEach((v: any) => {
          if (v.id && v.product_id) varToProdMap.set(v.id, v.product_id);
        });
      }

      const itemRows = updatedOrder.items.map((it) => {
        const isVarUuid = isValidUuid(it.variant_id);
        const rawProdId = it.product_id || (it as any).productId;
        const isProdUuid = isValidUuid(rawProdId);
        const resolvedProdId = isProdUuid
          ? rawProdId
          : isVarUuid && it.variant_id
          ? varToProdMap.get(it.variant_id) || null
          : null;
        const qty = Math.max(1, Number(it.quantity) || 1);
        const price = Math.max(0, Number(it.unit_price) || 0);
        return {
          order_id: orderUuid,
          product_id: resolvedProdId,
          variant_id: isVarUuid ? it.variant_id : null,
          sku: it.sku || "SKU-ITEM",
          product_name: it.product_name || "Molasses Product",
          variant_name: it.variant_name || "Standard",
          quantity: qty,
          unit_price: price,
          is_combo: Boolean(it.is_combo),
          combo_components: it.combo_components || [],
        };
      });

      const { data: insertedItems, error: insertErr } = await client
        .from("order_items")
        .insert(itemRows)
        .select();

      if (insertErr) {
        console.error("[OrderService] Supabase order_items insert error:", insertErr);
        throw new Error(insertErr.message || "Failed to update order items in database");
      }

      if (insertedItems && insertedItems.length > 0) {
        resultOrder.items = insertedItems.map((it: any, idx: number) => ({
          id: it.id || `item-${idx}`,
          sku: it.sku,
          product_name: it.product_name,
          variant_name: it.variant_name,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          line_total: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
          variant_id: it.variant_id,
          is_combo: Boolean(it.is_combo),
          combo_components: it.combo_components || [],
        }));
      }
    } else {
      resultOrder.items = [];
    }
  }

  if (orderUuid && Array.isArray(deduplicatedNotes)) {
    try {
      const newNotesToInsert = deduplicatedNotes.filter(
        (n) =>
          n &&
          n.text &&
          n.text.trim() &&
          n.type !== "customer" &&
          (!n.id || n.id.startsWith("note-") || !isValidUuid(n.id))
      );

      for (const n of newNotesToInsert) {
        const rawText = n.text
          .trim()
          .replace(/^\[(Delivery|Packaging|Internal|System) Note\]\s*/i, "");
        const dbType =
          n.type === "delivery" || n.type === "delivery_note"
            ? "delivery"
            : n.type === "packaging" || n.type === "packaging_note"
            ? "packaging"
            : n.type === "system" || n.type === "system_note"
            ? "system"
            : "internal";

        await client.from("order_notes").insert({
          order_id: orderUuid,
          order_number: orderId,
          type: dbType,
          author: n.author || authorName || "Admin Staff",
          note: rawText,
          created_at: n.created_at || new Date().toISOString(),
        });
      }

      const { data: dbNotes } = await client
        .from("order_notes")
        .select("*")
        .or(`order_id.eq.${orderUuid},order_number.eq.${orderId}`)
        .order("created_at", { ascending: false });

      if (dbNotes) {
        resultOrder.notes = dbNotes
          .filter((n: any) => n.type !== "customer")
          .map((n: any) => parseDbNoteToDomainInternal(n, orderId));
      }
    } catch (noteErr) {
      console.warn("[OrderService] Notice updating order_notes:", noteErr);
    }
  }

  resultOrder.subtotal = subtotal;
  resultOrder.grand_total = grandTotal;

  if (["confirmed", "processing", "shipped", "delivered", "partially_delivered"].includes(dbStatus)) {
    triggerCapiPurchaseInternal(orderId).catch(() => {});
  }

  return resultOrder;
}
