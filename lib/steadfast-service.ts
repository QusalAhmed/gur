import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { formatDbOrderRecord } from "@/lib/supabase";
import { persistOrderUpdateInternal } from "@/lib/order-service";
import type { Order, OrderItem } from "@/types/order";
import {
  normalizePhoneForSteadfast,
  calculateCodAmount,
  formatSteadfastItemDescription,
  calculateSteadfastTotalLot,
  buildSteadfastPayloadSnapshot,
  computeNextSteadfastInvoice,
  type BookSteadfastResponse,
  type BulkBookSteadfastResult,
  type BulkBookingItemResult,
  type SteadfastBalanceResult,
  type RecreateSteadfastParcelParams,
  type RecreateSteadfastParcelResult,
  type SteadfastDeliveryRecord,
  type GetSteadfastDeliveryRecordResponse,
} from "@/lib/steadfast";

const STEADFAST_BASE_URL =
  process.env.STEADFAST_BASE_URL || "https://portal.packzy.com/api/v1";

function getSteadfastCredentials() {
  const apiKey = (process.env.STEADFAST_API_KEY || "").trim();
  const secretKey = (process.env.STEADFAST_SECRET_KEY || "").trim();

  if (!apiKey || !secretKey) {
    throw new Error("Steadfast Courier API credentials are not configured.");
  }

  return { apiKey, secretKey };
}

