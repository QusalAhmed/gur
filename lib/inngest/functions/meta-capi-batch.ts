import { inngest } from "@/lib/inngest/client";
import { sendCapiEvents, type CapiEventParams } from "@/lib/facebook-capi";
import type { MetaCapiEventData } from "@/lib/inngest/events";

export const metaCapiBatchDispatcherFunction = inngest.createFunction(
  {
    id: "meta-capi-batch-dispatcher",
    name: "Meta CAPI: High-Throughput Event Batcher",
    retries: 3,
    triggers: [{ event: "meta.capi.event" }],
    batchEvents: {
      maxSize: 5,
      timeout: "5s",
    },
    throttle: {
      limit: 10,
      period: "1s",
    },
  },
  async ({ events, step }) => {
    return await step.run("dispatch-batch-to-meta", async () => {
      const capiEventList: CapiEventParams[] = events
        .map((ev) => (ev.data as MetaCapiEventData)?.event)
        .filter(Boolean);

      if (capiEventList.length === 0) {
        return { success: true, processedCount: 0 };
      }

      const result = await sendCapiEvents(capiEventList);

      return {
        success: result.success,
        processedCount: capiEventList.length,
        metaResponse: result.data,
        error: result.error,
      };
    });
  }
);
