import { NonRetriableError } from "inngest";
import { inngest } from "@/lib/inngest/client";
import { sendCapiEvents, type CapiEventParams } from "@/lib/facebook-capi";
import type { MetaCapiEventData } from "@/lib/inngest/events";

function isNonRetriableMetaFailure(result: {
  status?: number;
  data?: any;
  error?: string;
}): boolean {
  if (result.error === "FACEBOOK_CAPI_ACCESS_TOKEN is not configured") {
    return true;
  }

  if (result.data?.error?.is_transient === true) {
    return false;
  }

  // Retry network failures (no HTTP status), 429 rate limits, and 5xx server errors
  if (
    typeof result.status === "number" &&
    result.status >= 400 &&
    result.status < 500 &&
    result.status !== 429
  ) {
    return true;
  }

  return false;
}

export async function dispatchMetaCapiBatch(
  events: Array<{ data?: unknown }>
): Promise<{
  success: true;
  processedCount: number;
  metaResponse?: any;
}> {
  const groups = new Map<string, CapiEventParams[]>();

  for (const ev of events) {
    const payload = ev.data as MetaCapiEventData | undefined;
    if (!payload?.event) continue;

    const code = payload.testEventCode?.trim() || "";
    const list = groups.get(code) || [];
    list.push(payload.event);
    groups.set(code, list);
  }

  if (groups.size === 0) {
    return { success: true, processedCount: 0 };
  }

  let processedCount = 0;
  const responses: any[] = [];

  for (const [testEventCode, capiEventList] of groups.entries()) {
    const result = await sendCapiEvents(
      capiEventList,
      testEventCode ? { testEventCode } : undefined
    );

    if (!result.success) {
      const errorMessage = result.error || "Meta CAPI batch dispatch failed";
      if (isNonRetriableMetaFailure(result)) {
        throw new NonRetriableError(errorMessage);
      }
      throw new Error(errorMessage);
    }

    processedCount += capiEventList.length;
    responses.push(result.data);
  }

  return {
    success: true,
    processedCount,
    metaResponse: responses.length === 1 ? responses[0] : responses,
  };
}

export const metaCapiBatchDispatcherFunction = inngest.createFunction(
  {
    id: "meta-capi-batch-dispatcher",
    name: "Meta CAPI: High-Throughput Event Batcher",
    retries: 3,
    triggers: [{ event: "meta.capi.event" }],
    concurrency: {
      limit: 25, // Unlocked on self-hosted Inngest (allows high-parallel ad traffic)
    },
    batchEvents: {
      maxSize: 50, // Batch up to 50 events per Meta CAPI dispatch (reducing Lambda invocations)
      timeout: "5s",
    },
    throttle: {
      limit: 25,
      period: "1s",
    },
  },
  async ({ events, step }) => {
    return await step.run("dispatch-batch-to-meta", async () => {
      return await dispatchMetaCapiBatch(events);
    });
  }
);
