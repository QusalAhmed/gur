import { describe, it, expect } from "vitest";
import {
  isOrderDeliveredStatus,
  getOrderAdvancePaid,
  getOrderAmountPaidAfterDelivery,
  getOrderEffectivePaid,
  getOrderDueBalance,
  deriveOrderPaymentStatus,
} from "@/lib/order-payment-utils";
import { calculateCodAmount } from "@/lib/steadfast";
import { formatDbOrderRecord } from "@/lib/supabase/api";
import { orderFormSchema, recordPaymentFormSchema } from "@/lib/validations/order";
import type { Order } from "@/types/order";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ORD-TEST-1",
    customer: "Rahim Uddin",
    phone: "01711111111",
    email: "",
    address: {
      division: "Dhaka",
      district: "Dhaka",
      address_line: "Mirpur-10",
    },
    status: "confirmed",
    payment: "unpaid",
    fulfillment: "unfulfilled",
    method: "cod",
    channel: "web",
    subtotal: 1550,
    discount_total: 0,
    shipping_total: 100,
    grand_total: 1650,
    advance_paid: 0,
    amount_paid: 0,
    currency: "BDT",
    date: "2026-11-24T10:00:00.000Z",
    items: [],
    notes: [],
    events: [],
    ...overrides,
  };
}

