import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { orderCreatedFunction } from "@/lib/inngest/functions/order-created";
import { orderStatusUpdatedFunction } from "@/lib/inngest/functions/order-status";
import { orderIncompleteFunction } from "@/lib/inngest/functions/order-incomplete";
import {
  notificationEmailFunction,
  notificationSmsFunction,
  metaCapiPurchaseFunction,
} from "@/lib/inngest/functions/notification-direct";
import {
  outboxRecoveryCronFunction,
  outboxSweepEventFunction,
} from "@/lib/inngest/functions/outbox-recovery";
import { demoPackagingFunction } from "@/lib/inngest/functions/demo-packaging";
import { metaCapiBatchDispatcherFunction } from "@/lib/inngest/functions/meta-capi-batch";
import { draftOrderDebouncedAutoSaveFunction } from "@/lib/inngest/functions/draft-order";
import { steadfastBulkBookingFunction } from "@/lib/inngest/functions/steadfast-bulk";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    orderCreatedFunction,
    orderStatusUpdatedFunction,
    orderIncompleteFunction,
    notificationEmailFunction,
    notificationSmsFunction,
    metaCapiPurchaseFunction,
    outboxRecoveryCronFunction,
    outboxSweepEventFunction,
    demoPackagingFunction,
    metaCapiBatchDispatcherFunction,
    draftOrderDebouncedAutoSaveFunction,
    steadfastBulkBookingFunction,
  ],
});
