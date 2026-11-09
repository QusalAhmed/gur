import { Suspense } from "react";
import { requireStaffMember } from "@/lib/admin-guard";
import { getAdminOverviewData } from "@/lib/admin-overview-data";
import { KpiCards } from "@/components/admin/overview/kpi-cards";
import { SalesAreaChart } from "@/components/admin/overview/sales-area-chart";
import { OrdersDonutChart } from "@/components/admin/overview/orders-donut-chart";
import { NeedsAttentionStrip } from "@/components/admin/overview/needs-attention-strip";
import { TopProductsCard } from "@/components/admin/overview/top-products-card";
import { SourcesCampaignsCard } from "@/components/admin/overview/sources-campaigns-card";
import { RecentOrdersCard } from "@/components/admin/overview/recent-orders-card";
import { DateRangePicker } from "@/components/admin/date-range-picker";

export const metadata = {
  title: "Admin Overview · খাঁটি গুড়",
  description: "Operations dashboard for molasses sales, inventory, and fulfillment",
};

export const instant = false;

interface AdminPageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
}

export default async function AdminOverviewPage({ searchParams }: AdminPageProps) {
  // Server-side role guard: ensures authenticated staff member
  const session = await requireStaffMember("/admin");

  const resolvedParams = await searchParams;
  const overviewData = await getAdminOverviewData(resolvedParams.from, resolvedParams.to);

  return (
    <div className="space-y-5 py-4 max-w-7xl mx-auto pb-12">
      {/* Top Welcome & Date Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {session.user.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operations summary for {overviewData.period.from} to {overviewData.period.to} ({overviewData.period.days} days, Asia/Dhaka)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker />
        </div>
      </div>

      {/* Needs Attention Strip */}
      <NeedsAttentionStrip items={overviewData.needsAttention} />

      {/* KPI Stats Cards */}
      <KpiCards kpis={overviewData.kpis} deltas={overviewData.deltas} />

      {/* Primary Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SalesAreaChart series={overviewData.salesSeries} />
        </div>
        <div>
          <OrdersDonutChart data={overviewData.statusBreakdown} />
        </div>
      </div>

      {/* Secondary Metrics: Top Products & Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopProductsCard products={overviewData.topProducts} />
        <SourcesCampaignsCard sources={overviewData.sourceBreakdown} />
      </div>

      {/* Recent Orders Stream */}
      <RecentOrdersCard orders={overviewData.recentOrders as any} />
    </div>
  );
}
