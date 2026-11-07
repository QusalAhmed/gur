export interface FriendlyError {
  code: string;
  title: string;
  message: string;
  messageBn: string;
}

const ERROR_MAPPINGS: Record<string, { title: string; message: string; messageBn: string }> = {
  FORBIDDEN: {
    title: "Access Denied",
    message: "You do not have the required permissions to perform this action.",
    messageBn: "আপনার এই কাজটি করার প্রয়োজনীয় অনুমতি নেই।",
  },
  ORDER_STATUS_BACKWARDS: {
    title: "Invalid Status Transition",
    message: "An order cannot move backwards in its lifecycle.",
    messageBn: "অর্ডারের স্ট্যাটাস পেছনের ধাপে ফিরিয়ে নেওয়া যায় না।",
  },
  ORDER_FINAL: {
    title: "Order Closed",
    message: "This order is cancelled or returned and cannot be modified further.",
    messageBn: "এই অর্ডারটি বাতিল বা ফেরত করা হয়েছে এবং আর পরিবর্তন করা সম্ভব নয়।",
  },
  ORDER_NOT_CANCELLABLE: {
    title: "Cannot Cancel Order",
    message: "Orders that have already been shipped or delivered cannot be cancelled.",
    messageBn: "যেসব অর্ডার ইতোমধ্যে শিপ বা ডেলিভারি করা হয়েছে তা বাতিল করা যাবে না।",
  },
  ORDER_NOT_RETURNABLE: {
    title: "Cannot Return Order",
    message: "Only shipped or delivered orders can be marked as returned.",
    messageBn: "কেবল শিপড বা ডেলিভারড অর্ডারই ফেরত হিসেবে গ্রহণ করা যায়।",
  },
  ORDER_ITEMS_REQUIRED: {
    title: "Items Missing",
    message: "At least one product item is required before confirming the order.",
    messageBn: "অর্ডার নিশ্চিত করার আগে অন্তত একটি পণ্য যোগ করতে হবে।",
  },
  CUSTOMER_NAME_REQUIRED: {
    title: "Customer Name Missing",
    message: "A recipient customer name is required.",
    messageBn: "গ্রাহকের নাম উল্লেখ করা আবশ্যক।",
  },
  CUSTOMER_PHONE_REQUIRED: {
    title: "Valid Phone Required",
    message: "A valid Bangladeshi mobile phone number (01XXXXXXXXX) is required.",
    messageBn: "একটি সঠিক বাংলাদেশী মোবাইল নম্বর (০১XXXXXXXXX) আবশ্যক।",
  },
  ORDER_HAS_SHIPMENTS: {
    title: "Items Locked",
    message: "Order items cannot be edited because shipments have already been recorded.",
    messageBn: "অর্ডারের পণ্য পরিবর্তন করা যাবে না কারণ ইতোমধ্যে শিপমেন্ট সম্পন্ন হয়েছে।",
  },
  ORDER_HAS_PAYMENTS: {
    title: "Items Locked",
    message: "Order items cannot be edited because a payment has already been recorded.",
    messageBn: "অর্ডারের পণ্য পরিবর্তন করা যাবে না কারণ ইতোমধ্যে পেমেন্ট গ্রহণ করা হয়েছে।",
  },
  BATCH_NOT_RELEASED: {
    title: "Lot Not Released",
    message: "The chosen lot is in quarantine or blocked. Only released lots can be shipped.",
    messageBn: "নির্বাচিত লটটি কোয়ারেন্টাইনে বা অবরুদ্ধ। কেবল রিলিজড লট শিপ করা সম্ভব।",
  },
  BATCH_EXPIRED: {
    title: "Lot Expired",
    message: "The chosen lot has passed its best before date and cannot be sold.",
    messageBn: "নির্বাচিত লটটির মেয়াদ উত্তীর্ণ হয়েছে এবং এটি শিপ করা যাবে না।",
  },
  BATCH_PRODUCT_MISMATCH: {
    title: "Product Mismatch",
    message: "The selected lot belongs to a different product than this order line.",
    messageBn: "নির্বাচিত লটটি ভিন্ন পণ্যের এবং এই অর্ডারের সাথে মেলে না।",
  },
  SHIPMENT_EXCEEDS_ORDER: {
    title: "Quantity Exceeded",
    message: "The shipment quantity exceeds the remaining unshipped quantity.",
    messageBn: "শিপমেন্টের পরিমাণ অবশিষ্ট না-পাঠানো পরিমাণের চেয়ে বেশি।",
  },
  INSUFFICIENT_STOCK: {
    title: "Insufficient Stock",
    message: "There is not enough inventory available in the chosen warehouse.",
    messageBn: "নির্বাচিত গুদামে পর্যাপ্ত স্টক অবশিষ্ট নেই।",
  },
  OUT_OF_STOCK: {
    title: "Out of Stock",
    message: "One or more items are out of stock.",
    messageBn: "এক বা একাধিক পণ্যের স্টক শেষ হয়ে গেছে।",
  },
  CREDIT_LIMIT_EXCEEDED: {
    title: "Credit Limit Exceeded",
    message: "This order exceeds the business account's approved credit limit.",
    messageBn: "এই অর্ডারটি উক্ত বিজনেস অ্যাকাউন্টের ক্রেডিট সীমা অতিক্রম করেছে।",
  },
  BUSINESS_NOT_ALLOWED: {
    title: "Business Account Not Approved",
    message: "The business account must be approved before placing orders on credit terms.",
    messageBn: "বাকিতে অর্ডার দেওয়ার আগে বিজনেস অ্যাকাউন্ট অনুমোদিত হতে হবে।",
  },
  COUPON_INVALID: {
    title: "Invalid Coupon",
    message: "The coupon code is invalid, expired, or has reached its usage limit.",
    messageBn: "কুপন কোডটি অবৈধ, মেয়াদোত্তীর্ণ অথবা ব্যবহারের সর্বোচ্চ সীমায় পৌঁছে গেছে।",
  },
  NO_WAREHOUSE: {
    title: "Warehouse Required",
    message: "Please choose an active warehouse for stock allocation.",
    messageBn: "স্টক বরাদ্দের জন্য একটি সক্রিয় গুদাম নির্বাচন করুন।",
  },
  ADDRESS_REQUIRED: {
    title: "Address Required",
    message: "Please specify the recipient district and delivery address.",
    messageBn: "অনুগ্রহ করে প্রাপকের জেলা ও সম্পূর্ণ ঠিকানা প্রদান করুন।",
  },
};

