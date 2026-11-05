"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface QuoteRequestItem {
  id: string;
  referenceNo: string;
  company: string;
  contact: string;
  phone: string;
  email?: string;
  product: string;
  quantity: string;
  targetPrice: string;
  destination: string;
  requiredBy: string;
  status: "new" | "quoted" | "converted" | "declined";
  quotedPrice: string;
  quotedPriceNumeric: number;
  quoteReply?: string;
  createdAt: string;
}

export async function getAdminQuotesAction(): Promise<{
  success: boolean;
  data: QuoteRequestItem[];
  error?: string;
}> {
  try {
    const { data: rawQuotes, error } = await supabaseAdmin
      .from("quote_requests")
      .select(
        `
        id,
        reference_no,
        company_name,
        contact_name,
        phone,
        email,
        items,
        delivery_address,
        required_by,
        message,
        status,
        quoted_total,
        quote_reply,
        created_at
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const quotes: QuoteRequestItem[] = (rawQuotes || []).map((q) => {
      // Parse items array to get product and quantity
      let productName = "General Molasses Bulk";
      let quantityStr = "Custom Volume";

      if (Array.isArray(q.items) && q.items.length > 0) {
        const first = q.items[0];
        if (first.product_name) productName = first.product_name;
        if (first.quantity) quantityStr = `${first.quantity} ${first.unit || "Tons"}`;
      } else if (q.message) {
        productName = q.message.slice(0, 50);
      }

      const quotedNum = Number(q.quoted_total || 0);

      return {
        id: q.id,
        referenceNo: q.reference_no || `RFQ-${q.id.slice(0, 8)}`,
        company: q.company_name || "Commercial Buyer",
        contact: q.contact_name,
        phone: q.phone,
        email: q.email || undefined,
        product: productName,
        quantity: quantityStr,
        targetPrice: "Market Inquire",
        destination: q.delivery_address || "Dhaka Hub",
        requiredBy: q.required_by || "Flexible",
        status: (q.status as any) || "new",
        quotedPrice: quotedNum > 0 ? `৳ ${quotedNum.toLocaleString("en-BD")}` : "Pending Quote",
        quotedPriceNumeric: quotedNum,
        quoteReply: q.quote_reply || undefined,
        createdAt: q.created_at,
      };
    });

    return {
      success: true,
      data: quotes,
    };
  } catch (error: any) {
    console.error("getAdminQuotesAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to load quote requests",
      data: [],
    };
  }
}

export async function submitQuoteReplyAction(payload: {
  id: string;
  quotedTotal: number;
  replyMessage: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("quote_requests")
      .update({
        quoted_total: payload.quotedTotal,
        quote_reply: payload.replyMessage.trim(),
        status: "quoted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit quote reply" };
  }
}

export async function updateQuoteStatusAction(payload: {
  id: string;
  status: "new" | "quoted" | "converted" | "declined";
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("quote_requests")
      .update({
        status: payload.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update quote status" };
  }
}

export async function deleteQuoteRequestAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("quote_requests").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete quote request" };
  }
}