describe("Advance Payment & Post-Delivery Amount Paid Lifecycle", () => {
  describe("order-payment-utils lifecycle helpers", () => {
    it("treats only delivered, partially_delivered, or returned-with-delivered_at as delivered states", () => {
      expect(isOrderDeliveredStatus("pending")).toBe(false);
      expect(isOrderDeliveredStatus("confirmed")).toBe(false);
      expect(isOrderDeliveredStatus("processing")).toBe(false);
      expect(isOrderDeliveredStatus("shipped")).toBe(false);
      expect(isOrderDeliveredStatus("cancelled")).toBe(false);
      expect(isOrderDeliveredStatus("returned", null)).toBe(false);

      expect(isOrderDeliveredStatus("delivered")).toBe(true);
      expect(isOrderDeliveredStatus("partially_delivered")).toBe(true);
      expect(isOrderDeliveredStatus("returned", "2026-11-24T12:00:00Z")).toBe(true);
    });

    it("forces post-delivery amount_paid to 0 before delivery and uses advance_paid as effective paid", () => {
      const preDeliveryOrder = {
        status: "confirmed",
        payment: "partially_paid",
        grand_total: 1500,
        advance_paid: 400,
        amount_paid: 999,
      };

      expect(getOrderAdvancePaid(preDeliveryOrder)).toBe(400);
      expect(getOrderAmountPaidAfterDelivery(preDeliveryOrder)).toBe(0);
      expect(getOrderEffectivePaid(preDeliveryOrder)).toBe(400);
      expect(getOrderDueBalance(preDeliveryOrder)).toBe(1100);
    });

    it("preserves advance_paid and uses post-delivery amount_paid once delivered", () => {
      const deliveredOrder = {
        status: "delivered",
        payment: "paid",
        grand_total: 1500,
        advance_paid: 400,
        amount_paid: 1500,
      };

      expect(getOrderAdvancePaid(deliveredOrder)).toBe(400);
      expect(getOrderAmountPaidAfterDelivery(deliveredOrder)).toBe(1500);
      expect(getOrderEffectivePaid(deliveredOrder)).toBe(1500);
      expect(getOrderDueBalance(deliveredOrder)).toBe(0);
    });

    it("computes remaining due after partial delivery using total amount_paid", () => {
      const partialDelivery = {
        status: "partially_delivered",
        payment: "partially_paid",
        grand_total: 2000,
        advance_paid: 500,
        amount_paid: 1200,
      };

      expect(getOrderEffectivePaid(partialDelivery)).toBe(1200);
      expect(getOrderDueBalance(partialDelivery)).toBe(800);
    });

    it("derives payment_status accurately from grand_total and effective paid", () => {
      expect(deriveOrderPaymentStatus(1500, 0)).toBe("unpaid");
      expect(deriveOrderPaymentStatus(1500, 500)).toBe("partially_paid");
      expect(deriveOrderPaymentStatus(1500, 1500)).toBe("paid");
      expect(deriveOrderPaymentStatus(1500, 1700)).toBe("paid");
      expect(deriveOrderPaymentStatus(1500, 0, "refunded")).toBe("refunded");
      expect(deriveOrderPaymentStatus(1500, 500, "partially_refunded")).toBe("partially_refunded");
    });
  });

  describe("Steadfast calculateCodAmount with advance_paid", () => {
    it("deducts advance_paid before delivery even when amount_paid is 0", () => {
      expect(
        calculateCodAmount(
          makeOrder({
            status: "confirmed",
            payment: "partially_paid",
            grand_total: 1650,
            advance_paid: 500,
            amount_paid: 0,
          })
        )
      ).toBe(1150);
    });

    it("returns 0 COD when 100% prepaid via advance_paid before delivery", () => {
      expect(
        calculateCodAmount(
          makeOrder({
            status: "processing",
            payment: "paid",
            grand_total: 1650,
            advance_paid: 1650,
            amount_paid: 0,
          })
        )
      ).toBe(0);
    });
  });

  describe("formatDbOrderRecord mapping", () => {
    it("enforces amount_paid = 0 for pre-delivery records and retains advance_paid", () => {
      const mapped = formatDbOrderRecord({
        id: "ord-1",
        order_number: "GUR-2611-1001",
        status: "shipped",
        payment_status: "partially_paid",
        fulfillment_status: "fulfilled",
        payment_method: "bkash",
        channel: "phone",
        subtotal: 1200,
        discount_total: 0,
        shipping_total: 120,
        grand_total: 1320,
        advance_paid: 320,
        amount_paid: 0,
        currency: "BDT",
        created_at: "2026-11-24T10:00:00Z",
      });

      expect(mapped.advance_paid).toBe(320);
      expect(mapped.amount_paid).toBe(0);
    });

    it("retains both advance_paid and post-delivery amount_paid on delivered orders", () => {
      const mapped = formatDbOrderRecord({
        id: "ord-2",
        order_number: "GUR-2611-1002",
        status: "delivered",
        payment_status: "paid",
        fulfillment_status: "fulfilled",
        payment_method: "cod",
        channel: "web",
        subtotal: 1200,
        discount_total: 0,
        shipping_total: 120,
        grand_total: 1320,
        advance_paid: 320,
        amount_paid: 1320,
        delivered_at: "2026-11-24T16:00:00Z",
        currency: "BDT",
        created_at: "2026-11-24T10:00:00Z",
      });

      expect(mapped.advance_paid).toBe(320);
      expect(mapped.amount_paid).toBe(1320);
    });
  });

  describe("Zod schemas for advance_paid vs amount_paid", () => {
    const baseForm = {
      customer: "Karim Ahmed",
      phone: "01711111111",
      division: "Dhaka",
      district: "Dhaka",
      postal_code: "1205",
      address_line: "House 12, Road 4, Dhanmondi",
      channel: "phone",
      method: "bkash",
      status: "confirmed",
      payment: "partially_paid",
      fulfillment: "unfulfilled",
      shipping_total: 120,
      discount_total: 0,
      advance_paid: 400,
      amount_paid: 0,
      courier_name: "",
      cancel_reason: "",
      items: [
        {
          id: "i-1",
          sku: "PATALI-1KG",
          product_name: "Khejurer Patali Gur",
          variant_name: "1 KG",
          quantity: 1,
          unit_price: 1200,
          line_total: 1200,
        },
      ],
    };

    it("validates pre-delivery partially_paid orders against advance_paid", () => {
      expect(orderFormSchema.safeParse(baseForm).success).toBe(true);

      const invalidPreDelivery = orderFormSchema.safeParse({
        ...baseForm,
        advance_paid: 0,
        amount_paid: 400,
      });
      expect(invalidPreDelivery.success).toBe(false);
    });

    it("validates post-delivery partially_paid orders against amount_paid", () => {
      const validPostDelivery = orderFormSchema.safeParse({
        ...baseForm,
        status: "partially_delivered",
        courier_name: "Steadfast Courier",
        advance_paid: 400,
        amount_paid: 900,
      });
      expect(validPostDelivery.success).toBe(true);
    });

    it("parses recordPaymentFormSchema with both advance_paid and amount_paid", () => {
      const parsed = recordPaymentFormSchema.safeParse({
        payment: "partially_paid",
        method: "bkash",
        advance_paid: 500,
        amount_paid: 0,
        transaction_ref: "TRX-123",
        note: "Advance bKash",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.advance_paid).toBe(500);
        expect(parsed.data.amount_paid).toBe(0);
      }
    });
  });
});
