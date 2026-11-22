export interface ParcelCheckpoint {
  id: string;
  eventType: string;
  message: string;
  timestamp: string;
  stage: "placed" | "confirmed" | "processing" | "shipped" | "in_transit" | "out_for_delivery" | "delivered" | "cancelled" | "returned" | "general";
  isCourierEvent: boolean;
}

export interface ParcelTrackingItem {
  id: string;
  productName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  weightGrams?: number;
  weightKg?: number;
  description?: string;
  sku?: string;
  image?: string;
}

export interface ParcelTrackingData {
  orderId: string;
  orderNumber: string;
  publicToken?: string;
  status: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  shippingTotal: number;
  grandTotal: number;
  amountPaid: number;
  codPayable: number;
  totalWeightKg: number;

  // Privacy-preserved recipient info
  maskedCustomerName: string;
  maskedCustomerPhone: string;
  destinationDistrict: string;
  destinationDivision?: string;

  // Courier info
  courierName: string;
  courierTrackingCode: string | null;
  courierConsignmentId: string | null;
  courierTrackingUrl: string | null;

  // Milestones & Timestamps
  placedAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  
  // Delivery ETA
  estimatedDeliveryRangeBn: string;
  estimatedDeliveryRangeEn: string;
  estimatedDeliveryDaysBn: string;
  estimatedDeliveryDaysEn: string;

  // Checkpoints / Timeline
  checkpoints: ParcelCheckpoint[];

  // Items
  items: ParcelTrackingItem[];
}

export type ParcelTrackingResult =
  | { success: true; data: ParcelTrackingData }
  | { success: false; error: string; notFound?: boolean };
