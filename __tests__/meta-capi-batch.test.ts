import { beforeEach, describe, expect, it, vi } from "vitest";
import { NonRetriableError } from "inngest";

const { mockSendCapiEvents } = vi.hoisted(() => ({
  mockSendCapiEvents: vi.fn(),
}));

vi.mock("@/lib/facebook-capi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/facebook-capi")>();
  return {
    ...actual,
    sendCapiEvents: mockSendCapiEvents,
  };
});

import {
  dispatchMetaCapiBatch,
  type MetaCapiGroupOutcome,
  type MetaCapiStepRunner,
} from "@/lib/inngest/functions/meta-capi-batch";

function createMemoizedStepRunner(): {
  runStep: MetaCapiStepRunner;
  memo: Map<string, MetaCapiGroupOutcome>;
} {
  const memo = new Map<string, MetaCapiGroupOutcome>();
  const runStep: MetaCapiStepRunner = async (id, fn) => {
    if (memo.has(id)) {
      return memo.get(id)!;
    }
    const result = await fn();
    memo.set(id, result);
    return result;
  };
  return { runStep, memo };
}

const sampleEvent = (id: string) => ({
  eventName: "PageView" as const,
  eventId: id,
  eventSourceUrl: "https://khatikhejurgur.shop/",
  userData: { client_ip_address: "103.10.20.1" },
});