/**
 * Extracts the database error code from a Postgres or PostgREST error object/string.
 */
export function mapDatabaseError(error: unknown, lang: "en" | "bn" = "en"): FriendlyError {
  let message = "";
  let code = "UNKNOWN_ERROR";

  if (typeof error === "string") {
    message = error;
  } else if (error && typeof error === "object") {
    const err = error as { message?: string; details?: string; hint?: string; code?: string };
    message = err.message || err.details || err.hint || String(error);
    if (err.code) code = err.code;
  }

  // Look for known codes inside message (e.g. "ERROR: BATCH_NOT_RELEASED: ...")
  for (const knownCode of Object.keys(ERROR_MAPPINGS)) {
    if (message.includes(knownCode)) {
      const mapping = ERROR_MAPPINGS[knownCode];
      return {
        code: knownCode,
        title: mapping.title,
        message: mapping.message,
        messageBn: mapping.messageBn,
      };
    }
  }

  // Clean raw message if generic
  const cleanMsg = message.replace(/^error:\s*/i, "").replace(/\[.*?\]\s*/g, "");

  return {
    code,
    title: lang === "bn" ? "সমস্যা হয়েছে" : "Action Failed",
    message: cleanMsg || "An unexpected error occurred. Please try again.",
    messageBn: "একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
  };
}
