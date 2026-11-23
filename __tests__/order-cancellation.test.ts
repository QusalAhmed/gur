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

    it("requires a valid 4-digit zip / postal code before transitioning to confirmed or further", () => {
      // 1. Missing postal code
      const missingZipResult = validateOrderStatusTransition(
        "pending",
        "confirmed",
        "Customer Name",
        "01712345678",
        "House 1, Road 2",
        1,
        null,
        undefined,
        "Dhaka",
        "Dhaka",
        "" // missing
      );
      expect(missingZipResult.valid).toBe(false);
      expect(missingZipResult.code).toBe("POSTAL_CODE_REQUIRED");
      expect(missingZipResult.reason).toContain("A valid 4-digit zip/postal code is required");

      // 2. Invalid non-4-digit postal code (e.g. 3 digits or letters)
      const invalidZipResult = validateOrderStatusTransition(
        "pending",
        "confirmed",
        "Customer Name",
        "01712345678",
        "House 1, Road 2",
        1,
        null,
        undefined,
        "Dhaka",
        "Dhaka",
        "123" // 3 digits
      );
      expect(invalidZipResult.valid).toBe(false);
      expect(invalidZipResult.code).toBe("POSTAL_CODE_REQUIRED");

      // 3. Valid 4-digit postal code
      const validZipResult = validateOrderStatusTransition(
        "pending",
        "confirmed",
        "Customer Name",
        "01712345678",
        "House 1, Road 2",
        1,
        null,
        undefined,
        "Dhaka",
        "Dhaka",
        "1205" // valid
      );
      expect(validZipResult.valid).toBe(true);
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

    it("requires postal_code for confirmed and active statuses, but not for pending, incomplete, or cancelled", () => {
      expect(isFieldRequiredForStatus("postal_code", "confirmed")).toBe(true);
      expect(isFieldRequiredForStatus("postal_code", "processing")).toBe(true);
      expect(isFieldRequiredForStatus("postal_code", "shipped")).toBe(true);
      expect(isFieldRequiredForStatus("postal_code", "pending")).toBe(false);
      expect(isFieldRequiredForStatus("postal_code", "incomplete_order")).toBe(false);
      expect(isFieldRequiredForStatus("postal_code", "cancelled")).toBe(false);
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