describe("dispatchMetaCapiBatch retry & error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches a valid batch and returns processed count and Meta response", async () => {
    mockSendCapiEvents.mockResolvedValueOnce({
      success: true,
      data: { events_received: 2 },
    });

    const result = await dispatchMetaCapiBatch([
      { data: { event: sampleEvent("evt-1") } },
      { data: { event: sampleEvent("evt-2") } },
    ]);

    expect(mockSendCapiEvents).toHaveBeenCalledTimes(1);
    expect(mockSendCapiEvents).toHaveBeenCalledWith(
      [sampleEvent("evt-1"), sampleEvent("evt-2")],
      undefined
    );
    expect(result).toEqual({
      success: true,
      processedCount: 2,
      metaResponse: { events_received: 2 },
    });
  });

  it("returns processedCount 0 without calling Meta when batch has no valid events", async () => {
    const result = await dispatchMetaCapiBatch([{ data: {} }, {}]);
    expect(result).toEqual({ success: true, processedCount: 0 });
    expect(mockSendCapiEvents).not.toHaveBeenCalled();
  });

  it("throws a retriable Error on Meta 5xx, 429, network, or is_transient failures", async () => {
    const transientCases = [
      { success: false, status: 500, error: "Internal error" },
      { success: false, status: 429, error: "Too many requests" },
      { success: false, error: "Network timeout" },
      {
        success: false,
        status: 400,
        error: "Temporary issue",
        data: { error: { is_transient: true } },
      },
    ];

    for (const failure of transientCases) {
      mockSendCapiEvents.mockResolvedValueOnce(failure);
      let caught: unknown;
      try {
        await dispatchMetaCapiBatch([{ data: { event: sampleEvent("evt-retry") } }]);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(Error);
      expect(caught).not.toBeInstanceOf(NonRetriableError);
      expect((caught as Error).message).toBe(failure.error);
    }
  });

  it("throws NonRetriableError on missing token or permanent 4xx Meta error", async () => {
    const permanentCases = [
      { success: false, error: "FACEBOOK_CAPI_ACCESS_TOKEN is not configured" },
      { success: false, status: 400, error: "Invalid parameter" },
      { success: false, status: 401, error: "Invalid OAuth access token" },
    ];

    for (const failure of permanentCases) {
      mockSendCapiEvents.mockResolvedValueOnce(failure);
      await expect(
        dispatchMetaCapiBatch([{ data: { event: sampleEvent("evt-perm") } }])
      ).rejects.toThrow(NonRetriableError);
    }
  });

  it("groups events by explicit testEventCode when present", async () => {
    mockSendCapiEvents
      .mockResolvedValueOnce({ success: true, data: { events_received: 1 } })
      .mockResolvedValueOnce({ success: true, data: { events_received: 1 } });

    const result = await dispatchMetaCapiBatch([
      { data: { event: sampleEvent("evt-prod") } },
      { data: { event: sampleEvent("evt-test"), testEventCode: "TEST999" } },
    ]);

    expect(mockSendCapiEvents).toHaveBeenCalledTimes(2);
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(1, [sampleEvent("evt-prod")], undefined);
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(2, [sampleEvent("evt-test")], {
      testEventCode: "TEST999",
    });
    expect(result.processedCount).toBe(2);
  });

  it("still sends a valid production group when a preceding test group permanently fails, then propagates NonRetriableError", async () => {
    mockSendCapiEvents
      .mockResolvedValueOnce({
        success: false,
        status: 400,
        error: "Invalid test_event_code",
      })
      .mockResolvedValueOnce({
        success: true,
        data: { events_received: 2 },
      });

    const { runStep, memo } = createMemoizedStepRunner();

    await expect(
      dispatchMetaCapiBatch(
        [
          { data: { event: sampleEvent("evt-test-bad"), testEventCode: "BAD_TEST" } },
          { data: { event: sampleEvent("evt-prod-1") } },
          { data: { event: sampleEvent("evt-prod-2") } },
        ],
        runStep
      )
    ).rejects.toThrow(NonRetriableError);

    expect(mockSendCapiEvents).toHaveBeenCalledTimes(2);
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(1, [sampleEvent("evt-test-bad")], {
      testEventCode: "BAD_TEST",
    });
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(
      2,
      [sampleEvent("evt-prod-1"), sampleEvent("evt-prod-2")],
      undefined
    );
    expect(memo.get("dispatch-batch-to-meta")).toEqual({
      success: true,
      testEventCode: null,
      processedCount: 2,
      metaResponse: { events_received: 2 },
    });
    expect(memo.get("dispatch-batch-to-meta:BAD_TEST")).toEqual({
      success: false,
      nonRetriable: true,
      testEventCode: "BAD_TEST",
      eventCount: 1,
      error: "Invalid test_event_code",
    });
  });

  it("preserves successful group results across enclosing retries without re-sending them", async () => {
    mockSendCapiEvents
      .mockResolvedValueOnce({
        success: true,
        data: { events_received: 1 },
      })
      .mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "Meta temporary outage",
      })
      .mockResolvedValueOnce({
        success: true,
        data: { events_received: 1 },
      });

    const { runStep } = createMemoizedStepRunner();
    const batch = [
      { data: { event: sampleEvent("evt-prod") } },
      { data: { event: sampleEvent("evt-test"), testEventCode: "TEST_RETRY" } },
    ];

    // First attempt: prod succeeds (memoized), test group fails transiently
    await expect(dispatchMetaCapiBatch(batch, runStep)).rejects.toThrow("Meta temporary outage");

    // Second attempt (enclosing retry): prod is replayed from step memo, only test group retries
    const finalResult = await dispatchMetaCapiBatch(batch, runStep);

    expect(mockSendCapiEvents).toHaveBeenCalledTimes(3);
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(1, [sampleEvent("evt-prod")], undefined);
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(2, [sampleEvent("evt-test")], {
      testEventCode: "TEST_RETRY",
    });
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(3, [sampleEvent("evt-test")], {
      testEventCode: "TEST_RETRY",
    });
    expect(finalResult).toEqual({
      success: true,
      processedCount: 2,
      metaResponse: [{ events_received: 1 }, { events_received: 1 }],
    });
  });

  it("retries a transiently failing production group after a permanently failing test group without re-sending the failed test group", async () => {
    mockSendCapiEvents
      .mockResolvedValueOnce({
        success: false,
        status: 400,
        error: "Invalid test_event_code",
      })
      .mockResolvedValueOnce({
        success: false,
        status: 503,
        error: "Service unavailable",
      })
      .mockResolvedValueOnce({
        success: true,
        data: { events_received: 1 },
      });

    const { runStep } = createMemoizedStepRunner();
    const batch = [
      { data: { event: sampleEvent("evt-test-bad"), testEventCode: "BAD_TEST" } },
      { data: { event: sampleEvent("evt-prod") } },
    ];

    // Attempt 1: permanent failure is recorded/memoized, prod fails transiently -> retriable Error
    let firstErr: unknown;
    try {
      await dispatchMetaCapiBatch(batch, runStep);
    } catch (err) {
      firstErr = err;
    }
    expect(firstErr).toBeInstanceOf(Error);
    expect(firstErr).not.toBeInstanceOf(NonRetriableError);
    expect((firstErr as Error).message).toBe("Service unavailable");

    // Attempt 2: BAD_TEST is replayed from memo (not re-sent), prod retries & succeeds, then NonRetriableError propagates
    await expect(dispatchMetaCapiBatch(batch, runStep)).rejects.toThrow(NonRetriableError);

    expect(mockSendCapiEvents).toHaveBeenCalledTimes(3);
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(1, [sampleEvent("evt-test-bad")], {
      testEventCode: "BAD_TEST",
    });
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(2, [sampleEvent("evt-prod")], undefined);
    expect(mockSendCapiEvents).toHaveBeenNthCalledWith(3, [sampleEvent("evt-prod")], undefined);
  });
});
