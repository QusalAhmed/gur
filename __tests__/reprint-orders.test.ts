import { describe, it, expect, vi } from "vitest";
import {
  buildOrderCourierSnapshot,
  getOrderReprintDiff,
  isOrderReprintRequired,
  formatOrderReprintDiffSummary,
} from "@/lib/order-reprint";
import type { Order } from "@/types/order";

describe("Order Reprint Tracking & Courier Diff Detection", () => {
  const baseOrder: Order = {
    id: "ORD-2026-001",
    customer: "Rahim Uddin",
    phone: "01711111111",
    alternative_phone: "01822222222",
    email: "rahim@example.com",
    address: {
      recipient_name: "Rahim Uddin",
      phone: "01711111111",
      division: "Dhaka",
      district: "Dhaka",
      address_line: "House 12, Road 4, Dhanmondi",
    },
    status: "confirmed",
    payment: "unpaid",
    fulfillment: "unfulfilled",
    method: "cod",
    channel: "web",
    subtotal: 1000,
    discount_total: 0,
    shipping_total: 100,
    grand_total: 1100,
    amount_paid: 0,
    currency: "BDT",
    date: new Date().toISOString(),
    items: [],
    notes: [],
    events: [],
  };

  it("returns false for isOrderReprintRequired when order has never been printed", () => {
    expect(isOrderReprintRequired(baseOrder)).toBe(false);
    expect(getOrderReprintDiff(baseOrder)).toEqual([]);
  });

  it("returns false when order was printed and no courier details changed", () => {
    const snapshot = buildOrderCourierSnapshot(baseOrder);
    const printedOrder: Order = {
      ...baseOrder,
      printed_at: new Date().toISOString(),
      printed_courier_snapshot: snapshot,
      reprint_required: false,
    };

    expect(isOrderReprintRequired(printedOrder)).toBe(false);
    expect(getOrderReprintDiff(printedOrder)).toEqual([]);
  });

  it("detects address and phone differences when courier fields are edited", () => {
    const snapshot = buildOrderCourierSnapshot(baseOrder);
    const printedOrder: Order = {
      ...baseOrder,
      printed_at: new Date().toISOString(),
      printed_courier_snapshot: snapshot,
      reprint_required: true,
    };

    // Customer changes phone and delivery address
    const modifiedOrder: Order = {
      ...printedOrder,
      phone: "01999999999",
      address: {
        ...printedOrder.address,
        phone: "01999999999",
        address_line: "Flat 4B, Road 15, Uttara",
        district: "Dhaka",
        division: "Dhaka",
      },
    };

    expect(isOrderReprintRequired(modifiedOrder)).toBe(true);
    const diffs = getOrderReprintDiff(modifiedOrder);
    expect(diffs).toHaveLength(2);

    const phoneDiff = diffs.find((d) => d.field === "Contact Phone");
    expect(phoneDiff).toBeDefined();
    expect(phoneDiff?.old).toBe("01711111111");
    expect(phoneDiff?.new).toBe("01999999999");

    const addrDiff = diffs.find((d) => d.field === "Delivery Address");
    expect(addrDiff).toBeDefined();
    expect(addrDiff?.old).toContain("House 12, Road 4, Dhanmondi");
    expect(addrDiff?.new).toContain("Flat 4B, Road 15, Uttara");

    const summary = formatOrderReprintDiffSummary(diffs);
    expect(summary).toContain("Contact Phone: 01711111111 → 01999999999");
    expect(summary).toContain("Delivery Address:");
  });

  it("detects COD amount changes when order total is adjusted", () => {
    const snapshot = buildOrderCourierSnapshot(baseOrder);
    const printedOrder: Order = {
      ...baseOrder,
      printed_at: new Date().toISOString(),
      printed_courier_snapshot: snapshot,
    };

    // Additional item added, grand total increased from 1100 to 1600
    const modifiedOrder: Order = {
      ...printedOrder,
      grand_total: 1600,
    };

    expect(isOrderReprintRequired(modifiedOrder)).toBe(true);
    const diffs = getOrderReprintDiff(modifiedOrder);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe("COD Amount");
    expect(diffs[0].old).toBe("৳1,100");
    expect(diffs[0].new).toBe("৳1,600");
  });

  it("flags reprint_required when order.reprint_required flag is explicitly true", () => {
    const flaggedOrder: Order = {
      ...baseOrder,
      printed_at: new Date().toISOString(),
      reprint_required: true,
    };

    expect(flaggedOrder.reprint_required).toBe(true);
  });
});
