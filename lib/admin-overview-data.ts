import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toZonedTime, format as formatZoned } from "date-fns-tz";
import { subDays, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { DHAKA_TIMEZONE } from "@/lib/admin-format";

export interface KpiStats {
  orders_count: number;
  revenue: number;
  average_order: number;
  amount_collected: number;
  new_customers: number;
  checkouts_started: number;
  conversion_rate: number;
  low_stock_count: number;
}

export interface KpiCardData {
  title: string;
  titleBn: string;
  value: string;
  deltaPercent: number;
  deltaLabel: string;
  isPositiveGood?: boolean;
}

export interface NeedsAttentionItem {
  id: string;
  title: string;
  titleBn: string;
  count: number;
  href: string;
  severity: "urgent" | "warning" | "info";
  description: string;
}

export async function getAdminOverviewData(fromParam?: string, toParam?: string) {
  let supabase = supabaseAdmin;
  try {
    const supabaseUserClient = await createClient();
    const {
      data: { user },
    } = await supabaseUserClient.auth.getUser();

    // If user has active Supabase Auth session, use it (RLS applies).
    // Otherwise, use supabaseAdmin (service_role) so standalone admin or root admin sessions load metrics.
    if (user) {
      supabase = supabaseUserClient;
    }
  } catch {
    supabase = supabaseAdmin;
  }

  // 1. Calculate time windows anchored to Asia/Dhaka
  const nowInDhaka = toZonedTime(new Date(), DHAKA_TIMEZONE);

  let fromDate: Date;
  let toDate: Date;

  if (fromParam && toParam) {
    fromDate = startOfDay(new Date(fromParam));
    toDate = endOfDay(new Date(toParam));
  } else {
    // Default last 30 days
    fromDate = startOfDay(subDays(nowInDhaka, 29));
    toDate = endOfDay(nowInDhaka);
  }

  const durationDays = Math.max(1, differenceInDays(toDate, fromDate) + 1);
  const prevToDate = subDays(fromDate, 1);
  const prevFromDate = subDays(prevToDate, durationDays - 1);

  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();
  const prevFromIso = prevFromDate.toISOString();
  const prevToIso = prevToDate.toISOString();

  const bucket = durationDays > 45 ? "week" : "day";

  // Two hours ago ISO for pending order alerts
  const twoHoursAgoIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // 2. Fetch all overview data in parallel via RPC and PostgREST
  const [
    kpiCurrentRes,
    kpiPrevRes,
    seriesRes,
    topProductsRes,
    statusBreakdownRes,
    sourceBreakdownRes,
    pendingOldRes,
    unreconciledPaymentsRes,
    quarantinedLotsRes,
    newQuotesRes,
    pendingReviewsRes,
    recentOrdersRes,
  ] = await Promise.all([
    supabase.rpc("admin_kpis", { p_from: fromIso, p_to: toIso }),
    supabase.rpc("admin_kpis", { p_from: prevFromIso, p_to: prevToIso }),
    supabase.rpc("admin_sales_series", { p_from: fromIso, p_to: toIso, p_bucket: bucket }),
    supabase.rpc("admin_top_products", { p_from: fromIso, p_to: toIso, p_limit: 5 }),
    supabase.rpc("admin_sales_breakdown", { p_from: fromIso, p_to: toIso, p_dimension: "status" }),
    supabase.rpc("admin_sales_breakdown", { p_from: fromIso, p_to: toIso, p_dimension: "utm_source" }),
    // Needs attention queries (cheap head/limited)
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("created_at", twoHoursAgoIso),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed", "pending"]),
    supabase
      .from("batches")
      .select("id", { count: "exact", head: true })
      .eq("status", "quarantine"),
    supabase
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("product_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    // Recent 10 orders with line item summary
    supabase
      .from("orders")
      .select("id, order_number, created_at, customer_name, customer_phone, grand_total, status, payment_status, fulfillment_status, channel, order_items(id, product_name, quantity, unit_price)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  let currentKpisData = kpiCurrentRes.data as any;
  let prevKpisData = kpiPrevRes.data as any;
  let seriesData = seriesRes.data || [];
  let topProductsData = topProductsRes.data || [];
  let statusBreakdownData = statusBreakdownRes.data || [];
  let sourceBreakdownData = sourceBreakdownRes.data || [];
  let recentOrdersData = recentOrdersRes.data || [];

  // Fallback to supabaseAdmin if the user client received null/forbidden due to session state
  if ((!currentKpisData || currentKpisData.orders_count === undefined) && supabase !== supabaseAdmin) {
    const [fbKpiCurr, fbKpiPrev, fbSeries, fbTop, fbStatus, fbSource, fbRecent] = await Promise.all([
      supabaseAdmin.rpc("admin_kpis", { p_from: fromIso, p_to: toIso }),
      supabaseAdmin.rpc("admin_kpis", { p_from: prevFromIso, p_to: prevToIso }),
      supabaseAdmin.rpc("admin_sales_series", { p_from: fromIso, p_to: toIso, p_bucket: bucket }),
      supabaseAdmin.rpc("admin_top_products", { p_from: fromIso, p_to: toIso, p_limit: 5 }),
      supabaseAdmin.rpc("admin_sales_breakdown", { p_from: fromIso, p_to: toIso, p_dimension: "status" }),
      supabaseAdmin.rpc("admin_sales_breakdown", { p_from: fromIso, p_to: toIso, p_dimension: "utm_source" }),
      supabaseAdmin
        .from("orders")
        .select("id, order_number, created_at, customer_name, customer_phone, grand_total, status, payment_status, fulfillment_status, channel, order_items(id, product_name, quantity, unit_price)")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (fbKpiCurr.data) currentKpisData = fbKpiCurr.data as any;
    if (fbKpiPrev.data) prevKpisData = fbKpiPrev.data as any;
    if (fbSeries.data && fbSeries.data.length > 0) seriesData = fbSeries.data;
    if (fbTop.data && fbTop.data.length > 0) topProductsData = fbTop.data;
    if (fbStatus.data && fbStatus.data.length > 0) statusBreakdownData = fbStatus.data;
    if (fbSource.data && fbSource.data.length > 0) sourceBreakdownData = fbSource.data;
    if (fbRecent.data && fbRecent.data.length > 0) recentOrdersData = fbRecent.data;
  }

  const currentKpis: KpiStats = currentKpisData || {
    orders_count: 0,
    revenue: 0,
    average_order: 0,
    amount_collected: 0,
    new_customers: 0,
    checkouts_started: 0,
    conversion_rate: 0,
    low_stock_count: 0,
  };

  const prevKpis: KpiStats = prevKpisData || {
    orders_count: 0,
    revenue: 0,
    average_order: 0,
    amount_collected: 0,
    new_customers: 0,
    checkouts_started: 0,
    conversion_rate: 0,
    low_stock_count: 0,
  };

  const calcDelta = (curr: number, prev: number) => {
    if (!prev || prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
  };

  const deltas = {
    orders: calcDelta(currentKpis.orders_count, prevKpis.orders_count),
    revenue: calcDelta(currentKpis.revenue, prevKpis.revenue),
    average_order: calcDelta(currentKpis.average_order, prevKpis.average_order),
    collected: calcDelta(currentKpis.amount_collected, prevKpis.amount_collected),
    checkouts: calcDelta(currentKpis.checkouts_started, prevKpis.checkouts_started),
    conversion: Math.round((currentKpis.conversion_rate - prevKpis.conversion_rate) * 10) / 10,
  };

  // Build Needs Attention Strip
  const needsAttention: NeedsAttentionItem[] = [];

  if ((pendingOldRes.count || 0) > 0) {
    needsAttention.push({
      id: "pending_old",
      title: "Pending Orders (> 2h)",
      titleBn: "২ ঘণ্টার বেশি পেন্ডিং অর্ডার",
      count: pendingOldRes.count || 0,
      href: "/admin/orders?status=pending",
      severity: "urgent",
      description: "Customer waiting for confirmation call or verification",
    });
  }

  if ((unreconciledPaymentsRes.count || 0) > 0) {
    needsAttention.push({
      id: "payments_unreconciled",
      title: "Failed / Pending Payments",
      titleBn: "পেন্ডিং বা ফেইল্ড পেমেন্ট",
      count: unreconciledPaymentsRes.count || 0,
      href: "/admin/payments",
      severity: "urgent",
      description: "Requires gateway reconciliation or customer follow-up",
    });
  }

  if ((quarantinedLotsRes.count || 0) > 0) {
    needsAttention.push({
      id: "quarantined_lots",
      title: "Quarantined Lots",
      titleBn: "কোয়ারেন্টাইন লট",
      count: quarantinedLotsRes.count || 0,
      href: "/admin/batches?status=quarantine",
      severity: "warning",
      description: "Batches awaiting lab approval (Brix / pH / Ash)",
    });
  }

  if ((newQuotesRes.count || 0) > 0) {
    needsAttention.push({
      id: "new_quotes",
      title: "New RFQ Quotes",
      titleBn: "নতুন কোটেশন আবেদন",
      count: newQuotesRes.count || 0,
      href: "/admin/quotes?status=new",
      severity: "info",
      description: "Wholesale bulk price inquiries waiting for reply",
    });
  }

  if ((pendingReviewsRes.count || 0) > 0) {
    needsAttention.push({
      id: "pending_reviews",
      title: "Reviews Pending Moderation",
      titleBn: "অনুমোদনের অপেক্ষায় রিভিউ",
      count: pendingReviewsRes.count || 0,
      href: "/admin/reviews?status=pending",
      severity: "info",
      description: "Customer feedback waiting to be published",
    });
  }

  return {
    kpis: currentKpis,
    prevKpis,
    deltas,
    salesSeries: seriesData,
    topProducts: topProductsData,
    statusBreakdown: statusBreakdownData,
    sourceBreakdown: sourceBreakdownData,
    needsAttention,
    recentOrders: recentOrdersData,
    period: {
      from: fromParam || formatZoned(fromDate, "yyyy-MM-dd", { timeZone: DHAKA_TIMEZONE }),
      to: toParam || formatZoned(toDate, "yyyy-MM-dd", { timeZone: DHAKA_TIMEZONE }),
      days: durationDays,
    },
  };
}
