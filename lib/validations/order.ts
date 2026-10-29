import { z } from "zod";

/**
 * Bangladeshi phone number regex:
 * Accepts:
 * - Local 11-digit numbers: 013XXXXXXXX to 019XXXXXXXX
 * - Country code +88 prefix: +8801XXXXXXXXX or 8801XXXXXXXXX
 * Automatically strips whitespace and dashes before validation.
 */
const BD_PHONE_REGEX = /^(?:\+?88)?01[3-9]\d{8}$/;

/**
 * Customer Name: Required, 2 to 100 characters, trimmed.
 */
export const orderCustomerSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(
    z
      .string()
      .min(2, "Customer name must be at least 2 characters")
      .max(100, "Customer name must not exceed 100 characters")
  );

/**
 * Customer Phone: Required valid Bangladeshi mobile phone number.
 */
export const orderPhoneSchema = z
  .string()
  .transform((v) => (v || "").replace(/[\s-]/g, ""))
  .pipe(
    z
      .string()
      .min(1, "Phone number is required")
      .regex(
        BD_PHONE_REGEX,
        "Please enter a valid Bangladeshi phone number (e.g. 017XXXXXXXX or +88017XXXXXXXX)"
      )
  );

/**
 * Customer Email: Optional, but if provided must be a valid email format.
 */
export const orderEmailSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(
    z
      .string()
      .email("Please enter a valid email address (e.g. name@example.com)")
      .or(z.literal(""))
  )
  .optional()
  .default("");

/**
 * Geo Division: Required non-empty string.
 */
export const orderDivisionSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(z.string().min(1, "Please select a geographic division"));

/**
 * Geo District: Required non-empty string.
 */
export const orderDistrictSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(z.string().min(1, "Please select or type a delivery district"));

/**
 * Street / Delivery Address: Required, minimum 3 characters.
 */
export const orderAddressLineSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(
    z
      .string()
      .min(3, "Delivery address must be at least 3 characters")
      .max(300, "Delivery address is too long")
  );

/**
 * Order Channel Enum
 */
export const orderChannelSchema = z.enum(
  ["web", "phone", "whatsapp", "admin", "facebook", "walk_in"],
  {
    message: "Please select a valid order channel",
  }
);

/**
 * Payment Method Enum
 */
export const orderMethodSchema = z.enum(
  [
    "cod",
    "bkash",
    "nagad",
    "rocket",
    "card",
    "bank_transfer",
    "credit_terms",
    "cash",
  ],
  {
    message: "Please select a valid payment method",
  }
);

/**
 * Order Status Enum
 */
export const orderStatusSchema = z.enum([
  "incomplete_order",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "partially_delivered",
  "cancelled",
  "returned",
]);

/**
 * Payment Status Enum
 */
export const orderPaymentSchema = z.enum([
  "unpaid",
  "partially_paid",
  "paid",
  "partially_refunded",
  "refunded",
]);

/**
 * Fulfillment Status Enum
 */
export const orderFulfillmentSchema = z.enum([
  "unfulfilled",
  "partial",
  "fulfilled",
]);

/**
 * Shipping Fee: Non-negative number.
 */
export const orderShippingTotalSchema = z.coerce
  .number({
    message: "Shipping fee must be a number",
  })
  .min(0, "Shipping fee cannot be negative");

/**
 * Discount Total: Non-negative number.
 */
export const orderDiscountTotalSchema = z.coerce
  .number({
    message: "Discount must be a number",
  })
  .min(0, "Discount cannot be negative");

/**
 * Amount Paid (Partial or Full Payment): Non-negative number.
 */
export const orderAmountPaidSchema = z.coerce
  .number({
    message: "Amount paid must be a number",
  })
  .min(0, "Amount paid cannot be negative");

/**
 * Customer Note: Optional text up to 500 characters.
 */
export const orderCustomerNoteSchema = z
  .string()
  .max(500, "Special instructions note must not exceed 500 characters")
  .optional()
  .default("");

/**
 * Single Order Item Schema
 */
