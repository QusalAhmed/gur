import { describe, it, expect } from "vitest";
import { validateOrderStatusTransition } from "@/lib/supabase/error-handler";
import { isFieldRequiredForStatus, orderFormSchema } from "@/lib/validations/order";
import { ORDER_CANCELLATION_REASONS } from "@/types/order";

describe("Order Cancellation Requirements & Safeguards", () => {
  describe("validateOrderStatusTransition", () => {
    it("allows cancelling pre-dispatch orders with cancellation reason alone (no location, phone, or items required)", () => {
      const preDispatchStatuses = ["incomplete_order", "pending", "confirmed", "processing"];

      for (const status of preDispatchStatuses) {
        const result = validateOrderStatusTransition(
          status,
          "cancelled",
          null, // customerName
          null, // customerPhone
          null, // customerAddress
          null, // itemsCount
          null, // courierName
          "Customer Changed Mind", // cancelReason
          null, // division
          null // district
        );

        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      }
    });

    it("rejects cancellation when reason is missing or under 3 characters", () => {
      const invalidReasons = [undefined, null, "", "  ", "no", "ab"];

      for (const reason of invalidReasons) {
        const result = validateOrderStatusTransition(
          "pending",
          "cancelled",
          "Customer Name",
          "01712345678",
          "Road 1",
          1,
          null,
          reason,
          "Dhaka",
          "Dhaka"
        );

        expect(result.valid).toBe(false);
        expect(result.code).toBe("CANCEL_REASON_REQUIRED");
        expect(result.reason).toContain("Cancellation reason is required");
      }
    });

    it("prevents cancelling already shipped or delivered orders (must use returned workflow)", () => {
      const dispatchedStatuses = ["shipped", "delivered"];

      for (const status of dispatchedStatuses) {
        const result = validateOrderStatusTransition(
          status,
          "cancelled",
          "Customer Name",
          "01712345678",
          "Road 1",
          1,
          "Steadfast Courier",
          "Customer Changed Mind",
          "Dhaka",
          "Dhaka"
        );

        expect(result.valid).toBe(false);
        expect(result.code).toBe("ORDER_NOT_CANCELLABLE");
        expect(result.reason).toContain("cannot be cancelled. Use 'Returned'");
      }
    });

    it("prevents modifying an already cancelled or returned order", () => {
      const finalStatuses = ["cancelled", "returned"];

      for (const status of finalStatuses) {
        const result = validateOrderStatusTransition(
          status,
          "cancelled",
          "Customer Name",
          "01712345678",
          "Road 1",
          1,
          null,
          "Another reason",
          "Dhaka",
          "Dhaka"
        );

        // Same status is no-op if identical
        if (status === "cancelled") {
          expect(result.valid).toBe(true);
        } else {
          expect(result.valid).toBe(false);
          expect(result.code).toBe("ORDER_FINAL");
        }
      }
    });

    it("continues enforcing delivery division & district for all non-cancelled status transitions", () => {
      const result = validateOrderStatusTransition(
        "incomplete_order",
        "confirmed",
        "Customer Name",
        "01712345678",
        "Road 1",
        1,
        null,
        undefined,
        "", // missing division
        "" // missing district
      );

      expect(result.valid).toBe(false);
      expect(result.code).toBe("GEO_LOCATION_REQUIRED");
      expect(result.reason).toContain("Delivery division and district are required");
    });
  });

  describe("isFieldRequiredForStatus", () => {
    it("returns true ONLY for cancel_reason when status is cancelled", () => {
      expect(isFieldRequiredForStatus("cancel_reason", "cancelled")).toBe(true);
      expect(isFieldRequiredForStatus("phone", "cancelled")).toBe(false);
      expect(isFieldRequiredForStatus("customer", "cancelled")).toBe(false);
      expect(isFieldRequiredForStatus("items", "cancelled")).toBe(false);
      expect(isFieldRequiredForStatus("division", "cancelled")).toBe(false);
      expect(isFieldRequiredForStatus("district", "cancelled")).toBe(false);
      expect(isFieldRequiredForStatus("address_line", "cancelled")).toBe(false);
      expect(isFieldRequiredForStatus("courier_name", "cancelled")).toBe(false);
      expect(isFieldRequiredForStatus("channel", "cancelled")).toBe(false);
      expect(isFieldRequiredForStatus("shipping_total", "cancelled")).toBe(false);
    });

    it("still requires phone for active/confirmed statuses", () => {
      expect(isFieldRequiredForStatus("phone", "confirmed")).toBe(true);
      expect(isFieldRequiredForStatus("phone", "processing")).toBe(true);
    });
  });

  describe("orderFormSchema validation with cancelled status", () => {
    it("successfully parses order with status 'cancelled' and reason alone", () => {
      const formData = {
        customer: "",
        phone: "",
        division: "",
        district: "",
        address_line: "",
        channel: "",
        method: "cod",
        status: "cancelled",
        payment: "unpaid",
        fulfillment: "unfulfilled",
        shipping_total: 0,
        discount_total: 0,
        amount_paid: 0,
        courier_name: "",
        cancel_reason: "Duplicate / Test Order",
        items: [],
      };

      const parsed = orderFormSchema.safeParse(formData);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe("cancelled");
        expect(parsed.data.cancel_reason).toBe("Duplicate / Test Order");
      }
    });

    it("fails validation if status is 'cancelled' but cancel_reason is empty or < 3 chars", () => {
      const formData = {
        customer: "",
        phone: "",
        division: "",
        district: "",
        address_line: "",
        channel: "",
        method: "cod",
        status: "cancelled",
        payment: "unpaid",
        fulfillment: "unfulfilled",
        shipping_total: 0,
        discount_total: 0,
        amount_paid: 0,
        courier_name: "",
        cancel_reason: "no",
        items: [],
      };

      const parsed = orderFormSchema.safeParse(formData);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const cancelIssue = parsed.error.issues.find((issue) => issue.path.includes("cancel_reason"));
        expect(cancelIssue).toBeDefined();
        expect(cancelIssue?.message).toContain("reason");
      }
    });
  });

  describe("ORDER_CANCELLATION_REASONS preset options", () => {
    it("includes all standard agreed cancellation presets", () => {
      expect(ORDER_CANCELLATION_REASONS).toContain("Customer Changed Mind");
      expect(ORDER_CANCELLATION_REASONS).toContain("Duplicate / Test Order");
      expect(ORDER_CANCELLATION_REASONS).toContain("Customer Unreachable");
      expect(ORDER_CANCELLATION_REASONS).toContain("Out of Stock");
      expect(ORDER_CANCELLATION_REASONS).toContain("Customer Refused COD / Price");
      expect(ORDER_CANCELLATION_REASONS).toContain("Other (Custom)");
    });
  });
});
