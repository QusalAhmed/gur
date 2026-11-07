import * as React from "react";
import { Metadata } from "next";
import { assertStaffRole } from "@/lib/admin-guard";
import { getOutboxNotificationsAction } from "@/actions/outbox-ops";
import { OutboxView } from "@/components/admin/outbox/outbox-view";

export const metadata: Metadata = {
  title: "Notification Outbox | Admin Dashboard",
  description: "Monitor SMS, email, and webhook events with automated retry.",
};

export const instant = false;

export default async function AdminOutboxPage() {
  await assertStaffRole(["owner", "admin"]);

  const res = await getOutboxNotificationsAction({ limit: 100 });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <OutboxView initialNotifications={res.data || []} />
    </div>
  );
}