export const orderItemSchema = z.object({
  id: z.string().min(1, "Item ID is required"),
  sku: z.string().min(1, "SKU is required"),
  product_name: z.string().min(1, "Product name is required"),
  variant_name: z.string().default(""),
  quantity: z.coerce
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1"),
  unit_price: z.coerce.number().min(0, "Unit price cannot be negative"),
  line_total: z.coerce.number().min(0, "Line total cannot be negative"),
  variant_id: z.string().optional(),
});

/**
 * Order Items Array: Must contain at least one product.
 */
export const orderItemsArraySchema = z
  .array(orderItemSchema)
  .min(1, "Please select at least one product to place an order");

/**
 * Courier Name Schema & Bangladesh Courier Constants
 */
export const BANGLADESH_COURIERS = [
  "Steadfast Courier",
  "Pathao Courier",
  "RedX Logistics",
  "Paperfly",
  "Sundarban Courier",
  "SA Paribahan",
  "eCourier",
  "Warehouse Pickup",
] as const;

export const orderCourierNameSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .optional()
  .default("");

/**
 * Helper to determine if a field is mandatory based on order status
 */
export function isFieldRequiredForStatus(
  fieldName: "phone" | "customer" | "items" | "channel" | "method" | "division" | "district" | "address_line" | "shipping_total" | "courier_name" | "cancel_reason",
  status: string
): boolean {
  if (fieldName === "phone") return true;
  if (status === "incomplete_order" || status === "pending") {
    return false;
  }
  if (status === "cancelled" || status === "returned") {
    return fieldName === "cancel_reason";
  }
  if (
    fieldName === "customer" ||
    fieldName === "items" ||
    fieldName === "channel" ||
    fieldName === "method" ||
    fieldName === "division" ||
    fieldName === "district" ||
    fieldName === "address_line" ||
    fieldName === "shipping_total"
  ) {
    return true;
  }
  if (fieldName === "courier_name") {
    return (
      status === "processing" ||
      status === "shipped" ||
      status === "delivered" ||
      status === "partially_delivered"
    );
  }
  return false;
}

/**
 * Full Order Form Schema with Status-Based Conditional Validations
 */
