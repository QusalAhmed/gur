import * as React from "react";
import { Metadata } from "next";
import { connection } from "next/server";
import { assertStaffRole } from "@/lib/admin-guard";
import { getOutboxNotificationsAction } from "@/actions/outbox-ops";
import { OutboxView } from "@/components/admin/outbox/outbox-view";
import AdminLoading from "../../loading";

export const metadata: Metadata = {
  title: "Notification Outbox | Admin Dashboard",
  description: "Monitor SMS, email, and webhook events with automated retry.",
};

export const instant = false;

async function AdminOutboxContent() {
  await connection();
  await assertStaffRole(["owner", "admin"]);

  const res = await getOutboxNotificationsAction({ limit: 100 });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <OutboxView initialNotifications={res.data || []} />
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
