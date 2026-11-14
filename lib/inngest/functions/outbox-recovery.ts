import { inngest } from "@/lib/inngest/client";
import { processPendingOutboxEvents } from "@/lib/outbox";

/**
 * Scheduled cron job that sweeps the transactional outbox every 6 hours.
 * Guarantees delivery even if Inngest or network was temporarily offline during order creation.
 */
export const outboxRecoveryCronFunction = inngest.createFunction(
  {
    id: "outbox-recovery-cron",
    name: "Transactional Outbox Recovery Sweeper",
    retries: 2,
    triggers: [{ cron: "0 */6 * * *" }],
  },
  async ({ step }) => {
    return await step.run("recover-pending-outbox-events", async () => {
      const stats = await processPendingOutboxEvents(50);
      return {
        timestamp: new Date().toISOString(),
        ...stats,
      };
    });
  }
);

/**
 * Manual/event-driven outbox sweep function.
 */
export const outboxSweepEventFunction = inngest.createFunction(
  {
    id: "outbox-sweep-event",
    name: "Transactional Outbox Event Sweeper",
    retries: 2,
    triggers: [{ event: "outbox.sweep" }],
  },
  async ({ event, step }) => {
    const batchSize = event.data?.batchSize || 50;
    return await step.run("process-outbox-batch", async () => {
      return await processPendingOutboxEvents(batchSize);
    });
  }
);
