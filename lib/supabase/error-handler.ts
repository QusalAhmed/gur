/**
 * Database Error Handler & Diagnostic Classifier
 * Translates Supabase / PostgreSQL errors (RLS policies, trigger rejections, check constraints,
 * foreign keys, and silent 0-row rejections) into actionable, user-friendly messages for the UI.
 */

export interface ParsedDatabaseError {
  /** Short, high-impact title explaining the category of error */
  title: string;
  /** Clear human-readable description of what failed */
  message: string;
  /** Actionable next step or remediation instructions */
  resolution?: string;
  /** Database error code (e.g., '42501', 'P0001', '23514', '0-ROWS-RLS') */
  code?: string;
  /** Technical details or hint from Postgres/PostgREST */
  details?: string;
  /** Hint provided by the database or system */
  hint?: string;
  /** Whether this was an RLS (Row Level Security) failure */
  isRlsError: boolean;
  /** Whether this was a state-machine or data validation error */
  isWorkflowError: boolean;
  /** Raw error object */
  originalError?: any;
}

export class DatabaseOperationError extends Error {
  public parsed: ParsedDatabaseError;

  constructor(parsed: ParsedDatabaseError) {
    super(parsed.message);
    this.name = "DatabaseOperationError";
    this.parsed = parsed;
    // Maintain stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseOperationError);
    }
  }
}

/**
 * Parses any database error from Supabase / PostgREST / PostgreSQL and returns
 * structured, friendly error details for rendering in toasts and UI dialog banners.
 */