export async function bookSteadfastParcelInternal(
  order: Order,
  customCodAmount?: number,
  overrideInvoice?: string,
  isRecreation: boolean = false
): Promise<BookSteadfastResponse> {
  try {
    const invoice = (overrideInvoice || order.courier_invoice || order.id || "").trim();
    if (!invoice) {
      return {
        success: false,
        error: "Order invoice number is missing.",
      };
    }

    const client = getSupabaseAdmin();
    const baseOrderNumber = (order.id || "").trim();

    if (!isRecreation) {
      if (order.courier_consignment_id || order.courier_tracking_code) {
        return {
          success: false,
          error: `Order ${invoice} is already booked with courier (Consignment #${order.courier_consignment_id || "Assigned"}, Tracking: ${order.courier_tracking_code || "Assigned"}). Duplicate booking prevented.`,
        };
      }

      const { data: existingCheck } = await client
        .from("orders")
        .select(
          "id, order_number, courier_consignment_id, courier_tracking_code, courier_tracking_url, status"
        )
        .eq("order_number", baseOrderNumber)
        .maybeSingle();

      if (existingCheck?.courier_consignment_id || existingCheck?.courier_tracking_code) {
        return {
          success: false,
          error: `Order ${baseOrderNumber} already has an active courier consignment in the database (Consignment #${existingCheck.courier_consignment_id}, Tracking: ${existingCheck.courier_tracking_code}). Duplicate booking prevented.`,
        };
      }
    }

    const { data: dbOrder } = await client
      .from("orders")
      .select(
        "id, order_number, courier_consignment_id, courier_tracking_code, courier_tracking_url, status, order_items(id, sku, product_name, variant_name, quantity, unit_price, line_total, variant_id)"
      )
      .eq("order_number", baseOrderNumber)
      .maybeSingle();

    const { apiKey, secretKey } = getSteadfastCredentials();

    try {
      const checkRes = await fetch(
        `${STEADFAST_BASE_URL}/status_by_invoice/${encodeURIComponent(invoice)}`,
        {
          method: "GET",
          headers: {
            "Api-Key": apiKey,
            "Secret-Key": secretKey,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.status === 200 && checkData.delivery_status) {
          let recoveredCid = "";
          try {
            const trackRes = await fetch(
              `${STEADFAST_BASE_URL}/trackings_by_invoice/${encodeURIComponent(invoice)}`,
              {
                method: "GET",
                headers: {
                  "Api-Key": apiKey,
                  "Secret-Key": secretKey,
                  "Content-Type": "application/json",
                },
                cache: "no-store",
              }
            );
            if (trackRes.ok) {
              const trackData = await trackRes.json();
              if (Array.isArray(trackData.tracking) && trackData.tracking[0]?.consignment_id) {
                recoveredCid = String(trackData.tracking[0].consignment_id);
              }
            }
          } catch {
            // Silently continue
          }

          if (recoveredCid) {
            await client
              .from("orders")
              .update({
                courier_consignment_id: recoveredCid,
                shipping_method_name: "Steadfast Courier",
                updated_at: new Date().toISOString(),
              })
              .eq("order_number", baseOrderNumber);
          }

          return {
            success: false,
            error: `Order ${invoice} is already registered with Steadfast Courier (Status: ${checkData.delivery_status}${recoveredCid ? `, Consignment #${recoveredCid}` : ""}). Duplicate booking prevented.`,
          };
        }
      }
    } catch (checkErr) {
      console.warn("Steadfast duplicate invoice verification skipped:", checkErr);
    }

    const recipientPhone = normalizePhoneForSteadfast(
      order.address?.phone || order.shipping_phone || order.phone
    );
    if (!recipientPhone || !/^01[3-9]\d{8}$/.test(recipientPhone)) {
      return {
        success: false,
        error: `Delivery phone number '${order.address?.phone || order.shipping_phone || order.phone}' is not a valid 11-digit Bangladeshi mobile number starting with 01.`,
      };
    }

    const recipientName = (
      order.address?.recipient_name ||
      order.recipient_name ||
      order.customer ||
      "Valued Customer"
    ).trim();

    const recipientAddress = [
      order.address?.address_line,
      order.address?.district,
      order.address?.division,
    ]
      .filter(Boolean)
      .join(", ")
      .trim();

    if (!recipientAddress || recipientAddress.length < 5) {
      return {
        success: false,
        error: `Customer delivery address is too short (${recipientAddress}). Please ensure address line and district are specified.`,
      };
    }

    const codAmount = calculateCodAmount(order, customCodAmount);

    const orderItems: OrderItem[] =
      Array.isArray(order.items) && order.items.length > 0
        ? order.items
        : Array.isArray((dbOrder as any)?.order_items)
        ? ((dbOrder as any).order_items as any[]).map((it: any, idx: number) => ({
            id: it.id || `db-${idx}`,
            sku: it.sku || "",
            product_name: it.product_name || "",
            variant_name: it.variant_name || "",
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            line_total: Number(it.line_total) || 0,
            variant_id: it.variant_id,
          }))
        : [];

    const itemDescription = formatSteadfastItemDescription(orderItems);
    const totalLot = calculateSteadfastTotalLot(orderItems);

    const customerPhoneClean = normalizePhoneForSteadfast(order.phone);
    const rawAltPhone = order.alternative_phone
      ? normalizePhoneForSteadfast(order.alternative_phone)
      : recipientPhone !== customerPhoneClean && /^01[3-9]\d{8}$/.test(customerPhoneClean)
      ? customerPhoneClean
      : "";
    const recipientAltPhone =
      rawAltPhone && /^01[3-9]\d{8}$/.test(rawAltPhone) ? rawAltPhone : undefined;

    const payload: Record<string, any> = {
      invoice,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_address: recipientAddress.slice(0, 490),
      cod_amount: codAmount,
      note: (order.customer_note || "").slice(0, 480) || undefined,
    };

    if (recipientAltPhone) {
      payload.alternative_phone = recipientAltPhone;
    }
    if (itemDescription) {
      payload.item_description = itemDescription;
    }
    if (totalLot > 0) {
      payload.total_lot = totalLot;
    }

    const response = await fetch(`${STEADFAST_BASE_URL}/create_order`, {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Secret-Key": secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await response.json();

    if (response.ok && (data.status === 200 || data.consignment)) {
      const c = data.consignment;
      const trackingLink =
        c.tracking_link || `https://steadfast.com.bd/tl/${c.tracking_code}`;
      const snapshot = buildSteadfastPayloadSnapshot(order, customCodAmount, invoice);

      try {
        await client
          .from("orders")
          .update({
            courier_consignment_id: String(c.consignment_id),
            courier_tracking_code: c.tracking_code,
            courier_tracking_url: trackingLink,
            courier_invoice: invoice,
            courier_payload_snapshot: snapshot,
            shipping_method_name: "Steadfast Courier",
            updated_at: new Date().toISOString(),
          })
          .eq("order_number", baseOrderNumber);
      } catch (dbSaveErr) {
        console.warn("Could not persist courier snapshot immediately:", dbSaveErr);
      }

      return {
        success: true,
        consignment: {
          consignment_id: c.consignment_id,
          invoice: c.invoice,
          tracking_code: c.tracking_code,
          tracking_link: trackingLink,
          recipient_name: c.recipient_name,
          recipient_phone: c.recipient_phone,
          recipient_address: c.recipient_address,
          cod_amount: Number(c.cod_amount) || 0,
          status: c.status || "in_review",
          note: c.note,
          item_description: c.item_description || itemDescription || undefined,
          total_lot: Number(c.total_lot) || totalLot,
        },
        rawResponse: data,
      };
    }

    let errorMessage =
      data.message || "Failed to create consignment with Steadfast Courier.";
    if (data.errors && typeof data.errors === "object") {
      const errorList = Object.entries(data.errors)
        .map(
          ([field, msgs]) =>
            `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`
        )
        .join("; ");
      errorMessage = `${errorMessage} (${errorList})`;
    }

    if (
      errorMessage.toLowerCase().includes("taken") ||
      errorMessage.toLowerCase().includes("already") ||
      errorMessage.toLowerCase().includes("duplicate")
    ) {
      errorMessage = `Order ${invoice} was already submitted to Steadfast Courier. Duplicate booking prevented.`;
    }

    return {
      success: false,
      error: errorMessage,
      fieldErrors: data.errors,
      rawResponse: data,
    };
  } catch (err: any) {
    console.error("Steadfast API execution error:", err);
    return {
      success: false,
      error:
        err?.message || "Network error while connecting to Steadfast Courier API.",
    };
  }
}

export async function bookSteadfastBulkParcelsInternal(
  orders: Order[],
  actorUuid: string | null = null
): Promise<BulkBookSteadfastResult> {
  if (!orders || orders.length === 0) {
    return {
      success: true,
      totalRequested: 0,
      successfulCount: 0,
      failedCount: 0,
      results: [],
    };
  }

  const { apiKey, secretKey } = getSteadfastCredentials();
  const client = getSupabaseAdmin();

  const orderIds = orders.map((o) => (o.id || "").trim()).filter(Boolean);
  const { data: dbOrders } = await client
    .from("orders")
    .select(
      "order_number, courier_consignment_id, courier_tracking_code, courier_tracking_url, order_items(id, sku, product_name, variant_name, quantity, unit_price, line_total, variant_id)"
    )
    .in("order_number", orderIds);

  const dbOrdersMap = new Map<
    string,
    { consignmentId?: string; trackingCode?: string; trackingUrl?: string; orderItems?: any[] }
  >();

  if (dbOrders) {
    for (const d of dbOrders) {
      dbOrdersMap.set(d.order_number, {
        consignmentId: d.courier_consignment_id || undefined,
        trackingCode: d.courier_tracking_code || undefined,
        trackingUrl: d.courier_tracking_url || undefined,
        orderItems: (d as any).order_items || undefined,
      });
    }
  }

  const validItems: {
    order: Order;
    payload: any;
    itemDescription?: string;
    totalLot?: number;
  }[] = [];
  const results: BulkBookingItemResult[] = [];

  for (const o of orders) {
    const dbInfo = dbOrdersMap.get(o.id);
    const alreadyBooked =
      Boolean(o.courier_consignment_id) ||
      Boolean(o.courier_tracking_code) ||
      Boolean(dbInfo?.consignmentId) ||
      Boolean(dbInfo?.trackingCode);

    if (alreadyBooked) {
      results.push({
        orderId: o.id,
        success: true,
        consignmentId: o.courier_consignment_id || dbInfo?.consignmentId,
        trackingCode: o.courier_tracking_code || dbInfo?.trackingCode,
        trackingLink: o.courier_tracking_url || dbInfo?.trackingUrl,
      });
      continue;
    }

    const recipientPhone = normalizePhoneForSteadfast(
      o.address?.phone || o.shipping_phone || o.phone
    );
    if (!recipientPhone || !/^01[3-9]\d{8}$/.test(recipientPhone)) {
      results.push({
        orderId: o.id,
        success: false,
        error: `Invalid delivery phone format: '${o.address?.phone || o.shipping_phone || o.phone}'`,
      });
      continue;
    }

    const recipientName = (
      o.address?.recipient_name ||
      o.recipient_name ||
      o.customer ||
      "Valued Customer"
    ).trim();

    const recipientAddress = [
      o.address?.address_line,
      o.address?.district,
      o.address?.division,
    ]
      .filter(Boolean)
      .join(", ")
      .trim();

    if (!recipientAddress || recipientAddress.length < 5) {
      results.push({
        orderId: o.id,
        success: false,
        error: "Address too short",
      });
      continue;
    }

    const codAmount = calculateCodAmount(o);
    const invoice = (o.id || "").trim();

    const rawItems =
      Array.isArray(o.items) && o.items.length > 0
        ? o.items
        : Array.isArray(dbInfo?.orderItems) && dbInfo.orderItems.length > 0
        ? dbInfo.orderItems
        : [];

    const orderItems: OrderItem[] = rawItems.map((it: any, idx: number) => ({
      id: it.id || `db-${idx}`,
      sku: it.sku || "",
      product_name: it.product_name || "",
      variant_name: it.variant_name || "",
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      line_total: Number(it.line_total) || 0,
      variant_id: it.variant_id,
    }));

    const itemDescription = formatSteadfastItemDescription(orderItems);
    const totalLot = calculateSteadfastTotalLot(orderItems);

    const customerPhoneClean = normalizePhoneForSteadfast(o.phone);
    const rawBulkAlt = o.alternative_phone
      ? normalizePhoneForSteadfast(o.alternative_phone)
      : recipientPhone !== customerPhoneClean && /^01[3-9]\d{8}$/.test(customerPhoneClean)
      ? customerPhoneClean
      : "";
    const recipientBulkAlt =
      rawBulkAlt && /^01[3-9]\d{8}$/.test(rawBulkAlt) ? rawBulkAlt : undefined;

    const payload: Record<string, any> = {
      invoice,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_address: recipientAddress.slice(0, 490),
      cod_amount: codAmount,
      note: (o.customer_note || "").slice(0, 480) || undefined,
    };

    if (recipientBulkAlt) {
      payload.alternative_phone = recipientBulkAlt;
    }
    if (itemDescription) {
      payload.item_description = itemDescription;
      payload.order_description = itemDescription;
      payload.description = itemDescription;
    }
    if (totalLot > 0) {
      payload.total_lot = totalLot;
    }

    validItems.push({
      order: {
        ...o,
        items: orderItems,
      },
      payload,
      itemDescription,
      totalLot,
    });
  }

  if (validItems.length === 0) {
    const successCount = results.filter((r) => r.success).length;
    return {
      success: successCount > 0,
      totalRequested: orders.length,
      successfulCount: successCount,
      failedCount: results.length - successCount,
      results,
    };
  }

  try {
    const response = await fetch(`${STEADFAST_BASE_URL}/create_order/bulk-order`, {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Secret-Key": secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: validItems.map((vi) => vi.payload),
      }),
      cache: "no-store",
    });

    const data = await response.json();
    const nowIso = new Date().toISOString();

    if (response.ok && (data.status === 200 || Array.isArray(data.data))) {
      const returnedList: any[] = Array.isArray(data.data) ? data.data : [];

      for (const item of returnedList) {
        const inv = item.invoice;
        const matchingOrder = validItems.find((vi) => vi.payload.invoice === inv)?.order;
        const orderId = matchingOrder ? matchingOrder.id : inv;

        if (item.consignment_id && item.tracking_code) {
          const consignmentId = String(item.consignment_id);
          const trackingCode = String(item.tracking_code);
          const trackingLink =
            item.tracking_link || `https://steadfast.com.bd/tl/${trackingCode}`;

          const matchingValidItem = validItems.find((vi) => vi.payload.invoice === inv);
          const { data: updatedOrderRows } = await client
            .from("orders")
            .update({
              courier_consignment_id: consignmentId,
              courier_tracking_code: trackingCode,
              courier_tracking_url: trackingLink,
              courier_invoice: inv,
              courier_payload_snapshot: matchingValidItem
                ? buildSteadfastPayloadSnapshot(matchingValidItem.order, undefined, inv)
                : null,
              shipping_method_name: "Steadfast Courier",
              status: "processing",
              updated_at: nowIso,
            })
            .eq("order_number", orderId)
            .select("id");

          const matchingOrderUuid = updatedOrderRows?.[0]?.id;
          if (matchingOrderUuid) {
            await client
              .from("order_events")
              .insert({
                order_id: matchingOrderUuid,
                event_type: "courier_consignment_created",
                message: `Steadfast Consignment #${consignmentId} created (Tracking: ${trackingCode})${matchingValidItem?.itemDescription ? ` • Items: ${matchingValidItem.itemDescription}` : ""}`,
                actor_id: actorUuid,
              })
              .select()
              .maybeSingle();
          }

          results.push({
            orderId,
            success: true,
            consignmentId,
            trackingCode,
            trackingLink,
            itemDescription: matchingValidItem?.itemDescription,
            totalLot: matchingValidItem?.totalLot,
          });
        } else {
          results.push({
            orderId,
            success: false,
            error: item.message || item.error || "Consignment booking failed",
          });
        }
      }

      for (const vi of validItems) {
        if (!results.some((r) => r.orderId === vi.order.id)) {
          results.push({
            orderId: vi.order.id,
            success: false,
            error: "Not processed by Steadfast API response",
          });
        }
      }
    } else {
      for (const vi of validItems) {
        results.push({
          orderId: vi.order.id,
          success: false,
          error: data.message || "Steadfast bulk booking error",
        });
      }
    }
  } catch (err: any) {
    console.error("Steadfast Bulk API call failed:", err);
    for (const vi of validItems) {
      results.push({
        orderId: vi.order.id,
        success: false,
        error: err.message || "Network timeout connecting to Steadfast",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return {
    success: successCount > 0,
    totalRequested: orders.length,
    successfulCount: successCount,
    failedCount: results.length - successCount,
    results,
  };
}

export async function getSteadfastBalanceInternal(): Promise<SteadfastBalanceResult> {
  try {
    const { apiKey, secretKey } = getSteadfastCredentials();

    const response = await fetch(`${STEADFAST_BASE_URL}/get_balance`, {
      method: "GET",
      headers: {
        "Api-Key": apiKey,
        "Secret-Key": secretKey,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (response.ok && data.status === 200) {
      return {
        success: true,
        current_balance: Number(data.current_balance) || 0,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      success: false,
      error: data.message || "Failed to retrieve balance from Steadfast.",
    };
  } catch (err: any) {
    console.error("Error retrieving Steadfast balance:", err);
    return {
      success: false,
      error: err.message || "Network error fetching Steadfast balance.",
    };
  }
}

export async function cancelSteadfastConsignmentInternal(
  identifier: { consignmentId?: number | string; invoice?: string; trackingCode?: string },
  reason?: string
): Promise<{ success: boolean; status?: number; message?: string; raw?: any }> {
  try {
    const { apiKey, secretKey } = getSteadfastCredentials();

    const payload: Record<string, any> = {
      reason: (reason || "Order information modified by merchant").slice(0, 500),
    };

    if (identifier.consignmentId) {
      payload.consignment_id = Number(identifier.consignmentId);
    } else if (identifier.invoice) {
      payload.invoice = identifier.invoice;
    } else if (identifier.trackingCode) {
      payload.tracking_code = identifier.trackingCode;
    } else {
      return {
        success: false,
        message: "No identifier provided for cancellation request.",
      };
    }

    const response = await fetch(`${STEADFAST_BASE_URL}/create_return_request`, {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Secret-Key": secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await response.json();

    if (
      response.ok &&
      (data.status === 200 || data.status === 201 || data.consignment_id || data.id)
    ) {
      return {
        success: true,
        status: data.status || 201,
        message:
          data.message ||
          "Cancellation/return request submitted to Steadfast Courier.",
        raw: data,
      };
    }

    return {
      success: false,
      status: data.status || response.status,
      message: data.message || "Steadfast return request could not be placed.",
      raw: data,
    };
  } catch (err: any) {
    console.error("Error creating Steadfast return request:", err);
    return {
      success: false,
      message:
        err.message || "Failed connecting to Steadfast return request API.",
    };
  }
}

export async function recreateSteadfastParcelInternal(
  params: RecreateSteadfastParcelParams,
  actorUuid: string | null = null,
  actorName: string = "Admin Staff"
): Promise<RecreateSteadfastParcelResult> {
  const { orderId, updatedOrder, customCodAmount, cancelReason } = params;
  const client = getSupabaseAdmin();

  const { data: dbRow } = await client
    .from("orders")
    .select("*, order_items(*), order_events(*), order_notes(*)")
    .eq("order_number", orderId)
    .maybeSingle();

  const currentOrder: Order = dbRow ? formatDbOrderRecord(dbRow) : updatedOrder;
  const orderUuid = dbRow?.id;
  const oldCid = currentOrder.courier_consignment_id;
  const oldTracking = currentOrder.courier_tracking_code;
  const oldInvoice = currentOrder.courier_invoice || orderId;

  const cancellationResult: {
    attempted: boolean;
    success: boolean;
    message?: string;
  } = {
    attempted: false,
    success: false,
    message: "",
  };

  if (oldCid) {
    cancellationResult.attempted = true;
    try {
      const cancelRes = await cancelSteadfastConsignmentInternal(
        { consignmentId: oldCid, invoice: oldInvoice },
        cancelReason || "Order information updated by merchant"
      );
      cancellationResult.success = cancelRes.success;
      cancellationResult.message = cancelRes.message;
    } catch (cancelErr: any) {
      cancellationResult.message =
        cancelErr.message || "Failed calling return/cancel API";
    }

    try {
      if (orderUuid) {
        await client.from("order_events").insert({
          order_id: orderUuid,
          event_type: "courier_consignment_superseded",
          message: `Steadfast Consignment #${oldCid} (Tracking: ${oldTracking || "N/A"}) superseded due to updated order information`,
          actor_id: actorUuid,
        });
      }
    } catch (noteErr) {
      console.warn("Could not insert superseded event:", noteErr);
    }
  }

  const nextInvoice = computeNextSteadfastInvoice(orderId, oldInvoice);

  await persistOrderUpdateInternal(
    {
      ...updatedOrder,
      courier_invoice: nextInvoice,
    },
    true,
    actorName
  );

  const bookingResult = await bookSteadfastParcelInternal(
    updatedOrder,
    customCodAmount,
    nextInvoice,
    true
  );

  if (!bookingResult.success) {
    return {
      success: false,
      error: bookingResult.error,
      fieldErrors: bookingResult.fieldErrors,
      cancellationResult,
      order: updatedOrder,
    };
  }

  const c = bookingResult.consignment!;

  try {
    if (orderUuid) {
      await client.from("order_events").insert({
        order_id: orderUuid,
        event_type: "courier_consignment_recreated",
        message: `Steadfast Consignment recreated #${c.consignment_id} (Tracking: ${c.tracking_code}, Invoice: ${nextInvoice})${c.item_description ? ` • Items: ${c.item_description}` : ""}`,
        actor_id: actorUuid,
      });
    }
  } catch (eventErr) {
    console.warn("Could not insert recreation events:", eventErr);
  }

  const { data: finalDbRow } = await client
    .from("orders")
    .select("*, order_items(*), order_events(*), order_notes(*)")
    .eq("order_number", orderId)
    .maybeSingle();

  const finalOrder: Order = finalDbRow
    ? formatDbOrderRecord(finalDbRow)
    : {
        ...updatedOrder,
        courier_consignment_id: String(c.consignment_id),
        courier_tracking_code: c.tracking_code,
        courier_tracking_url: c.tracking_link,
        courier_invoice: nextInvoice,
        courier_payload_snapshot: buildSteadfastPayloadSnapshot(
          updatedOrder,
          customCodAmount,
          nextInvoice
        ),
      };

  return {
    success: true,
    order: finalOrder,
    consignment: c,
    cancellationResult,
  };
}

const deliveryRecordCache = new Map<
  string,
  { record: SteadfastDeliveryRecord; expiresAt: number }
>();
const RECORD_CACHE_TTL_MS = 15 * 60 * 1000;
const DB_FRESHNESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function getSteadfastDeliveryRecordInternal(
  phone: string,
  skipCache: boolean = false
): Promise<GetSteadfastDeliveryRecordResponse> {
  try {
    const cleanPhone = normalizePhoneForSteadfast(phone);
    if (!cleanPhone || !/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return {
        success: false,
        error: "A valid 11-digit Bangladeshi mobile number is required.",
      };
    }

    const client = getSupabaseAdmin();

    if (!skipCache) {
      const cached = deliveryRecordCache.get(cleanPhone);
      if (cached && Date.now() < cached.expiresAt) {
        return {
          success: true,
          data: cached.record,
          fromCache: true,
          source: cached.record.source || "db",
          storedAt: cached.record.updated_at || cached.record.stored_at,
        };
      }
    }

    let dbRecord: any = null;
    try {
      const { data, error } = await client
        .from("customer_delivery_reports")
        .select("*")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (!error && data) {
        dbRecord = data;
      }
    } catch (err: any) {
      console.warn("DB lookup for delivery report failed:", err?.message || err);
    }

    if (dbRecord && !skipCache) {
      const recordDate = new Date(
        dbRecord.updated_at || dbRecord.stored_at
      ).getTime();
      const ageMs = Date.now() - recordDate;

      if (ageMs < DB_FRESHNESS_TTL_MS) {
        const record: SteadfastDeliveryRecord = {
          status: 200,
          phone: dbRecord.phone,
          delivery_ratio:
            dbRecord.delivery_ratio != null ? Number(dbRecord.delivery_ratio) : null,
          cancellation_ratio:
            dbRecord.cancellation_ratio != null
              ? Number(dbRecord.cancellation_ratio)
              : null,
          return_ratio:
            dbRecord.return_ratio != null ? Number(dbRecord.return_ratio) : null,
          volume_band: dbRecord.volume_band || null,
          volume_range: dbRecord.volume_range || null,
          delivered_count:
            dbRecord.delivered_count != null ? Number(dbRecord.delivered_count) : null,
          cancelled_count:
            dbRecord.cancelled_count != null ? Number(dbRecord.cancelled_count) : null,
          total_reports:
            dbRecord.total_reports != null ? Number(dbRecord.total_reports) : 0,
          fraud_categories: dbRecord.fraud_categories || {},
          doubtful_reports: Boolean(dbRecord.doubtful_reports),
          scoring_disabled: true,
          fetchedAt: dbRecord.updated_at || dbRecord.stored_at,
          stored_at: dbRecord.stored_at,
          updated_at: dbRecord.updated_at,
          source: "db",
        };

        deliveryRecordCache.set(cleanPhone, {
          record,
          expiresAt: Date.now() + RECORD_CACHE_TTL_MS,
        });

        return {
          success: true,
          data: record,
          fromCache: true,
          source: "db",
          storedAt: record.updated_at || record.stored_at,
        };
      }
    }

    const { apiKey, secretKey } = getSteadfastCredentials();

    const response = await fetch(
      `${STEADFAST_BASE_URL}/fraud_check/score/${encodeURIComponent(cleanPhone)}`,
      {
        method: "GET",
        headers: {
          "Api-Key": apiKey,
          "Secret-Key": secretKey,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (response.status === 429) {
      if (dbRecord) {
        const fallbackRecord: SteadfastDeliveryRecord = {
          status: 200,
          phone: dbRecord.phone,
          delivery_ratio:
            dbRecord.delivery_ratio != null ? Number(dbRecord.delivery_ratio) : null,
          cancellation_ratio:
            dbRecord.cancellation_ratio != null
              ? Number(dbRecord.cancellation_ratio)
              : null,
          return_ratio:
            dbRecord.return_ratio != null ? Number(dbRecord.return_ratio) : null,
          volume_band: dbRecord.volume_band || null,
          volume_range: dbRecord.volume_range || null,
          delivered_count:
            dbRecord.delivered_count != null ? Number(dbRecord.delivered_count) : null,
          cancelled_count:
            dbRecord.cancelled_count != null ? Number(dbRecord.cancelled_count) : null,
          total_reports:
            dbRecord.total_reports != null ? Number(dbRecord.total_reports) : 0,
          fraud_categories: dbRecord.fraud_categories || {},
          doubtful_reports: Boolean(dbRecord.doubtful_reports),
          scoring_disabled: true,
          fetchedAt: dbRecord.updated_at || dbRecord.stored_at,
          stored_at: dbRecord.stored_at,
          updated_at: dbRecord.updated_at,
          source: "db_fallback",
        };

        return {
          success: true,
          data: fallbackRecord,
          isRateLimited: true,
          fromCache: true,
          source: "db_fallback",
          storedAt: fallbackRecord.updated_at || fallbackRecord.stored_at,
          error:
            "Steadfast rate limit exceeded. Displaying latest saved database record.",
        };
      }

      return {
        success: false,
        error:
          "Steadfast rate limit exceeded. Please wait a moment before trying again.",
        isRateLimited: true,
      };
    }

    const data = await response.json();

    if (!response.ok || data.status !== 200) {
      if (dbRecord) {
        const fallbackRecord: SteadfastDeliveryRecord = {
          status: 200,
          phone: dbRecord.phone,
          delivery_ratio:
            dbRecord.delivery_ratio != null ? Number(dbRecord.delivery_ratio) : null,
          cancellation_ratio:
            dbRecord.cancellation_ratio != null
              ? Number(dbRecord.cancellation_ratio)
              : null,
          return_ratio:
            dbRecord.return_ratio != null ? Number(dbRecord.return_ratio) : null,
          volume_band: dbRecord.volume_band || null,
          volume_range: dbRecord.volume_range || null,
          delivered_count:
            dbRecord.delivered_count != null ? Number(dbRecord.delivered_count) : null,
          cancelled_count:
            dbRecord.cancelled_count != null ? Number(dbRecord.cancelled_count) : null,
          total_reports:
            dbRecord.total_reports != null ? Number(dbRecord.total_reports) : 0,
          fraud_categories: dbRecord.fraud_categories || {},
          doubtful_reports: Boolean(dbRecord.doubtful_reports),
          scoring_disabled: true,
          fetchedAt: dbRecord.updated_at || dbRecord.stored_at,
          stored_at: dbRecord.stored_at,
          updated_at: dbRecord.updated_at,
          source: "db_fallback",
        };

        return {
          success: true,
          data: fallbackRecord,
          fromCache: true,
          source: "db_fallback",
          storedAt: fallbackRecord.updated_at || fallbackRecord.stored_at,
        };
      }

      return {
        success: false,
        error: data.message || `Steadfast API error (${response.status})`,
      };
    }

    const nowIso = new Date().toISOString();
    const record: SteadfastDeliveryRecord = {
      status: 200,
      phone: cleanPhone,
      delivery_ratio:
        typeof data.delivery_ratio === "number" ? data.delivery_ratio : null,
      cancellation_ratio:
        typeof data.cancellation_ratio === "number"
          ? data.cancellation_ratio
          : null,
      return_ratio:
        typeof data.return_ratio === "number"
          ? data.return_ratio
          : typeof data.cancellation_ratio === "number"
          ? data.cancellation_ratio
          : null,
      volume_band: data.volume_band || null,
      volume_range: data.volume_range || null,
      delivered_count:
        typeof data.delivered_count === "number" ? data.delivered_count : null,
      cancelled_count:
        typeof data.cancelled_count === "number" ? data.cancelled_count : null,
      total_reports: typeof data.total_reports === "number" ? data.total_reports : 0,
      fraud_categories: data.fraud_categories || {},
      doubtful_reports: Boolean(data.doubtful_reports),
      scoring_disabled: true,
      fetchedAt: nowIso,
      stored_at: dbRecord?.stored_at || nowIso,
      updated_at: nowIso,
      source: "api",
    };

    try {
      const payloadToSave = {
        phone: cleanPhone,
        delivery_ratio: record.delivery_ratio,
        cancellation_ratio: record.cancellation_ratio,
        return_ratio: record.return_ratio,
        volume_band: record.volume_band,
        volume_range: record.volume_range,
        delivered_count: record.delivered_count,
        cancelled_count: record.cancelled_count,
        total_reports: record.total_reports,
        fraud_categories: record.fraud_categories,
        doubtful_reports: record.doubtful_reports,
        raw_response: data,
        updated_at: nowIso,
        ...(dbRecord ? {} : { stored_at: nowIso }),
      };

      const { error: upsertErr } = await client
        .from("customer_delivery_reports")
        .upsert(payloadToSave, { onConflict: "phone" });

      if (upsertErr) {
        console.warn("Could not save delivery report to database:", upsertErr.message);
      }
    } catch (saveErr: any) {
      console.warn(
        "Failed persisting delivery report to DB:",
        saveErr?.message || saveErr
      );
    }

    deliveryRecordCache.set(cleanPhone, {
      record,
      expiresAt: Date.now() + RECORD_CACHE_TTL_MS,
    });

    return {
      success: true,
      data: record,
      fromCache: false,
      source: "api",
      storedAt: nowIso,
    };
  } catch (err: any) {
    console.error("Error fetching Steadfast delivery record:", err);
    return {
      success: false,
      error:
        err.message ||
        "Failed to connect to Steadfast delivery records service.",
    };
  }
}

export async function batchGetSteadfastDeliveryRecordsInternal(
  phones: string[]
): Promise<Record<string, SteadfastDeliveryRecord>> {
  try {
    if (!phones || phones.length === 0) {
      return {};
    }

    const cleanPhones = Array.from(
      new Set(
        phones
          .map((p) => normalizePhoneForSteadfast(p))
          .filter((p) => /^01[3-9]\d{8}$/.test(p))
      )
    );

    if (cleanPhones.length === 0) {
      return {};
    }

    const client = getSupabaseAdmin();
    const { data, error } = await client
      .from("customer_delivery_reports")
      .select("*")
      .in("phone", cleanPhones);

    if (error || !data) {
      return {};
    }

    const result: Record<string, SteadfastDeliveryRecord> = {};

    for (const row of data) {
      const record: SteadfastDeliveryRecord = {
        status: 200,
        phone: row.phone,
        delivery_ratio:
          row.delivery_ratio != null ? Number(row.delivery_ratio) : null,
        cancellation_ratio:
          row.cancellation_ratio != null ? Number(row.cancellation_ratio) : null,
        return_ratio:
          row.return_ratio != null ? Number(row.return_ratio) : null,
        volume_band: row.volume_band || null,
        volume_range: row.volume_range || null,
        delivered_count:
          row.delivered_count != null ? Number(row.delivered_count) : null,
        cancelled_count:
          row.cancelled_count != null ? Number(row.cancelled_count) : null,
        total_reports: row.total_reports != null ? Number(row.total_reports) : 0,
        fraud_categories: row.fraud_categories || {},
        doubtful_reports: Boolean(row.doubtful_reports),
        scoring_disabled: true,
        fetchedAt: row.updated_at || row.stored_at,
        stored_at: row.stored_at,
        updated_at: row.updated_at,
        source: "db",
      };

      result[row.phone] = record;

      deliveryRecordCache.set(row.phone, {
        record,
        expiresAt: Date.now() + RECORD_CACHE_TTL_MS,
      });
    }

    return result;
  } catch (err: any) {
    console.warn(
      "batchGetSteadfastDeliveryRecordsInternal error:",
      err?.message || err
    );
    return {};
  }
}
