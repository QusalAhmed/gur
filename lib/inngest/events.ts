import type { BrevoSendEmailPayload } from "@/lib/brevo";
import type { OrderSmsStatus } from "@/lib/sms/smsbangladesh";
import type { CapiEventParams } from "@/lib/facebook-capi";
import type { StorefrontOrderItem } from "@/actions/storefront-order";

export interface OrderCreatedEventData {
  outboxEventId?: string;
  orderId: string;
  orderNumber: string;
  customerName?: string;
  customerPhone: string;
  deliveryZone?: "inside_dhaka" | "outside_dhaka" | string;
  address?:
    | {
        address_line?: string;
        district?: string;
        division?: string;
      }
    | string;
  courierName?: string;
  items: Array<{
    productName: string;
    variantName?: string;
    quantity: number;
    unitPrice: number;
    lineTotal?: number;
  }>;
  subtotal: number;
  shippingTotal: number;
  discountTotal?: number;
  grandTotal: number;
  customerNote?: string;
  status: string;
  channel?: string;
  hasOtherOrders?: boolean;
  otherOrderNumbers?: string[];
  createdAt?: string;
}

export interface OrderStatusUpdatedEventData {
  outboxEventId?: string;
  orderId: string;
  orderNumber: string;
  newStatus: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "partially_delivered" | "cancelled" | "returned";
  previousStatus?: string;
  customerPhone: string;
  customerName?: string;
  grandTotal?: number;
  courierName?: string;
  trackingCode?: string;
  trackingUrl?: string;
  triggerMetaCapi?: boolean;
}

export interface OrderIncompleteEventData {
  outboxEventId?: string;
  orderId: string;
  orderNumber: string;
  customerName?: string;
  customerPhone: string;
  deliveryZone?: string;
  address?:
    | {
        address_line?: string;
        district?: string;
        division?: string;
      }
    | string;
  courierName?: string;
  items?: Array<{
    productName: string;
    variantName?: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal?: number;
  shippingTotal?: number;
  grandTotal?: number;
  customerNote?: string;
  createdAt?: string;
}

export interface OrderDraftAutoSaveEventData {
  orderId?: string;
  customerPhone: string;
  customerName?: string;
  addressLine?: string;
  deliveryZone?: "inside_dhaka" | "outside_dhaka";
  customerNote?: string;
  items?: StorefrontOrderItem[];
}

export interface NotificationEmailSendEventData {
  outboxEventId?: string;
  payload: BrevoSendEmailPayload;
}

export interface NotificationSmsSendEventData {
  outboxEventId?: string;
  recipientPhone: string;
  messageText: string;
  statusEvent?: OrderSmsStatus;
  orderId?: string;
  orderNumber?: string;
}

export interface MetaCapiPurchaseEventData {
  outboxEventId?: string;
  orderIdOrNumber: string;
}

export interface MetaCapiEventData {
  event: CapiEventParams;
}

export interface SteadfastBulkBookingEventData {
  orderIds?: string[];
  orders?: any[];
}

export type InngestEvents = {
  "order.created": {
    data: OrderCreatedEventData;
  };
  "order.status_updated": {
    data: OrderStatusUpdatedEventData;
  };
  "order.incomplete": {
    data: OrderIncompleteEventData;
  };
  "order.draft.autosave": {
    data: OrderDraftAutoSaveEventData;
  };
  "meta.capi.event": {
    data: MetaCapiEventData;
  };
  "steadfast.bulk.book": {
    data: SteadfastBulkBookingEventData;
  };
  "notification.email.send": {
    data: NotificationEmailSendEventData;
  };
  "notification.sms.send": {
    data: NotificationSmsSendEventData;
  };
  "meta.capi.purchase": {
    data: MetaCapiPurchaseEventData;
  };
  "outbox.sweep": {
    data: {
      source?: string;
      batchSize?: number;
    };
  };
};
