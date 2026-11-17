import { NonRetriableError, StepError } from "inngest";
import { inngest } from "@/lib/inngest/client";
import { sendCapiEvents, type CapiEventParams } from "@/lib/facebook-capi";
import type { MetaCapiEventData } from "@/lib/inngest/events";

export type MetaCapiGroupOutcome =
  | {
      success: true;
      testEventCode: string | null;
      processedCount: number;
      metaResponse: any;
    }
  | {
      success: false;
      nonRetriable: true;
      testEventCode: string | null;
      eventCount: number;
      error: string;
    };

export type MetaCapiStepRunner = (
  id: string,
  fn: () => Promise<MetaCapiGroupOutcome>
) => Promise<MetaCapiGroupOutcome>;

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
  events: Array<{ data?: unknown }>,
  runStep: MetaCapiStepRunner = (_id, fn) => fn()
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
  const retriableFailures: string[] = [];
  const permanentFailures: string[] = [];

  for (const [testEventCode, capiEventList] of groups.entries()) {
    const stepId = testEventCode
      ? `dispatch-batch-to-meta:${testEventCode}`
      : "dispatch-batch-to-meta";

    try {
      const outcome = await runStep(stepId, async (): Promise<MetaCapiGroupOutcome> => {
        const result = await sendCapiEvents(
          capiEventList,
          testEventCode ? { testEventCode } : undefined
        );

        if (!result.success) {
          const errorMessage = result.error || "Meta CAPI batch dispatch failed";
          if (isNonRetriableMetaFailure(result)) {
            return {
              success: false,
              nonRetriable: true,
              testEventCode: testEventCode || null,
              eventCount: capiEventList.length,
              error: errorMessage,
            };
          }
          throw new Error(errorMessage);
        }

        return {
          success: true,
          testEventCode: testEventCode || null,
          processedCount: capiEventList.length,
          metaResponse: result.data,
        };
      });

      if (outcome.success) {
        processedCount += outcome.processedCount;
        responses.push(outcome.metaResponse);
      } else {
        permanentFailures.push(outcome.error);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err || "Meta CAPI batch dispatch failed");
      if (err instanceof NonRetriableError || err instanceof StepError) {
        permanentFailures.push(errorMessage);
      } else {
        retriableFailures.push(errorMessage);
      }
    }
  }

  if (retriableFailures.length > 0) {
    throw new Error(retriableFailures.join("; "));
  }

  if (permanentFailures.length > 0) {
    throw new NonRetriableError(permanentFailures.join("; "));
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
    return await dispatchMetaCapiBatch(events, (id, fn) => step.run(id, fn));
  }
);
