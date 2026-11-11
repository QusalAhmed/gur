"use server";

import { assertStaffRole, getActorUuid } from "@/lib/admin-guard";
import {
  bookSteadfastParcelInternal,
  bookSteadfastBulkParcelsInternal,
  getSteadfastBalanceInternal,
  cancelSteadfastConsignmentInternal,
  recreateSteadfastParcelInternal,
  getSteadfastDeliveryRecordInternal,
  batchGetSteadfastDeliveryRecordsInternal,
} from "@/lib/steadfast-service";
import type { Order } from "@/types/order";
import type {
  BookSteadfastResponse,
  BulkBookSteadfastResult,
  BulkBookingItemResult,
  SteadfastBalanceResult,
  UpdateOrderStatusWithSteadfastParams,
  UpdateOrderStatusWithSteadfastResult,
  SteadfastPayloadSnapshot,
  SteadfastDiffItem,
  SteadfastDiffResult,
  RecreateSteadfastParcelParams,
  RecreateSteadfastParcelResult,
  SteadfastDeliveryRecord,
  GetSteadfastDeliveryRecordResponse,
  SteadfastRiskAssessment,
} from "@/lib/steadfast";

export type {
  BookSteadfastResponse,
  BulkBookSteadfastResult,
  BulkBookingItemResult,
  SteadfastBalanceResult,
  UpdateOrderStatusWithSteadfastParams,
  UpdateOrderStatusWithSteadfastResult,
  SteadfastPayloadSnapshot,
  SteadfastDiffItem,
  SteadfastDiffResult,
  RecreateSteadfastParcelParams,
  RecreateSteadfastParcelResult,
  SteadfastDeliveryRecord,
  GetSteadfastDeliveryRecordResponse,
  SteadfastRiskAssessment,
};

/**
 * Server Action: Book a single parcel with Steadfast Courier.
 */
export async function bookSteadfastParcelAction(
  order: Order,
  customCodAmount?: number,
  overrideInvoice?: string,
  isRecreation: boolean = false
): Promise<BookSteadfastResponse> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    return await bookSteadfastParcelInternal(
      order,
      customCodAmount,
      overrideInvoice,
      isRecreation
    );
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unauthorized or failed to book parcel.",
    };
  }
}

/**
 * Server Action: Bulk-book parcels with Steadfast Courier (/create_order/bulk-order).
 */
export async function bookSteadfastBulkParcelsAction(
  orders: Order[]
): Promise<BulkBookSteadfastResult> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    return await bookSteadfastBulkParcelsInternal(orders, getActorUuid(session));
  } catch (err: any) {
    return {
      success: false,
      totalRequested: orders?.length || 0,
      successfulCount: 0,
      failedCount: orders?.length || 0,
      results: [],
      error: err?.message || "Unauthorized or bulk booking failed.",
    };
  }
}

/**
 * Server Action: Enqueues bulk parcel booking into Inngest with concurrency control.
 * Falls back to synchronous execution if Inngest queue is unavailable.
 */
export async function queueSteadfastBulkBookingAction(orders: Order[]): Promise<{
  success: boolean;
  queued: boolean;
  totalRequested: number;
  error?: string;
}> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    if (!orders || orders.length === 0) {
      return { success: true, queued: false, totalRequested: 0 };
    }

    try {
      const { inngest } = await import("@/lib/inngest/client");
      await inngest.send({
        name: "steadfast.bulk.book",
        data: { orders },
      });
      return { success: true, queued: true, totalRequested: orders.length };
    } catch (err: any) {
      console.warn(
        "[Steadfast] Failed to enqueue bulk booking, falling back to synchronous execution:",
        err
      );
      const syncRes = await bookSteadfastBulkParcelsInternal(
        orders,
        getActorUuid(session)
      );
      return {
        success: syncRes.success,
        queued: false,
        totalRequested: syncRes.totalRequested,
        error: syncRes.error,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      queued: false,
      totalRequested: orders?.length || 0,
      error: err?.message || "Unauthorized or failed to queue bulk booking.",
    };
  }
}

/**
 * Server Action: Fetch current Steadfast Courier merchant balance & remittance.
 */
export async function getSteadfastBalanceAction(): Promise<SteadfastBalanceResult> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    return await getSteadfastBalanceInternal();
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unauthorized or failed to retrieve balance.",
    };
  }
}

/**
 * Server Action: High-level status updater with automatic Steadfast parcel creation.
 * Delegated to central updateOrderStatusAction in actions/orders.ts.
 */
export async function updateOrderStatusWithSteadfastAction(
  params: UpdateOrderStatusWithSteadfastParams
): Promise<UpdateOrderStatusWithSteadfastResult> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    const { updateOrderStatusAction } = await import("@/actions/orders");
    return await updateOrderStatusAction(params);
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unauthorized or failed to update order status.",
    };
  }
}

/**
 * Server Action: Submit a return/cancellation request to Steadfast Courier.
 */
export async function cancelSteadfastConsignmentAction(
  identifier: {
    consignmentId?: number | string;
    invoice?: string;
    trackingCode?: string;
  },
  reason?: string
): Promise<{ success: boolean; status?: number; message?: string; raw?: any }> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    return await cancelSteadfastConsignmentInternal(identifier, reason);
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Unauthorized or failed to cancel consignment.",
    };
  }
}

/**
 * Server Action: Recreate a Steadfast parcel when critical order info changes after booking.
 */
export async function recreateSteadfastParcelAction(
  params: RecreateSteadfastParcelParams
): Promise<RecreateSteadfastParcelResult> {
  try {
    const session = await assertStaffRole(["owner", "admin", "manager", "support"]);
    return await recreateSteadfastParcelInternal(
      params,
      getActorUuid(session),
      session.user.name
    );
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unauthorized or failed to recreate parcel.",
    };
  }
}

/**
 * Server Action: Fetch a customer's courier delivery track record by phone number.
 */
export async function getSteadfastDeliveryRecordAction(
  phone: string,
  skipCache: boolean = false
): Promise<GetSteadfastDeliveryRecordResponse> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    return await getSteadfastDeliveryRecordInternal(phone, skipCache);
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unauthorized or failed to load delivery record.",
    };
  }
}

/**
 * Server Action: Batch lookup cached courier delivery records for an array of phone numbers.
 */
export async function batchGetSteadfastDeliveryRecordsAction(
  phones: string[]
): Promise<Record<string, SteadfastDeliveryRecord>> {
  try {
    await assertStaffRole(["owner", "admin", "manager", "support"]);
    return await batchGetSteadfastDeliveryRecordsInternal(phones);
  } catch {
    return {};
  }
}