export function parseDatabaseError(error: any): ParsedDatabaseError {
  if (!error) {
    return {
      title: "Unknown Database Error",
      message: "An unexpected error occurred while communicating with the database.",
      resolution: "Please refresh the page and try again.",
      isRlsError: false,
      isWorkflowError: false,
      originalError: error,
    };
  }

  // If already an instance with parsed metadata, return it
  if (error instanceof DatabaseOperationError && error.parsed) {
    return error.parsed;
  }
  if (error.parsed && typeof error.parsed === "object" && error.parsed.title) {
    return error.parsed;
  }

  const rawMessage: string = String(error.message || error.error_description || error.details || error || "");
  const code: string = String(error.code || error.statusCode || error.status || "").trim();
  const details: string = error.details ? String(error.details) : "";
  const hint: string = error.hint ? String(error.hint) : "";
  const lowerMsg = rawMessage.toLowerCase();
  const lowerDetails = details.toLowerCase();

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ROW-LEVEL SECURITY (RLS) POLICIES & PERMISSIONS (Postgres 42501)
  // ───────────────────────────────────────────────────────────────────────────
  const isExplicitRls =
    code === "42501" ||
    lowerMsg.includes("row-level security") ||
    lowerMsg.includes("row level security") ||
    lowerMsg.includes("violates row-level security policy") ||
    lowerMsg.includes("permission denied for table") ||
    lowerMsg.includes("permission denied for schema") ||
    lowerDetails.includes("row-level security");

  if (isExplicitRls) {
    let tableName = "orders";
    if (lowerMsg.includes("order_items") || lowerDetails.includes("order_items")) {
      tableName = "order_items";
    } else if (lowerMsg.includes("order_events") || lowerDetails.includes("order_events")) {
      tableName = "order_events";
    } else if (lowerMsg.includes("staff_members") || lowerDetails.includes("staff_members")) {
      tableName = "staff_members";
    }

    return {
      title: "Database Permission Denied (RLS Policy)",
      message: `Database Row-Level Security policy blocked modifying '${tableName}'. The database rejected the update statement.`,
      resolution:
        "Check that your Supabase project has the latest order update policies applied (e.g. migration 20261028000001_fix_order_status_rls_and_workflow.sql) and that legacy restrictive policies like 'orders_update_staff' have been dropped.",
      code: code || "42501",
      details: details || rawMessage,
      hint: hint || "Run the provided migration script in your Supabase SQL Editor to grant UPDATE access to anon and authenticated roles.",
      isRlsError: true,
      isWorkflowError: false,
      originalError: error,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SILENT RLS 0-ROW REJECTION
  // ───────────────────────────────────────────────────────────────────────────
  if (code === "0-ROWS-RLS" || lowerMsg.includes("0 rows affected by update") || lowerMsg.includes("rls filtered row")) {
    return {
      title: "Database RLS Update Denied (0 Rows Updated)",
      message: "The database accepted the query but 0 rows were updated because the table's Row-Level Security (RLS) policy filtered out this order.",
      resolution:
        "Ensure the orders table has an UPDATE policy matching this order's user or role (run the migration 20261028000001_fix_order_status_rls_and_workflow.sql).",
      code: "0-ROWS-RLS",
      details: rawMessage,
      hint: "PostgREST returns 200 OK with empty rows when an RLS USING expression evaluates to FALSE.",
      isRlsError: true,
      isWorkflowError: false,
      originalError: error,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. DATABASE STATE MACHINE / TRIGGER ERRORS (Postgres P0001)
  // ───────────────────────────────────────────────────────────────────────────
  if (code === "P0001" || lowerMsg.includes("customer_name_required") || lowerMsg.includes("order_status_backwards") || lowerMsg.includes("order_final")) {
    // 3a. Customer Name Required
    if (lowerMsg.includes("customer_name_required") || lowerMsg.includes("customer name is required")) {
      return {
        title: "Customer Name Required",
        message: "Cannot advance order to Confirmed without a valid customer name.",
        resolution: "Click 'Edit Order' to enter the customer's full name, then retry confirming the order.",
        code: "CUSTOMER_NAME_REQUIRED",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // 3b. Customer Phone Required
    if (lowerMsg.includes("customer_phone_required") || lowerMsg.includes("customer phone is required")) {
      return {
        title: "Valid Customer Phone Required",
        message: "Cannot advance order to Confirmed without a valid Bangladesh mobile number (+880...).",
        resolution: "Click 'Edit Order' to enter a valid phone number (e.g. +88017xxxxxxxx), then retry confirming.",
        code: "CUSTOMER_PHONE_REQUIRED",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // 3c. Customer Delivery Address Required
    if (lowerMsg.includes("customer_address_required") || lowerMsg.includes("delivery address is required") || lowerMsg.includes("street delivery address")) {
      return {
        title: "Delivery Address Required",
        message: "Cannot advance order to Confirmed without a street delivery address.",
        resolution: "Click 'Edit Order' to enter the customer's street delivery address, then retry confirming.",
        code: "CUSTOMER_ADDRESS_REQUIRED",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // 3d. Order Items Required
    if (
      lowerMsg.includes("order_items_required") ||
      lowerMsg.includes("order item is required") ||
      lowerMsg.includes("at least one product item is required")
    ) {
      return {
        title: "Product Items Required",
        message: "Cannot advance order to Confirmed or beyond without at least one product item.",
        resolution: "Click 'Edit Order' to add product items to the order before confirming or dispatching.",
        code: "ORDER_ITEMS_REQUIRED",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // 3c. Order Status Backwards
    if (lowerMsg.includes("order_status_backwards") || lowerMsg.includes("->")) {
      return {
        title: "Invalid Status Progression",
        message: "Order workflow can only move forward along the fulfillment pipeline.",
        resolution: "Orders cannot move backwards (e.g. from Confirmed back to Pending). If you need to reprocess or cancel the order, mark it as Cancelled or create a replacement order.",
        code: "ORDER_STATUS_BACKWARDS",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // 3d. Order Finalized (Cancelled or Returned)
    if (lowerMsg.includes("order_final") || lowerMsg.includes("order is already")) {
      return {
        title: "Order Already Finalized",
        message: "This order has already been Cancelled or Returned and its status is locked.",
        resolution: "Finalized orders cannot be reopened or edited. Please create a new order instead.",
        code: "ORDER_FINAL",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // 3e. Order Not Cancellable
    if (lowerMsg.includes("order_not_cancellable")) {
      return {
        title: "Cannot Cancel Dispatched Order",
        message: "Orders that have already been shipped or delivered cannot be cancelled.",
        resolution: "If the customer returned the product, update the status to 'Returned' instead.",
        code: "ORDER_NOT_CANCELLABLE",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // 3f. Order Not Returnable
    if (lowerMsg.includes("order_not_returnable")) {
      return {
        title: "Cannot Return Undispatched Order",
        message: "Only orders that have been shipped or delivered can be marked as 'Returned'.",
        resolution: "If the order was not yet dispatched from warehouse, select 'Cancelled' instead.",
        code: "ORDER_NOT_RETURNABLE",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // 3g. Order Immutable Fields
    if (lowerMsg.includes("order_immutable")) {
      return {
        title: "Immutable Order Attributes",
        message: "Core order identity fields (order number, token, currency) cannot be modified.",
        resolution: "Ensure status updates only modify the workflow status, notes, or courier fields.",
        code: "ORDER_IMMUTABLE",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // 3h. Courier Partner Required
    if (lowerMsg.includes("courier_required") || lowerMsg.includes("courier partner assignment is required")) {
      return {
        title: "Courier Partner Required",
        message: "Orders advancing to Processing, Shipped, or Delivered must have a Courier Partner assigned.",
        resolution: "Assign a courier partner (such as Steadfast Courier or Pathao Courier) before advancing this order.",
        code: "COURIER_REQUIRED",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // 3i. Cancel Reason Required
    if (lowerMsg.includes("cancel_reason_required") || lowerMsg.includes("cancellation reason is required")) {
      return {
        title: "Cancellation Reason Required",
        message: "A cancellation reason of at least 3 characters is required to cancel an order.",
        resolution: "Provide a descriptive cancellation reason explaining why the order was cancelled.",
        code: "CANCEL_REASON_REQUIRED",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // 3j. Return Reason Required
    if (lowerMsg.includes("return_reason_required") || lowerMsg.includes("return reason is required")) {
      return {
        title: "Return Reason Required",
        message: "A return reason of at least 3 characters is required to mark an order as returned.",
        resolution: "Provide a return reason explaining why the package was returned.",
        code: "RETURN_REASON_REQUIRED",
        details: rawMessage,
        isRlsError: false,
        isWorkflowError: true,
        originalError: error,
      };
    }

    // Generic P0001
    return {
      title: "Order Workflow Validation Rejected",
      message: cleanDatabaseErrorMessage(rawMessage),
      resolution: "Verify that all required order information is filled out and that the status progression is valid.",
      code: "P0001",
      details: rawMessage,
      isRlsError: false,
      isWorkflowError: true,
      originalError: error,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. CHECK CONSTRAINT VIOLATION (Postgres 23514)
  // ───────────────────────────────────────────────────────────────────────────
  if (code === "23514" || lowerMsg.includes("check constraint")) {
    let msg = "A database check constraint was violated.";
    let res = "Check input field formats and try again.";

    if (lowerMsg.includes("orders_customer_name_check")) {
      msg = "Customer name must be between 1 and 120 characters.";
      res = "Edit the order to provide a valid customer name.";
    } else if (lowerMsg.includes("orders_customer_phone_check")) {
      msg = "Customer phone number must match international format (+88017xxxxxxxx).";
      res = "Edit the order and enter a valid Bangladesh mobile number.";
    } else if (lowerMsg.includes("orders_totals_consistent")) {
      msg = "Order grand total does not match item subtotals minus discounts plus shipping.";
      res = "Review order items and recalculate totals.";
    }

    return {
      title: "Data Validation Constraint Failed",
      message: msg,
      resolution: res,
      code: "23514",
      details: rawMessage,
      isRlsError: false,
      isWorkflowError: true,
      originalError: error,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. NOT-NULL CONSTRAINT (Postgres 23502)
  // ───────────────────────────────────────────────────────────────────────────
  if (code === "23502" || lowerMsg.includes("null value in column")) {
    const colMatch = rawMessage.match(/column "([^"]+)"/i);
    const colName = colMatch ? colMatch[1] : "a required field";
    return {
      title: "Missing Required Value",
      message: `Database column '${colName}' cannot be empty.`,
      resolution: `Ensure that '${colName}' is populated before saving.`,
      code: "23502",
      details: rawMessage,
      isRlsError: false,
      isWorkflowError: true,
      originalError: error,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. FOREIGN KEY CONSTRAINT (Postgres 23503)
  // ───────────────────────────────────────────────────────────────────────────
  if (code === "23503" || lowerMsg.includes("foreign key constraint")) {
    return {
      title: "Referenced Record Not Found",
      message: "The order references a product variant, user, or shipping method that does not exist.",
      resolution: "Check that the selected products and delivery options exist in the catalog.",
      code: "23503",
      details: rawMessage,
      isRlsError: false,
      isWorkflowError: false,
      originalError: error,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. NETWORK / CONNECTION / TIMEOUT ERRORS
  // ───────────────────────────────────────────────────────────────────────────
  if (
    lowerMsg.includes("fetch failed") ||
    lowerMsg.includes("network error") ||
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("failed to fetch")
  ) {
    return {
      title: "Network Connection Error",
      message: "Unable to connect to the Supabase database server.",
      resolution: "Please check your internet connection and verify that your Supabase service is active.",
      code: "NETWORK_ERROR",
      details: rawMessage,
      isRlsError: false,
      isWorkflowError: false,
      originalError: error,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8. DEFAULT FALLBACK
  // ───────────────────────────────────────────────────────────────────────────
  return {
    title: "Database Sync Error",
    message: cleanDatabaseErrorMessage(rawMessage),
    resolution: "Please inspect the error details, ensure the order record has valid fields, and retry.",
    code: code || undefined,
    details: details || rawMessage,
    hint: hint || undefined,
    isRlsError: false,
    isWorkflowError: false,
    originalError: error,
  };
}

/**
 * Strips technical Postgres prefixes like 'P0001: ', 'ERROR: ', etc.
 */
function cleanDatabaseErrorMessage(msg: string): string {
  if (!msg) return "An unexpected database error occurred.";
  let cleaned = msg.replace(/^error:\s*/i, "").replace(/^p[0-9]{4}:\s*/i, "");
  // If there is an internal prefix like "CUSTOMER_NAME_REQUIRED: ", format it nicely
  const colonIdx = cleaned.indexOf(":");
  if (colonIdx > 0 && colonIdx < 30 && cleaned.slice(0, colonIdx) === cleaned.slice(0, colonIdx).toUpperCase()) {
    cleaned = cleaned.slice(colonIdx + 1).trim();
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export const STATUS_WORKFLOW_FLOW = [
  "incomplete_order",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
] as const;

export interface TransitionValidationResult {
  valid: boolean;
  code?: string;
  reason?: string;
}

/**
 * Validates whether an order can transition from its current status to targetStatus,
 * checking state machine rules and required customer fields before hitting the database.
 */
export function validateOrderStatusTransition(
  currentStatus: string,
  targetStatus: string,
  customerName?: string | null,
  customerPhone?: string | null,
  customerAddress?: string | null,
  itemsCount?: number | null,
  courierName?: string | null,
  cancelReason?: string | null
): TransitionValidationResult {
  const normalizedCurrent = currentStatus === "partially_delivered" ? "delivered" : currentStatus;
  const normalizedTarget = targetStatus === "partially_delivered" ? "delivered" : targetStatus;

  // 1. Same status is a no-op / valid
  if (normalizedCurrent === normalizedTarget) {
    return { valid: true };
  }

  // 2. Already final
  if (normalizedCurrent === "cancelled" || normalizedCurrent === "returned") {
    return {
      valid: false,
      code: "ORDER_FINAL",
      reason: `Order is already ${normalizedCurrent.replace(/_/g, " ")} and cannot be modified.`,
    };
  }

  // 3. Cancelled validation
  if (normalizedTarget === "cancelled") {
    if (normalizedCurrent === "shipped" || normalizedCurrent === "delivered") {
      return {
        valid: false,
        code: "ORDER_NOT_CANCELLABLE",
        reason: `Orders already ${normalizedCurrent} cannot be cancelled. Use 'Returned' if the product was returned.`,
      };
    }
    if (cancelReason !== undefined && cancelReason !== null) {
      const trimmedReason = cancelReason.trim();
      if (trimmedReason.length < 3) {
        return {
          valid: false,
          code: "CANCEL_REASON_REQUIRED",
          reason: "Cancellation reason is required (minimum 3 characters).",
        };
      }
    }
    return { valid: true };
  }

  // 4. Returned validation
  if (normalizedTarget === "returned") {
    if (normalizedCurrent !== "shipped" && normalizedCurrent !== "delivered") {
      return {
        valid: false,
        code: "ORDER_NOT_RETURNABLE",
        reason: `Only dispatched orders (shipped or delivered) can be marked as returned. Current status is ${normalizedCurrent}.`,
      };
    }
    if (cancelReason !== undefined && cancelReason !== null) {
      const trimmedReason = cancelReason.trim();
      if (trimmedReason.length < 3) {
        return {
          valid: false,
          code: "RETURN_REASON_REQUIRED",
          reason: "Return reason is required (minimum 3 characters).",
        };
      }
    }
    return { valid: true };
  }

  // 5. Flow check
  const currPos = STATUS_WORKFLOW_FLOW.indexOf(normalizedCurrent as any);
  const targetPos = STATUS_WORKFLOW_FLOW.indexOf(normalizedTarget as any);

  if (currPos !== -1 && targetPos !== -1 && targetPos <= currPos) {
    return {
      valid: false,
      code: "ORDER_STATUS_BACKWARDS",
      reason: `Cannot move status backward from ${normalizedCurrent.replace(/_/g, " ")} to ${normalizedTarget.replace(/_/g, " ")}.`,
    };
  }

  // 6. Customer details and items required for confirmed or higher
  const confirmedPos = STATUS_WORKFLOW_FLOW.indexOf("confirmed");
  if (targetPos >= confirmedPos) {
    // 6a. At least one line item required (strictly enforce: must be defined, not null, and >= 1)
    if (itemsCount === undefined || itemsCount === null || itemsCount < 1) {
      return {
        valid: false,
        code: "ORDER_ITEMS_REQUIRED",
        reason: "At least one product item is required before confirming or advancing order.",
      };
    }

    // 6b. Customer name required (minimum 2 characters)
    const trimmedName = (customerName || "").trim();
    if (trimmedName.length < 2) {
      return {
        valid: false,
        code: "CUSTOMER_NAME_REQUIRED",
        reason: "Customer name is required before confirming order (minimum 2 characters).",
      };
    }

    // 6c. Valid customer phone required
    const trimmedPhone = (customerPhone || "").trim();
    const cleanedPhone = trimmedPhone.replace(/[\s\-\(\)]/g, "");
    if (!cleanedPhone || (!cleanedPhone.startsWith("+") && cleanedPhone.length < 10) || cleanedPhone.length > 16) {
      return {
        valid: false,
        code: "CUSTOMER_PHONE_REQUIRED",
        reason: "Valid customer mobile number is required before confirming order.",
      };
    }

    // 6d. Street delivery address required (strictly enforce: must be defined and at least 3 characters)
    const trimmedAddress = (customerAddress || "").trim();
    if (trimmedAddress.length < 3) {
      return {
        valid: false,
        code: "CUSTOMER_ADDRESS_REQUIRED",
        reason: "Street delivery address is required before confirming order (minimum 3 characters).",
      };
    }
  }

  // 7. Courier partner required for processing, shipped, and delivered
  const processingPos = STATUS_WORKFLOW_FLOW.indexOf("processing");
  if (targetPos >= processingPos) {
    const trimmedCourier = (courierName || "").trim();
    if (trimmedCourier.length < 2) {
      return {
        valid: false,
        code: "COURIER_REQUIRED",
        reason: `Courier partner assignment is required before moving order to ${normalizedTarget.replace(/_/g, " ")}.`,
      };
    }
  }

  return { valid: true };
}
