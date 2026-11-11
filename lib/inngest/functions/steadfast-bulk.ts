import { inngest } from "@/lib/inngest/client";
import { bookSteadfastParcelInternal } from "@/lib/steadfast-service";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isValidUuid, sanitizePostgrestFilterTerm } from "@/lib/security";
import { formatDbOrderRecord } from "@/lib/supabase";
import type { Order } from "@/types/order";
import type { SteadfastBulkBookingEventData } from "@/lib/inngest/events";

export const steadfastBulkBookingFunction = inngest.createFunction(
  {
    id: "steadfast-bulk-booking",
    name: "Steadfast Courier: Bulk Parcel Booking with Throttling",
    retries: 2,
    triggers: [{ event: "steadfast.bulk.book" }],
    concurrency: {
      limit: 5, // Throttles parallel bookings to prevent courier gateway timeouts
    },
  },
  async ({ event, step }) => {
    const data = event.data as SteadfastBulkBookingEventData;
    const client = getSupabaseAdmin();

    // Support both direct orders array or list of order IDs
    const orderIdentifiers: string[] = [];
    if (Array.isArray(data.orders)) {
      for (const o of data.orders) {
        const id = (o as any).order_number || (o as any).id;
        if (id) orderIdentifiers.push(String(id));
      }
    }
    if (Array.isArray(data.orderIds)) {
      for (const id of data.orderIds) {
        if (id && !orderIdentifiers.includes(String(id))) {
          orderIdentifiers.push(String(id));
        }
      }
    }

    const results = [];

    for (const orderId of orderIdentifiers) {
      const res = await step.run(`book-order-${orderId}`, async () => {
        try {
          // Fetch fresh order details with line items
          const cleanOrderId = sanitizePostgrestFilterTerm(orderId);
          if (!cleanOrderId) {
            return { success: false, orderId, error: "Invalid order identifier" };
          }
          let fetchQuery = client
            .from("orders")
            .select("*, order_items(*)");

          if (isValidUuid(cleanOrderId)) {
            fetchQuery = fetchQuery.or(`id.eq.${cleanOrderId},order_number.eq.${cleanOrderId}`);
          } else {
            fetchQuery = fetchQuery.eq("order_number", orderId);
          }

          const { data: dbRow, error: fetchErr } = await fetchQuery.maybeSingle();

          if (fetchErr || !dbRow) {
            return {
              success: false,
              orderId,
              error: fetchErr?.message || `Order '${orderId}' not found in database.`,
            };
          }

          const resolvedOrder: Order = formatDbOrderRecord(dbRow);
          return await bookSteadfastParcelInternal(resolvedOrder);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, error: msg, orderId };
        }
      });
      results.push(res);
    }

    return {
      total: orderIdentifiers.length,
      results,
    };
  }
);
