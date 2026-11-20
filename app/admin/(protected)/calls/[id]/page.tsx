import * as React from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireStaffMember } from "@/lib/admin-guard";
import { CallListView } from "@/components/admin/calls/call-list-view";
import { isValidUuid } from "@/lib/security";
import CallsLoading from "../loading";

interface CallListPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Opt-out of instant navigation validation for dynamic call list detail data
export const instant = false;

async function CallListDetailLoader({ params }: CallListPageProps) {
  await connection();
  const { id } = await params;
  await requireStaffMember(`/admin/calls/${id}`);

  if (!isValidUuid(id)) {
    notFound();
  }

  return (
    <div className="w-full">
      <CallListView listId={id} />
    </div>
  );
}

export default function CallListDetailPage({ params }: CallListPageProps) {
  return (
    <React.Suspense fallback={<CallsLoading />}>
      <CallListDetailLoader params={params} />
    </React.Suspense>
  );
}
