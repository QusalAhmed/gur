import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface WebhookResult {
  success: boolean;
  status: string;
  message?: string;
  order_number?: string;
  order_id?: string;
  reason?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const idempotencyKey =
    req.headers.get("idempotency-key") ||
    req.headers.get("x-idempotency-key") ||
    null;

  // 1. Authenticate with Bearer token matching STEADFAST_WEBHOOK_TOKEN
  const expectedToken = (process.env.STEADFAST_WEBHOOK_TOKEN || "").trim();
  const authHeader = req.headers.get("authorization") || "";
  const tokenMatch = authHeader.replace(/^Bearer\s+/i, "").trim();

  // If token is configured in .env, enforce validation
  if (expectedToken && tokenMatch !== expectedToken) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid or missing Bearer token." },
      { status: 401 }
    );
  }

  // 2. Parse request JSON payload
  let payload: any = null;
  try {
    payload = await req.json();
  } catch (parseErr) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const notificationType: string = String(payload?.notification_type || "unknown").trim();
  const rawConsignmentId = payload?.consignment_id != null ? String(payload.consignment_id).trim() : null;
  const rawInvoice = payload?.invoice != null ? String(payload.invoice).trim() : null;

  // 3. Idempotency Check: prevent duplicate processing if same event was already processed
  if (idempotencyKey) {
    try {
      const { data: existingLog } = await supabaseAdmin
        .from("courier_webhook_logs")
        .select("id, status, response_data")
        .eq("idempotency_key", idempotencyKey)
        .in("status", ["processed", "already_processed"])
        .maybeSingle();

      if (existingLog) {
        return NextResponse.json(
          {
            success: true,
            status: "already_processed",
            message: "Duplicate event detected via Idempotency-Key. Skipped redundant processing.",
            idempotency_key: idempotencyKey,
          },
          { status: 200 }
        );
      }
    } catch (idemErr) {
      console.warn("[Steadfast Webhook] Idempotency check query failed:", idemErr);
    }
  }

  // 4. Resolve Order from Database
  let matchedOrder: {
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    fulfillment_status: string;
    grand_total: number;
    amount_paid: number;
    courier_consignment_id?: string;
    courier_invoice?: string;
    shipping_address?: any;
    customer_name?: string;
  } | null = null;

  if (rawConsignmentId || rawInvoice) {
    try {
      let query = supabaseAdmin
        .from("orders")
        .select(
          "id, order_number, status, payment_status, fulfillment_status, grand_total, amount_paid, courier_consignment_id, courier_invoice, shipping_address, customer_name"
        );

      if (rawConsignmentId && rawInvoice) {
        query = query.or(
          `courier_consignment_id.eq.${rawConsignmentId},courier_invoice.eq.${rawInvoice},order_number.eq.${rawInvoice}`
        );
      } else if (rawConsignmentId) {
        query = query.eq("courier_consignment_id", rawConsignmentId);
      } else if (rawInvoice) {
        query = query.or(`courier_invoice.eq.${rawInvoice},order_number.eq.${rawInvoice}`);
      }

      const { data: ordersList } = await query.limit(1);
      if (ordersList && ordersList.length > 0) {
        matchedOrder = ordersList[0];
      }
    } catch (lookupErr) {
      console.error("[Steadfast Webhook] Order lookup failed:", lookupErr);
    }
  }

  // 5. Handle Unknown / Missing Orders
  // Per specification: Return 200 OK so Steadfast does not fail delivery health scores
  if (!matchedOrder && (rawConsignmentId || rawInvoice)) {
    const notFoundResult: WebhookResult = {
      success: false,
      status: "order_not_found",
      reason: `No matching order found for consignment: '${rawConsignmentId}', invoice: '${rawInvoice}'.`,
    };

    await logWebhookExecution({
      idempotencyKey,
      notificationType,
      consignmentId: rawConsignmentId,
      invoice: rawInvoice,
      orderId: null,
      orderNumber: null,
      payload,
      status: "order_not_found",
      responseData: notFoundResult,
      errorMessage: notFoundResult.reason,
    });

    return NextResponse.json(notFoundResult, { status: 200 });
  }

  // 6. Process Webhook Event by Notification Type
  const result: WebhookResult = {
    success: true,
    status: "processed",
    order_number: matchedOrder?.order_number,
    order_id: matchedOrder?.id,
  };

  try {
    const nowIso = new Date().toISOString();

    switch (notificationType) {
      // -----------------------------------------------------------------------
      // EVENT: delivery_status
      // -----------------------------------------------------------------------
      case "delivery_status": {
        if (!matchedOrder) break;

        const sfStatus = String(payload.status || "").toLowerCase().trim();
        const codAmount = payload.cod_amount != null ? Number(payload.cod_amount) : null;
        const deliveryCharge = payload.delivery_charge != null ? Number(payload.delivery_charge) : null;
        const trackingMessage = payload.tracking_message || "";
        const eventTimestamp = payload.updated_at
          ? new Date(payload.updated_at).toISOString()
          : nowIso;

        if (sfStatus === "delivered") {
          // Rule: full sync to delivered + paid + fulfilled + update amount_paid & delivery charge
          const updatePayload: Record<string, any> = {
            status: "delivered",
            payment_status: "paid",
            fulfillment_status: "fulfilled",
            delivered_at: eventTimestamp,
            updated_at: nowIso,
          };

          if (codAmount !== null && !isNaN(codAmount)) {
            updatePayload.amount_paid = codAmount;
          }
          if (deliveryCharge !== null && !isNaN(deliveryCharge)) {
            updatePayload.courier_delivery_charge = deliveryCharge;
          }

          await supabaseAdmin
            .from("orders")
            .update(updatePayload)
            .eq("id", matchedOrder.id);

          // Add timeline event
          await supabaseAdmin.from("order_events").insert({
            order_id: matchedOrder.id,
            event_type: "courier_status_delivered",
            from_value: matchedOrder.status,
            to_value: "delivered",
            message: trackingMessage || "Parcel delivered successfully by Steadfast Courier",
            actor_id: null,
          });

          // Add system delivery note
          const noteText = `Steadfast Delivery Confirmed: Consignment #${rawConsignmentId || matchedOrder.courier_consignment_id || "N/A"} delivered.${
            codAmount !== null ? ` COD collected: ৳${codAmount}.` : ""
          }${deliveryCharge !== null ? ` Courier charge: ৳${deliveryCharge}.` : ""}${
            trackingMessage ? ` Note: ${trackingMessage}` : ""
          }`.trim();

          await supabaseAdmin.from("order_notes").insert({
            order_id: matchedOrder.id,
            order_number: matchedOrder.order_number,
            type: "delivery",
            author: "Steadfast Courier",
            note: noteText,
          });

          result.message = "Order marked as delivered with COD collection synced.";
        } else if (sfStatus === "partial_delivered") {
          // Rule: mark as delivered, payment as partially_paid + update amount_paid & delivery charge
          const updatePayload: Record<string, any> = {
            status: "delivered",
            payment_status: "partially_paid",
            delivered_at: eventTimestamp,
            updated_at: nowIso,
          };

          if (codAmount !== null && !isNaN(codAmount)) {
            updatePayload.amount_paid = codAmount;
          }
          if (deliveryCharge !== null && !isNaN(deliveryCharge)) {
            updatePayload.courier_delivery_charge = deliveryCharge;
          }

          await supabaseAdmin
            .from("orders")
            .update(updatePayload)
            .eq("id", matchedOrder.id);

          await supabaseAdmin.from("order_events").insert({
            order_id: matchedOrder.id,
            event_type: "courier_status_partial_delivered",
            from_value: matchedOrder.status,
            to_value: "delivered",
            message: trackingMessage || "Parcel partially delivered by Steadfast Courier",
            actor_id: null,
          });

          const noteText = `Steadfast Partial Delivery: Consignment #${rawConsignmentId || matchedOrder.courier_consignment_id || "N/A"}.${
            codAmount !== null ? ` COD collected: ৳${codAmount}.` : ""
          }${deliveryCharge !== null ? ` Courier charge: ৳${deliveryCharge}.` : ""}${
            trackingMessage ? ` Note: ${trackingMessage}` : ""
          }`.trim();

          await supabaseAdmin.from("order_notes").insert({
            order_id: matchedOrder.id,
            order_number: matchedOrder.order_number,
            type: "delivery",
            author: "Steadfast Courier",
            note: noteText,
          });

          result.message = "Order marked as delivered (partially paid).";
        } else if (sfStatus === "cancelled") {
          // Database Trigger Rule:
          // If order is currently 'shipped', transitioning to 'cancelled' is blocked by DB trigger;
          // it must transition to 'returned'. If in 'processing', transition to 'cancelled'.
          const isShipped = matchedOrder.status === "shipped";
          const newStatus = isShipped ? "returned" : "cancelled";

          const updatePayload: Record<string, any> = {
            status: newStatus,
            updated_at: nowIso,
          };

          if (newStatus === "cancelled") {
            updatePayload.cancelled_at = eventTimestamp;
            updatePayload.cancel_reason =
              "Cancelled by Steadfast Courier" +
              (trackingMessage ? `: ${trackingMessage}` : "");
          }

          await supabaseAdmin
            .from("orders")
            .update(updatePayload)
            .eq("id", matchedOrder.id);

          await supabaseAdmin.from("order_events").insert({
            order_id: matchedOrder.id,
            event_type: isShipped ? "courier_parcel_returned" : "courier_parcel_cancelled",
            from_value: matchedOrder.status,
            to_value: newStatus,
            message: trackingMessage || `Parcel ${newStatus} by Steadfast Courier`,
            actor_id: null,
          });

          await supabaseAdmin.from("order_notes").insert({
            order_id: matchedOrder.id,
            order_number: matchedOrder.order_number,
            type: "delivery",
            author: "Steadfast Courier",
            note: `Steadfast Parcel ${isShipped ? "Returned" : "Cancelled"}: Consignment #${rawConsignmentId || "N/A"}.${
              trackingMessage ? ` Reason: ${trackingMessage}` : ""
            }`.trim(),
          });

          // Trigger high-priority admin notification per user specification
          await supabaseAdmin.from("notifications").insert({
            type: "system_alert",
            title: `Steadfast Alert: Order ${matchedOrder.order_number} ${isShipped ? "Returned" : "Cancelled"}`,
            message: `Order ${matchedOrder.order_number} was marked as ${newStatus} by Steadfast Courier.${
              trackingMessage ? ` Note: ${trackingMessage}` : ""
            }`,
            data: {
              order_id: matchedOrder.id,
              order_number: matchedOrder.order_number,
              consignment_id: rawConsignmentId,
              status: newStatus,
              link: `/admin/orders?search=${encodeURIComponent(matchedOrder.order_number)}`,
            },
          });

          result.message = `Order status transitioned to '${newStatus}'.`;
        } else {
          // Status like 'pending', 'in_transit', etc.
          // Add tracking update event without breaking existing state
          if (trackingMessage) {
            await supabaseAdmin.from("order_events").insert({
              order_id: matchedOrder.id,
              event_type: "courier_tracking_step",
              from_value: matchedOrder.status,
              to_value: matchedOrder.status,
              message: trackingMessage,
              actor_id: null,
            });
          }
          result.message = `Order courier update acknowledged (status: ${sfStatus}).`;
        }
        break;
      }

      // -----------------------------------------------------------------------
      // EVENT: tracking_update
      // -----------------------------------------------------------------------
      case "tracking_update": {
        if (!matchedOrder) break;

        const trackingMessage = String(payload.tracking_message || "").trim();
        if (trackingMessage) {
          await supabaseAdmin.from("order_events").insert({
            order_id: matchedOrder.id,
            event_type: "courier_tracking_step",
            from_value: null,
            to_value: null,
            message: trackingMessage,
            actor_id: null,
          });

          await supabaseAdmin.from("order_notes").insert({
            order_id: matchedOrder.id,
            order_number: matchedOrder.order_number,
            type: "delivery",
            author: "Steadfast Courier",
            note: `[Steadfast Tracking] ${trackingMessage}`,
          });
        }
        result.message = "Tracking checkpoint recorded on order.";
        break;
      }

      // -----------------------------------------------------------------------
      // EVENT: consignment_update
      // -----------------------------------------------------------------------
      case "consignment_update": {
        if (!matchedOrder) break;

        const changedList = Array.isArray(payload.changed) ? payload.changed : [];
        const values = payload.values || {};
        const changedDesc = changedList.length > 0 ? changedList.join(", ") : "Parcel details";

        await supabaseAdmin.from("order_events").insert({
          order_id: matchedOrder.id,
          event_type: "courier_consignment_modified",
          from_value: null,
          to_value: null,
          message: `Steadfast consignment modified (${changedDesc})`,
          actor_id: null,
        });

        await supabaseAdmin.from("order_notes").insert({
          order_id: matchedOrder.id,
          order_number: matchedOrder.order_number,
          type: "delivery",
          author: "Steadfast Courier",
          note: `[Steadfast Consignment Updated] Changed: ${changedDesc} | New values: ${JSON.stringify(values)}`,
        });

        result.message = "Consignment modification recorded on order.";
        break;
      }

      // -----------------------------------------------------------------------
      // EVENT: return_request / cancel_request
      // -----------------------------------------------------------------------
      case "return_request":
      case "cancel_request": {
        if (!matchedOrder) break;

        const reason = String(payload.reason || payload.note || "No reason specified").trim();

        await supabaseAdmin.from("order_events").insert({
          order_id: matchedOrder.id,
          event_type: "courier_return_request",
          from_value: null,
          to_value: null,
          message: `Steadfast return request received: ${reason}`,
          actor_id: null,
        });

        await supabaseAdmin.from("order_notes").insert({
          order_id: matchedOrder.id,
          order_number: matchedOrder.order_number,
          type: "delivery",
          author: "Steadfast Courier",
          note: `[Steadfast Return Request] Reason: ${reason}`,
        });

        // Trigger high-priority admin alert notification per user specification
        await supabaseAdmin.from("notifications").insert({
          type: "system_alert",
          title: `Steadfast Return Request: Order ${matchedOrder.order_number}`,
          message: `A return request was raised by Steadfast for Order ${matchedOrder.order_number}. Reason: ${reason}`,
          data: {
            order_id: matchedOrder.id,
            order_number: matchedOrder.order_number,
            consignment_id: rawConsignmentId,
            link: `/admin/orders?search=${encodeURIComponent(matchedOrder.order_number)}`,
          },
        });

        result.message = "Return/cancel request recorded with admin notification.";
        break;
      }

      // -----------------------------------------------------------------------
      // OTHER EVENTS: return_list_accepted, payment_request, pickup_request, user_update
      // -----------------------------------------------------------------------
      default: {
        result.message = `Acknowledged notification_type '${notificationType}'.`;
        break;
      }
    }
  } catch (err: any) {
    console.error(`[Steadfast Webhook] Processing error for event ${notificationType}:`, err);
    result.success = false;
    result.status = "error";
    result.message = err?.message || "Internal processing error occurred.";

    await logWebhookExecution({
      idempotencyKey,
      notificationType,
      consignmentId: rawConsignmentId,
      invoice: rawInvoice,
      orderId: matchedOrder?.id || null,
      orderNumber: matchedOrder?.order_number || null,
      payload,
      status: "error",
      responseData: result,
      errorMessage: err?.message,
    });

    // If server fails unexpectedly, return 500 so Steadfast retry schedule takes effect
    return NextResponse.json(
      { success: false, error: err?.message || "Internal error." },
      { status: 500 }
    );
  }

  // 7. Record Successful Execution in Audit Log
  await logWebhookExecution({
    idempotencyKey,
    notificationType,
    consignmentId: rawConsignmentId,
    invoice: rawInvoice,
    orderId: matchedOrder?.id || null,
    orderNumber: matchedOrder?.order_number || null,
    payload,
    status: "processed",
    responseData: result,
  });

  return NextResponse.json(result, { status: 200 });
}

/**
 * Audit helper: writes each received webhook event to public.courier_webhook_logs
 */
async function logWebhookExecution(params: {
  idempotencyKey: string | null;
  notificationType: string;
  consignmentId: string | null;
  invoice: string | null;
  orderId: string | null;
  orderNumber: string | null;
  payload: any;
  status: string;
  responseData: any;
  errorMessage?: string;
}) {
  try {
    await supabaseAdmin.from("courier_webhook_logs").insert({
      idempotency_key: params.idempotencyKey,
      notification_type: params.notificationType,
      consignment_id: params.consignmentId,
      invoice: params.invoice,
      order_id: params.orderId,
      order_number: params.orderNumber,
      payload: params.payload || {},
      status: params.status,
      response_data: params.responseData || {},
      error_message: params.errorMessage || null,
    });
  } catch (logErr) {
    console.warn("[Steadfast Webhook] Failed to write audit log:", logErr);
  }
}