export const orderFormSchema = z
  .object({
    customer: z.string().transform((v) => (v || "").trim()).default(""),
    phone: z.string().transform((v) => (v || "").replace(/[\s-]/g, "")).default(""),
    email: orderEmailSchema,
    division: z.string().transform((v) => (v || "").trim()).default(""),
    district: z.string().transform((v) => (v || "").trim()).default(""),
    address_line: z.string().transform((v) => (v || "").trim()).default(""),
    channel: orderChannelSchema,
    method: orderMethodSchema,
    status: orderStatusSchema,
    payment: orderPaymentSchema,
    fulfillment: orderFulfillmentSchema,
    shipping_total: orderShippingTotalSchema,
    discount_total: orderDiscountTotalSchema,
    amount_paid: orderAmountPaidSchema.optional().default(0),
    courier_name: orderCourierNameSchema,
    customer_note: orderCustomerNoteSchema,
    staff_note: z.string().max(1000, "Internal staff note must not exceed 1000 characters").optional().default(""),
    delivery_note: z.string().max(1000, "Delivery note must not exceed 1000 characters").optional().default(""),
    packaging_note: z.string().max(1000, "Packaging note must not exceed 1000 characters").optional().default(""),
    cancel_reason: z.string().optional().default(""),
    items: z.array(orderItemSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const isDraft = data.status === "incomplete_order" || data.status === "pending";
    const isTerminated = data.status === "cancelled" || data.status === "returned";
    const requiresCourier =
      data.status === "processing" ||
      data.status === "shipped" ||
      data.status === "delivered" ||
      data.status === "partially_delivered";

    // Validate phone number based on status
    if (data.status === "incomplete_order") {
      if (data.phone && !BD_PHONE_REGEX.test(data.phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid Bangladeshi phone number (e.g. 017XXXXXXXX or +88017XXXXXXXX)",
          path: ["phone"],
        });
      }
    } else {
      if (!data.phone || !BD_PHONE_REGEX.test(data.phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid Bangladeshi phone number (e.g. 017XXXXXXXX or +88017XXXXXXXX)",
          path: ["phone"],
        });
      }
    }

    // 1. Confirmed / Active Lifecycle Validation
    if (!isDraft && !isTerminated) {
      if (!data.customer || data.customer.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Customer name is required for confirmed orders (minimum 2 characters)",
          path: ["customer"],
        });
      }

      if (!data.items || data.items.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select at least one product item for confirmed orders",
          path: ["items"],
        });
      }

      if (!data.address_line || data.address_line.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Street delivery address is required (at least 3 characters)",
          path: ["address_line"],
        });
      }

      if (!data.division || !data.division.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select a geographic division",
          path: ["division"],
        });
      }

      if (!data.district || !data.district.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select or type a delivery district",
          path: ["district"],
        });
      }

      if (
        data.shipping_total === undefined ||
        data.shipping_total === null ||
        isNaN(data.shipping_total) ||
        data.shipping_total < 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Delivery charge must be a valid non-negative number",
          path: ["shipping_total"],
        });
      }
    }

    // 2. Processing & Subsequent Dispatches Require Courier Name
    if (requiresCourier) {
      if (!data.courier_name || data.courier_name.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Courier service name is required when order status is processing or dispatched",
          path: ["courier_name"],
        });
      }
    }

    // 3. Cancelled or Returned orders require reason
    if (isTerminated) {
      if (!data.cancel_reason || data.cancel_reason.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Please specify a reason for marking order as ${data.status.replace("_", " ")}`,
          path: ["cancel_reason"],
        });
      }
    }

    // 4. Financial sanity check
    const subtotal = data.items.reduce((sum, item) => sum + item.line_total, 0);
    if (!isDraft && data.discount_total > subtotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discount cannot exceed the order subtotal amount",
        path: ["discount_total"],
      });
    }

    // 5. Partial payment sanity check (only enforced when not in initial incomplete draft)
    const grandTotal = Math.max(0, subtotal - (data.discount_total || 0) + (data.shipping_total || 0));
    const amountPaid = Number(data.amount_paid) || 0;
    if (data.payment === "partially_paid" && !isDraft) {
      if (amountPaid <= 0 || amountPaid >= grandTotal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "For partial payment, amount paid must be greater than 0 and less than grand total",
          path: ["amount_paid"],
        });
      }
    }
  });

/**
 * Record / Settle Payment Form Schema
 */
export const recordPaymentFormSchema = z.object({
  payment: orderPaymentSchema,
  method: orderMethodSchema,
  amount_paid: orderAmountPaidSchema,
  transaction_ref: z.string().max(100, "Reference code is too long").optional().default(""),
  note: z.string().max(500, "Payment memo must not exceed 500 characters").optional().default(""),
});

/**
 * Order Note Schema (for Staff & Customer notes dialog)
 */
export const orderNoteTextSchema = z
  .string()
  .transform((v) => (v || "").trim())
  .pipe(
    z
      .string()
      .min(1, "Note details cannot be empty")
      .max(1000, "Note must not exceed 1000 characters")
  );

export const orderNoteTypeSchema = z.enum(
  ["internal", "customer", "delivery", "packaging"],
  {
    message: "Note type must be internal, customer, delivery, or packaging",
  }
);

export const orderNoteFormSchema = z.object({
  text: orderNoteTextSchema,
  type: orderNoteTypeSchema,
});

export const updateOrderNoteFormSchema = z.object({
  id: z.string().min(1, "Note ID is required"),
  text: orderNoteTextSchema,
  type: orderNoteTypeSchema,
});

/**
 * Inferred Types from Zod Schemas
 */
export type OrderFormValues = z.infer<typeof orderFormSchema>;
export type OrderItemValues = z.infer<typeof orderItemSchema>;
export type OrderNoteValues = z.infer<typeof orderNoteFormSchema>;
export type UpdateOrderNoteValues = z.infer<typeof updateOrderNoteFormSchema>;
export type RecordPaymentFormValues = z.infer<typeof recordPaymentFormSchema>;

/**
 * TanStack Form Validator Adapter Helper:
 * Wraps any Zod schema for TanStack Form field validators (onChange, onBlur).
 * Returns undefined if valid, or the first error message string if invalid.
 */
export function validateWithZod<T>(schema: z.ZodType<T>) {
  return ({ value }: { value: unknown }): string | undefined => {
    const result = schema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message;
    }
    return undefined;
  };
}
