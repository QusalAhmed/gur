"use server";

import {
  enrichOrderMetaTrackingInternal,
  sendCapiContactInternal,
} from "@/lib/capi-service";

/**
 * Server action to send Contact / Lead touchpoint event to Meta CAPI.
 * Dispatched when visitor clicks Call, WhatsApp, Messenger, or submits call request.
 */
export async function sendCapiContactAction(params: {
  eventId?: string;
  event_id?: string;
  eventID?: string;
  channel?: string;
  refCode?: string;
  ref_code?: string;
  phone?: string | null;
  url?: string;
  fbp?: string | null;
  fbc?: string | null;
  customData?: Record<string, any>;
  custom_data?: Record<string, any>;
}) {
  return sendCapiContactInternal(params);
}

/**
 * Enriches an existing order's meta_tracking attribution when the customer
 * opens their confirmation link (/order-confirmed/[id]).
 */
export async function enrichOrderMetaTrackingAction(params: {
  orderIdentifier: string;
  publicToken?: string;
  fbp?: string | null;
  fbc?: string | null;
  url?: string;
  eventId?: string;
}): Promise<{
  success: boolean;
  orderNumber?: string;
  enriched?: boolean;
  error?: string;
}> {
  return enrichOrderMetaTrackingInternal(params);
}

