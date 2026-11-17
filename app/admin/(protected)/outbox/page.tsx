import * as React from "react";
import { Metadata } from "next";
import { connection } from "next/server";
import { assertStaffRole } from "@/lib/admin-guard";
import { getOutboxNotificationsAction } from "@/actions/outbox-ops";
import {
  getOutboxEventsAction,
  getOutboxMetricsAction,
} from "@/actions/outbox";
import { OutboxView } from "@/components/admin/outbox/outbox-view";
import AdminLoading from "../../loading";

export const metadata: Metadata = {
  title: "Transactional Outbox | Admin Dashboard",
  description:
    "Monitor reliable event-driven SMS, email, Meta CAPI, push, and webhook deliveries with automated retry.",
};

export const instant = false;

async function AdminOutboxContent() {
  await connection();
  await assertStaffRole(["owner", "admin"]);

  const [eventsRes, metricsRes, notificationsRes] = await Promise.all([
    getOutboxEventsAction({ limit: 100 }),
    getOutboxMetricsAction(),
    getOutboxNotificationsAction({ limit: 100 }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-1 py-2 sm:px-4 sm:py-4">
      <OutboxView
        initialEvents={eventsRes.events || []}
        initialMetrics={metricsRes.metrics}
        initialNotifications={notificationsRes.data || []}
      />
    </div>
  );
}

export default function AdminOutboxPage() {
  return (
    <React.Suspense fallback={<AdminLoading />}>
      <AdminOutboxContent />
    </React.Suspense>
  );
}
